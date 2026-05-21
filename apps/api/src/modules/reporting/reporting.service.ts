import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import Decimal from 'decimal.js';

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardKpis(companyId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Revenue this month (credit balance on accounts 4xxx)
    const revenueAccounts = await this.prisma.account.findMany({
      where: { companyId, code: { startsWith: '4' }, isActive: true },
      select: { id: true },
    });
    const revenueIds = revenueAccounts.map((a) => a.id);

    // Expense this month (debit balance on accounts 5xxx, 6xxx)
    const expenseAccounts = await this.prisma.account.findMany({
      where: { companyId, OR: [{ code: { startsWith: '5' } }, { code: { startsWith: '6' } }], isActive: true },
      select: { id: true },
    });
    const expenseIds = expenseAccounts.map((a) => a.id);

    const [revLines, expLines, arBalance, apBalance, overdueInvoices] = await Promise.all([
      this.prisma.journalEntryLine.findMany({
        where: { accountId: { in: revenueIds }, entry: { companyId, date: { gte: startOfMonth }, status: 'POSTED' } },
        select: { creditAmount: true, debitAmount: true },
      }),
      this.prisma.journalEntryLine.findMany({
        where: { accountId: { in: expenseIds }, entry: { companyId, date: { gte: startOfMonth }, status: 'POSTED' } },
        select: { debitAmount: true, creditAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { companyId, type: 'SALE', status: { in: ['OPEN', 'PARTIAL'] } },
        _sum: { total: true, paidAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { companyId, type: 'PURCHASE', status: { in: ['OPEN', 'PARTIAL'] } },
        _sum: { total: true, paidAmount: true },
      }),
      this.prisma.invoice.count({ where: { companyId, type: 'SALE', dueDate: { lt: now }, status: { in: ['OPEN', 'PARTIAL'] } } }),
    ]);

    const revenue = revLines.reduce((s, l) => s.plus(l.creditAmount.toString()).minus(l.debitAmount.toString()), new Decimal(0));
    const expenses = expLines.reduce((s, l) => s.plus(l.debitAmount.toString()).minus(l.creditAmount.toString()), new Decimal(0));
    const arTotal = new Decimal((arBalance._sum.total ?? 0).toString()).minus((arBalance._sum.paidAmount ?? 0).toString());
    const apTotal = new Decimal((apBalance._sum.total ?? 0).toString()).minus((apBalance._sum.paidAmount ?? 0).toString());

    return {
      revenueThisMonth: revenue.toFixed(2),
      expensesThisMonth: expenses.toFixed(2),
      netIncomeThisMonth: revenue.minus(expenses).toFixed(2),
      arBalance: arTotal.toFixed(2),
      apBalance: apTotal.toFixed(2),
      overdueInvoices,
    };
  }

  async getCashTrend(companyId: string, months: number = 6) {
    const cashAccounts = await this.prisma.account.findMany({
      where: { companyId, code: { startsWith: '1000' } },
      select: { id: true },
    });
    const cashIds = cashAccounts.map((a) => a.id);

    const result: Array<{ month: string; inflow: string; outflow: string }> = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const lines = await this.prisma.journalEntryLine.findMany({
        where: { accountId: { in: cashIds }, entry: { companyId, date: { gte: d, lte: end }, status: 'POSTED' } },
        select: { debitAmount: true, creditAmount: true },
      });

      const inflow = lines.reduce((s, l) => s.plus(l.debitAmount.toString()), new Decimal(0));
      const outflow = lines.reduce((s, l) => s.plus(l.creditAmount.toString()), new Decimal(0));
      result.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, inflow: inflow.toFixed(2), outflow: outflow.toFixed(2) });
    }

    return result;
  }

  async getTopExpenses(companyId: string, limit: number = 5) {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const expenseAccounts = await this.prisma.account.findMany({
      where: { companyId, OR: [{ code: { startsWith: '5' } }, { code: { startsWith: '6' } }], isActive: true },
    });

    const results = await Promise.all(
      expenseAccounts.map(async (acc) => {
        const agg = await this.prisma.journalEntryLine.aggregate({
          where: { accountId: acc.id, entry: { companyId, date: { gte: startOfMonth }, status: 'POSTED' } },
          _sum: { debitAmount: true },
        });
        return { accountId: acc.id, accountName: acc.name, amount: new Decimal((agg._sum.debitAmount ?? 0).toString()).toFixed(2) };
      }),
    );

    return results.sort((a, b) => new Decimal(b.amount).minus(a.amount).toNumber()).slice(0, limit);
  }

  async getBudgetUtilization(companyId: string, periodId: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { companyId, periodId },
      include: { lines: { include: { account: true } } },
    });
    if (!budget) return [];

    const period = await this.prisma.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period) return [];

    return Promise.all(
      budget.lines.map(async (line) => {
        const actual = await this.prisma.journalEntryLine.aggregate({
          where: { accountId: line.accountId, entry: { companyId, date: { gte: period.startDate, lte: period.endDate }, status: 'POSTED' } },
          _sum: { debitAmount: true },
        });
        const actualAmt = new Decimal((actual._sum.debitAmount ?? 0).toString());
        const budgeted = new Decimal(line.amount.toString());
        return {
          accountId: line.accountId,
          accountName: line.account.name,
          budgeted: budgeted.toFixed(2),
          actual: actualAmt.toFixed(2),
          utilization: budgeted.gt(0) ? actualAmt.div(budgeted).mul(100).toFixed(1) : '0.0',
        };
      }),
    );
  }
}
