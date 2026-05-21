import { format, parseISO, isValid } from 'date-fns';

export const DISPLAY_DATE = 'MMM d, yyyy';
export const DISPLAY_DATETIME = 'MMM d, yyyy h:mm a';
export const API_DATE = 'yyyy-MM-dd';

export function formatDate(date: string | Date, fmt = DISPLAY_DATE): string {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '';
  return format(d, fmt);
}

export function toApiDate(date: Date): string {
  return format(date, API_DATE);
}

export function today(): string {
  return format(new Date(), API_DATE);
}
