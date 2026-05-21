import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../../lib/api';
import { formatCurrency } from '../../../lib/money';
import { formatDate } from '../../../lib/date';

interface Account { id: string; code: string; name: string; accountTypeName: string }
interface LedgerEntry {
  date: string; reference: string; description: string;
  debit: string; credit: string; balance: string; entryId: string;
}
interface TrialBalanceLine {
  accountId: string; accountCode: string; accountName: string;
  debitTotal: string; creditTotal: string; netBalance: string;
}

export function LedgerPage() {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [tab, setTab] = useState<'gl' | 'trial'>('trial');

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts', 'flat'],
    queryFn: () => apiGet<Account[]>('/accounts/flat'),
  });

  const { data: ledgerEntries = [], isFetching: glLoading } = useQuery<LedgerEntry[]>({
    queryKey: ['ledger', selectedAccountId],
    queryFn: () => apiGet<LedgerEntry[]>(`/ledger/account/${selectedAccountId}`),
    enabled: !!selectedAccountId,
  });

  const { data: trialBalance = [] } = useQuery<TrialBalanceLine[]>({
    queryKey: ['ledger', 'trial-balance'],
    queryFn: () => apiGet<TrialBalanceLine[]>('/ledger/trial-balance/current'),
  });

  const totalDebits = trialBalance.reduce((s, r) => s + parseFloat(r.debitTotal || '0'), 0);
  const totalCredits = trialBalance.reduce((s, r) => s + parseFloat(r.creditTotal || '0'), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">General Ledger</h1>
          <p className="text-sm text-gray-400">Account activity and trial balance</p>
        </div>
        <div className="flex rounded-lg border border-gray-700 overflow-hidden">
          <button onClick={() => setTab('trial')} className={`px-4 py-2 text-sm ${tab === 'trial' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Trial Balance</button>
          <button onClick={() => setTab('gl')} className={`px-4 py-2 text-sm ${tab === 'gl' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Account Ledger</button>
        </div>
      </div>

      {tab === 'trial' && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
            <span className="font-semibold text-white">Trial Balance</span>
            <span className={`text-xs px-2 py-1 rounded-full ${isBalanced ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
              {isBalanced ? 'Balanced' : 'OUT OF BALANCE'}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Code</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Account Name</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Debit</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Credit</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Net Balance</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.map((row) => (
                <tr key={row.accountId} className="border-t border-gray-700 hover:bg-gray-700/30">
                  <td className="px-4 py-2.5 font-mono text-gray-400 text-xs">{row.accountCode}</td>
                  <td className="px-4 py-2.5 text-white">{row.accountName}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-300">{formatCurrency(row.debitTotal)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-300">{formatCurrency(row.creditTotal)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-semibold ${parseFloat(row.netBalance) >= 0 ? 'text-white' : 'text-red-400'}`}>
                    {formatCurrency(row.netBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-600 bg-gray-700/30">
              <tr>
                <td colSpan={2} className="px-4 py-3 font-semibold text-white">Totals</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-white">{formatCurrency(String(totalDebits))}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-white">{formatCurrency(String(totalCredits))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {tab === 'gl' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm w-72 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">Select an account...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
            {glLoading && <span className="text-xs text-gray-400">Loading...</span>}
          </div>

          {selectedAccountId && (
            <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Date</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Reference</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Description</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Debit</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Credit</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map((e, i) => (
                    <tr key={i} className="border-t border-gray-700 hover:bg-gray-700/30">
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{formatDate(e.date)}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-400 text-xs">{e.reference}</td>
                      <td className="px-4 py-2.5 text-gray-300">{e.description}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-green-400">{parseFloat(e.debit) > 0 ? formatCurrency(e.debit) : ''}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-red-400">{parseFloat(e.credit) > 0 ? formatCurrency(e.credit) : ''}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-white">{formatCurrency(e.balance)}</td>
                    </tr>
                  ))}
                  {ledgerEntries.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No transactions found for this account</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
