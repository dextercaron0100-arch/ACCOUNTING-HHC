import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../../lib/api';
import { formatCurrency } from '../../../lib/money';
import { formatDate, toApiDate } from '../../../lib/date';

interface Customer { id: string; name: string; email: string; phone?: string }
interface Invoice {
  id: string; reference: string; date: string; dueDate: string;
  customer: Customer; total: string; paidAmount: string; status: string;
}
interface AgingBucket { customerId: string; customerName: string; current: string; days1_30: string; days31_60: string; days61_90: string; over90: string; total: string }

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-700 text-gray-300', OPEN: 'bg-blue-900 text-blue-300',
  PARTIAL: 'bg-yellow-900 text-yellow-300', PAID: 'bg-green-900 text-green-300',
  VOID: 'bg-red-900 text-red-300',
};

export function ArPage() {
  const [tab, setTab] = useState<'invoices' | 'customers' | 'aging'>('invoices');
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const qc = useQueryClient();

  const { data: invoicesData } = useQuery({ queryKey: ['ar', 'invoices'], queryFn: () => apiGet<{ data: Invoice[] }>('/ar/invoices') });
  const { data: customersData } = useQuery({ queryKey: ['ar', 'customers'], queryFn: () => apiGet<{ data: Customer[] }>('/ar/customers') });
  const { data: aging = [] } = useQuery<AgingBucket[]>({ queryKey: ['ar', 'aging'], queryFn: () => apiGet<AgingBucket[]>('/ar/aging') });

  const invoices = invoicesData?.data ?? [];
  const customers = customersData?.data ?? [];

  const totalOutstanding = invoices.filter((i) => ['OPEN', 'PARTIAL'].includes(i.status))
    .reduce((s, i) => s + parseFloat(i.total) - parseFloat(i.paidAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounts Receivable</h1>
          <p className="text-sm text-gray-400">Outstanding: <span className="text-blue-400 font-semibold">{formatCurrency(String(totalOutstanding))}</span></p>
        </div>
        <div className="flex gap-3">
          <div className="flex rounded-lg border border-gray-700 overflow-hidden">
            {(['invoices', 'customers', 'aging'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm capitalize ${tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>{t}</button>
            ))}
          </div>
          {tab === 'invoices' && (
            <button onClick={() => setShowInvoiceForm(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">+ New Invoice</button>
          )}
        </div>
      </div>

      {tab === 'invoices' && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Reference</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Customer</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Date</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Due</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Total</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Balance</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-gray-700 hover:bg-gray-700/30">
                  <td className="px-4 py-2.5 font-mono text-gray-400 text-xs">{inv.reference}</td>
                  <td className="px-4 py-2.5 text-white">{inv.customer?.name}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{formatDate(inv.date)}</td>
                  <td className={`px-4 py-2.5 text-xs ${new Date(inv.dueDate) < new Date() && inv.status !== 'PAID' ? 'text-red-400' : 'text-gray-400'}`}>{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-white">{formatCurrency(inv.total)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-blue-400">{formatCurrency(String(parseFloat(inv.total) - parseFloat(inv.paidAmount)))}</td>
                  <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[inv.status] ?? ''}`}>{inv.status}</span></td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No invoices yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'customers' && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Name</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Email</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Phone</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-gray-700 hover:bg-gray-700/30">
                  <td className="px-4 py-2.5 text-white font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 text-gray-400">{c.email}</td>
                  <td className="px-4 py-2.5 text-gray-400">{c.phone ?? '—'}</td>
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
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Customer</th>
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
                <tr key={row.customerId} className="border-t border-gray-700 hover:bg-gray-700/30">
                  <td className="px-4 py-2.5 text-white">{row.customerName}</td>
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
