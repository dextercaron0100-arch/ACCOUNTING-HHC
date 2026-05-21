import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  companyId: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    permissions: string[];
  } | null;
  setAuth: (token: string, refreshToken: string, user: AuthState['user']) => void;
  setCompanyId: (companyId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      companyId: null,
      user: null,
      setAuth: (token, refreshToken, user) => set({ token, refreshToken, user }),
      setCompanyId: (companyId) => set({ companyId }),
      logout: () => set({ token: null, refreshToken: null, user: null, companyId: null }),
    }),
    { name: 'auth-storage' },
  ),
);

export function useHasPermission(permission: string): boolean {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  return permissions.includes(permission);
}
