import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import Decimal from 'decimal.js';

@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string) { return this.prisma.taxCode.findMany({ where: { companyId }, orderBy: { code: 'asc' } }); }

  async findOne(id: string, companyId: string) {
    const tax = await this.prisma.taxCode.findFirst({ where: { id, companyId } });
    if (!tax) throw new NotFoundException('Tax code not found');
    return tax;
  }

  create(companyId: string, dto: { code: string; name: string; rate: string; type: string; glAccountId?: string; jurisdiction?: string }) {
    return this.prisma.taxCode.create({ data: { ...dto, companyId } });
  }

  computeTax(amount: string, taxCodeId: string, companyId: string) {
    return this.prisma.taxCode.findFirst({ where: { id: taxCodeId, companyId } }).then((tc) => {
      if (!tc) throw new NotFoundException('Tax code not found');
      const base = new Decimal(amount);
      const taxAmount = base.mul(tc.rate.toString());
      return { base: base.toFixed(2), rate: tc.rate.toString(), taxAmount: taxAmount.toFixed(2), total: base.plus(taxAmount).toFixed(2) };
    });
  }

  async getBirSummary(companyId: string, year: number) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);

    const vatOutput = await this.prisma.invoiceLine.aggregate({
      where: { invoice: { companyId, type: 'SALE', date: { gte: start, lte: end } }, taxCode: { code: 'VAT12' } },
      _sum: { taxAmount: true },
    });

    const vatInput = await this.prisma.invoiceLine.aggregate({
      where: { invoice: { companyId, type: 'PURCHASE', date: { gte: start, lte: end } }, taxCode: { code: 'VATIN' } },
      _sum: { taxAmount: true },
    });

    const outputVat = new Decimal((vatOutput._sum.taxAmount ?? 0).toString());
    const inputVat = new Decimal((vatInput._sum.taxAmount ?? 0).toString());

    return {
      year,
      outputVat: outputVat.toFixed(2),
      inputVat: inputVat.toFixed(2),
      vatPayable: outputVat.minus(inputVat).toFixed(2),
      forms: ['BIR Form 2550M (Monthly VAT)', 'BIR Form 2550Q (Quarterly VAT)', 'BIR Form 1601-C (Withholding Tax on Compensation)'],
    };
  }
}
