export type InvoiceType = 'SALE' | 'PURCHASE';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'VOID' | 'CREDIT_NOTE';

export interface InvoiceLine {
  id?: string;
  accountId?: string;
  taxCodeId?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPct: string;
  amount: string;
  taxAmount: string;
  lineNo: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  type: InvoiceType;
  status: InvoiceStatus;
  invoiceNo: string;
  date: string;
  dueDate: string;
  customer?: { id: string; name: string };
  vendor?: { id: string; name: string };
  currency: { id: string; code: string; symbol: string };
  subtotal: string;
  taxAmount: string;
  total: string;
  paidAmount: string;
  balance: string;
  lines: InvoiceLine[];
}
