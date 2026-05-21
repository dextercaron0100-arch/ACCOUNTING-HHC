import { Controller, Get, Post, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get() findAll(@CompanyId() c: string, @Query('page') page?: number, @Query('status') status?: string) {
    return this.expensesService.findClaims(c, { page, status });
  }

  @Get(':id') findOne(@Param('id') id: string, @CompanyId() c: string) {
    return this.expensesService.findOne(id, c);
  }

  @Post() createClaim(@CompanyId() c: string, @CurrentUser() user: JwtPayload, @Body() dto: Record<string, unknown>) {
    return this.expensesService.createClaim(c, user.sub, dto as never);
  }

  @Post(':id/submit') @HttpCode(HttpStatus.OK)
  submit(@Param('id') id: string, @CompanyId() c: string, @CurrentUser() user: JwtPayload) {
    return this.expensesService.submitClaim(id, c, user.sub);
  }

  @Post(':id/approve') @HttpCode(HttpStatus.OK)
  approve(@Param('id') id: string, @CompanyId() c: string, @CurrentUser() user: JwtPayload, @Body('action') action: 'APPROVE' | 'REJECT', @Body('note') note?: string) {
    return this.expensesService.approveClaim(id, c, user.sub, action, note);
  }

  @Post(':id/reimburse') @HttpCode(HttpStatus.OK)
  reimburse(@Param('id') id: string, @CompanyId() c: string, @CurrentUser() user: JwtPayload, @Body('cashAccountId') cashAccountId: string) {
    return this.expensesService.reimburse(id, c, user.sub, cashAccountId);
  }
}
