import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getPaginationParams, buildPaginatedResponse } from '../../common/utils/pagination.helper';

@Injectable()
export class ArService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Customers ──────────────────────────────────────────────────────────────

  async findCustomers(companyId: string, query: { page?: number; limit?: number; search?: string }) {
    const { skip, take, page, limit } = getPaginationParams(query);
    const where = {
      companyId,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async createCustomer(companyId: string, dto: Record<string, unknown>) {
    return this.prisma.customer.create({ data: { ...dto, companyId } as never });
  }

  // ── Invoices ───────────────────────────────────────────────────────────────

  async findInvoices(companyId: string, query: { page?: number; limit?: number; status?: string; customerId?: string }) {
    const { skip, take, page, limit } = getPaginationParams(query);
    const where = {
      companyId,
      type: 'SALE' as const,
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: { customer: true, currency: true, lines: true },
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

  async createInvoice(companyId: string, dto: Record<string, unknown>) {
    const lines = (dto['lines'] as Record<string, unknown>[]) ?? [];
    const subtotal = lines.reduce(
      (s, l) => s.plus(new Decimal((l['amount'] as string) || '0')),
      new Decimal(0),
    );
    const taxAmount = lines.reduce(
      (s, l) => s.plus(new Decimal((l['taxAmount'] as string) || '0')),
      new Decimal(0),
    );
    const total = subtotal.plus(taxAmount);

    return this.prisma.invoice.create({
      data: {
        companyId,
        type: 'SALE',
        status: 'DRAFT',
        invoiceNo: dto['invoiceNo'] as string,
        date: new Date(dto['date'] as string),
        dueDate: new Date(dto['dueDate'] as string),
        customerId: dto['customerId'] as string,
        currencyId: dto['currencyId'] as string,
        subtotal: subtotal.toFixed(4),
        taxAmount: taxAmount.toFixed(4),
        total: total.toFixed(4),
        paidAmount: '0',
        notes: dto['notes'] as string,
        lines: {
          create: lines.map((l, i) => ({
            ...l,
            lineNo: i + 1,
          })) as never,
        },
      },
      include: { customer: true, lines: true },
    });
  }

  // ── AR Aging ───────────────────────────────────────────────────────────────

  async getArAging(companyId: string) {
    const today = new Date();
    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        type: 'SALE',
        status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] },
      },
      include: { customer: true },
    });

    const buckets = {
      current: new Decimal(0),
      days1to30: new Decimal(0),
      days31to60: new Decimal(0),
      days61to90: new Decimal(0),
      over90: new Decimal(0),
    };

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

  async recordReceipt(companyId: string, dto: { customerId: string; invoiceId: string; amount: string; date: string; bankAccountId?: string; reference?: string }) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: dto.invoiceId, companyId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const paymentAmount = new Decimal(dto.amount);
    const balance = new Decimal(invoice.total.toString()).minus(invoice.paidAmount.toString());
    if (paymentAmount.gt(balance)) throw new BadRequestException('Payment exceeds invoice balance');

    const newPaid = new Decimal(invoice.paidAmount.toString()).plus(paymentAmount);
    const newStatus = newPaid.gte(new Decimal(invoice.total.toString())) ? 'PAID' : 'PARTIAL';

    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          companyId,
          customerId: dto.customerId,
          bankAccountId: dto.bankAccountId,
          type: 'RECEIPT',
          date: new Date(dto.date),
          amount: dto.amount,
          reference: dto.reference,
          allocations: {
            create: [{ invoiceId: dto.invoiceId, amount: dto.amount }],
          },
        },
      }),
      this.prisma.invoice.update({
        where: { id: dto.invoiceId },
        data: { paidAmount: newPaid.toFixed(4), status: newStatus as never },
      }),
    ]);

    return payment;
  }
}
