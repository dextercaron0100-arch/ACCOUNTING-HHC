import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../../lib/api';
import { formatCurrency } from '../../../lib/money';
import { formatDate } from '../../../lib/date';

interface Asset {
  id: string; code: string; name: string; acquisitionDate: string;
  acquisitionCost: string; residualValue: string; usefulLifeMonths: number;
  depreciationMethod: string; status: string;
}

const METHOD_LABELS: Record<string, string> = { SL: 'Straight-Line', DB: 'Declining Balance', UOP: 'Units of Production' };

export function AssetsPage() {
  const qc = useQueryClient();

  const { data: assetsData } = useQuery({ queryKey: ['assets'], queryFn: () => apiGet<{ data: Asset[] }>('/assets') });
  const assets = assetsData?.data ?? [];

  const runDepreciation = useMutation({
    mutationFn: () => apiPost('/assets/depreciation/run', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });

  const totalCost = assets.reduce((s, a) => s + parseFloat(a.acquisitionCost), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fixed Assets</h1>
          <p className="text-sm text-gray-400">Asset register — Total cost: <span className="text-white font-semibold">{formatCurrency(String(totalCost))}</span></p>
        </div>
        <button
          onClick={() => runDepreciation.mutate()}
          disabled={runDepreciation.isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {runDepreciation.isPending ? 'Running...' : 'Post Monthly Depreciation'}
        </button>
      </div>

      {runDepreciation.isSuccess && (
        <div className="rounded-lg bg-green-900/30 border border-green-700 px-4 py-3 text-green-300 text-sm">
          Depreciation entries posted successfully.
        </div>
      )}

      <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Code</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Name</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Acquired</th>
              <th className="px-4 py-3 text-right text-gray-400 font-medium">Cost</th>
              <th className="px-4 py-3 text-right text-gray-400 font-medium">Residual</th>
              <th className="px-4 py-3 text-center text-gray-400 font-medium">Life (mo)</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Method</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id} className="border-t border-gray-700 hover:bg-gray-700/30">
                <td className="px-4 py-2.5 font-mono text-gray-400 text-xs">{asset.code}</td>
                <td className="px-4 py-2.5 text-white">{asset.name}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{formatDate(asset.acquisitionDate)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-white">{formatCurrency(asset.acquisitionCost)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-400">{formatCurrency(asset.residualValue)}</td>
                <td className="px-4 py-2.5 text-center text-gray-400">{asset.usefulLifeMonths}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{METHOD_LABELS[asset.depreciationMethod] ?? asset.depreciationMethod}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${asset.status === 'ACTIVE' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                    {asset.status}
                  </span>
                </td>
              </tr>
            ))}
            {assets.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No assets in register yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
