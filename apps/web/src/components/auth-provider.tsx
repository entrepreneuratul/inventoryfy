'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthUser, BusinessSummary, Capability, LoginRequest, MembershipRole, TeamRole } from '@inventoryfy/shared-types';
import { CAPABILITY_MATRIX } from '@inventoryfy/shared-types';
import { apiFetch, ApiError } from '@/lib/api';

interface StoredAuth {
  accessToken: string;
  user: AuthUser;
  role: MembershipRole;
  teamRole: TeamRole;
  businesses: BusinessSummary[];
}

interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  accessToken: string | null;
  user: AuthUser | null;
  role: MembershipRole | null;
  teamRole: TeamRole | null;
  /** Whether the current session's team role has a given capability —
   * mirrors CAPABILITY_MATRIX, the same table the backend's
   * CapabilityGuard enforces. UI-only convenience; the backend is always
   * the real gate. */
  can: (capability: Capability) => boolean;
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

    apiFetch<{ user: AuthUser; role: MembershipRole; teamRole: TeamRole; businesses: BusinessSummary[] }>('/auth/me', {
      token: stored.accessToken,
    })
      .then((me) => {
        const refreshed: StoredAuth = { ...stored, user: me.user, role: me.role, teamRole: me.teamRole, businesses: me.businesses };
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

  const can = useCallback(
    (capability: Capability) => (auth ? CAPABILITY_MATRIX[capability].includes(auth.teamRole) : false),
    [auth],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      accessToken: auth?.accessToken ?? null,
      user: auth?.user ?? null,
      role: auth?.role ?? null,
      teamRole: auth?.teamRole ?? null,
      can,
      businesses: auth?.businesses ?? [],
      activeBusinessId,
      setActiveBusinessId: setActiveBusinessIdState,
      login,
      logout,
    }),
    [status, auth, can, activeBusinessId, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export { ApiError };
