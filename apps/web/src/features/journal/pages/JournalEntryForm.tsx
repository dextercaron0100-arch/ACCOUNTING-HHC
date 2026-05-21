import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { money, formatCurrency, isBalanced } from '@/lib/money';
import { today } from '@/lib/date';
import type { Account } from '@shared/types/account';
import Decimal from 'decimal.js';

interface Line {
  id: string;
  accountId: string;
  debitAmount: string;
  creditAmount: string;
  memo: string;
}

const emptyLine = (): Line => ({
  id: crypto.randomUUID(),
  accountId: '',
  debitAmount: '',
  creditAmount: '',
  memo: '',
});

export default function JournalEntryForm() {
  const router = useRouter();
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState('');

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-flat'],
    queryFn: () => apiGet<Account[]>('/api/v1/accounts/flat'),
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiPost('/api/v1/journal', data),
    onSuccess: () => router.navigate({ to: '/journal' }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to save';
      setError(msg);
    },
  });

  const totalDebits = lines.reduce((s, l) => s.plus(money(l.debitAmount || '0')), new Decimal(0));
  const totalCredits = lines.reduce((s, l) => s.plus(money(l.creditAmount || '0')), new Decimal(0));
  const balanced = isBalanced(totalDebits.toFixed(4), totalCredits.toFixed(4));
  const hasAmounts = totalDebits.gt(0);

  const updateLine = useCallback((id: string, field: keyof Line, value: string) => {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }, []);

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (id: string) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleDebitChange = (id: string, value: string) => {
    updateLine(id, 'debitAmount', value);
    if (value) updateLine(id, 'creditAmount', '');
  };

  const handleCreditChange = (id: string, value: string) => {
    updateLine(id, 'creditAmount', value);
    if (value) updateLine(id, 'debitAmount', '');
  };

  const handleSubmit = (e: React.FormEvent, shouldPost = false) => {
    e.preventDefault();
    setError('');

    if (!balanced) { setError('Debits must equal credits'); return; }
    if (!hasAmounts) { setError('Enter at least one amount'); return; }

    const payload = {
      reference,
      date,
      description,
      lines: lines
        .filter((l) => l.accountId)
        .map((l, i) => ({
          accountId: l.accountId,
          debitAmount: l.debitAmount || '0',
          creditAmount: l.creditAmount || '0',
          memo: l.memo || undefined,
          lineNo: i + 1,
        })),
    };

    createMutation.mutate(payload);
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Journal Entry</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Header fields */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Reference No.</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="JE-2026-001"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Description of this entry"
                required
              />
            </div>
          </div>
        </div>

        {/* Lines table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-2.5 px-4 font-medium text-gray-600 w-2/5">Account</th>
                <th className="text-left py-2.5 px-4 font-medium text-gray-600">Memo</th>
                <th className="text-right py-2.5 px-4 font-medium text-gray-600 w-32">Debit (₱)</th>
                <th className="text-right py-2.5 px-4 font-medium text-gray-600 w-32">Credit (₱)</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-2">
                    <select
                      value={line.accountId}
                      onChange={(e) => updateLine(line.id, 'accountId', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select account...</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={line.memo}
                      onChange={(e) => updateLine(line.id, 'memo', e.target.value)}
                      placeholder="Optional memo"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={line.debitAmount}
                      onChange={(e) => handleDebitChange(line.id, e.target.value)}
                      placeholder="0.00"
                      step="0.0001"
                      min="0"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={line.creditAmount}
                      onChange={(e) => handleCreditChange(line.id, e.target.value)}
                      placeholder="0.00"
                      step="0.0001"
                      min="0"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      disabled={lines.length <= 2}
                      className="p-1 text-gray-300 hover:text-red-500 rounded disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-blue-600 hover:text-blue-700 text-xs font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add line
                  </button>
                </td>
                <td />
                <td className="px-4 py-3 text-right font-mono font-semibold text-sm">
                  {formatCurrency(totalDebits.toFixed(4))}
                </td>
                <td className={`px-4 py-3 text-right font-mono font-semibold text-sm ${balanced && hasAmounts ? 'text-green-700' : 'text-red-600'}`}>
                  {formatCurrency(totalCredits.toFixed(4))}
                </td>
                <td className="px-2 py-3 text-center">
                  {balanced && hasAmounts
                    ? <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                    : <AlertCircle className="w-4 h-4 text-red-400 mx-auto" />
                  }
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.navigate({ to: '/journal' })}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            type="submit"
            onClick={(e) => handleSubmit(e, true)}
            disabled={createMutation.isPending || !balanced || !hasAmounts}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Save & Post
          </button>
        </div>
      </form>
    </div>
  );
}
