import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.accountingPeriod.findMany({ where: { companyId }, orderBy: { startDate: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    const period = await this.prisma.accountingPeriod.findFirst({ where: { id, companyId } });
    if (!period) throw new NotFoundException('Accounting period not found');
    return period;
  }

  create(companyId: string, dto: { name: string; startDate: string; endDate: string }) {
    return this.prisma.accountingPeriod.create({
      data: { companyId, name: dto.name, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate), status: 'OPEN' },
    });
  }

  async softClose(id: string, companyId: string) {
    const period = await this.prisma.accountingPeriod.findFirst({ where: { id, companyId } });
    if (!period) throw new NotFoundException('Period not found');
    if (period.status !== 'OPEN') throw new BadRequestException('Only OPEN periods can be soft-closed');
    return this.prisma.accountingPeriod.update({ where: { id }, data: { status: 'SOFT_CLOSED' } });
  }

  async hardClose(id: string, companyId: string) {
    const period = await this.prisma.accountingPeriod.findFirst({ where: { id, companyId } });
    if (!period) throw new NotFoundException('Period not found');
    if (period.status === 'HARD_CLOSED') throw new BadRequestException('Period is already hard-closed');

    // Verify no unposted journal entries
    const draftEntries = await this.prisma.journalEntry.count({ where: { companyId, periodId: id, status: 'DRAFT' } });
    if (draftEntries > 0) throw new BadRequestException(`${draftEntries} unposted journal entries exist in this period`);

    return this.prisma.accountingPeriod.update({ where: { id }, data: { status: 'HARD_CLOSED' } });
  }

  async reopen(id: string, companyId: string) {
    const period = await this.prisma.accountingPeriod.findFirst({ where: { id, companyId } });
    if (!period) throw new NotFoundException('Period not found');
    if (period.status === 'HARD_CLOSED') throw new BadRequestException('Hard-closed periods cannot be reopened without override permission');
    return this.prisma.accountingPeriod.update({ where: { id }, data: { status: 'OPEN' } });
  }

  async getOpenPeriod(companyId: string, date?: Date) {
    const d = date ?? new Date();
    return this.prisma.accountingPeriod.findFirst({
      where: { companyId, startDate: { lte: d }, endDate: { gte: d }, status: { not: 'HARD_CLOSED' } },
    });
  }
}
