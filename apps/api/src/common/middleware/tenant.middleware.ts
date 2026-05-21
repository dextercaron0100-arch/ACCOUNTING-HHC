import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const companyId = req.headers['x-company-id'] as string | undefined;
    if (companyId) {
      // Set PostgreSQL session variable for RLS
      await this.prisma.$executeRawUnsafe(
        `SET LOCAL app.company_id = '${companyId.replace(/'/g, "''")}'`,
      );
    }
    next();
  }
}
