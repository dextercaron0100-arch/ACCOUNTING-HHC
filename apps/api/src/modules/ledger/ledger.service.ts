import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getPaginationParams, buildPaginatedResponse } from '../../common/utils/pagination.helper';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async getGeneralLedger(
    companyId: string,
    accountId: string,
    query: { page?: number; limit?: number; dateFrom?: string; dateTo?: string },
  ) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where = {
      accountId,
      entry: {
        companyId,
        status: 'POSTED' as const,
        deletedAt: null,
        ...(query.dateFrom || query.dateTo
          ? {
              date: {
                ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
                ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
              },
            }
          : {}),
      },
    };

    const [total, lines] = await Promise.all([
      this.prisma.journalEntryLine.count({ where }),
      this.prisma.journalEntryLine.findMany({
        where,
        include: {
          entry: { select: { id: true, reference: true, date: true, description: true, sourceType: true } },
        },
        orderBy: [{ entry: { date: 'asc' } }],
        skip,
        take,
      }),
    ]);

    // Compute running balance
    let runningBalance = new Decimal(0);
    const account = await this.prisma.account.findFirst({
      where: { id: accountId },
      include: { accountType: true },
    });

    const isDebitNormal = account?.normalBalance === 'DEBIT';
    const enriched = lines.map((line) => {
      const debit = new Decimal(line.debitAmount.toString());
      const credit = new Decimal(line.creditAmount.toString());
      runningBalance = isDebitNormal
        ? runningBalance.plus(debit).minus(credit)
        : runningBalance.minus(debit).plus(credit);

      return { ...line, runningBalance: runningBalance.toFixed(4) };
    });

    return buildPaginatedResponse(enriched, total, page, limit);
  }

  async getTrialBalance(companyId: string, periodId: string) {
    const balances = await this.prisma.ledgerBalance.findMany({
      where: { periodId, account: { companyId } },
      include: { account: { include: { accountType: true } } },
      orderBy: [{ account: { code: 'asc' } }],
    });

    const totals = balances.reduce(
      (acc, b) => {
        const closing = new Decimal(b.closingBalance.toString());
        if (closing.gt(0)) acc.totalDebits = acc.totalDebits.plus(closing);
        else acc.totalCredits = acc.totalCredits.plus(closing.abs());
        return acc;
      },
      { totalDebits: new Decimal(0), totalCredits: new Decimal(0) },
    );

    return {
      balances,
      totalDebits: totals.totalDebits.toFixed(4),
      totalCredits: totals.totalCredits.toFixed(4),
      isBalanced: totals.totalDebits.equals(totals.totalCredits),
    };
  }

  async getArSubLedger(companyId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { companyId },
      include: {
        invoices: {
          where: { status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
          select: { id: true, invoiceNo: true, date: true, dueDate: true, total: true, paidAmount: true },
        },
      },
    });

    return customers.map((c) => ({
      ...c,
      totalOutstanding: c.invoices.reduce(
        (s, inv) => s.plus(new Decimal(inv.total.toString()).minus(inv.paidAmount.toString())),
        new Decimal(0),
      ).toFixed(4),
    }));
  }

  async getApSubLedger(companyId: string) {
    const vendors = await this.prisma.vendor.findMany({
      where: { companyId },
      include: {
        invoices: {
          where: { status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
          select: { id: true, invoiceNo: true, date: true, dueDate: true, total: true, paidAmount: true },
        },
      },
    });

    return vendors.map((v) => ({
      ...v,
      totalOutstanding: v.invoices.reduce(
        (s, inv) => s.plus(new Decimal(inv.total.toString()).minus(inv.paidAmount.toString())),
        new Decimal(0),
      ).toFixed(4),
    }));
  }
}
