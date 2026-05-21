import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StatementsService } from './statements.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';

@ApiTags('statements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('statements')
export class StatementsController {
  constructor(private readonly statementsService: StatementsService) {}

  @Get('income-statement')
  @ApiOperation({ summary: 'Profit & Loss statement' })
  getIncomeStatement(
    @CompanyId() companyId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('compareDateFrom') compareDateFrom?: string,
    @Query('compareDateTo') compareDateTo?: string,
  ) {
    return this.statementsService.getIncomeStatement(
      companyId,
      new Date(dateFrom),
      new Date(dateTo),
      compareDateFrom ? new Date(compareDateFrom) : undefined,
      compareDateTo ? new Date(compareDateTo) : undefined,
    );
  }

  @Get('balance-sheet')
  @ApiOperation({ summary: 'Balance sheet as of date' })
  getBalanceSheet(@CompanyId() companyId: string, @Query('asOfDate') asOfDate: string) {
    return this.statementsService.getBalanceSheet(companyId, new Date(asOfDate));
  }

  @Get('cash-flow')
  @ApiOperation({ summary: 'Cash flow statement (indirect method)' })
  getCashFlow(
    @CompanyId() companyId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    return this.statementsService.getCashFlowStatement(companyId, new Date(dateFrom), new Date(dateTo));
  }
}
