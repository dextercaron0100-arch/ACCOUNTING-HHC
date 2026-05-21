import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';

// Philippine mandatory deductions calculator (2024 rates)

@Injectable()
export class PhPayrollCalculator {
  // SSS Contribution Table 2024 (monthly salary credit → contribution)
  // Simplified: 4.5% employee, 9.5% employer + EC, max MSC ₱30,000
  computeSSS(monthlyBasic: Decimal): { employee: Decimal; employer: Decimal } {
    const msc = Decimal.min(monthlyBasic, new Decimal(30000));
    const employee = msc.mul(0.045).toDecimalPlaces(2);
    const employer = msc.mul(0.095).toDecimalPlaces(2);
    return { employee, employer };
  }

  // PhilHealth 2024: 5% of basic monthly salary, 50/50 split, max ₱100,000
  computePhilHealth(monthlyBasic: Decimal): { employee: Decimal; employer: Decimal } {
    const cappedSalary = Decimal.min(monthlyBasic, new Decimal(100000));
    const total = cappedSalary.mul(0.05).toDecimalPlaces(2);
    const half = total.div(2).toDecimalPlaces(2);
    return { employee: half, employer: half };
  }

  // Pag-IBIG 2024: 2% of salary, max ₱100 employee / ₱100 employer
  computePagIbig(monthlyBasic: Decimal): { employee: Decimal; employer: Decimal } {
    const computed = monthlyBasic.mul(0.02).toDecimalPlaces(2);
    const employee = Decimal.min(computed, new Decimal(100));
    const employer = new Decimal(100);
    return { employee, employer };
  }

  // BIR Withholding Tax — TRAIN Law 2023+ annual table applied monthly
  computeWithholdingTax(monthlyTaxableIncome: Decimal): Decimal {
    const annual = monthlyTaxableIncome.mul(12);

    let annualTax: Decimal;

    if (annual.lte(250000)) {
      annualTax = new Decimal(0);
    } else if (annual.lte(400000)) {
      annualTax = annual.minus(250000).mul(0.15);
    } else if (annual.lte(800000)) {
      annualTax = new Decimal(22500).plus(annual.minus(400000).mul(0.20));
    } else if (annual.lte(2000000)) {
      annualTax = new Decimal(102500).plus(annual.minus(800000).mul(0.25));
    } else if (annual.lte(8000000)) {
      annualTax = new Decimal(402500).plus(annual.minus(2000000).mul(0.30));
    } else {
      annualTax = new Decimal(2202500).plus(annual.minus(8000000).mul(0.35));
    }

    return annualTax.div(12).toDecimalPlaces(2);
  }

  computePayslip(employee: {
    basicSalary: string;
    payFrequency: string;
  }): {
    grossPay: Decimal;
    sssEmployee: Decimal;
    sssEmployer: Decimal;
    philhealthEmployee: Decimal;
    philhealthEmployer: Decimal;
    pagibigEmployee: Decimal;
    pagibigEmployer: Decimal;
    withholdingTax: Decimal;
    netPay: Decimal;
  } {
    const monthly = new Decimal(employee.basicSalary);
    const periodFactor = employee.payFrequency === 'SEMI_MONTHLY' ? 0.5 : employee.payFrequency === 'WEEKLY' ? 0.25 : 1;
    const grossPay = monthly.mul(periodFactor).toDecimalPlaces(2);

    const sss = this.computeSSS(monthly);
    const philhealth = this.computePhilHealth(monthly);
    const pagibig = this.computePagIbig(monthly);

    const taxableIncome = monthly
      .minus(sss.employee)
      .minus(philhealth.employee)
      .minus(pagibig.employee);

    const withholdingTax = this.computeWithholdingTax(taxableIncome).mul(periodFactor).toDecimalPlaces(2);

    const periodSss = sss.employee.mul(periodFactor).toDecimalPlaces(2);
    const periodPhilhealth = philhealth.employee.mul(periodFactor).toDecimalPlaces(2);
    const periodPagibig = pagibig.employee.mul(periodFactor).toDecimalPlaces(2);

    const totalDeductions = periodSss.plus(periodPhilhealth).plus(periodPagibig).plus(withholdingTax);
    const netPay = grossPay.minus(totalDeductions).toDecimalPlaces(2);

    return {
      grossPay,
      sssEmployee: periodSss,
      sssEmployer: sss.employer.mul(periodFactor).toDecimalPlaces(2),
      philhealthEmployee: periodPhilhealth,
      philhealthEmployer: philhealth.employer.mul(periodFactor).toDecimalPlaces(2),
      pagibigEmployee: periodPagibig,
      pagibigEmployer: pagibig.employer.mul(periodFactor).toDecimalPlaces(2),
      withholdingTax,
      netPay,
    };
  }
}
