import Decimal from 'decimal.js';

export function convertCurrency(
  amount: string | number,
  exchangeRate: string | number,
): string {
  return new Decimal(amount).mul(new Decimal(exchangeRate)).toFixed(4);
}

export function calculateForexGainLoss(
  originalAmount: string | number,
  originalRate: string | number,
  currentRate: string | number,
): string {
  const original = new Decimal(originalAmount).mul(new Decimal(originalRate));
  const current = new Decimal(originalAmount).mul(new Decimal(currentRate));
  return current.minus(original).toFixed(4);
}
