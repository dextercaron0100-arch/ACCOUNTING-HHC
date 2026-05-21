import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Plus, Eye, CheckCircle } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { formatDate } from '@/lib/date';
import { formatCurrency } from '@/lib/money';
import type { JournalEntry } from '@shared/types/journal';
import type { PaginatedResponse } from '@shared/types/common';

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-yellow-50 text-yellow-700',
  POSTED: 'bg-green-50 text-green-700',
  REVERSED: 'bg-gray-100 text-gray-500',
};

export default function JournalPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['journal', page],
    queryFn: () => apiGet<PaginatedResponse<JournalEntry>>('/api/v1/journal', { page, limit: 20 }),
  });

  const postMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/api/v1/journal/${id}/post`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['journal'] }),
  });

  const entries = (data as unknown as { data: JournalEntry[]; meta: { total: number; totalPages: number } }) ?? { data: [], meta: { total: 0, totalPages: 1 } };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">General Journal</h1>
          <p className="text-gray-500 text-sm mt-0.5">{entries.meta.total} entries total</p>
        </div>
        <Link
          to="/journal/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New Entry
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Reference</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Description</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Debits</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Credits</th>
              <th className="text-center py-3 px-4 font-medium text-gray-600">Status</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading...</td></tr>
            ) : entries.data.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400">No journal entries yet</td></tr>
            ) : (
              entries.data.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-xs">{entry.reference}</td>
                  <td className="py-3 px-4 text-gray-600">{formatDate(entry.date)}</td>
                  <td className="py-3 px-4 text-gray-800 max-w-xs truncate">{entry.description}</td>
                  <td className="py-3 px-4 text-right font-mono">{formatCurrency(entry.totalDebits ?? '0')}</td>
                  <td className="py-3 px-4 text-right font-mono">{formatCurrency(entry.totalCredits ?? '0')}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[entry.status]}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 justify-end">
                      <button className="p-1 text-gray-400 hover:text-blue-600 rounded">
                        <Eye className="w-4 h-4" />
                      </button>
                      {entry.status === 'DRAFT' && (
                        <button
                          onClick={() => postMutation.mutate(entry.id)}
                          className="p-1 text-gray-400 hover:text-green-600 rounded"
                          title="Post this entry"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
