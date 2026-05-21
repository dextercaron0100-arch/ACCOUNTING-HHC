import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getPaginationParams, buildPaginatedResponse } from '../../common/utils/pagination.helper';

@Injectable()
export class ApService {
  constructor(private readonly prisma: PrismaService) {}

  async findVendors(companyId: string, query: { page?: number; limit?: number; search?: string }) {
    const { skip, take, page, limit } = getPaginationParams(query);
    const where = {
      companyId,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.vendor.count({ where }),
      this.prisma.vendor.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async createVendor(companyId: string, dto: Record<string, unknown>) {
    return this.prisma.vendor.create({ data: { ...dto, companyId } as never });
  }

  async findBills(companyId: string, query: { page?: number; limit?: number; status?: string; vendorId?: string }) {
    const { skip, take, page, limit } = getPaginationParams(query);
    const where = {
      companyId,
      type: 'PURCHASE' as const,
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: { vendor: true, currency: true, lines: true },
        skip,
        take,
        orderBy: { date: 'desc' },
      }),
    ]);
    const enriched = data.map((inv) => ({
      ...inv,
      balance: new Decimal(inv.total.toString()).minus(inv.paidAmount.toString()).toFixed(4),
    }));
    return buildPaginatedResponse(enriched, total, page, limit);
  }

  async getApAging(companyId: string) {
    const today = new Date();
    const invoices = await this.prisma.invoice.findMany({
      where: { companyId, type: 'PURCHASE', status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
      include: { vendor: true },
    });

    const buckets = { current: new Decimal(0), days1to30: new Decimal(0), days31to60: new Decimal(0), days61to90: new Decimal(0), over90: new Decimal(0) };

    const details = invoices.map((inv) => {
      const balance = new Decimal(inv.total.toString()).minus(inv.paidAmount.toString());
      const daysPastDue = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000);

      if (daysPastDue <= 0) buckets.current = buckets.current.plus(balance);
      else if (daysPastDue <= 30) buckets.days1to30 = buckets.days1to30.plus(balance);
      else if (daysPastDue <= 60) buckets.days31to60 = buckets.days31to60.plus(balance);
      else if (daysPastDue <= 90) buckets.days61to90 = buckets.days61to90.plus(balance);
      else buckets.over90 = buckets.over90.plus(balance);

      return { ...inv, balance: balance.toFixed(4), daysPastDue };
    });

    return {
      summary: {
        current: buckets.current.toFixed(4),
        days1to30: buckets.days1to30.toFixed(4),
        days31to60: buckets.days31to60.toFixed(4),
        days61to90: buckets.days61to90.toFixed(4),
        over90: buckets.over90.toFixed(4),
        total: Object.values(buckets).reduce((s, b) => s.plus(b), new Decimal(0)).toFixed(4),
      },
      details,
    };
  }
}
