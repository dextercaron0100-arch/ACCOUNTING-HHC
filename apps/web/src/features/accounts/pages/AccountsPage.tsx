import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, Plus, Edit, Trash2, Search } from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import type { Account } from '@shared/types/account';

function AccountNode({
  account,
  depth = 0,
  onEdit,
  onDelete,
}: {
  account: Account;
  depth?: number;
  onEdit: (a: Account) => void;
  onDelete: (a: Account) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = (account.children?.length ?? 0) > 0;

  const typeColors: Record<string, string> = {
    ASSET: 'text-blue-600 bg-blue-50',
    LIABILITY: 'text-red-600 bg-red-50',
    EQUITY: 'text-purple-600 bg-purple-50',
    INCOME: 'text-green-600 bg-green-50',
    EXPENSE: 'text-orange-600 bg-orange-50',
  };
  const colorClass = typeColors[account.accountType.code] ?? 'text-gray-600 bg-gray-50';

  return (
    <div>
      <div
        className="group flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded-lg"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        <button
          onClick={() => setOpen(!open)}
          className="w-4 h-4 flex items-center justify-center text-gray-400"
        >
          {hasChildren ? (open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />) : <span className="w-3" />}
        </button>

        <span className="font-mono text-xs text-gray-400 w-14">{account.code}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colorClass}`}>
          {account.accountType.code.charAt(0)}
        </span>
        <span className={`flex-1 text-sm font-medium ${account.isActive ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
          {account.name}
        </span>
        <span className="text-xs text-gray-400 mr-2">{account.normalBalance}</span>

        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
          <button
            onClick={() => onEdit(account)}
            className="p-1 text-gray-400 hover:text-blue-600 rounded"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          {!account.isSystemAccount && (
            <button
              onClick={() => onDelete(account)}
              className="p-1 text-gray-400 hover:text-red-600 rounded"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {open && hasChildren && account.children!.map((child) => (
        <AccountNode key={child.id} account={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);

  const { data: tree = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiGet<Account[]>('/api/v1/accounts'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/v1/accounts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });

  const filterTree = (accounts: Account[], q: string): Account[] => {
    if (!q) return accounts;
    return accounts.reduce<Account[]>((acc, a) => {
      const match = a.name.toLowerCase().includes(q.toLowerCase()) || a.code.includes(q);
      const children = filterTree(a.children ?? [], q);
      if (match || children.length > 0) acc.push({ ...a, children });
      return acc;
    }, []);
  };

  const filtered = filterTree(tree, search);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your account hierarchy</p>
        </div>
        <button
          onClick={() => { setEditAccount(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New Account
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts by name or code..."
            className="flex-1 text-sm outline-none placeholder-gray-400"
          />
        </div>

        <div className="divide-y divide-gray-50">
          {isLoading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading accounts...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No accounts found</div>
          ) : (
            <div className="py-2">
              {filtered.map((account) => (
                <AccountNode
                  key={account.id}
                  account={account}
                  onEdit={(a) => { setEditAccount(a); setShowForm(true); }}
                  onDelete={(a) => {
                    if (confirm(`Delete "${a.name}"?`)) deleteMutation.mutate(a.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <AccountFormModal
          account={editAccount}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
          }}
        />
      )}
    </div>
  );
}

function AccountFormModal({
  account,
  onClose,
  onSaved,
}: {
  account: Account | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(account?.name ?? '');
  const [isActive, setIsActive] = useState(account?.isActive ?? true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (account) {
        await apiPatch(`/api/v1/accounts/${account.id}`, { name, isActive });
      }
      onSaved();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{account ? 'Edit Account' : 'New Account'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {account && (
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <span className="text-gray-500">Code: </span>
              <span className="font-mono font-medium">{account.code}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          {account && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
