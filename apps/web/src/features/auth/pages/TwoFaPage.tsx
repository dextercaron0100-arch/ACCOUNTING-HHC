import { useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useAuthStore } from '@/hooks/use-auth-store';
import { apiPost } from '@/lib/api';
import type { AuthResponse } from '@shared/types/auth';

export default function TwoFaPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = sessionStorage.getItem('pending_user_id');
    if (!userId) { router.navigate({ to: '/login' }); return; }

    setLoading(true);
    setError('');
    try {
      const res = await apiPost<AuthResponse>('/api/v1/auth/2fa/verify', { userId, token });
      sessionStorage.removeItem('pending_user_id');
      setAuth(res.accessToken, res.refreshToken, res.user);
      router.navigate({ to: '/' });
    } catch {
      setError('Invalid 2FA code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-4">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Two-Factor Authentication</h2>
          <p className="text-gray-500 text-sm mb-6">Enter the 6-digit code from your authenticator app</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            <input
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full text-center text-3xl font-mono tracking-widest px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="000000"
              maxLength={6}
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || token.length < 6}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => router.navigate({ to: '/login' })}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Back to login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
