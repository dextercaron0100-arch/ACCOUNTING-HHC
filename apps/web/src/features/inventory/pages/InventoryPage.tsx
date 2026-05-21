import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../../lib/api';
import { formatCurrency } from '../../../lib/money';

interface StockItem {
  id: string; sku: string; name: string; unitOfMeasure: string;
  valuationMethod: string; reorderLevel: number;
}
interface StockBalance { itemId: string; quantity: string; avgCost: string; totalValue: string }

export function InventoryPage() {
  const [tab, setTab] = useState<'items' | 'movements'>('items');
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);

  const { data: itemsData } = useQuery({ queryKey: ['inventory', 'items'], queryFn: () => apiGet<{ data: StockItem[] }>('/inventory/items') });
  const items = itemsData?.data ?? [];

  const { data: balance } = useQuery<StockBalance>({
    queryKey: ['inventory', 'balance', selectedItem?.id],
    queryFn: () => apiGet<StockBalance>(`/inventory/items/${selectedItem!.id}/balance`),
    enabled: !!selectedItem,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Inventory</h1>
          <p className="text-sm text-gray-400">Stock items and movements — FIFO/LIFO/Weighted Average</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">SKU</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Name</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">UOM</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Valuation</th>
              <th className="px-4 py-3 text-right text-gray-400 font-medium">Reorder Level</th>
              <th className="px-4 py-3 text-right text-gray-400 font-medium">Qty on Hand</th>
              <th className="px-4 py-3 text-right text-gray-400 font-medium">Stock Value</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-gray-700 hover:bg-gray-700/30 cursor-pointer" onClick={() => setSelectedItem(item)}>
                <td className="px-4 py-2.5 font-mono text-gray-400 text-xs">{item.sku}</td>
                <td className="px-4 py-2.5 text-white">{item.name}</td>
                <td className="px-4 py-2.5 text-gray-400">{item.unitOfMeasure}</td>
                <td className="px-4 py-2.5"><span className="text-xs bg-gray-700 px-2 py-0.5 rounded">{item.valuationMethod}</span></td>
                <td className="px-4 py-2.5 text-right text-gray-400">{item.reorderLevel}</td>
                <td className="px-4 py-2.5 text-right font-mono text-white">—</td>
                <td className="px-4 py-2.5 text-right font-mono text-white">—</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No stock items yet</td></tr>}
          </tbody>
        </table>
      </div>

      {selectedItem && balance && (
        <div className="rounded-xl border border-indigo-700 bg-indigo-900/20 p-5">
          <h3 className="font-semibold text-white mb-3">{selectedItem.name} — Stock Balance</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-gray-800 px-4 py-3">
              <p className="text-xs text-gray-400">Quantity on Hand</p>
              <p className="text-xl font-bold text-white">{balance.quantity} {selectedItem.unitOfMeasure}</p>
            </div>
            <div className="rounded-lg bg-gray-800 px-4 py-3">
              <p className="text-xs text-gray-400">Average Cost</p>
              <p className="text-xl font-bold text-white">{formatCurrency(balance.avgCost)}</p>
            </div>
            <div className="rounded-lg bg-gray-800 px-4 py-3">
              <p className="text-xs text-gray-400">Total Stock Value</p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(balance.totalValue)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
