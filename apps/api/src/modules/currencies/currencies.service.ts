import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() { return this.prisma.currency.findMany({ orderBy: { code: 'asc' } }); }

  async getRate(fromCode: string, toCode: string, date?: Date) {
    const effectiveDate = date ?? new Date();
    const from = await this.prisma.currency.findFirst({ where: { code: fromCode } });
    const to = await this.prisma.currency.findFirst({ where: { code: toCode } });
    if (!from || !to) throw new NotFoundException('Currency not found');

    const rate = await this.prisma.exchangeRate.findFirst({
      where: { fromCurrencyId: from.id, toCurrencyId: to.id, effectiveDate: { lte: effectiveDate } },
      orderBy: { effectiveDate: 'desc' },
    });
    return rate;
  }

  async setRate(dto: { fromCode: string; toCode: string; rate: string; effectiveDate: string }) {
    const from = await this.prisma.currency.findFirstOrThrow({ where: { code: dto.fromCode } });
    const to = await this.prisma.currency.findFirstOrThrow({ where: { code: dto.toCode } });
    return this.prisma.exchangeRate.create({
      data: { fromCurrencyId: from.id, toCurrencyId: to.id, rate: dto.rate, effectiveDate: new Date(dto.effectiveDate) },
    });
  }

  async getRateHistory(fromCode: string, toCode: string) {
    const from = await this.prisma.currency.findFirst({ where: { code: fromCode } });
    const to = await this.prisma.currency.findFirst({ where: { code: toCode } });
    if (!from || !to) return [];
    return this.prisma.exchangeRate.findMany({
      where: { fromCurrencyId: from.id, toCurrencyId: to.id },
      orderBy: { effectiveDate: 'desc' },
      take: 30,
    });
  }
}
