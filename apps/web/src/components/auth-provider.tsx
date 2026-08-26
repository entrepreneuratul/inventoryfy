'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthUser, BusinessSummary, LoginRequest, MembershipRole } from '@inventoryfy/shared-types';
import { apiFetch, ApiError } from '@/lib/api';

interface StoredAuth {
  accessToken: string;
  user: AuthUser;
  role: MembershipRole;
  businesses: BusinessSummary[];
}

interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  accessToken: string | null;
  user: AuthUser | null;
  role: MembershipRole | null;
  businesses: BusinessSummary[];
  /** The business currently being viewed. Fixed for staff; switchable for owners. */
  activeBusinessId: string | null;
  setActiveBusinessId: (id: string | null) => void;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'inventoryfy-auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(null);

  // On mount: hydrate from localStorage, then re-validate against /auth/me
  // so a suspended/expired session is caught immediately rather than
  // trusting stale cached data.
  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setStatus('unauthenticated');
      return;
    }
    const stored: StoredAuth = JSON.parse(raw);

    apiFetch<{ user: AuthUser; role: MembershipRole; businesses: BusinessSummary[] }>('/auth/me', {
      token: stored.accessToken,
    })
      .then((me) => {
        const refreshed: StoredAuth = { ...stored, user: me.user, role: me.role, businesses: me.businesses };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(refreshed));
        setAuth(refreshed);
        setActiveBusinessIdState(refreshed.businesses[0]?.id ?? null);
        setStatus('authenticated');
      })
      .catch(() => {
        window.localStorage.removeItem(STORAGE_KEY);
        setStatus('unauthenticated');
      });
  }, []);

  const login = useCallback(async (input: LoginRequest) => {
    const result = await apiFetch<StoredAuth>('/auth/login', { method: 'POST', body: input });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    setAuth(result);
    setActiveBusinessIdState(result.businesses[0]?.id ?? null);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
    setActiveBusinessIdState(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      accessToken: auth?.accessToken ?? null,
      user: auth?.user ?? null,
      role: auth?.role ?? null,
      businesses: auth?.businesses ?? [],
      activeBusinessId,
      setActiveBusinessId: setActiveBusinessIdState,
      login,
      logout,
    }),
    [status, auth, activeBusinessId, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export { ApiError };
