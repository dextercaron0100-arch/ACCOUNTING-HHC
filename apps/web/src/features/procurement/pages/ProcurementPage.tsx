import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../../lib/api';
import { formatCurrency } from '../../../lib/money';
import { formatDate } from '../../../lib/date';

interface PO {
  id: string; poNumber: string; date: string; vendor: { name: string };
  total: string; status: string; approvedBy?: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-700 text-gray-300', APPROVED: 'bg-blue-900 text-blue-300',
  PARTIALLY_RECEIVED: 'bg-yellow-900 text-yellow-300', FULLY_RECEIVED: 'bg-green-900 text-green-300',
  MATCHED: 'bg-purple-900 text-purple-300', CLOSED: 'bg-gray-600 text-gray-400',
};

export function ProcurementPage() {
  const [tab, setTab] = useState<'pos'>('pos');
  const qc = useQueryClient();

  const { data: posData } = useQuery({ queryKey: ['procurement', 'pos'], queryFn: () => apiGet<{ data: PO[] }>('/procurement/pos') });
  const pos = posData?.data ?? [];

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/procurement/pos/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procurement', 'pos'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Procurement</h1>
          <p className="text-sm text-gray-400">Purchase orders, GRNs and 3-way match</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <span className="font-semibold text-white">Purchase Orders</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">PO Number</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Vendor</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Date</th>
              <th className="px-4 py-3 text-right text-gray-400 font-medium">Total</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Status</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pos.map((po) => (
              <tr key={po.id} className="border-t border-gray-700 hover:bg-gray-700/30">
                <td className="px-4 py-2.5 font-mono text-gray-400 text-xs">{po.poNumber}</td>
                <td className="px-4 py-2.5 text-white">{po.vendor?.name}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{formatDate(po.date)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-white">{formatCurrency(po.total)}</td>
                <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[po.status] ?? ''}`}>{po.status}</span></td>
                <td className="px-4 py-2.5">
                  {po.status === 'DRAFT' && (
                    <button onClick={() => approveMutation.mutate(po.id)} className="text-xs text-indigo-400 hover:text-indigo-300">Approve</button>
                  )}
                </td>
              </tr>
            ))}
            {pos.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No purchase orders yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
