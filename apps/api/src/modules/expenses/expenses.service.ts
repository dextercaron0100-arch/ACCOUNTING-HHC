import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getPaginationParams, buildPaginatedResponse } from '../../common/utils/pagination.helper';
import Decimal from 'decimal.js';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async findClaims(companyId: string, query: { page?: number; status?: string; userId?: string }) {
    const { skip, take, page, limit } = getPaginationParams(query);
    const where: Record<string, unknown> = { companyId };
    if (query.status) where.status = query.status;
    if (query.userId) where.employeeId = query.userId;

    const [total, data] = await Promise.all([
      this.prisma.expenseClaim.count({ where }),
      this.prisma.expenseClaim.findMany({
        where,
        skip,
        take,
        orderBy: { submittedAt: 'desc' },
        include: { lines: true, employee: true },
      }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const claim = await this.prisma.expenseClaim.findFirst({
      where: { id, companyId },
      include: {
        lines: true,
        employee: true,
        approvals: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!claim) throw new NotFoundException('Expense claim not found');
    return claim;
  }

  async createClaim(
    companyId: string,
    userId: string,
    dto: {
      title: string;
      description?: string;
      lines: Array<{ accountId: string; description: string; amount: string; receiptKey?: string }>;
    },
  ) {
    if (!dto.lines || dto.lines.length === 0) throw new BadRequestException('Expense claim must have at least one line');

    const totalAmount = dto.lines.reduce((sum, l) => sum.plus(new Decimal(l.amount)), new Decimal(0));
    const claimNo = `EXP-${Date.now()}`;

    return this.prisma.expenseClaim.create({
      data: {
        companyId,
        employeeId: userId,
        claimNo,
        description: dto.description ?? dto.title,
        totalAmount: totalAmount.toFixed(4),
        status: 'DRAFT',
        lines: {
          create: dto.lines.map((l, i) => ({
            accountId: l.accountId,
            description: l.description,
            amount: new Decimal(l.amount).toFixed(4),
            date: new Date(),
            lineNo: i + 1,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async submitClaim(id: string, companyId: string, userId: string) {
    const claim = await this.prisma.expenseClaim.findFirst({ where: { id, companyId } });
    if (!claim) throw new NotFoundException('Expense claim not found');
    if (claim.employeeId !== userId) throw new ForbiddenException('You can only submit your own claims');
    if (claim.status !== 'DRAFT') throw new BadRequestException('Only DRAFT claims can be submitted');

    return this.prisma.expenseClaim.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
  }

  async approveClaim(id: string, companyId: string, approverId: string, action: 'APPROVE' | 'REJECT', note?: string) {
    const claim = await this.prisma.expenseClaim.findFirst({ where: { id, companyId } });
    if (!claim) throw new NotFoundException('Expense claim not found');
    if (claim.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED claims can be approved/rejected');

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    await this.prisma.approval.create({
      data: {
        referenceType: 'EXPENSE_CLAIM',
        referenceId: id,
        approverId,
        status: newStatus as any,
        comments: note,
      },
    });

    return this.prisma.expenseClaim.update({
      where: { id },
      data: { status: newStatus },
    });
  }

  async reimburse(id: string, companyId: string, userId: string, cashAccountId: string) {
    const claim = await this.prisma.expenseClaim.findFirst({
      where: { id, companyId },
      include: { lines: true },
    });
    if (!claim) throw new NotFoundException('Expense claim not found');
    if (claim.status !== 'APPROVED') throw new BadRequestException('Claim must be APPROVED before reimbursement');

    const period = await this.prisma.accountingPeriod.findFirst({
      where: { companyId, startDate: { lte: new Date() }, endDate: { gte: new Date() }, status: { not: 'HARD_CLOSED' } },
    });
    if (!period) throw new BadRequestException('No open accounting period');

    const cashAcc = await this.prisma.account.findFirst({ where: { id: cashAccountId, companyId } });
    if (!cashAcc) throw new BadRequestException('Cash account not found');

    const lines: Array<{ accountId: string; debitAmount: string; creditAmount: string; memo: string; lineNo: number }> = [];
    let lineNo = 1;

    for (const l of claim.lines) {
      lines.push({ accountId: l.accountId ?? cashAcc.id, debitAmount: l.amount.toString(), creditAmount: '0.0000', memo: l.description, lineNo: lineNo++ });
    }
    lines.push({ accountId: cashAcc.id, debitAmount: '0.0000', creditAmount: claim.totalAmount.toString(), memo: `Reimbursement: ${claim.description}`, lineNo: lineNo++ });

    const entry = await this.prisma.journalEntry.create({
      data: {
        companyId,
        periodId: period.id,
        reference: `EXP-${id.slice(0, 8)}`,
        date: new Date(),
        description: `Expense reimbursement: ${claim.description}`,
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: userId,
        sourceType: 'EXPENSE',
        sourceId: id,
        createdBy: userId,
        lines: {
          create: lines.map((l) => ({
            accountId: l.accountId,
            debitAmount: l.debitAmount,
            creditAmount: l.creditAmount,
            basDebitAmount: l.debitAmount,
            basCreditAmount: l.creditAmount,
            memo: l.memo,
            lineNo: l.lineNo,
          })),
        },
      },
    });

    return this.prisma.expenseClaim.update({
      where: { id },
      data: { status: 'REIMBURSED', journalEntryId: entry.id },
    });
  }
}
