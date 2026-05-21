import { Outlet, Link, useRouter } from '@tanstack/react-router';
import { useAuthStore } from '@/hooks/use-auth-store';
import {
  LayoutDashboard, BookOpen, FileText, BarChart2, Users, ShoppingCart,
  Package, Landmark, DollarSign, Briefcase, Receipt, Building,
  CreditCard, TrendingUp, LogOut, ChevronDown,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Chart of Accounts', icon: BookOpen, to: '/accounts' },
  {
    label: 'General Ledger', icon: FileText, children: [
      { label: 'Journal Entries', to: '/journal' },
      { label: 'General Ledger', to: '/ledger' },
    ],
  },
  {
    label: 'Accounts Receivable', icon: TrendingUp, children: [
      { label: 'Invoices', to: '/ar/invoices' },
      { label: 'Customers', to: '/ar/customers' },
      { label: 'AR Aging', to: '/ar/aging' },
    ],
  },
  {
    label: 'Accounts Payable', icon: CreditCard, children: [
      { label: 'Bills', to: '/ap/bills' },
      { label: 'Vendors', to: '/ap/vendors' },
    ],
  },
  { label: 'Financial Statements', icon: BarChart2, to: '/statements' },
  { label: 'Procurement', icon: ShoppingCart, to: '/procurement' },
  { label: 'Inventory', icon: Package, to: '/inventory' },
  { label: 'Fixed Assets', icon: Building, to: '/assets' },
  { label: 'Payroll', icon: Users, to: '/payroll' },
  { label: 'Expenses', icon: Receipt, to: '/expenses' },
  { label: 'Banking', icon: Landmark, to: '/banking' },
];

export default function AppLayout() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    router.navigate({ to: '/login' });
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 flex flex-col overflow-y-auto">
        <div className="px-4 py-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold text-sm">Accounting System</span>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {navItems.map((item) => {
            if (item.children) {
              const isOpen = expanded === item.label;
              return (
                <div key={item.label}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : item.label)}
                    className="w-full flex items-center justify-between px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </div>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="ml-6 mt-0.5 space-y-0.5">
                      {item.children.map((child) => (
                        <Link
                          key={child.to}
                          to={child.to}
                          className="block px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition-colors"
                          activeProps={{ className: 'text-white bg-gray-800' }}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition-colors"
                activeOptions={{ exact: item.to === '/' }}
                activeProps={{ className: 'text-white bg-blue-600 hover:bg-blue-600' }}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">{user?.firstName} {user?.lastName}</p>
              <p className="text-gray-400 text-xs">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
