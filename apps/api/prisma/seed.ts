import { PrismaClient, AccountTypeCode, NormalBalance, PeriodStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.warn('🌱 Seeding database...');

  // ── Currencies ────────────────────────────────────────────────────────────
  const php = await prisma.currency.upsert({
    where: { code: 'PHP' },
    update: {},
    create: { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimalPlaces: 2 },
  });

  await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
  });

  await prisma.currency.upsert({
    where: { code: 'EUR' },
    update: {},
    create: { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2 },
  });

  // ── Account Types ─────────────────────────────────────────────────────────
  const accountTypes = [
    { code: AccountTypeCode.ASSET, name: 'Asset', normalBalance: NormalBalance.DEBIT, displayOrder: 1 },
    { code: AccountTypeCode.LIABILITY, name: 'Liability', normalBalance: NormalBalance.CREDIT, displayOrder: 2 },
    { code: AccountTypeCode.EQUITY, name: 'Equity', normalBalance: NormalBalance.CREDIT, displayOrder: 3 },
    { code: AccountTypeCode.INCOME, name: 'Income', normalBalance: NormalBalance.CREDIT, displayOrder: 4 },
    { code: AccountTypeCode.EXPENSE, name: 'Expense', normalBalance: NormalBalance.DEBIT, displayOrder: 5 },
  ];

  for (const at of accountTypes) {
    await prisma.accountType.upsert({
      where: { code: at.code },
      update: {},
      create: at,
    });
  }

  const [assetType, liabilityType, equityType, incomeType, expenseType] = await Promise.all([
    prisma.accountType.findUnique({ where: { code: AccountTypeCode.ASSET } }),
    prisma.accountType.findUnique({ where: { code: AccountTypeCode.LIABILITY } }),
    prisma.accountType.findUnique({ where: { code: AccountTypeCode.EQUITY } }),
    prisma.accountType.findUnique({ where: { code: AccountTypeCode.INCOME } }),
    prisma.accountType.findUnique({ where: { code: AccountTypeCode.EXPENSE } }),
  ]);

  // ── Roles ─────────────────────────────────────────────────────────────────
  const superAdminPermissions = [
    'MANAGE_COMPANY', 'MANAGE_USERS', 'MANAGE_ROLES',
    'VIEW_ALL', 'CREATE_ALL', 'UPDATE_ALL', 'DELETE_ALL',
    'POST_JOURNAL', 'APPROVE_PO', 'APPROVE_EXPENSE',
    'RUN_PAYROLL', 'CLOSE_PERIOD', 'OVERRIDE_PERIOD_LOCK',
    'POST_TO_SOFT_CLOSED_PERIOD', 'VIEW_AUDIT_LOG',
    'MANAGE_INTEGRATIONS', 'EXPORT_DATA',
  ];

  const roles = [
    { name: 'Super Admin', permissions: superAdminPermissions, isSystem: true },
    { name: 'Company Admin', permissions: ['MANAGE_USERS', 'VIEW_ALL', 'CREATE_ALL', 'UPDATE_ALL', 'CLOSE_PERIOD'], isSystem: true },
    { name: 'Accountant', permissions: ['POST_JOURNAL', 'VIEW_LEDGER', 'CREATE_INVOICE', 'VIEW_REPORTS', 'VIEW_STATEMENTS'], isSystem: true },
    { name: 'Auditor', permissions: ['VIEW_ALL', 'VIEW_AUDIT_LOG'], isSystem: true },
    { name: 'AP Clerk', permissions: ['CREATE_VENDOR', 'CREATE_PURCHASE_BILL', 'CREATE_PAYMENT', 'VIEW_AP'], isSystem: true },
    { name: 'AR Clerk', permissions: ['CREATE_CUSTOMER', 'CREATE_INVOICE', 'CREATE_RECEIPT', 'VIEW_AR'], isSystem: true },
    { name: 'Payroll Officer', permissions: ['RUN_PAYROLL', 'VIEW_EMPLOYEES', 'MANAGE_EMPLOYEES'], isSystem: true },
    { name: 'Viewer', permissions: ['VIEW_ALL'], isSystem: true },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: { name: role.name, permissions: role.permissions, isSystem: role.isSystem },
    });
  }

  // ── Demo Company ──────────────────────────────────────────────────────────
  const company = await prisma.company.upsert({
    where: { id: 'demo-company-id' },
    update: {},
    create: {
      id: 'demo-company-id',
      name: 'Demo Enterprise Corp.',
      legalName: 'Demo Enterprise Corporation',
      taxId: '123-456-789-000',
      baseCurrencyId: php.id,
      timezone: 'Asia/Manila',
      fiscalYearStart: 1,
      address: '123 Ayala Avenue, Makati City, Metro Manila',
      phone: '+63 2 8888 0000',
      email: 'admin@demoenterprise.ph',
    },
  });

  // ── Chart of Accounts (Philippine Standard) ───────────────────────────────
  const createAccount = async (
    code: string,
    name: string,
    typeId: string,
    normalBalance: NormalBalance,
    parentId?: string,
    isSystemAccount = false,
  ) => {
    return prisma.account.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      update: {},
      create: {
        companyId: company.id,
        accountTypeId: typeId,
        code,
        name,
        normalBalance,
        parentId,
        isSystemAccount,
      },
    });
  };

  // Assets
  const cash = await createAccount('1000', 'Cash and Cash Equivalents', assetType!.id, NormalBalance.DEBIT, undefined, true);
  await createAccount('1001', 'Petty Cash', assetType!.id, NormalBalance.DEBIT, cash.id);
  await createAccount('1002', 'Cash in Bank - BDO', assetType!.id, NormalBalance.DEBIT, cash.id);
  await createAccount('1003', 'Cash in Bank - BPI', assetType!.id, NormalBalance.DEBIT, cash.id);
  await createAccount('1004', 'GCash / Maya Digital Wallet', assetType!.id, NormalBalance.DEBIT, cash.id);

  const ar = await createAccount('1100', 'Accounts Receivable', assetType!.id, NormalBalance.DEBIT, undefined, true);
  await createAccount('1101', 'Trade Receivables', assetType!.id, NormalBalance.DEBIT, ar.id);
  await createAccount('1102', 'Other Receivables', assetType!.id, NormalBalance.DEBIT, ar.id);
  await createAccount('1103', 'Allowance for Doubtful Accounts', assetType!.id, NormalBalance.CREDIT, ar.id);

  const vatInput = await createAccount('1301', 'Input VAT (Creditable)', assetType!.id, NormalBalance.DEBIT, undefined, true);
  await createAccount('1302', 'Deferred Input VAT', assetType!.id, NormalBalance.DEBIT);
  await createAccount('1310', 'Prepaid Expenses', assetType!.id, NormalBalance.DEBIT);

  const inventory = await createAccount('1200', 'Inventory', assetType!.id, NormalBalance.DEBIT, undefined, true);
  await createAccount('1201', 'Finished Goods', assetType!.id, NormalBalance.DEBIT, inventory.id);
  await createAccount('1202', 'Raw Materials', assetType!.id, NormalBalance.DEBIT, inventory.id);
  await createAccount('1203', 'Work in Progress', assetType!.id, NormalBalance.DEBIT, inventory.id);

  const fixedAssets = await createAccount('1500', 'Property, Plant & Equipment', assetType!.id, NormalBalance.DEBIT);
  await createAccount('1501', 'Land', assetType!.id, NormalBalance.DEBIT, fixedAssets.id);
  await createAccount('1502', 'Building', assetType!.id, NormalBalance.DEBIT, fixedAssets.id);
  await createAccount('1503', 'Office Equipment', assetType!.id, NormalBalance.DEBIT, fixedAssets.id);
  await createAccount('1504', 'Vehicles', assetType!.id, NormalBalance.DEBIT, fixedAssets.id);
  await createAccount('1505', 'Computer & IT Equipment', assetType!.id, NormalBalance.DEBIT, fixedAssets.id);
  await createAccount('1550', 'Accumulated Depreciation', assetType!.id, NormalBalance.CREDIT, fixedAssets.id, true);

  // Liabilities
  const ap = await createAccount('2000', 'Accounts Payable', liabilityType!.id, NormalBalance.CREDIT, undefined, true);
  await createAccount('2001', 'Trade Payables', liabilityType!.id, NormalBalance.CREDIT, ap.id);
  await createAccount('2002', 'Accrued Expenses', liabilityType!.id, NormalBalance.CREDIT, ap.id);

  const sssPayable = await createAccount('2100', 'SSS Contributions Payable', liabilityType!.id, NormalBalance.CREDIT, undefined, true);
  const philhealthPayable = await createAccount('2101', 'PhilHealth Contributions Payable', liabilityType!.id, NormalBalance.CREDIT, undefined, true);
  const pagibigPayable = await createAccount('2102', 'Pag-IBIG Contributions Payable', liabilityType!.id, NormalBalance.CREDIT, undefined, true);
  const taxPayable = await createAccount('2103', 'Withholding Tax Payable', liabilityType!.id, NormalBalance.CREDIT, undefined, true);
  const vatPayable = await createAccount('2104', 'Output VAT Payable', liabilityType!.id, NormalBalance.CREDIT, undefined, true);
  await createAccount('2105', 'Deferred Output VAT', liabilityType!.id, NormalBalance.CREDIT);
  await createAccount('2110', 'Income Tax Payable', liabilityType!.id, NormalBalance.CREDIT);
  const loansPayable = await createAccount('2200', 'Loans Payable', liabilityType!.id, NormalBalance.CREDIT);
  await createAccount('2201', 'Short-Term Bank Loans', liabilityType!.id, NormalBalance.CREDIT, loansPayable.id);
  await createAccount('2202', 'Long-Term Loans', liabilityType!.id, NormalBalance.CREDIT, loansPayable.id);

  // Equity
  const ownerEquity = await createAccount('3000', "Owner's Equity / Share Capital", equityType!.id, NormalBalance.CREDIT);
  await createAccount('3001', 'Paid-in Capital', equityType!.id, NormalBalance.CREDIT, ownerEquity.id);
  await createAccount('3100', 'Retained Earnings', equityType!.id, NormalBalance.CREDIT, undefined, true);
  await createAccount('3200', 'Current Year Earnings', equityType!.id, NormalBalance.CREDIT, undefined, true);
  await createAccount('3300', 'Drawings / Dividends', equityType!.id, NormalBalance.DEBIT);

  // Income
  const revenue = await createAccount('4000', 'Revenue', incomeType!.id, NormalBalance.CREDIT);
  await createAccount('4001', 'Sales Revenue', incomeType!.id, NormalBalance.CREDIT, revenue.id);
  await createAccount('4002', 'Service Revenue', incomeType!.id, NormalBalance.CREDIT, revenue.id);
  const otherIncome = await createAccount('4100', 'Other Income', incomeType!.id, NormalBalance.CREDIT);
  await createAccount('4101', 'Interest Income', incomeType!.id, NormalBalance.CREDIT, otherIncome.id);
  await createAccount('4102', 'Gain on Asset Disposal', incomeType!.id, NormalBalance.CREDIT, otherIncome.id);
  await createAccount('4103', 'Foreign Exchange Gain', incomeType!.id, NormalBalance.CREDIT, otherIncome.id);

  // Expenses
  const cogs = await createAccount('5000', 'Cost of Sales', expenseType!.id, NormalBalance.DEBIT, undefined, true);
  await createAccount('5001', 'Cost of Goods Sold', expenseType!.id, NormalBalance.DEBIT, cogs.id);
  await createAccount('5002', 'Freight and Delivery', expenseType!.id, NormalBalance.DEBIT, cogs.id);

  const opex = await createAccount('6000', 'Operating Expenses', expenseType!.id, NormalBalance.DEBIT);
  const salaries = await createAccount('6001', 'Salaries and Wages', expenseType!.id, NormalBalance.DEBIT, opex.id, true);
  const sssExp = await createAccount('6002', 'SSS Employer Contribution', expenseType!.id, NormalBalance.DEBIT, opex.id, true);
  const phExp = await createAccount('6003', 'PhilHealth Employer Contribution', expenseType!.id, NormalBalance.DEBIT, opex.id, true);
  const piExp = await createAccount('6004', 'Pag-IBIG Employer Contribution', expenseType!.id, NormalBalance.DEBIT, opex.id, true);
  await createAccount('6005', 'Depreciation Expense', expenseType!.id, NormalBalance.DEBIT, opex.id, true);
  await createAccount('6006', 'Rent Expense', expenseType!.id, NormalBalance.DEBIT, opex.id);
  await createAccount('6007', 'Utilities Expense', expenseType!.id, NormalBalance.DEBIT, opex.id);
  await createAccount('6008', 'Office Supplies Expense', expenseType!.id, NormalBalance.DEBIT, opex.id);
  await createAccount('6009', 'Communications Expense', expenseType!.id, NormalBalance.DEBIT, opex.id);
  await createAccount('6010', 'Marketing and Advertising', expenseType!.id, NormalBalance.DEBIT, opex.id);
  await createAccount('6011', 'Professional Fees', expenseType!.id, NormalBalance.DEBIT, opex.id);
  await createAccount('6012', 'Travel and Transportation', expenseType!.id, NormalBalance.DEBIT, opex.id);
  await createAccount('6013', 'Meals and Entertainment', expenseType!.id, NormalBalance.DEBIT, opex.id);
  await createAccount('6014', 'Repairs and Maintenance', expenseType!.id, NormalBalance.DEBIT, opex.id);
  await createAccount('6100', 'Interest Expense', expenseType!.id, NormalBalance.DEBIT);
  await createAccount('6101', 'Bank Charges', expenseType!.id, NormalBalance.DEBIT);
  await createAccount('6102', 'Foreign Exchange Loss', expenseType!.id, NormalBalance.DEBIT);
  await createAccount('6103', 'Loss on Asset Disposal', expenseType!.id, NormalBalance.DEBIT);
  await createAccount('6200', 'Income Tax Expense', expenseType!.id, NormalBalance.DEBIT);

  console.warn('✅ Chart of Accounts created');

  // ── Tax Codes ─────────────────────────────────────────────────────────────
  const taxCodes = [
    { code: 'VAT12', name: 'VAT 12% Output', rate: 0.12, type: 'VAT_OUTPUT', glAccountId: vatPayable.id },
    { code: 'VATIN', name: 'VAT 12% Input', rate: 0.12, type: 'VAT_INPUT', glAccountId: vatInput.id },
    { code: 'EXEMPT', name: 'VAT Exempt', rate: 0, type: 'VAT_OUTPUT', glAccountId: null },
    { code: 'ZERO', name: 'Zero-Rated VAT', rate: 0, type: 'VAT_OUTPUT', glAccountId: null },
    { code: 'EWT-2306', name: 'Withholding Tax on Compensation', rate: 0.05, type: 'WITHHOLDING', glAccountId: taxPayable.id },
    { code: 'EWT-2307-2', name: 'Creditable WT 2%', rate: 0.02, type: 'WITHHOLDING', glAccountId: taxPayable.id },
    { code: 'EWT-2307-5', name: 'Creditable WT 5%', rate: 0.05, type: 'WITHHOLDING', glAccountId: taxPayable.id },
    { code: 'EWT-2307-10', name: 'Creditable WT 10%', rate: 0.10, type: 'WITHHOLDING', glAccountId: taxPayable.id },
    { code: 'EWT-2307-15', name: 'Creditable WT 15%', rate: 0.15, type: 'WITHHOLDING', glAccountId: taxPayable.id },
  ];

  for (const tc of taxCodes) {
    await prisma.taxCode.upsert({
      where: { companyId_code: { companyId: company.id, code: tc.code } },
      update: {},
      create: {
        companyId: company.id,
        code: tc.code,
        name: tc.name,
        rate: tc.rate,
        type: tc.type as never,
        glAccountId: tc.glAccountId,
        jurisdiction: 'PH',
      },
    });
  }

  console.warn('✅ Tax codes created');

  // ── Accounting Periods (FY 2026) ──────────────────────────────────────────
  const months = [
    { name: 'January 2026', start: '2026-01-01', end: '2026-01-31' },
    { name: 'February 2026', start: '2026-02-01', end: '2026-02-28' },
    { name: 'March 2026', start: '2026-03-01', end: '2026-03-31' },
    { name: 'April 2026', start: '2026-04-01', end: '2026-04-30' },
    { name: 'May 2026', start: '2026-05-01', end: '2026-05-31' },
    { name: 'June 2026', start: '2026-06-01', end: '2026-06-30' },
    { name: 'July 2026', start: '2026-07-01', end: '2026-07-31' },
    { name: 'August 2026', start: '2026-08-01', end: '2026-08-31' },
    { name: 'September 2026', start: '2026-09-01', end: '2026-09-30' },
    { name: 'October 2026', start: '2026-10-01', end: '2026-10-31' },
    { name: 'November 2026', start: '2026-11-01', end: '2026-11-30' },
    { name: 'December 2026', start: '2026-12-01', end: '2026-12-31' },
  ];

  for (const m of months) {
    const startDate = new Date(m.start);
    const endDate = new Date(m.end);
    const existing = await prisma.accountingPeriod.findFirst({
      where: { companyId: company.id, startDate, endDate },
    });
    if (!existing) {
      await prisma.accountingPeriod.create({
        data: {
          companyId: company.id,
          name: m.name,
          startDate,
          endDate,
          status: PeriodStatus.OPEN,
        },
      });
    }
  }

  console.warn('✅ Accounting periods created');

  // ── Admin User ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@1234!', 12);
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'Super Admin' } });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@demoenterprise.ph' },
    update: {},
    create: {
      email: 'admin@demoenterprise.ph',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
    },
  });

  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: adminUser.id, companyId: company.id } },
    update: {},
    create: {
      userId: adminUser.id,
      companyId: company.id,
      roleId: superAdminRole!.id,
    },
  });

  // ── Demo Bank Account ─────────────────────────────────────────────────────
  const cashInBankAccount = await prisma.account.findFirst({
    where: { companyId: company.id, code: '1002' },
  });

  await prisma.bankAccount.upsert({
    where: { id: 'demo-bank-account-id' },
    update: {},
    create: {
      id: 'demo-bank-account-id',
      companyId: company.id,
      currencyId: php.id,
      glAccountId: cashInBankAccount?.id,
      name: 'BDO Main Account',
      accountNo: '1234-5678-90',
      bankName: 'Banco de Oro (BDO)',
    },
  });

  // ── Demo Warehouse ────────────────────────────────────────────────────────
  await prisma.warehouse.upsert({
    where: { id: 'demo-warehouse-id' },
    update: {},
    create: {
      id: 'demo-warehouse-id',
      companyId: company.id,
      name: 'Main Warehouse',
      location: 'Makati City',
    },
  });

  // ── Sample Employee ───────────────────────────────────────────────────────
  const salaryAccount = await prisma.account.findFirst({
    where: { companyId: company.id, code: '6001' },
  });

  await prisma.employee.upsert({
    where: { companyId_employeeNo: { companyId: company.id, employeeNo: 'EMP-001' } },
    update: {},
    create: {
      companyId: company.id,
      salaryExpenseAccountId: salaryAccount?.id,
      employeeNo: 'EMP-001',
      firstName: 'Juan',
      lastName: 'dela Cruz',
      email: 'juan.delacruz@demoenterprise.ph',
      position: 'Senior Accountant',
      department: 'Finance',
      basicSalary: 35000,
      payFrequency: 'SEMI_MONTHLY',
      sssNo: '12-3456789-0',
      philhealthNo: '12-345678901-2',
      pagibigNo: '1234-5678-9012',
      tin: '123-456-789-000',
      hireDate: new Date('2024-01-15'),
    },
  });

  // ── Sample Customer ───────────────────────────────────────────────────────
  const arAccount = await prisma.account.findFirst({
    where: { companyId: company.id, code: '1100' },
  });

  await prisma.customer.upsert({
    where: { companyId_code: { companyId: company.id, code: 'CUST-001' } },
    update: {},
    create: {
      companyId: company.id,
      currencyId: php.id,
      arAccountId: arAccount?.id,
      code: 'CUST-001',
      name: 'ABC Trading Corporation',
      email: 'billing@abctrading.ph',
      phone: '+63 2 8000 1234',
      taxId: '987-654-321-000',
      creditLimit: 500000,
      paymentTerms: 30,
    },
  });

  // ── Sample Vendor ─────────────────────────────────────────────────────────
  const apAccount = await prisma.account.findFirst({
    where: { companyId: company.id, code: '2000' },
  });

  await prisma.vendor.upsert({
    where: { companyId_code: { companyId: company.id, code: 'VEND-001' } },
    update: {},
    create: {
      companyId: company.id,
      currencyId: php.id,
      apAccountId: apAccount?.id,
      code: 'VEND-001',
      name: 'XYZ Supplies Inc.',
      email: 'accounts@xyzsupplies.ph',
      phone: '+63 2 8000 9876',
      taxId: '111-222-333-000',
      paymentTerms: 30,
    },
  });

  // ── HR System Test Users ──────────────────────────────────────────────────
  // Test data for HR-SYSTEM-HHC frontend application
  const testHRUsers = [
    { email: 'admin@hhc.com', firstName: 'System', lastName: 'Administrator', password: 'Admin@2026', role: 'Super Admin' },
    { email: 'maria.santos@hhc.com', firstName: 'Maria', lastName: 'Santos', password: 'Maria@2026', role: 'Company Admin' },
    { email: 'carlos.reyes@hhc.com', firstName: 'Carlos', lastName: 'Reyes', password: 'Carlos@2026', role: 'Company Admin' },
    { email: 'john.smith@hhc.com', firstName: 'John', lastName: 'Smith', password: 'John@2026', role: 'Accountant' },
    { email: 'emily.johnson@hhc.com', firstName: 'Emily', lastName: 'Johnson', password: 'Emily@2026', role: 'Accountant' },
    { email: 'ang.santos@hhc.com', firstName: 'Angela', lastName: 'Santos', password: 'Angela@2026', role: 'AP Clerk' },
    { email: 'robert.cruz@hhc.com', firstName: 'Robert', lastName: 'Cruz', password: 'Robert@2026', role: 'AR Clerk' },
    { email: 'patricia.flores@hhc.com', firstName: 'Patricia', lastName: 'Flores', password: 'Patricia@2026', role: 'Payroll Officer' },
    { email: 'michael.davis@hhc.com', firstName: 'Michael', lastName: 'Davis', password: 'Michael@2026', role: 'Auditor' },
    { email: 'diana.wilson@hhc.com', firstName: 'Diana', lastName: 'Wilson', password: 'Diana@2026', role: 'Viewer' },
    { email: 'thomas.anderson@hhc.com', firstName: 'Thomas', lastName: 'Anderson', password: 'Thomas@2026', role: 'Viewer' },
  ];

  for (const testUser of testHRUsers) {
    const passHash = await bcrypt.hash(testUser.password, 12);
    const role = await prisma.role.findUnique({ where: { name: testUser.role } });
    
    const user = await prisma.user.upsert({
      where: { email: testUser.email },
      update: {},
      create: {
        email: testUser.email,
        passwordHash: passHash,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
      },
    });

    await prisma.userCompany.upsert({
      where: { userId_companyId: { userId: user.id, companyId: company.id } },
      update: {},
      create: {
        userId: user.id,
        companyId: company.id,
        roleId: role!.id,
      },
    });
  }

  console.warn('✅ Demo company, users, customers, vendors seeded');
  console.warn('✅ HR System test users seeded');
  console.warn('');
  console.warn('🔑 Admin Login credentials:');
  console.warn('   Email:    admin@demoenterprise.ph');
  console.warn('   Password: Admin@1234!');
  console.warn('');
  console.warn('🔑 HR System Test Users (all passwords end with @2026):');
  console.warn('   1. admin@hhc.com            (Super Admin)');
  console.warn('   2. maria.santos@hhc.com     (Company Admin) - HR-2026-001');
  console.warn('   3. carlos.reyes@hhc.com     (Company Admin) - HR-2026-002');
  console.warn('   4. john.smith@hhc.com       (Accountant)');
  console.warn('   5. emily.johnson@hhc.com    (Accountant)');
  console.warn('   6. ang.santos@hhc.com       (AP Clerk)');
  console.warn('   7. robert.cruz@hhc.com      (AR Clerk)');
  console.warn('   8. patricia.flores@hhc.com  (Payroll Officer)');
  console.warn('   9. michael.davis@hhc.com    (Auditor)');
  console.warn('   10. diana.wilson@hhc.com    (Viewer)');
  console.warn('   11. thomas.anderson@hhc.com (Viewer)');
  console.warn('');
  console.warn('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
