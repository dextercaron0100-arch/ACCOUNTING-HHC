import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    // Soft-delete middleware: filter out deleted records automatically
    this.$use(async (params, next) => {
      const modelsWithSoftDelete = [
        'Company', 'User', 'Account', 'JournalEntry', 'Invoice',
        'Customer', 'Vendor', 'PurchaseOrder', 'Asset', 'Employee',
        'ExpenseClaim', 'Document', 'StockItem',
      ];

      if (modelsWithSoftDelete.includes(params.model ?? '')) {
        if (params.action === 'findFirst' || params.action === 'findMany') {
          params.args = params.args ?? {};
          params.args.where = { ...params.args.where, deletedAt: null };
        }
        if (params.action === 'findUnique') {
          params.action = 'findFirst';
          params.args = params.args ?? {};
          params.args.where = { ...params.args.where, deletedAt: null };
        }
      }
      return next(params);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async softDelete(model: string, id: string) {
    return (this as unknown as Record<string, { update: (args: unknown) => Promise<unknown> }>)[
      model.charAt(0).toLowerCase() + model.slice(1)
    ].update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
