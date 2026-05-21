import Decimal from 'decimal.js';
import { BadRequestException } from '@nestjs/common';

export interface JournalLine {
  debitAmount: string | number;
  creditAmount: string | number;
}

export function validateDoubleEntry(lines: JournalLine[]): void {
  if (lines.length < 2) {
    throw new BadRequestException('Journal entry must have at least 2 lines');
  }

  const totalDebits = lines.reduce(
    (sum, line) => sum.plus(new Decimal(line.debitAmount || 0)),
    new Decimal(0),
  );

  const totalCredits = lines.reduce(
    (sum, line) => sum.plus(new Decimal(line.creditAmount || 0)),
    new Decimal(0),
  );

  if (!totalDebits.equals(totalCredits)) {
    throw new BadRequestException(
      `Journal entry is unbalanced: debits=${totalDebits.toFixed(4)}, credits=${totalCredits.toFixed(4)}`,
    );
  }

  if (totalDebits.isZero()) {
    throw new BadRequestException('Journal entry cannot have zero amounts');
  }
}

export function formatMoney(amount: string | number | Decimal): string {
  return new Decimal(amount).toFixed(4);
}
