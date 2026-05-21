import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getPaginationParams, buildPaginatedResponse } from '../../common/utils/pagination.helper';

@Injectable()
export class ProcurementService {
  constructor(private readonly prisma: PrismaService) {}

  async findPOs(companyId: string, query: { page?: number; limit?: number; status?: string }) {
    const { skip, take, page, limit } = getPaginationParams(query);
    const [total, data] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { companyId, ...(query.status ? { status: query.status as never } : {}) } }),
      this.prisma.purchaseOrder.findMany({
        where: { companyId, ...(query.status ? { status: query.status as never } : {}) },
        include: { vendor: true, lines: true },
        skip, take, orderBy: { date: 'desc' },
      }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async createPO(companyId: string, dto: Record<string, unknown>) {
    const lines = (dto['lines'] as Record<string, unknown>[]) ?? [];
    const total = lines.reduce((s, l) => {
      const qty = new Decimal((l['quantity'] as string) || '0');
      const cost = new Decimal((l['unitCost'] as string) || '0');
      return s.plus(qty.mul(cost));
    }, new Decimal(0));

    return this.prisma.purchaseOrder.create({
      data: {
        companyId,
        vendorId: dto['vendorId'] as string,
        poNumber: dto['poNumber'] as string,
        date: new Date(dto['date'] as string),
        status: 'DRAFT',
        total: total.toFixed(4),
        taxAmount: '0',
        lines: {
          create: lines.map((l, i) => ({
            stockItemId: l['stockItemId'] as string | undefined,
            description: l['description'] as string,
            quantity: l['quantity'] as string,
            unitCost: l['unitCost'] as string,
            receivedQty: '0',
            matchedQty: '0',
            lineNo: i + 1,
          })),
        },
      },
      include: { vendor: true, lines: true },
    });
  }

  async approvePO(id: string, companyId: string, userId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, companyId } });
    if (!po) throw new NotFoundException('PO not found');
    if (po.status !== 'DRAFT' && po.status !== 'PENDING_APPROVAL') throw new BadRequestException('PO cannot be approved in current status');

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
    });
  }

  async createGRN(companyId: string, poId: string, dto: Record<string, unknown>) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: poId, companyId },
      include: { lines: true },
    });
    if (!po) throw new NotFoundException('PO not found');
    if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
      throw new BadRequestException('PO must be approved before receiving goods');
    }

    const grnLines = (dto['lines'] as Record<string, unknown>[]) ?? [];

    const grn = await this.prisma.goodsReceivedNote.create({
      data: {
        poId,
        grnNumber: dto['grnNumber'] as string,
        date: new Date(dto['date'] as string),
        warehouseId: dto['warehouseId'] as string,
        receivedBy: dto['receivedBy'] as string,
        lines: {
          create: grnLines.map((l) => ({
            poLineId: l['poLineId'] as string,
            quantityReceived: l['quantityReceived'] as string,
            unitCost: l['unitCost'] as string,
          })),
        },
      },
      include: { lines: true },
    });

    // Update PO line received quantities and PO status
    for (const grnLine of grnLines) {
      await this.prisma.purchaseOrderLine.update({
        where: { id: grnLine['poLineId'] as string },
        data: { receivedQty: { increment: parseFloat(grnLine['quantityReceived'] as string) } },
      });
    }

    const updatedPO = await this.prisma.purchaseOrder.findFirst({
      where: { id: poId },
      include: { lines: true },
    });
    const allReceived = updatedPO!.lines.every((l) =>
      new Decimal(l.receivedQty.toString()).gte(l.quantity.toString()),
    );
    await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: allReceived ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED' },
    });

    return grn;
  }

  async threeWayMatch(companyId: string, poId: string, invoiceId: string) {
    const [po, invoice] = await Promise.all([
      this.prisma.purchaseOrder.findFirst({ where: { id: poId, companyId }, include: { lines: true } }),
      this.prisma.invoice.findFirst({ where: { id: invoiceId, companyId }, include: { lines: true } }),
    ]);

    if (!po || !invoice) throw new NotFoundException('PO or Invoice not found');

    const issues: string[] = [];
    const poTotal = new Decimal(po.total.toString());
    const invoiceTotal = new Decimal(invoice.total.toString());

    if (!invoiceTotal.lte(poTotal.mul(1.05))) {
      issues.push(`Invoice total ${invoiceTotal} exceeds PO total ${poTotal} by more than 5%`);
    }

    if (po.status !== 'FULLY_RECEIVED' && po.status !== 'PARTIALLY_RECEIVED') {
      issues.push('Goods have not been received for this PO');
    }

    return {
      matched: issues.length === 0,
      issues,
      poTotal: poTotal.toFixed(4),
      invoiceTotal: invoiceTotal.toFixed(4),
      status: issues.length === 0 ? 'PASS' : 'EXCEPTION',
    };
  }
}
