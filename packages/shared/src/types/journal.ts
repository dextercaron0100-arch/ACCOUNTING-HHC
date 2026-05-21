export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'REVERSED';

export interface JournalEntryLine {
  id?: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debitAmount: string;
  creditAmount: string;
  currencyId?: string;
  exchangeRate?: string;
  memo?: string;
  lineNo: number;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  periodId: string;
  reference: string;
  date: string;
  description: string;
  status: JournalEntryStatus;
  postedAt: string | null;
  sourceType: string | null;
  sourceId: string | null;
  lines: JournalEntryLine[];
  totalDebits: string;
  totalCredits: string;
  createdAt: string;
}

export interface CreateJournalEntryDto {
  periodId: string;
  reference: string;
  date: string;
  description: string;
  lines: Omit<JournalEntryLine, 'id'>[];
}
