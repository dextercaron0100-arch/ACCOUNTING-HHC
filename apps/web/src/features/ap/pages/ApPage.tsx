import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../../lib/api';
import { formatCurrency } from '../../../lib/money';
import { formatDate } from '../../../lib/date';

interface Vendor { id: string; name: string; email: string }
interface Bill {
  id: string; reference: string; date: string; dueDate: string;
  vendor: Vendor; total: string; paidAmount: string; status: string;
}
interface AgingBucket { vendorId: string; vendorName: string; current: string; days1_30: string; days31_60: string; days61_90: string; over90: string; total: string }

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-700 text-gray-300', OPEN: 'bg-blue-900 text-blue-300',
  PARTIAL: 'bg-yellow-900 text-yellow-300', PAID: 'bg-green-900 text-green-300',
};

export function ApPage() {
  const [tab, setTab] = useState<'bills' | 'vendors' | 'aging'>('bills');

  const { data: billsData } = useQuery({ queryKey: ['ap', 'bills'], queryFn: () => apiGet<{ data: Bill[] }>('/ap/bills') });
  const { data: vendorsData } = useQuery({ queryKey: ['ap', 'vendors'], queryFn: () => apiGet<{ data: Vendor[] }>('/ap/vendors') });
  const { data: aging = [] } = useQuery<AgingBucket[]>({ queryKey: ['ap', 'aging'], queryFn: () => apiGet<AgingBucket[]>('/ap/aging') });

  const bills = billsData?.data ?? [];
  const vendors = vendorsData?.data ?? [];
  const totalPayable = bills.filter((b) => ['OPEN', 'PARTIAL'].includes(b.status)).reduce((s, b) => s + parseFloat(b.total) - parseFloat(b.paidAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounts Payable</h1>
          <p className="text-sm text-gray-400">Outstanding: <span className="text-orange-400 font-semibold">{formatCurrency(String(totalPayable))}</span></p>
        </div>
        <div className="flex rounded-lg border border-gray-700 overflow-hidden">
          {(['bills', 'vendors', 'aging'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm capitalize ${tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>{t}</button>
          ))}
        </div>
      </div>

      {tab === 'bills' && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Reference</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Vendor</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Date</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Due</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Total</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Balance</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id} className="border-t border-gray-700 hover:bg-gray-700/30">
                  <td className="px-4 py-2.5 font-mono text-gray-400 text-xs">{b.reference}</td>
                  <td className="px-4 py-2.5 text-white">{b.vendor?.name}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{formatDate(b.date)}</td>
                  <td className={`px-4 py-2.5 text-xs ${new Date(b.dueDate) < new Date() && b.status !== 'PAID' ? 'text-red-400' : 'text-gray-400'}`}>{formatDate(b.dueDate)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-white">{formatCurrency(b.total)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-orange-400">{formatCurrency(String(parseFloat(b.total) - parseFloat(b.paidAmount)))}</td>
                  <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status] ?? ''}`}>{b.status}</span></td>
                </tr>
              ))}
              {bills.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No bills yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'vendors' && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Name</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="border-t border-gray-700 hover:bg-gray-700/30">
                  <td className="px-4 py-2.5 text-white font-medium">{v.name}</td>
                  <td className="px-4 py-2.5 text-gray-400">{v.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'aging' && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Vendor</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Current</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">1–30 Days</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">31–60 Days</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">61–90 Days</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">90+ Days</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {aging.map((row) => (
                <tr key={row.vendorId} className="border-t border-gray-700 hover:bg-gray-700/30">
                  <td className="px-4 py-2.5 text-white">{row.vendorName}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-300">{formatCurrency(row.current)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-yellow-400">{formatCurrency(row.days1_30)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-orange-400">{formatCurrency(row.days31_60)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-red-400">{formatCurrency(row.days61_90)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-red-600">{formatCurrency(row.over90)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-white">{formatCurrency(row.total)}</td>
                </tr>
              ))}
              {aging.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No aging data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
