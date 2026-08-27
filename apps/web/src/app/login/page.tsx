'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, useAuth } from '@/components/auth-provider';

export default function LoginPage() {
  const router = useRouter();
  const { login, status } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  // No role, no business — the server figures out whether this account
  // owns a business (possibly several) or works at exactly one, from
  // the credentials alone. See AuthService.login's resolveAutomatically.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: 'min(420px, 100%)' }}>
        <Link
          href="/"
          style={{
            display: 'block',
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: '-0.02em',
            marginBottom: 4,
            color: 'var(--color-text)',
            textDecoration: 'none',
          }}
        >
          INVENTORYFY
        </Link>
        <div className="text-muted" style={{ fontSize: 13, marginBottom: 28 }}>
          Inventory, suppliers &amp; finance across every business you run.
        </div>
        <div className="hr" style={{ margin: '0 0 24px' }} />

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@business.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="field" style={{ marginBottom: 18 }}>
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
          New here?{' '}
          <Link href="/#request-access" style={{ color: 'var(--color-accent)' }}>
            Request access
          </Link>{' '}
          from the homepage.
        </div>
      </div>
    </div>
  );
}
