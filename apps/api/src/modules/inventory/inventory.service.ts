import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findItems(companyId: string) {
    return this.prisma.stockItem.findMany({
      where: { companyId },
      orderBy: { sku: 'asc' },
    });
  }

  async createItem(companyId: string, dto: Record<string, unknown>) {
    return this.prisma.stockItem.create({ data: { ...dto, companyId } as never });
  }

  async getStockBalance(itemId: string) {
    const movements = await this.prisma.stockMovement.findMany({
      where: { stockItemId: itemId },
      orderBy: { date: 'desc' },
      take: 1,
    });
    if (!movements.length) return { quantity: '0', value: '0', unitCost: '0' };

    const latest = movements[0];
    return {
      quantity: latest.runningQty.toString(),
      value: latest.runningValue.toString(),
      unitCost: new Decimal(latest.runningValue.toString())
        .div(latest.runningQty.toString() || '1')
        .toFixed(4),
    };
  }

  async recordMovement(companyId: string, dto: {
    stockItemId: string;
    type: string;
    quantity: string;
    unitCost: string;
    date: string;
    warehouseId?: string;
    referenceType?: string;
    referenceId?: string;
  }) {
    const item = await this.prisma.stockItem.findFirst({ where: { id: dto.stockItemId, companyId } });
    if (!item) throw new NotFoundException('Stock item not found');

    const currentBalance = await this.getStockBalance(dto.stockItemId);
    const qty = new Decimal(dto.quantity);
    const cost = new Decimal(dto.unitCost);

    const isInbound = ['PURCHASE_RECEIPT', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'OPENING_STOCK'].includes(dto.type);

    let newRunningQty: Decimal;
    let newRunningValue: Decimal;
    let cogsAmount = new Decimal(0);

    if (isInbound) {
      newRunningQty = new Decimal(currentBalance.quantity).plus(qty);
      newRunningValue = new Decimal(currentBalance.value).plus(qty.mul(cost));
    } else {
      if (new Decimal(currentBalance.quantity).lt(qty)) {
        throw new BadRequestException('Insufficient stock');
      }

      // Calculate COGS based on valuation method
      cogsAmount = await this.calculateCOGS(dto.stockItemId, item.valuationMethod, qty);
      newRunningQty = new Decimal(currentBalance.quantity).minus(qty);
      newRunningValue = new Decimal(currentBalance.value).minus(cogsAmount);
    }

    return this.prisma.stockMovement.create({
      data: {
        companyId,
        stockItemId: dto.stockItemId,
        warehouseId: dto.warehouseId,
        type: dto.type as never,
        quantity: isInbound ? qty.toFixed(4) : qty.neg().toFixed(4),
        unitCost: cost.toFixed(4),
        runningQty: newRunningQty.toFixed(4),
        runningValue: newRunningValue.toFixed(4),
        cogsAmount: cogsAmount.toFixed(4),
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        date: new Date(dto.date),
      },
    });
  }

  private async calculateCOGS(itemId: string, method: string, quantity: Decimal): Promise<Decimal> {
    if (method === 'WEIGHTED_AVG') {
      const balance = await this.getStockBalance(itemId);
      const avgCost = new Decimal(balance.value).div(new Decimal(balance.quantity) || new Decimal(1));
      return avgCost.mul(quantity);
    }

    if (method === 'FIFO') {
      // Get oldest inbound layers
      const layers = await this.prisma.stockMovement.findMany({
        where: { stockItemId: itemId, quantity: { gt: 0 } },
        orderBy: { date: 'asc' },
      });

      let remaining = quantity;
      let cogs = new Decimal(0);

      for (const layer of layers) {
        if (remaining.lte(0)) break;
        const available = new Decimal(layer.quantity.toString()).abs();
        const take = Decimal.min(remaining, available);
        cogs = cogs.plus(take.mul(layer.unitCost.toString()));
        remaining = remaining.minus(take);
      }
      return cogs;
    }

    // LIFO — last in, first out
    const balance = await this.getStockBalance(itemId);
    return quantity.mul(balance.unitCost);
  }
}
