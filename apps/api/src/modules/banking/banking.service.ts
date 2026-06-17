import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getPaginationParams, buildPaginatedResponse } from '../../common/utils/pagination.helper';
import Decimal from 'decimal.js';

@Injectable()
export class BankingService {
  constructor(private readonly prisma: PrismaService) {}

  async findBankAccounts(companyId: string) {
    return this.prisma.bankAccount.findMany({ where: { companyId }, include: { glAccount: true } });
  }

  async createBankAccount(companyId: string, dto: { name: string; accountNo: string; glAccountId: string; currencyId: string }) {
    return this.prisma.bankAccount.create({ data: { ...dto, companyId } });
  }

  async findTransactions(bankAccountId: string, query: { page?: number; status?: string }) {
    const { skip, take, page, limit } = getPaginationParams(query);
    const where: Record<string, unknown> = { statement: { bankAccountId } };
    if (query.status) where.status = query.status;

    const [total, data] = await Promise.all([
      this.prisma.bankTransaction.count({ where }),
      this.prisma.bankTransaction.findMany({ where, skip, take, orderBy: { date: 'desc' } }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async importStatement(
    bankAccountId: string,
    companyId: string,
    dto: {
      periodStart: string;
      periodEnd: string;
      transactions: Array<{ date: string; description: string; amount: string }>;
    },
  ) {
    const bankAccount = await this.prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId } });
    if (!bankAccount) throw new NotFoundException('Bank account not found');

    const statement = await this.prisma.bankStatement.create({
      data: {
        bankAccountId,
        importDate: new Date(),
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        status: 'OPEN',
      },
    });

    const transactions = await this.prisma.bankTransaction.createMany({
      data: dto.transactions.map((t) => ({
        statementId: statement.id,
        date: new Date(t.date),
        description: t.description,
        amount: new Decimal(t.amount).toFixed(4),
        status: 'UNMATCHED',
      })),
    });

    // Auto-match by amount + date ±1 day against posted journal entry lines
    await this.autoMatch(bankAccountId, statement.id);

    return { statement, imported: transactions.count };
  }

  private async autoMatch(bankAccountId: string, statementId: string) {
    const unmatched = await this.prisma.bankTransaction.findMany({ where: { statementId, status: 'UNMATCHED' } });
    const bankAccount = await this.prisma.bankAccount.findUnique({ where: { id: bankAccountId }, include: { glAccount: true } });
    if (!bankAccount) return;

    for (const txn of unmatched) {
      const txnDate = new Date(txn.date);
      const dayBefore = new Date(txnDate); dayBefore.setDate(dayBefore.getDate() - 1);
      const dayAfter = new Date(txnDate); dayAfter.setDate(dayAfter.getDate() + 1);
      const txnAmount = new Decimal(txn.amount.toString());

      // Find journal entry line with matching amount on the bank's GL account
      const matchingLine = await this.prisma.journalEntryLine.findFirst({
        where: {
          accountId: bankAccount.glAccountId ?? undefined,
          entry: { date: { gte: dayBefore, lte: dayAfter }, status: 'POSTED' },
          OR: [
            { debitAmount: { equals: txnAmount.abs().toFixed(4) as never } },
            { creditAmount: { equals: txnAmount.abs().toFixed(4) as never } },
          ],
        },
        include: { entry: true },
      });

      if (matchingLine) {
        await this.prisma.bankTransaction.update({
          where: { id: txn.id },
          data: { status: 'MATCHED', matchedEntryId: matchingLine.entryId },
        });
      }
    }
  }

  async matchTransaction(txnId: string, journalEntryId: string) {
    const txn = await this.prisma.bankTransaction.findUnique({ where: { id: txnId } });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (txn.status === 'MATCHED') throw new BadRequestException('Transaction already matched');

    return this.prisma.bankTransaction.update({
      where: { id: txnId },
      data: { status: 'MATCHED', matchedEntryId: journalEntryId },
    });
  }

  async unmatchTransaction(txnId: string) {
    return this.prisma.bankTransaction.update({
      where: { id: txnId },
      data: { status: 'UNMATCHED', matchedEntryId: null },
    });
  }

  async lockReconciliation(bankAccountId: string, periodId: string, userId: string) {
    const unmatched = await this.prisma.bankTransaction.count({
      where: { statement: { bankAccountId }, status: 'UNMATCHED' },
    });
    if (unmatched > 0) throw new BadRequestException(`${unmatched} unmatched transactions remain — reconcile before locking`);

    return this.prisma.reconciliation.create({
      data: { bankAccountId, periodId, status: 'LOCKED', lockedAt: new Date(), lockedBy: userId },
    });
  }

  async getReconciliationSummary(bankAccountId: string) {
    const [total, matched, unmatched] = await Promise.all([
      this.prisma.bankTransaction.count({ where: { statement: { bankAccountId } } }),
      this.prisma.bankTransaction.count({ where: { statement: { bankAccountId }, status: 'MATCHED' } }),
      this.prisma.bankTransaction.count({ where: { statement: { bankAccountId }, status: 'UNMATCHED' } }),
    ]);
    return { total, matched, unmatched, matchRate: total > 0 ? ((matched / total) * 100).toFixed(1) : '0.0' };
  }
}
