import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../../lib/api';
import { formatCurrency } from '../../../lib/money';
import { formatDate } from '../../../lib/date';

interface ExpenseClaim {
  id: string; title: string; totalAmount: string; status: string;
  submittedAt?: string; submitter: { name: string };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-700 text-gray-300', SUBMITTED: 'bg-yellow-900 text-yellow-300',
  APPROVED: 'bg-blue-900 text-blue-300', REJECTED: 'bg-red-900 text-red-300',
  REIMBURSED: 'bg-green-900 text-green-300',
};

export function ExpensesPage() {
  const [tab, setTab] = useState<'my' | 'all'>('my');
  const qc = useQueryClient();

  const { data: claimsData } = useQuery({
    queryKey: ['expenses', tab],
    queryFn: () => apiGet<{ data: ExpenseClaim[] }>('/expenses'),
  });
  const claims = claimsData?.data ?? [];

  const submitMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/expenses/${id}/submit`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      apiPost(`/expenses/${id}/approve`, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const totalPending = claims.filter((c) => c.status === 'SUBMITTED').reduce((s, c) => s + parseFloat(c.totalAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Expense Claims</h1>
          <p className="text-sm text-gray-400">Pending approval: <span className="text-yellow-400 font-semibold">{formatCurrency(String(totalPending))}</span></p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Title</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Submitted By</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Date</th>
              <th className="px-4 py-3 text-right text-gray-400 font-medium">Amount</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Status</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-t border-gray-700 hover:bg-gray-700/30">
                <td className="px-4 py-2.5 text-white">{c.title}</td>
                <td className="px-4 py-2.5 text-gray-400">{c.submitter?.name}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{c.submittedAt ? formatDate(c.submittedAt) : '—'}</td>
                <td className="px-4 py-2.5 text-right font-mono text-white">{formatCurrency(c.totalAmount)}</td>
                <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] ?? ''}`}>{c.status}</span></td>
                <td className="px-4 py-2.5 flex gap-2">
                  {c.status === 'DRAFT' && (
                    <button onClick={() => submitMutation.mutate(c.id)} className="text-xs text-indigo-400 hover:text-indigo-300">Submit</button>
                  )}
                  {c.status === 'SUBMITTED' && (
                    <>
                      <button onClick={() => approveMutation.mutate({ id: c.id, action: 'APPROVE' })} className="text-xs text-green-400 hover:text-green-300">Approve</button>
                      <button onClick={() => approveMutation.mutate({ id: c.id, action: 'REJECT' })} className="text-xs text-red-400 hover:text-red-300">Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {claims.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No expense claims yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
