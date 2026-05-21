import { Controller, Get, Post, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('employees') getEmployees(@CompanyId() c: string, @Query('page') page?: number) { return this.payrollService.findEmployees(c, { page }); }
  @Post('employees') createEmployee(@CompanyId() c: string, @Body() dto: Record<string, unknown>) { return this.payrollService.createEmployee(c, dto); }

  @Post('periods') createPeriod(@CompanyId() _c: string, @Body() dto: { name: string; startDate: string; endDate: string; payDate: string }) { return this.payrollService.createPayPeriod(_c, dto); }

  @Post('runs') @HttpCode(HttpStatus.OK)
  runPayroll(@CompanyId() c: string, @Body('payPeriodId') payPeriodId: string, @CurrentUser() user: JwtPayload) {
    return this.payrollService.runPayroll(c, payPeriodId, user.sub);
  }

  @Post('runs/:id/approve') @HttpCode(HttpStatus.OK)
  approvePayRun(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.payrollService.approvePayRun(id, user.sub);
  }

  @Post('runs/:id/post') @HttpCode(HttpStatus.OK)
  postPayRun(@Param('id') id: string, @CompanyId() c: string, @CurrentUser() user: JwtPayload) {
    return this.payrollService.postPayRun(id, c, user.sub);
  }
}
