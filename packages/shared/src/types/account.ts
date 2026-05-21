export type AccountTypeCode = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';

export interface Account {
  id: string;
  companyId: string;
  parentId: string | null;
  accountTypeId: string;
  accountType: { code: AccountTypeCode; name: string };
  code: string;
  name: string;
  description: string | null;
  normalBalance: NormalBalance;
  isActive: boolean;
  isSystemAccount: boolean;
  children?: Account[];
  balance?: string;
}

export interface CreateAccountDto {
  parentId?: string;
  accountTypeId: string;
  code: string;
  name: string;
  description?: string;
  normalBalance: NormalBalance;
  currencyId?: string;
}

export interface UpdateAccountDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}
