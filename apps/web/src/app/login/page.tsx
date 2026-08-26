'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BusinessSummary, MembershipRole } from '@inventoryfy/shared-types';
import { apiFetch } from '@/lib/api';
import { ApiError, useAuth } from '@/components/auth-provider';

export default function LoginPage() {
  const router = useRouter();
  const { login, status } = useAuth();

  const [role, setRole] = useState<MembershipRole>('OWNER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [businesses, setBusinesses] = useState<Pick<BusinessSummary, 'id' | 'name'>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  useEffect(() => {
    apiFetch<Pick<BusinessSummary, 'id' | 'name'>[]>('/businesses')
      .then((list) => {
        setBusinesses(list);
        setBusinessId((current) => current || list[0]?.id || '');
      })
      .catch(() => setBusinesses([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password, role, ...(role === 'STAFF' ? { businessId } : {}) });
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const loginHint =
    role === 'OWNER'
      ? 'Demo: owner@inventoryfy.dev / password123'
      : 'Demo: staff@inventoryfy.dev / password123 — business: Northside Hardware';

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: 'min(420px, 100%)' }}>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: '-0.02em',
            marginBottom: 4,
          }}
        >
          INVENTORYFY
        </div>
        <div className="text-muted" style={{ fontSize: 13, marginBottom: 28 }}>
          Inventory, suppliers &amp; finance across every business you run.
        </div>
        <div className="hr" style={{ margin: '0 0 24px' }} />

        <form onSubmit={handleSubmit}>
          <div className="seg" style={{ marginBottom: 20, width: '100%' }}>
            <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input
                type="radio"
                name="loginrole"
                checked={role === 'OWNER'}
                onChange={() => setRole('OWNER')}
              />
              Owner
            </label>
            <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input
                type="radio"
                name="loginrole"
                checked={role === 'STAFF'}
                onChange={() => setRole('STAFF')}
              />
              Staff
            </label>
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@business.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {role === 'STAFF' && (
            <div className="field" style={{ marginBottom: 18 }}>
              <label>Business</label>
              <select
                className="input"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
              >
                {businesses.map((biz) => (
                  <option key={biz.id} value={biz.id}>
                    {biz.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="text-muted" style={{ fontSize: 12, marginTop: 14 }}>
          {loginHint}
        </div>
      </div>
    </div>
  );
}
