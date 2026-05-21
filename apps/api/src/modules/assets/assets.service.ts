import { Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.asset.findMany({
      where: { companyId, status: { not: 'DISPOSED' } },
      orderBy: { assetCode: 'asc' },
    });
  }

  async create(companyId: string, dto: Record<string, unknown>) {
    return this.prisma.asset.create({ data: { ...dto, companyId } as never });
  }

  async computeDepreciation(assetId: string, periodId: string): Promise<Decimal> {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset not found');

    const cost = new Decimal(asset.acquisitionCost.toString());
    const residual = new Decimal(asset.residualValue.toString());
    const depreciableAmount = cost.minus(residual);

    if (asset.depreciationMethod === 'STRAIGHT_LINE') {
      return depreciableAmount.div(asset.usefulLifeMonths);
    }

    if (asset.depreciationMethod === 'DECLINING_BALANCE') {
      const rate = new Decimal(asset.decliningRate?.toString() ?? '0.2');
      // Book value = cost - accumulated depreciation
      const accumulated = await this.prisma.assetDepreciationSchedule.aggregate({
        where: { assetId },
        _sum: { depreciationAmount: true },
      });
      const accum = new Decimal(accumulated._sum.depreciationAmount?.toString() ?? '0');
      const bookValue = cost.minus(accum);
      return bookValue.mul(rate).div(12);
    }

    return depreciableAmount.div(asset.usefulLifeMonths);
  }

  async postMonthlyDepreciation(companyId: string, periodId: string, userId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { companyId, status: 'ACTIVE' },
    });

    const results = [];

    for (const asset of assets) {
      const existing = await this.prisma.assetDepreciationSchedule.findUnique({
        where: { assetId_periodId: { assetId: asset.id, periodId } },
      });
      if (existing?.journalEntryId) continue;

      const depAmount = await this.computeDepreciation(asset.id, periodId);

      const accumulated = await this.prisma.assetDepreciationSchedule.aggregate({
        where: { assetId: asset.id },
        _sum: { depreciationAmount: true },
      });
      const prevAccum = new Decimal(accumulated._sum.depreciationAmount?.toString() ?? '0');
      const newAccum = prevAccum.plus(depAmount);
      const bookValue = new Decimal(asset.acquisitionCost.toString()).minus(newAccum);

      // Post journal entry if accounts are configured
      let journalEntryId: string | null = null;
      if (asset.depExpenseAccountId && asset.accumDepAccountId) {
        const entry = await this.prisma.journalEntry.create({
          data: {
            companyId,
            periodId,
            reference: `DEP-${asset.assetCode}-${periodId.slice(0, 8)}`,
            date: new Date(),
            description: `Monthly depreciation for ${asset.name}`,
            status: 'POSTED',
            postedAt: new Date(),
            postedBy: userId,
            sourceType: 'DEPRECIATION',
            sourceId: asset.id,
            createdBy: userId,
            lines: {
              create: [
                { accountId: asset.depExpenseAccountId, debitAmount: depAmount.toFixed(4), creditAmount: '0', basDebitAmount: depAmount.toFixed(4), basCreditAmount: '0', lineNo: 1 },
                { accountId: asset.accumDepAccountId, debitAmount: '0', creditAmount: depAmount.toFixed(4), basDebitAmount: '0', basCreditAmount: depAmount.toFixed(4), lineNo: 2 },
              ],
            },
          },
        });
        journalEntryId = entry.id;
      }

      const schedule = await this.prisma.assetDepreciationSchedule.upsert({
        where: { assetId_periodId: { assetId: asset.id, periodId } },
        create: { assetId: asset.id, periodId, depreciationAmount: depAmount.toFixed(4), accumulatedDep: newAccum.toFixed(4), bookValue: bookValue.toFixed(4), journalEntryId, postedAt: new Date() },
        update: { depreciationAmount: depAmount.toFixed(4), accumulatedDep: newAccum.toFixed(4), bookValue: bookValue.toFixed(4), journalEntryId, postedAt: new Date() },
      });

      results.push(schedule);
    }

    return { processed: results.length, schedules: results };
  }

  async dispose(assetId: string, companyId: string, dto: { date: string; proceeds: string; userId: string }) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, companyId } });
    if (!asset) throw new NotFoundException('Asset not found');

    const accumulated = await this.prisma.assetDepreciationSchedule.aggregate({
      where: { assetId },
      _sum: { depreciationAmount: true },
    });
    const accum = new Decimal(accumulated._sum.depreciationAmount?.toString() ?? '0');
    const bookValue = new Decimal(asset.acquisitionCost.toString()).minus(accum);
    const proceeds = new Decimal(dto.proceeds);
    const gainLoss = proceeds.minus(bookValue);

    const disposal = await this.prisma.assetDisposal.create({
      data: {
        assetId,
        date: new Date(dto.date),
        proceeds: proceeds.toFixed(4),
        bookValueAtDisposal: bookValue.toFixed(4),
        gainLoss: gainLoss.toFixed(4),
      },
    });

    await this.prisma.asset.update({ where: { id: assetId }, data: { status: 'DISPOSED' } });
    return disposal;
  }
}
