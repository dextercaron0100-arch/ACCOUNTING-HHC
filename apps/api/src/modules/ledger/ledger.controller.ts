import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';

@ApiTags('ledger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('account/:accountId')
  @ApiOperation({ summary: 'Get general ledger detail for an account' })
  getAccountLedger(
    @Param('accountId') accountId: string,
    @CompanyId() companyId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.ledgerService.getGeneralLedger(companyId, accountId, { page, limit, dateFrom, dateTo });
  }

  @Get('trial-balance/:periodId')
  @ApiOperation({ summary: 'Get trial balance for a period' })
  getTrialBalance(@Param('periodId') periodId: string, @CompanyId() companyId: string) {
    return this.ledgerService.getTrialBalance(companyId, periodId);
  }

  @Get('ar-subledger')
  @ApiOperation({ summary: 'Get AR sub-ledger' })
  getArSubLedger(@CompanyId() companyId: string) {
    return this.ledgerService.getArSubLedger(companyId);
  }

  @Get('ap-subledger')
  @ApiOperation({ summary: 'Get AP sub-ledger' })
  getApSubLedger(@CompanyId() companyId: string) {
    return this.ledgerService.getApSubLedger(companyId);
  }
}
