import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../../lib/api';
import { formatCurrency } from '../../../lib/money';
import { formatDate } from '../../../lib/date';

interface Employee {
  id: string; employeeNo: string; name: string; employmentType: string;
  payFrequency: string; basicSalary: string;
}
interface PayRun {
  id: string; status: string; totalGross: string; totalDeductions: string; totalNet: string;
  payPeriod: { name: string; payDate: string };
}

const RUN_STATUS: Record<string, string> = {
  DRAFT: 'bg-gray-700 text-gray-300', APPROVED: 'bg-blue-900 text-blue-300', POSTED: 'bg-green-900 text-green-300',
};

export function PayrollPage() {
  const [tab, setTab] = useState<'employees' | 'runs'>('employees');
  const [payPeriodId, setPayPeriodId] = useState('');
  const qc = useQueryClient();

  const { data: employeesData } = useQuery({ queryKey: ['payroll', 'employees'], queryFn: () => apiGet<{ data: Employee[] }>('/payroll/employees') });
  const employees = employeesData?.data ?? [];

  const runMutation = useMutation({
    mutationFn: (periodId: string) => apiPost('/payroll/runs', { payPeriodId: periodId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll', 'runs'] }); setPayPeriodId(''); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payroll</h1>
          <p className="text-sm text-gray-400">Philippine payroll — SSS, PhilHealth, Pag-IBIG, BIR TRAIN Law</p>
        </div>
        <div className="flex rounded-lg border border-gray-700 overflow-hidden">
          <button onClick={() => setTab('employees')} className={`px-4 py-2 text-sm ${tab === 'employees' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Employees</button>
          <button onClick={() => setTab('runs')} className={`px-4 py-2 text-sm ${tab === 'runs' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Pay Runs</button>
        </div>
      </div>

      {tab === 'employees' && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Employee No</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Name</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Type</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Frequency</th>
                <th className="px-4 py-3 text-right text-gray-400 font-medium">Basic Salary</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-t border-gray-700 hover:bg-gray-700/30">
                  <td className="px-4 py-2.5 font-mono text-gray-400 text-xs">{e.employeeNo}</td>
                  <td className="px-4 py-2.5 text-white">{e.name}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{e.employmentType}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{e.payFrequency.replace('_', ' ')}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-white">{formatCurrency(e.basicSalary)}</td>
                </tr>
              ))}
              {employees.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No employees found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'runs' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Run Payroll</h3>
            <div className="flex items-center gap-3">
              <input
                type="text" placeholder="Pay Period ID"
                value={payPeriodId} onChange={(e) => setPayPeriodId(e.target.value)}
                className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm w-72 outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => runMutation.mutate(payPeriodId)}
                disabled={!payPeriodId || runMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {runMutation.isPending ? 'Running...' : 'Run Payroll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
