import { Controller, Get, Post, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get() findAll(@CurrentUser() user: JwtPayload, @CompanyId() c: string) { return this.notificationsService.findAll(user.sub, c); }
  @Get('unread-count') unreadCount(@CurrentUser() user: JwtPayload, @CompanyId() c: string) { return this.notificationsService.getUnreadCount(user.sub, c); }

  @Post(':id/read') @HttpCode(HttpStatus.OK)
  markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.notificationsService.markRead(id, user.sub); }

  @Post('read-all') @HttpCode(HttpStatus.OK)
  markAllRead(@CurrentUser() user: JwtPayload, @CompanyId() c: string) { return this.notificationsService.markAllRead(user.sub, c); }
}
