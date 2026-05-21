import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { companyId },
      include: { accountType: true, currency: true },
      orderBy: [{ code: 'asc' }],
    });
    return this.buildTree(accounts);
  }

  async findFlat(companyId: string, typeCode?: string) {
    return this.prisma.account.findMany({
      where: {
        companyId,
        ...(typeCode ? { accountType: { code: typeCode as never } } : {}),
      },
      include: { accountType: true },
      orderBy: [{ code: 'asc' }],
    });
  }

  async findOne(id: string, companyId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, companyId },
      include: { accountType: true, parent: true, children: true, currency: true },
    });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async create(companyId: string, dto: CreateAccountDto) {
    const existing = await this.prisma.account.findUnique({
      where: { companyId_code: { companyId, code: dto.code } },
    });
    if (existing) throw new BadRequestException(`Account code "${dto.code}" already exists`);

    if (dto.parentId) {
      const parent = await this.prisma.account.findFirst({ where: { id: dto.parentId, companyId } });
      if (!parent) throw new NotFoundException('Parent account not found');
    }

    return this.prisma.account.create({
      data: { ...dto, companyId },
      include: { accountType: true },
    });
  }

  async update(id: string, companyId: string, dto: UpdateAccountDto) {
    const account = await this.findOne(id, companyId);
    if (account.isSystemAccount && dto.isActive === false) {
      throw new BadRequestException('Cannot deactivate a system account');
    }
    return this.prisma.account.update({
      where: { id },
      data: dto,
      include: { accountType: true },
    });
  }

  async remove(id: string, companyId: string) {
    const account = await this.findOne(id, companyId);
    if (account.isSystemAccount) throw new BadRequestException('Cannot delete a system account');

    const childCount = await this.prisma.account.count({ where: { parentId: id } });
    if (childCount > 0) throw new BadRequestException('Cannot delete account with sub-accounts');

    const lineCount = await this.prisma.journalEntryLine.count({ where: { accountId: id } });
    if (lineCount > 0) throw new BadRequestException('Cannot delete account with journal entries');

    return this.prisma.account.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async getAccountTypes() {
    return this.prisma.accountType.findMany({ orderBy: { displayOrder: 'asc' } });
  }

  async getBalance(accountId: string, periodId?: string) {
    if (periodId) {
      const balance = await this.prisma.ledgerBalance.findUnique({
        where: { accountId_periodId: { accountId, periodId } },
      });
      return balance?.closingBalance ?? '0.0000';
    }

    const lines = await this.prisma.journalEntryLine.aggregate({
      where: {
        accountId,
        entry: { status: 'POSTED', deletedAt: null },
      },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const debit = lines._sum.debitAmount ?? 0;
    const credit = lines._sum.creditAmount ?? 0;
    return { totalDebits: debit, totalCredits: credit };
  }

  private buildTree(accounts: Record<string, unknown>[]) {
    const map = new Map<string, Record<string, unknown>>();
    const roots: Record<string, unknown>[] = [];

    accounts.forEach((a) => {
      map.set(a['id'] as string, { ...a, children: [] });
    });

    accounts.forEach((a) => {
      const node = map.get(a['id'] as string)!;
      if (a['parentId']) {
        const parent = map.get(a['parentId'] as string);
        if (parent) (parent['children'] as unknown[]).push(node);
        else roots.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }
}
