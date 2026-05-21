import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportingService } from './reporting.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';

@ApiTags('reporting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reporting')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('dashboard') kpis(@CompanyId() c: string) { return this.reportingService.getDashboardKpis(c); }
  @Get('cash-trend') cashTrend(@CompanyId() c: string, @Query('months') months?: number) { return this.reportingService.getCashTrend(c, months); }
  @Get('top-expenses') topExpenses(@CompanyId() c: string, @Query('limit') limit?: number) { return this.reportingService.getTopExpenses(c, limit); }
  @Get('budget-utilization') budgetUtil(@CompanyId() c: string, @Query('periodId') periodId: string) { return this.reportingService.getBudgetUtilization(c, periodId); }
}
