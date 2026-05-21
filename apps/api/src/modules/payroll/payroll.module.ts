import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PhPayrollCalculator } from './ph-payroll.calculator';

@Module({
  controllers: [PayrollController],
  providers: [PayrollService, PhPayrollCalculator],
  exports: [PayrollService],
})
export class PayrollModule {}
