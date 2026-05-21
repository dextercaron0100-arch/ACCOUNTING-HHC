import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../../lib/api';
import { formatCurrency } from '../../../lib/money';

interface IncomeStatementLine { accountId: string; accountCode: string; accountName: string; amount: string }
interface IncomeStatement {
  revenue: IncomeStatementLine[]; expenses: IncomeStatementLine[];
  totalRevenue: string; totalExpenses: string; netIncome: string; periodName?: string;
}
interface BalanceSheetSection { accountId: string; accountCode: string; accountName: string; balance: string }
interface BalanceSheet {
  assets: BalanceSheetSection[]; liabilities: BalanceSheetSection[]; equity: BalanceSheetSection[];
  totalAssets: string; totalLiabilities: string; totalEquity: string; isBalanced: boolean;
}

function StatementSection({ title, lines, total, totalLabel, totalColor }: {
  title: string; lines: { accountName: string; amount?: string; balance?: string }[];
  total: string; totalLabel: string; totalColor?: string;
}) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">{title}</h3>
      <div className="space-y-1">
        {lines.map((l, i) => (
          <div key={i} className="flex justify-between px-3 py-1 hover:bg-gray-700/20 rounded">
            <span className="text-sm text-gray-300">{l.accountName}</span>
            <span className="font-mono text-sm text-white">{formatCurrency(l.amount ?? l.balance ?? '0')}</span>
          </div>
        ))}
        <div className={`flex justify-between border-t border-gray-600 px-3 py-2 mt-1 font-semibold ${totalColor ?? 'text-white'}`}>
          <span className="text-sm">{totalLabel}</span>
          <span className="font-mono text-sm">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

export function StatementsPage() {
  const [tab, setTab] = useState<'pl' | 'bs' | 'cf'>('pl');

  const { data: plData } = useQuery<IncomeStatement>({
    queryKey: ['statements', 'income-statement'],
    queryFn: () => apiGet<IncomeStatement>('/statements/income-statement'),
  });

  const { data: bsData } = useQuery<BalanceSheet>({
    queryKey: ['statements', 'balance-sheet'],
    queryFn: () => apiGet<BalanceSheet>('/statements/balance-sheet'),
  });

  const netIncome = plData ? parseFloat(plData.netIncome) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Financial Statements</h1>
          <p className="text-sm text-gray-400">P&L, Balance Sheet, Cash Flow</p>
        </div>
        <div className="flex rounded-lg border border-gray-700 overflow-hidden">
          <button onClick={() => setTab('pl')} className={`px-4 py-2 text-sm ${tab === 'pl' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>P&L</button>
          <button onClick={() => setTab('bs')} className={`px-4 py-2 text-sm ${tab === 'bs' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Balance Sheet</button>
          <button onClick={() => setTab('cf')} className={`px-4 py-2 text-sm ${tab === 'cf' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Cash Flow</button>
        </div>
      </div>

      {tab === 'pl' && plData && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 max-w-2xl">
          <h2 className="mb-6 text-center text-lg font-bold text-white">Income Statement</h2>
          <StatementSection title="Revenue" lines={plData.revenue} total={plData.totalRevenue} totalLabel="Total Revenue" totalColor="text-green-400" />
          <StatementSection title="Expenses" lines={plData.expenses} total={plData.totalExpenses} totalLabel="Total Expenses" totalColor="text-red-400" />
          <div className={`flex justify-between rounded-lg px-3 py-3 mt-4 border-2 ${netIncome >= 0 ? 'border-green-700 bg-green-900/20' : 'border-red-700 bg-red-900/20'}`}>
            <span className="font-bold text-white">Net Income</span>
            <span className={`font-mono font-bold text-lg ${netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(plData.netIncome)}</span>
          </div>
        </div>
      )}

      {tab === 'bs' && bsData && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
            <h2 className="mb-4 text-center text-base font-bold text-white">Assets</h2>
            <StatementSection title="Assets" lines={bsData.assets} total={bsData.totalAssets} totalLabel="Total Assets" />
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
            <h2 className="mb-4 text-center text-base font-bold text-white">Liabilities & Equity</h2>
            <StatementSection title="Liabilities" lines={bsData.liabilities} total={bsData.totalLiabilities} totalLabel="Total Liabilities" totalColor="text-orange-400" />
            <StatementSection title="Equity" lines={bsData.equity} total={bsData.totalEquity} totalLabel="Total Equity" totalColor="text-blue-400" />
            <div className={`flex justify-between rounded-lg px-3 py-2 mt-2 ${bsData.isBalanced ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
              <span className="font-semibold text-sm">Liabilities + Equity</span>
              <span className="font-mono font-semibold text-sm">{formatCurrency(String(parseFloat(bsData.totalLiabilities) + parseFloat(bsData.totalEquity)))}</span>
            </div>
            {!bsData.isBalanced && <p className="mt-2 text-xs text-red-400 text-center">Balance sheet is not balanced — check for missing entries</p>}
          </div>
        </div>
      )}

      {tab === 'cf' && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 max-w-2xl">
          <h2 className="mb-4 text-center text-base font-bold text-white">Cash Flow Statement (Indirect)</h2>
          <p className="text-center text-sm text-gray-400">Cash flow statement data is derived from journal entries.</p>
          <p className="mt-2 text-center text-xs text-gray-500">Use GET /statements/cash-flow to retrieve the full report.</p>
        </div>
      )}
    </div>
  );
}
