import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class StatementsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getAccountBalance(companyId: string, accountCode: string, dateFrom: Date, dateTo: Date): Promise<Decimal> {
    const account = await this.prisma.account.findFirst({ where: { companyId, code: accountCode } });
    if (!account) return new Decimal(0);

    const lines = await this.prisma.journalEntryLine.aggregate({
      where: {
        accountId: account.id,
        entry: { companyId, status: 'POSTED', date: { gte: dateFrom, lte: dateTo }, deletedAt: null },
      },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const debits = new Decimal(lines._sum.debitAmount?.toString() ?? '0');
    const credits = new Decimal(lines._sum.creditAmount?.toString() ?? '0');
    return account.normalBalance === 'DEBIT' ? debits.minus(credits) : credits.minus(debits);
  }

  private async getAccountsByType(companyId: string, typeCode: string, dateFrom: Date, dateTo: Date) {
    const accounts = await this.prisma.account.findMany({
      where: { companyId, accountType: { code: typeCode as never }, parentId: null, deletedAt: null },
      include: {
        children: {
          include: { children: true },
          where: { deletedAt: null },
        },
      },
    });

    const enriched = await Promise.all(
      accounts.map(async (a) => {
        const balance = await this.getAccountBalance(companyId, a.code, dateFrom, dateTo);
        return { id: a.id, code: a.code, name: a.name, balance: balance.toFixed(4) };
      }),
    );

    return enriched.filter((a) => new Decimal(a.balance).abs().gt(0));
  }

  async getIncomeStatement(companyId: string, dateFrom: Date, dateTo: Date, compareDateFrom?: Date, compareDateTo?: Date) {
    const [income, cogs, expenses] = await Promise.all([
      this.getAccountsByType(companyId, 'INCOME', dateFrom, dateTo),
      this.getAccountsByType(companyId, 'EXPENSE', dateFrom, dateTo),
      this.getAccountsByType(companyId, 'EXPENSE', dateFrom, dateTo),
    ]);

    const totalRevenue = income.reduce((s, a) => s.plus(new Decimal(a.balance)), new Decimal(0));
    const totalExpenses = cogs.reduce((s, a) => s.plus(new Decimal(a.balance)), new Decimal(0));
    const netIncome = totalRevenue.minus(totalExpenses);

    let comparative = null;
    if (compareDateFrom && compareDateTo) {
      const [compIncome, compExpenses] = await Promise.all([
        this.getAccountsByType(companyId, 'INCOME', compareDateFrom, compareDateTo),
        this.getAccountsByType(companyId, 'EXPENSE', compareDateFrom, compareDateTo),
      ]);
      const compRevenue = compIncome.reduce((s, a) => s.plus(new Decimal(a.balance)), new Decimal(0));
      const compExpensesTotal = compExpenses.reduce((s, a) => s.plus(new Decimal(a.balance)), new Decimal(0));
      comparative = {
        revenue: compRevenue.toFixed(4),
        expenses: compExpensesTotal.toFixed(4),
        netIncome: compRevenue.minus(compExpensesTotal).toFixed(4),
        period: { from: compareDateFrom, to: compareDateTo },
      };
    }

    return {
      period: { from: dateFrom, to: dateTo },
      revenue: { items: income, total: totalRevenue.toFixed(4) },
      expenses: { items: expenses, total: totalExpenses.toFixed(4) },
      netIncome: netIncome.toFixed(4),
      comparative,
    };
  }

  async getBalanceSheet(companyId: string, asOfDate: Date) {
    const dateFrom = new Date('2000-01-01');

    const [assets, liabilities, equity] = await Promise.all([
      this.getAccountsByType(companyId, 'ASSET', dateFrom, asOfDate),
      this.getAccountsByType(companyId, 'LIABILITY', dateFrom, asOfDate),
      this.getAccountsByType(companyId, 'EQUITY', dateFrom, asOfDate),
    ]);

    const totalAssets = assets.reduce((s, a) => s.plus(new Decimal(a.balance)), new Decimal(0));
    const totalLiabilities = liabilities.reduce((s, a) => s.plus(new Decimal(a.balance)), new Decimal(0));
    const totalEquity = equity.reduce((s, a) => s.plus(new Decimal(a.balance)), new Decimal(0));

    return {
      asOfDate,
      assets: { items: assets, total: totalAssets.toFixed(4) },
      liabilities: { items: liabilities, total: totalLiabilities.toFixed(4) },
      equity: { items: equity, total: totalEquity.toFixed(4) },
      totalLiabilitiesAndEquity: totalLiabilities.plus(totalEquity).toFixed(4),
      isBalanced: totalAssets.eq(totalLiabilities.plus(totalEquity)),
    };
  }

  async getCashFlowStatement(companyId: string, dateFrom: Date, dateTo: Date) {
    // Indirect method: start with net income, adjust for non-cash items
    const incomeStatement = await this.getIncomeStatement(companyId, dateFrom, dateTo);
    const netIncome = new Decimal(incomeStatement.netIncome);

    // Depreciation (add back — non-cash)
    const depreciation = await this.getAccountBalance(companyId, '6005', dateFrom, dateTo);

    // AR change (increase in AR = cash outflow)
    const arChange = await this.getAccountBalance(companyId, '1100', dateFrom, dateTo);

    // AP change (increase in AP = cash inflow)
    const apChange = await this.getAccountBalance(companyId, '2000', dateFrom, dateTo);

    const operatingCashFlow = netIncome.plus(depreciation).minus(arChange).plus(apChange);

    return {
      period: { from: dateFrom, to: dateTo },
      operating: {
        netIncome: netIncome.toFixed(4),
        adjustments: [
          { label: 'Depreciation & Amortization', amount: depreciation.toFixed(4) },
          { label: 'Change in Accounts Receivable', amount: arChange.neg().toFixed(4) },
          { label: 'Change in Accounts Payable', amount: apChange.toFixed(4) },
        ],
        total: operatingCashFlow.toFixed(4),
      },
      investing: { items: [], total: '0.0000' },
      financing: { items: [], total: '0.0000' },
      netCashChange: operatingCashFlow.toFixed(4),
    };
  }
}
