import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function money(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}

export function formatCurrency(
  amount: string | number | Decimal,
  currency = 'PHP',
  locale = 'en-PH',
): string {
  const num = new Decimal(amount).toNumber();
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatNumber(amount: string | number | Decimal, decimals = 2): string {
  return new Decimal(amount).toFixed(decimals);
}

export function sumAmounts(amounts: (string | number)[]): Decimal {
  return amounts.reduce((sum, a) => sum.plus(new Decimal(a)), new Decimal(0));
}

export function isBalanced(debits: string | number, credits: string | number): boolean {
  return new Decimal(debits).equals(new Decimal(credits));
}
