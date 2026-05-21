import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PhPayrollCalculator } from './ph-payroll.calculator';
import { getPaginationParams, buildPaginatedResponse } from '../../common/utils/pagination.helper';
import Decimal from 'decimal.js';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: PhPayrollCalculator,
  ) {}

  async findEmployees(companyId: string, query: { page?: number; limit?: number }) {
    const { skip, take, page, limit } = getPaginationParams(query);
    const [total, data] = await Promise.all([
      this.prisma.employee.count({ where: { companyId, isActive: true } }),
      this.prisma.employee.findMany({ where: { companyId, isActive: true }, skip, take, orderBy: { employeeNo: 'asc' } }),
    ]);
    return buildPaginatedResponse(data, total, page, limit);
  }

  async createEmployee(companyId: string, dto: Record<string, unknown>) {
    return this.prisma.employee.create({ data: { ...dto, companyId } as never });
  }

  async createPayPeriod(companyId: string, dto: { name: string; startDate: string; endDate: string; payDate: string }) {
    return this.prisma.payPeriod.create({
      data: {
        companyId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        payDate: new Date(dto.payDate),
      },
    });
  }

  async runPayroll(companyId: string, payPeriodId: string, userId: string) {
    const payPeriod = await this.prisma.payPeriod.findFirst({ where: { id: payPeriodId, companyId } });
    if (!payPeriod) throw new NotFoundException('Pay period not found');

    const existingRun = await this.prisma.payRun.findFirst({ where: { payPeriodId, status: { in: ['APPROVED', 'POSTED'] } } });
    if (existingRun) throw new BadRequestException('A pay run already exists for this period');

    const employees = await this.prisma.employee.findMany({ where: { companyId, isActive: true } });

    const payRun = await this.prisma.payRun.create({ data: { payPeriodId, status: 'DRAFT' } });

    let totalGross = new Decimal(0);
    let totalDeductions = new Decimal(0);
    let totalNet = new Decimal(0);

    for (const emp of employees) {
      const computed = this.calculator.computePayslip({
        basicSalary: emp.basicSalary.toString(),
        payFrequency: emp.payFrequency,
      });

      await this.prisma.payslip.create({
        data: {
          payRunId: payRun.id,
          employeeId: emp.id,
          grossPay: computed.grossPay.toFixed(4),
          sssEmployee: computed.sssEmployee.toFixed(4),
          sssEmployer: computed.sssEmployer.toFixed(4),
          philhealthEmployee: computed.philhealthEmployee.toFixed(4),
          philhealthEmployer: computed.philhealthEmployer.toFixed(4),
          pagibigEmployee: computed.pagibigEmployee.toFixed(4),
          pagibigEmployer: computed.pagibigEmployer.toFixed(4),
          withholdingTax: computed.withholdingTax.toFixed(4),
          otherDeductions: '0',
          netPay: computed.netPay.toFixed(4),
        },
      });

      totalGross = totalGross.plus(computed.grossPay);
      totalDeductions = totalDeductions.plus(
        computed.sssEmployee.plus(computed.philhealthEmployee).plus(computed.pagibigEmployee).plus(computed.withholdingTax),
      );
      totalNet = totalNet.plus(computed.netPay);
    }

    return this.prisma.payRun.update({
      where: { id: payRun.id },
      data: {
        totalGross: totalGross.toFixed(4),
        totalDeductions: totalDeductions.toFixed(4),
        totalNet: totalNet.toFixed(4),
      },
      include: { payslips: { include: { employee: true } } },
    });
  }

  async approvePayRun(payRunId: string, userId: string) {
    return this.prisma.payRun.update({
      where: { id: payRunId },
      data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
    });
  }

  async postPayRun(payRunId: string, companyId: string, userId: string) {
    const payRun = await this.prisma.payRun.findFirst({
      where: { id: payRunId },
      include: { payPeriod: true, payslips: { include: { employee: true } } },
    });
    if (!payRun) throw new NotFoundException('Pay run not found');
    if (payRun.status !== 'APPROVED') throw new BadRequestException('Pay run must be approved before posting');

    const period = await this.prisma.accountingPeriod.findFirst({
      where: { companyId, startDate: { lte: new Date(payRun.payPeriod.payDate) }, endDate: { gte: new Date(payRun.payPeriod.payDate) } },
    });
    if (!period) throw new BadRequestException('No open accounting period for pay date');

    const sssPayableAcc = await this.prisma.account.findFirst({ where: { companyId, code: '2100' } });
    const phPayableAcc = await this.prisma.account.findFirst({ where: { companyId, code: '2101' } });
    const piPayableAcc = await this.prisma.account.findFirst({ where: { companyId, code: '2102' } });
    const taxPayableAcc = await this.prisma.account.findFirst({ where: { companyId, code: '2103' } });
    const cashAcc = await this.prisma.account.findFirst({ where: { companyId, code: '1000' } });
    const salaryExpAcc = await this.prisma.account.findFirst({ where: { companyId, code: '6001' } });
    const sssExpAcc = await this.prisma.account.findFirst({ where: { companyId, code: '6002' } });
    const phExpAcc = await this.prisma.account.findFirst({ where: { companyId, code: '6003' } });
    const piExpAcc = await this.prisma.account.findFirst({ where: { companyId, code: '6004' } });

    const totalGross = new Decimal(payRun.totalGross.toString());
    const totalSssEe = payRun.payslips.reduce((s, p) => s.plus(p.sssEmployee.toString()), new Decimal(0));
    const totalSssEr = payRun.payslips.reduce((s, p) => s.plus(p.sssEmployer.toString()), new Decimal(0));
    const totalPhEe = payRun.payslips.reduce((s, p) => s.plus(p.philhealthEmployee.toString()), new Decimal(0));
    const totalPhEr = payRun.payslips.reduce((s, p) => s.plus(p.philhealthEmployer.toString()), new Decimal(0));
    const totalPiEe = payRun.payslips.reduce((s, p) => s.plus(p.pagibigEmployee.toString()), new Decimal(0));
    const totalPiEr = payRun.payslips.reduce((s, p) => s.plus(p.pagibigEmployer.toString()), new Decimal(0));
    const totalTax = payRun.payslips.reduce((s, p) => s.plus(p.withholdingTax.toString()), new Decimal(0));
    const totalNet = new Decimal(payRun.totalNet.toString());

    // Dr: Salary Expense (gross + employer contributions)
    // Dr: SSS Expense (employer), PhilHealth Expense (employer), Pag-IBIG Expense (employer)
    // Cr: SSS Payable, PhilHealth Payable, Pag-IBIG Payable, Tax Payable, Cash (net pay)
    const lines: Array<{ accountId: string; debitAmount: string; creditAmount: string; memo: string; lineNo: number }> = [];
    let lineNo = 1;

    if (salaryExpAcc) lines.push({ accountId: salaryExpAcc.id, debitAmount: totalGross.toFixed(4), creditAmount: '0.0000', memo: 'Gross payroll', lineNo: lineNo++ });
    if (sssExpAcc) lines.push({ accountId: sssExpAcc.id, debitAmount: totalSssEr.toFixed(4), creditAmount: '0.0000', memo: 'SSS employer share', lineNo: lineNo++ });
    if (phExpAcc) lines.push({ accountId: phExpAcc.id, debitAmount: totalPhEr.toFixed(4), creditAmount: '0.0000', memo: 'PhilHealth employer share', lineNo: lineNo++ });
    if (piExpAcc) lines.push({ accountId: piExpAcc.id, debitAmount: totalPiEr.toFixed(4), creditAmount: '0.0000', memo: 'Pag-IBIG employer share', lineNo: lineNo++ });
    if (sssPayableAcc) lines.push({ accountId: sssPayableAcc.id, debitAmount: '0.0000', creditAmount: totalSssEe.plus(totalSssEr).toFixed(4), memo: 'SSS payable (employee + employer)', lineNo: lineNo++ });
    if (phPayableAcc) lines.push({ accountId: phPayableAcc.id, debitAmount: '0.0000', creditAmount: totalPhEe.plus(totalPhEr).toFixed(4), memo: 'PhilHealth payable', lineNo: lineNo++ });
    if (piPayableAcc) lines.push({ accountId: piPayableAcc.id, debitAmount: '0.0000', creditAmount: totalPiEe.plus(totalPiEr).toFixed(4), memo: 'Pag-IBIG payable', lineNo: lineNo++ });
    if (taxPayableAcc) lines.push({ accountId: taxPayableAcc.id, debitAmount: '0.0000', creditAmount: totalTax.toFixed(4), memo: 'Withholding tax payable', lineNo: lineNo++ });
    if (cashAcc) lines.push({ accountId: cashAcc.id, debitAmount: '0.0000', creditAmount: totalNet.toFixed(4), memo: 'Net pay disbursed', lineNo: lineNo++ });

    if (lines.length > 0) {
      const entry = await this.prisma.journalEntry.create({
        data: {
          companyId,
          periodId: period.id,
          reference: `PAY-${payRunId.slice(0, 8)}`,
          date: new Date(payRun.payPeriod.payDate),
          description: `Payroll for ${payRun.payPeriod.name}`,
          status: 'POSTED',
          postedAt: new Date(),
          postedBy: userId,
          sourceType: 'PAYROLL',
          sourceId: payRunId,
          createdBy: userId,
          lines: {
            create: lines.map((l) => ({
              accountId: l.accountId,
              debitAmount: l.debitAmount,
              creditAmount: l.creditAmount,
              basDebitAmount: l.debitAmount,
              basCreditAmount: l.creditAmount,
              memo: l.memo,
              lineNo: l.lineNo,
            })),
          },
        },
      });

      await this.prisma.payRun.update({
        where: { id: payRunId },
        data: { status: 'POSTED', journalEntryId: entry.id, postedAt: new Date() },
      });
    }

    return this.prisma.payRun.findUnique({ where: { id: payRunId } });
  }
}
