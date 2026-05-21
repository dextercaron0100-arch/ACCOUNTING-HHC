import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../common/prisma/prisma.service';
import { validateDoubleEntry } from '../../common/utils/double-entry.validator';
import { checkPeriodOpen } from '../../common/utils/period-lock.checker';
import { getPaginationParams, buildPaginatedResponse } from '../../common/utils/pagination.helper';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: { page?: number; limit?: number; status?: string; dateFrom?: string; dateTo?: string },
  ) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where = {
      companyId,
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            date: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [total, entries] = await Promise.all([
      this.prisma.journalEntry.count({ where }),
      this.prisma.journalEntry.findMany({
        where,
        include: {
          period: true,
          creator: { select: { id: true, firstName: true, lastName: true } },
          lines: { include: { account: { select: { id: true, code: true, name: true } } }, orderBy: { lineNo: 'asc' } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
    ]);

    const enriched = entries.map((e) => ({
      ...e,
      totalDebits: e.lines.reduce((s, l) => s.plus(l.debitAmount), new Decimal(0)).toFixed(4),
      totalCredits: e.lines.reduce((s, l) => s.plus(l.creditAmount), new Decimal(0)).toFixed(4),
    }));

    return buildPaginatedResponse(enriched, total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        period: true,
        creator: { select: { id: true, firstName: true, lastName: true } },
        lines: {
          include: { account: { select: { id: true, code: true, name: true } }, currency: true },
          orderBy: { lineNo: 'asc' },
        },
      },
    });
    if (!entry) throw new NotFoundException('Journal entry not found');
    return entry;
  }

  async create(companyId: string, userId: string, dto: CreateJournalEntryDto, userPermissions: string[] = []) {
    validateDoubleEntry(dto.lines);

    const date = new Date(dto.date);
    await checkPeriodOpen(this.prisma, companyId, date, userPermissions);

    const period = await this.prisma.accountingPeriod.findFirst({
      where: { companyId, startDate: { lte: date }, endDate: { gte: date } },
    });
    if (!period) throw new BadRequestException('No accounting period for this date');

    // Verify all accounts belong to company
    const accountIds = [...new Set(dto.lines.map((l) => l.accountId))];
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds }, companyId },
    });
    if (accounts.length !== accountIds.length) {
      throw new BadRequestException('One or more account IDs are invalid');
    }

    return this.prisma.journalEntry.create({
      data: {
        companyId,
        periodId: dto.periodId ?? period.id,
        reference: dto.reference,
        date,
        description: dto.description,
        status: 'DRAFT',
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        createdBy: userId,
        lines: {
          create: dto.lines.map((line, i) => ({
            accountId: line.accountId,
            currencyId: line.currencyId,
            exchangeRate: line.exchangeRate ?? 1,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            basDebitAmount: line.debitAmount,
            basCreditAmount: line.creditAmount,
            memo: line.memo,
            lineNo: line.lineNo ?? i + 1,
          })),
        },
      },
      include: {
        lines: { include: { account: { select: { id: true, code: true, name: true } } } },
      },
    });
  }

  async post(id: string, companyId: string, userId: string, userPermissions: string[] = []) {
    const entry = await this.findOne(id, companyId);
    if (entry.status !== 'DRAFT') throw new BadRequestException('Only DRAFT entries can be posted');

    await checkPeriodOpen(this.prisma, companyId, new Date(entry.date), userPermissions);
    validateDoubleEntry(entry.lines.map((l) => ({
      debitAmount: l.debitAmount.toString(),
      creditAmount: l.creditAmount.toString(),
    })));

    const posted = await this.prisma.journalEntry.update({
      where: { id },
      data: { status: 'POSTED', postedAt: new Date(), postedBy: userId },
    });

    // Update ledger balances
    await this.updateLedgerBalances(entry.periodId, entry.lines as never[]);

    return posted;
  }

  async reverse(id: string, companyId: string, userId: string, description?: string) {
    const entry = await this.findOne(id, companyId);
    if (entry.status !== 'POSTED') throw new BadRequestException('Only POSTED entries can be reversed');

    const reversalLines = entry.lines.map((l, i) => ({
      accountId: l.accountId,
      currencyId: l.currencyId,
      exchangeRate: l.exchangeRate ?? 1,
      debitAmount: l.creditAmount,
      creditAmount: l.debitAmount,
      basDebitAmount: l.creditAmount,
      basCreditAmount: l.debitAmount,
      memo: l.memo ? `Reversal: ${l.memo}` : 'Reversal entry',
      lineNo: i + 1,
    }));

    const reversal = await this.prisma.journalEntry.create({
      data: {
        companyId,
        periodId: entry.periodId,
        reference: `REV-${entry.reference}`,
        date: new Date(),
        description: description ?? `Reversal of ${entry.reference}`,
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: userId,
        reversalOf: id,
        createdBy: userId,
        lines: { create: reversalLines },
      },
      include: {
        lines: { include: { account: { select: { id: true, code: true, name: true } } } },
      },
    });

    await this.prisma.journalEntry.update({ where: { id }, data: { status: 'REVERSED' } });
    await this.updateLedgerBalances(entry.periodId, reversal.lines as never[]);

    return reversal;
  }

  private async updateLedgerBalances(
    periodId: string,
    lines: Array<{ accountId: string; debitAmount: { toNumber: () => number }; creditAmount: { toNumber: () => number } }>,
  ) {
    for (const line of lines) {
      await this.prisma.ledgerBalance.upsert({
        where: { accountId_periodId: { accountId: line.accountId, periodId } },
        create: {
          accountId: line.accountId,
          periodId,
          openingBalance: 0,
          debitTotal: line.debitAmount.toNumber(),
          creditTotal: line.creditAmount.toNumber(),
          closingBalance: new Decimal(line.debitAmount.toNumber()).minus(line.creditAmount.toNumber()).toNumber(),
        },
        update: {
          debitTotal: { increment: line.debitAmount.toNumber() },
          creditTotal: { increment: line.creditAmount.toNumber() },
          closingBalance: { increment: new Decimal(line.debitAmount.toNumber()).minus(line.creditAmount.toNumber()).toNumber() },
        },
      });
    }
  }
}
