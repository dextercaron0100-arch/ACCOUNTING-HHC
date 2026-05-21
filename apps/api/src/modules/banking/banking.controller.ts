import { Controller, Get, Post, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BankingService } from './banking.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('banking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('banking')
export class BankingController {
  constructor(private readonly bankingService: BankingService) {}

  @Get('accounts') findAccounts(@CompanyId() c: string) { return this.bankingService.findBankAccounts(c); }
  @Post('accounts') createAccount(@CompanyId() c: string, @Body() dto: Record<string, unknown>) { return this.bankingService.createBankAccount(c, dto as never); }

  @Get('accounts/:id/transactions')
  findTransactions(@Param('id') id: string, @Query('page') page?: number, @Query('status') status?: string) {
    return this.bankingService.findTransactions(id, { page, status });
  }

  @Post('accounts/:id/import') @HttpCode(HttpStatus.OK)
  importStatement(@Param('id') id: string, @CompanyId() c: string, @Body() dto: Record<string, unknown>) {
    return this.bankingService.importStatement(id, c, dto as never);
  }

  @Post('transactions/:id/match') @HttpCode(HttpStatus.OK)
  matchTxn(@Param('id') id: string, @Body('journalEntryId') journalEntryId: string) {
    return this.bankingService.matchTransaction(id, journalEntryId);
  }

  @Post('transactions/:id/unmatch') @HttpCode(HttpStatus.OK)
  unmatchTxn(@Param('id') id: string) { return this.bankingService.unmatchTransaction(id); }

  @Post('accounts/:id/reconcile') @HttpCode(HttpStatus.OK)
  lock(@Param('id') id: string, @Body('periodId') periodId: string, @CurrentUser() user: JwtPayload) {
    return this.bankingService.lockReconciliation(id, periodId, user.sub);
  }

  @Get('accounts/:id/summary')
  summary(@Param('id') id: string) { return this.bankingService.getReconciliationSummary(id); }
}
