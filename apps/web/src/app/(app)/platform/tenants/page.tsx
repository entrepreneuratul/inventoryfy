'use client';

// =====================================================================
// PLATFORM → TENANTS — Super Owner only (see the API's PlatformModule
// and User.isSuperOwner). Onboards a brand-new tenant Business and
// grants its first OWNER, and can grant/reassign an owner on an
// existing one. app-shell.tsx only shows the nav link here at all when
// user.isSuperOwner is true; the real gate is still the backend's
// SuperOwnerGuard — a non-super-owner hitting this URL directly just
// gets 403s from every call below.
// =====================================================================

import { useEffect, useState } from 'react';
import type { AssignOwnerResult, OnboardTenantResult, TenantRow } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';

export default function TenantsPage() {
  const { accessToken } = useAuth();

  const [tenants, setTenants] = useState<TenantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [onboardOpen, setOnboardOpen] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [onboardResult, setOnboardResult] = useState<OnboardTenantResult | null>(null);

  const [assigningFor, setAssigningFor] = useState<TenantRow | null>(null);
  const [assignName, setAssignName] = useState('');
  const [assignEmail, setAssignEmail] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<AssignOwnerResult | null>(null);

  const load = () => {
    apiFetch<TenantRow[]>('/platform/tenants', { token: accessToken })
      .then(setTenants)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load tenants'));
  };

  useEffect(load, [accessToken]);

  async function handleOnboard(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<OnboardTenantResult>('/platform/tenants', {
        method: 'POST',
        body: {
          businessName,
          businessType: businessType || undefined,
          ownerName,
          ownerEmail,
        },
        token: accessToken,
      });
      setOnboardResult(result);
      setBusinessName('');
      setBusinessType('');
      setOwnerName('');
      setOwnerEmail('');
      setOnboardOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to onboard tenant');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignOwner(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningFor) return;
    setError(null);
    setAssigning(true);
    try {
      const result = await apiFetch<AssignOwnerResult>(`/platform/tenants/${assigningFor.id}/owners`, {
        method: 'POST',
        body: { name: assignName, email: assignEmail },
        token: accessToken,
      });
      setAssignResult(result);
      setAssignName('');
      setAssignEmail('');
      setAssigningFor(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign owner');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 8 }}>
        <h1 style={{ marginBottom: 0 }}>Tenants</h1>
        <button className="btn btn-primary" onClick={() => setOnboardOpen(true)}>
          Onboard new customer
        </button>
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 20 }}>
        Platform-operator only. Every business here is a separate tenant — onboarding creates it and grants its
        first owner; assigning an owner on an existing tenant is additive (a co-owner), not a replacement.
      </p>

      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      {onboardResult && (
        <div className="card" style={{ background: 'var(--color-surface)', maxWidth: 480, marginBottom: 20, fontSize: 13 }}>
          <div className="card-title" style={{ fontSize: 14 }}>
            {onboardResult.business.name} onboarded
          </div>
          {onboardResult.temporaryPassword ? (
            <div className="card-body" style={{ flex: 'none' }}>
              Owner login for {onboardResult.ownerEmail} — there&apos;s no email system connected yet, so relay
              this temporary password yourself, it won&apos;t be shown again:{' '}
              <code>{onboardResult.temporaryPassword}</code>
            </div>
          ) : (
            <div className="card-body" style={{ flex: 'none' }}>
              {onboardResult.ownerEmail} already had an account — their existing password now also works as owner
              of this new business.
            </div>
          )}
          <button className="btn btn-ghost" style={{ fontSize: 12, width: 'fit-content' }} onClick={() => setOnboardResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {assignResult && (
        <div className="card" style={{ background: 'var(--color-surface)', maxWidth: 480, marginBottom: 20, fontSize: 13 }}>
          <div className="card-title" style={{ fontSize: 14 }}>
            Owner {assignResult.promoted ? 'promoted' : 'granted'} for {assignResult.ownerEmail}
          </div>
          {assignResult.temporaryPassword ? (
            <div className="card-body" style={{ flex: 'none' }}>
              There&apos;s no email system connected yet, so relay this temporary password yourself, it won&apos;t
              be shown again: <code>{assignResult.temporaryPassword}</code>
            </div>
          ) : (
            <div className="card-body" style={{ flex: 'none' }}>
              {assignResult.promoted
                ? 'This person already had access to this business (e.g. as staff) — their existing password still works, now with owner access.'
                : 'This email already had an account elsewhere — their existing password now also works as owner of this business.'}
            </div>
          )}
          <button className="btn btn-ghost" style={{ fontSize: 12, width: 'fit-content' }} onClick={() => setAssignResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {onboardOpen && (
        <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
          <div className="card-title" style={{ fontSize: 14 }}>
            Onboard a new customer
          </div>
          <form onSubmit={handleOnboard} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div className="field" style={{ minWidth: 200, flex: 1 }}>
                <label>Business name</label>
                <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
              </div>
              <div className="field" style={{ minWidth: 160 }}>
                <label>Type (optional)</label>
                <input
                  className="input"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  placeholder="Retail, Wholesale..."
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div className="field" style={{ minWidth: 160, flex: 1 }}>
                <label>Owner name</label>
                <input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
              </div>
              <div className="field" style={{ minWidth: 200, flex: 1 }}>
                <label>Owner email</label>
                <input className="input" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Onboarding…' : 'Onboard'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setOnboardOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {assigningFor && (
        <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
          <div className="card-title" style={{ fontSize: 14 }}>
            Assign an owner for {assigningFor.name}
          </div>
          <form onSubmit={handleAssignOwner} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div className="field" style={{ minWidth: 160, flex: 1 }}>
                <label>Name</label>
                <input className="input" value={assignName} onChange={(e) => setAssignName(e.target.value)} required />
              </div>
              <div className="field" style={{ minWidth: 200, flex: 1 }}>
                <label>Email</label>
                <input className="input" type="email" value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} required />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={assigning}>
                {assigning ? 'Assigning…' : 'Assign owner'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setAssigningFor(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Business</th>
            <th>Type</th>
            <th>Currency</th>
            <th>Owners</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tenants?.map((t) => (
            <tr key={t.id}>
              <td style={{ fontWeight: 600 }}>{t.name}</td>
              <td className="text-muted">{t.type ?? '—'}</td>
              <td className="text-muted">{t.currency}</td>
              <td className="text-muted">{t.ownerCount}</td>
              <td className="text-muted">{new Date(t.createdAt).toLocaleDateString('en-IN')}</td>
              <td>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={() => {
                    setAssigningFor(t);
                    setAssignResult(null);
                  }}
                >
                  Assign owner
                </button>
              </td>
            </tr>
          ))}
          {tenants?.length === 0 && (
            <tr>
              <td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                No tenants yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
