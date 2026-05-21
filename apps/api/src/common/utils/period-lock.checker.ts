import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export async function checkPeriodOpen(
  prisma: PrismaService,
  companyId: string,
  date: Date,
  userPermissions: string[] = [],
): Promise<void> {
  const period = await prisma.accountingPeriod.findFirst({
    where: {
      companyId,
      startDate: { lte: date },
      endDate: { gte: date },
    },
  });

  if (!period) {
    throw new ForbiddenException(`No accounting period found for date ${date.toISOString().split('T')[0]}`);
  }

  if (period.status === 'HARD_CLOSED') {
    if (!userPermissions.includes('OVERRIDE_PERIOD_LOCK')) {
      throw new ForbiddenException(
        `Accounting period "${period.name}" is hard-closed. Override permission required.`,
      );
    }
  }

  if (period.status === 'SOFT_CLOSED') {
    if (!userPermissions.includes('POST_TO_SOFT_CLOSED_PERIOD')) {
      throw new ForbiddenException(
        `Accounting period "${period.name}" is soft-closed.`,
      );
    }
  }
}
