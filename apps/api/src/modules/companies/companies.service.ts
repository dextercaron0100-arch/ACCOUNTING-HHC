import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const userCompanies = await this.prisma.userCompany.findMany({
      where: { userId },
      include: { company: { include: { baseCurrency: true } }, role: true },
    });
    return userCompanies.map((uc) => ({ ...uc.company, role: uc.role }));
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { baseCurrency: true, branches: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(id: string, dto: Record<string, unknown>) {
    return this.prisma.company.update({ where: { id }, data: dto as never });
  }

  async findBranches(companyId: string) {
    return this.prisma.branch.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }

  async createBranch(companyId: string, dto: { name: string; code: string }) {
    return this.prisma.branch.create({ data: { ...dto, companyId } });
  }

  async getUserRoles(companyId: string) {
    return this.prisma.userCompany.findMany({
      where: { companyId },
      include: { user: { select: { id: true, name: true, email: true } }, role: true },
    });
  }

  async assignRole(companyId: string, userId: string, roleId: string) {
    return this.prisma.userCompany.upsert({
      where: { userId_companyId: { userId, companyId } },
      update: { roleId },
      create: { userId, companyId, roleId },
    });
  }
}
