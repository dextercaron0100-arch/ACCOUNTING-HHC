import { lazy, Suspense } from 'react';
import { createRouter, createRoute, createRootRoute, Outlet, redirect } from '@tanstack/react-router';
import { useAuthStore } from '@/hooks/use-auth-store';

// Default-export pages (auth + layout)
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const TwoFaPage = lazy(() => import('@/features/auth/pages/TwoFaPage'));
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));

// Named-export pages — wrapped to satisfy React.lazy (requires { default })
const named = <T,>(importer: () => Promise<{ [k: string]: T }>, name: string) =>
  lazy(() => importer().then((m) => ({ default: m[name] as React.ComponentType })));

const DashboardPage = named(() => import('@/features/dashboard/pages/DashboardPage'), 'DashboardPage');
const AccountsPage = named(() => import('@/features/accounts/pages/AccountsPage'), 'AccountsPage');
const JournalPage = named(() => import('@/features/journal/pages/JournalPage'), 'JournalPage');
const JournalEntryForm = named(() => import('@/features/journal/pages/JournalEntryForm'), 'JournalEntryForm');
const LedgerPage = named(() => import('@/features/ledger/pages/LedgerPage'), 'LedgerPage');
const ArPage = named(() => import('@/features/ar/pages/ArPage'), 'ArPage');
const ApPage = named(() => import('@/features/ap/pages/ApPage'), 'ApPage');
const StatementsPage = named(() => import('@/features/statements/pages/StatementsPage'), 'StatementsPage');
const ProcurementPage = named(() => import('@/features/procurement/pages/ProcurementPage'), 'ProcurementPage');
const InventoryPage = named(() => import('@/features/inventory/pages/InventoryPage'), 'InventoryPage');
const AssetsPage = named(() => import('@/features/assets/pages/AssetsPage'), 'AssetsPage');
const PayrollPage = named(() => import('@/features/payroll/pages/PayrollPage'), 'PayrollPage');
const ExpensesPage = named(() => import('@/features/expenses/pages/ExpensesPage'), 'ExpensesPage');
const BankingPage = named(() => import('@/features/banking/pages/BankingPage'), 'BankingPage');

function Fallback() { return <div className="flex h-screen items-center justify-center text-gray-400 text-sm">Loading...</div>; }

function withSuspense(Component: React.ComponentType) {
  return function SuspenseWrapper() { return <Suspense fallback={<Fallback />}><Component /></Suspense>; };
}

const RootRoute = createRootRoute({ component: Outlet });

const loginRoute = createRoute({ getParentRoute: () => RootRoute, path: '/login', component: withSuspense(LoginPage) });
const twoFaRoute = createRoute({ getParentRoute: () => RootRoute, path: '/2fa', component: withSuspense(TwoFaPage) });

const appRoute = createRoute({
  getParentRoute: () => RootRoute,
  id: 'app',
  beforeLoad: () => {
    const { token } = useAuthStore.getState();
    if (!token) throw redirect({ to: '/login' });
  },
  component: withSuspense(AppLayout),
});

const dashboardRoute = createRoute({ getParentRoute: () => appRoute, path: '/', component: withSuspense(DashboardPage) });
const accountsRoute = createRoute({ getParentRoute: () => appRoute, path: '/accounts', component: withSuspense(AccountsPage) });
const journalRoute = createRoute({ getParentRoute: () => appRoute, path: '/journal', component: withSuspense(JournalPage) });
const journalNewRoute = createRoute({ getParentRoute: () => appRoute, path: '/journal/new', component: withSuspense(JournalEntryForm) });
const ledgerRoute = createRoute({ getParentRoute: () => appRoute, path: '/ledger', component: withSuspense(LedgerPage) });
const arRoute = createRoute({ getParentRoute: () => appRoute, path: '/ar', component: withSuspense(ArPage) });
const apRoute = createRoute({ getParentRoute: () => appRoute, path: '/ap', component: withSuspense(ApPage) });
const statementsRoute = createRoute({ getParentRoute: () => appRoute, path: '/statements', component: withSuspense(StatementsPage) });
const procurementRoute = createRoute({ getParentRoute: () => appRoute, path: '/procurement', component: withSuspense(ProcurementPage) });
const inventoryRoute = createRoute({ getParentRoute: () => appRoute, path: '/inventory', component: withSuspense(InventoryPage) });
const assetsRoute = createRoute({ getParentRoute: () => appRoute, path: '/assets', component: withSuspense(AssetsPage) });
const payrollRoute = createRoute({ getParentRoute: () => appRoute, path: '/payroll', component: withSuspense(PayrollPage) });
const expensesRoute = createRoute({ getParentRoute: () => appRoute, path: '/expenses', component: withSuspense(ExpensesPage) });
const bankingRoute = createRoute({ getParentRoute: () => appRoute, path: '/banking', component: withSuspense(BankingPage) });

const routeTree = RootRoute.addChildren([
  loginRoute,
  twoFaRoute,
  appRoute.addChildren([
    dashboardRoute,
    accountsRoute,
    journalRoute,
    journalNewRoute,
    ledgerRoute,
    arRoute,
    apRoute,
    statementsRoute,
    procurementRoute,
    inventoryRoute,
    assetsRoute,
    payrollRoute,
    expensesRoute,
    bankingRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
