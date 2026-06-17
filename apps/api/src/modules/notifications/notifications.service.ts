import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, companyId: string) {
    return this.prisma.notification.findMany({
      where: { userId, companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string, companyId: string) {
    return this.prisma.notification.updateMany({ where: { userId, companyId, readAt: null }, data: { readAt: new Date() } });
  }

  async create(userId: string, companyId: string, dto: { title: string; message: string; type?: string; linkUrl?: string }) {
    return this.prisma.notification.create({
      data: { userId, companyId, title: dto.title, body: dto.message, type: dto.type ?? 'INFO' },
    });
  }

  async getUnreadCount(userId: string, companyId: string) {
    const count = await this.prisma.notification.count({ where: { userId, companyId, readAt: null } });
    return { count };
  }
}
