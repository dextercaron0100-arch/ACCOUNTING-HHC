import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { apiGet } from '../../../lib/api';
import { formatCurrency } from '../../../lib/money';

interface KpiData {
  revenueThisMonth: string;
  expensesThisMonth: string;
  netIncomeThisMonth: string;
  arBalance: string;
  apBalance: string;
  overdueInvoices: number;
}

interface CashTrendItem { month: string; inflow: string; outflow: string }
interface TopExpense { accountName: string; amount: string }

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color ?? 'text-white'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export function DashboardPage() {
  const { data: kpis } = useQuery<KpiData>({
    queryKey: ['reporting', 'dashboard'],
    queryFn: () => apiGet<KpiData>('/reporting/dashboard'),
    refetchInterval: 60_000,
  });

  const { data: cashTrend = [] } = useQuery<CashTrendItem[]>({
    queryKey: ['reporting', 'cash-trend'],
    queryFn: () => apiGet<CashTrendItem[]>('/reporting/cash-trend?months=6'),
    refetchInterval: 60_000,
  });

  const { data: topExpenses = [] } = useQuery<TopExpense[]>({
    queryKey: ['reporting', 'top-expenses'],
    queryFn: () => apiGet<TopExpense[]>('/reporting/top-expenses?limit=5'),
    refetchInterval: 60_000,
  });

  const cashTrendFormatted = cashTrend.map((d) => ({
    month: d.month,
    Inflow: parseFloat(d.inflow),
    Outflow: parseFloat(d.outflow),
  }));

  const pieData = topExpenses.map((e) => ({ name: e.accountName, value: parseFloat(e.amount) }));

  const netIncome = kpis ? parseFloat(kpis.netIncomeThisMonth) : 0;
  const netColor = netIncome >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400">Financial overview — current month</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Revenue (MTD)" value={formatCurrency(kpis?.revenueThisMonth ?? '0')} color="text-green-400" />
        <KpiCard label="Expenses (MTD)" value={formatCurrency(kpis?.expensesThisMonth ?? '0')} color="text-red-400" />
        <KpiCard label="Net Income (MTD)" value={formatCurrency(kpis?.netIncomeThisMonth ?? '0')} color={netColor} />
        <KpiCard label="AR Balance" value={formatCurrency(kpis?.arBalance ?? '0')} sub="Outstanding receivables" />
        <KpiCard label="AP Balance" value={formatCurrency(kpis?.apBalance ?? '0')} sub="Outstanding payables" />
        <KpiCard
          label="Overdue Invoices"
          value={String(kpis?.overdueInvoices ?? 0)}
          color={kpis?.overdueInvoices ? 'text-yellow-400' : 'text-white'}
          sub="Past due date"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Cash Flow Trend */}
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-300">Cash Flow — Last 6 Months</h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={cashTrendFormatted}>
              <defs>
                <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => formatCurrency(String(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Inflow" stroke="#22c55e" fill="url(#inflowGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="Outflow" stroke="#ef4444" fill="url(#outflowGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top 5 Expenses Donut */}
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-300">Top 5 Expenses (MTD)</h2>
          {pieData.length === 0 ? (
            <div className="flex h-60 items-center justify-center text-gray-500 text-sm">No expense data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={(v: number) => formatCurrency(String(v))}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value) => <span style={{ color: '#d1d5db' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* AR Days + Revenue vs Expense Bar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue vs Expenses Bar */}
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-300">Revenue vs Expenses — Monthly</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cashTrendFormatted}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(v: number) => formatCurrency(String(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Inflow" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Outflow" name="Expenses" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Stats */}
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-300">At a Glance</h2>
          <div className="space-y-3">
            <div className="flex justify-between rounded-lg bg-gray-700/50 px-4 py-3">
              <span className="text-sm text-gray-400">AR Turnover Days</span>
              <span className="font-mono text-sm text-white">
                {kpis && parseFloat(kpis.revenueThisMonth) > 0
                  ? Math.round((parseFloat(kpis.arBalance) / parseFloat(kpis.revenueThisMonth)) * 30)
                  : '—'} days
              </span>
            </div>
            <div className="flex justify-between rounded-lg bg-gray-700/50 px-4 py-3">
              <span className="text-sm text-gray-400">Gross Margin (MTD)</span>
              <span className="font-mono text-sm text-white">
                {kpis && parseFloat(kpis.revenueThisMonth) > 0
                  ? ((1 - parseFloat(kpis.expensesThisMonth) / parseFloat(kpis.revenueThisMonth)) * 100).toFixed(1)
                  : '—'}%
              </span>
            </div>
            <div className="flex justify-between rounded-lg bg-gray-700/50 px-4 py-3">
              <span className="text-sm text-gray-400">Overdue AR</span>
              <span className={`font-mono text-sm ${kpis?.overdueInvoices ? 'text-yellow-400' : 'text-green-400'}`}>
                {kpis?.overdueInvoices ?? 0} invoice{kpis?.overdueInvoices !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex justify-between rounded-lg bg-gray-700/50 px-4 py-3">
              <span className="text-sm text-gray-400">AP Outstanding</span>
              <span className="font-mono text-sm text-white">{formatCurrency(kpis?.apBalance ?? '0')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
