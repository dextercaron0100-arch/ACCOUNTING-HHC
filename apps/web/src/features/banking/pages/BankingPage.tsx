import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../../lib/api';
import { formatCurrency } from '../../../lib/money';
import { formatDate } from '../../../lib/date';

interface BankAccount { id: string; name: string; accountNo: string; glAccount: { name: string } }
interface BankTransaction {
  id: string; date: string; description: string; amount: string;
  status: string; matchedEntryId?: string;
}
interface ReconciliationSummary { total: number; matched: number; unmatched: number; matchRate: string }

const TXN_STATUS: Record<string, string> = {
  UNMATCHED: 'bg-yellow-900 text-yellow-300',
  MATCHED: 'bg-green-900 text-green-300',
  EXCEPTION: 'bg-red-900 text-red-300',
};

export function BankingPage() {
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const qc = useQueryClient();

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ['banking', 'accounts'],
    queryFn: () => apiGet<BankAccount[]>('/banking/accounts'),
  });

  const { data: txnsData } = useQuery({
    queryKey: ['banking', 'transactions', selectedAccount?.id],
    queryFn: () => apiGet<{ data: BankTransaction[] }>(`/banking/accounts/${selectedAccount!.id}/transactions`),
    enabled: !!selectedAccount,
  });
  const transactions = txnsData?.data ?? [];

  const { data: summary } = useQuery<ReconciliationSummary>({
    queryKey: ['banking', 'summary', selectedAccount?.id],
    queryFn: () => apiGet<ReconciliationSummary>(`/banking/accounts/${selectedAccount!.id}/summary`),
    enabled: !!selectedAccount,
  });

  const unmatchMutation = useMutation({
    mutationFn: (txnId: string) => apiPost(`/banking/transactions/${txnId}/unmatch`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['banking', 'transactions'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Bank Reconciliation</h1>
        <p className="text-sm text-gray-400">Import statements, auto-match, and lock periods</p>
      </div>

      {/* Bank Account Selector */}
      <div className="flex gap-3 flex-wrap">
        {accounts.map((acc) => (
          <button
            key={acc.id}
            onClick={() => setSelectedAccount(acc)}
            className={`rounded-xl border px-5 py-3 text-left transition-colors ${selectedAccount?.id === acc.id ? 'border-indigo-500 bg-indigo-900/30' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
          >
            <p className="font-semibold text-white">{acc.name}</p>
            <p className="text-xs text-gray-400">{acc.accountNo}</p>
            <p className="text-xs text-gray-500">{acc.glAccount?.name}</p>
          </button>
        ))}
        {accounts.length === 0 && <p className="text-gray-500 text-sm">No bank accounts configured yet.</p>}
      </div>

      {selectedAccount && summary && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Transactions', value: String(summary.total), color: 'text-white' },
            { label: 'Matched', value: String(summary.matched), color: 'text-green-400' },
            { label: 'Unmatched', value: String(summary.unmatched), color: 'text-yellow-400' },
            { label: 'Match Rate', value: `${summary.matchRate}%`, color: summary.unmatched === 0 ? 'text-green-400' : 'text-yellow-400' },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-gray-700 bg-gray-800 px-5 py-4">
              <p className="text-xs text-gray-400">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {selectedAccount && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
            <span className="font-semibold text-white">Transactions — {selectedAccount.name}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Date</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Description</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Amount</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Status</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn.id} className="border-t border-gray-700 hover:bg-gray-700/30">
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{formatDate(txn.date)}</td>
                  <td className="px-4 py-2.5 text-gray-300">{txn.description}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${parseFloat(txn.amount) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(txn.amount)}</td>
                  <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full ${TXN_STATUS[txn.status] ?? ''}`}>{txn.status}</span></td>
                  <td className="px-4 py-2.5">
                    {txn.status === 'MATCHED' && (
                      <button onClick={() => unmatchMutation.mutate(txn.id)} className="text-xs text-gray-400 hover:text-white">Unmatch</button>
                    )}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No transactions imported yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
