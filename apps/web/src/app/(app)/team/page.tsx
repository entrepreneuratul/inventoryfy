'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import {
  CAPABILITY_LABELS,
  CAPABILITY_MATRIX,
  INVITABLE_ROLES,
  ROLE_LABELS,
  type Capability,
  type InviteResult,
  type ResetPasswordResult,
  type TeamMemberRow,
  type TeamRole,
} from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { membershipStatusBadge, roleBadgeClass } from '@/lib/team-ui';

const CAPABILITIES = Object.keys(CAPABILITY_MATRIX) as Capability[];
const ALL_ROLES = Object.keys(ROLE_LABELS) as TeamRole[];

export default function TeamPage() {
  const { accessToken, role, businesses, activeBusinessId, can } = useAuth();
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;
  const canManageTeam = can('MANAGE_TEAM');
  // Deliberately the literal account role, not the MANAGE_TEAM capability —
  // resetting a password (anyone's, including the owner's own row below)
  // stays owner-only even if the capability matrix changes later. The
  // backend enforces this independently; this only controls whether the
  // button renders.
  const isOwner = role === 'OWNER';

  const [team, setTeam] = useState<TeamMemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [teamRole, setTeamRole] = useState<TeamRole>('SALES_STAFF');
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [resetResult, setResetResult] = useState<ResetPasswordResult | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    if (!effectiveBusinessId) return;
    apiFetch<TeamMemberRow[]>(`/businesses/${effectiveBusinessId}/team`, { token: accessToken })
      .then(setTeam)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load team'));
  };

  useEffect(load, [effectiveBusinessId, accessToken]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveBusinessId) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<InviteResult>(`/businesses/${effectiveBusinessId}/team/invite`, {
        method: 'POST',
        body: { name, email, teamRole },
        token: accessToken,
      });
      setInviteResult(result);
      setName('');
      setEmail('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send invite');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleSuspend(membershipId: string) {
    if (!effectiveBusinessId) return;
    try {
      await apiFetch(`/businesses/${effectiveBusinessId}/team/${membershipId}/toggle-suspend`, {
        method: 'POST',
        token: accessToken,
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update status');
    }
  }

  async function resetPassword(membershipId: string, name: string) {
    if (!effectiveBusinessId) return;
    if (!confirm(`Reset ${name}'s password? Their current password stops working immediately.`)) return;
    setError(null);
    setResettingId(membershipId);
    try {
      const result = await apiFetch<ResetPasswordResult>(
        `/businesses/${effectiveBusinessId}/team/${membershipId}/reset-password`,
        { method: 'POST', token: accessToken },
      );
      setResetResult(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reset password');
    } finally {
      setResettingId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 20 }}>
        <h1 style={{ marginBottom: 0 }}>Team &amp; roles</h1>
        {canManageTeam && (
          <button className="btn btn-primary" onClick={() => setInviteOpen(true)}>
            Invite team member
          </button>
        )}
      </div>

      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      {inviteResult && (
        <div className="card" style={{ background: 'var(--color-surface)', maxWidth: 480, marginBottom: 20, fontSize: 13 }}>
          <div className="card-title" style={{ fontSize: 14 }}>
            Invite sent to {inviteResult.email}
          </div>
          {inviteResult.temporaryPassword ? (
            <div className="card-body" style={{ flex: 'none' }}>
              There&apos;s no email system connected yet, so relay this temporary password yourself:{' '}
              <code>{inviteResult.temporaryPassword}</code>
            </div>
          ) : (
            <div className="card-body" style={{ flex: 'none' }}>
              This email already had an account — their existing password still works, and they now have access to
              this business too.
            </div>
          )}
          <button className="btn btn-ghost" style={{ fontSize: 12, width: 'fit-content' }} onClick={() => setInviteResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {resetResult && (
        <div className="card" style={{ background: 'var(--color-surface)', maxWidth: 480, marginBottom: 20, fontSize: 13 }}>
          <div className="card-title" style={{ fontSize: 14 }}>
            Password reset for {resetResult.email}
          </div>
          <div className="card-body" style={{ flex: 'none' }}>
            There&apos;s no email system connected yet, so relay this new password yourself — it won&apos;t be
            shown again: <code>{resetResult.temporaryPassword}</code>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 12, width: 'fit-content' }} onClick={() => setResetResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {inviteOpen && (
        <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
          <div className="card-title" style={{ fontSize: 14 }}>
            Invite a team member
          </div>
          <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div className="field" style={{ minWidth: 160, flex: 1 }}>
                <label>Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="field" style={{ minWidth: 180, flex: 1 }}>
                <label>Email</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field" style={{ minWidth: 160 }}>
                <label>Role</label>
                <select className="input" value={teamRole} onChange={(e) => setTeamRole(e.target.value as TeamRole)}>
                  {INVITABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send invite'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setInviteOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <table className="table" style={{ marginBottom: 32 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Business</th>
            <th>Status</th>
            {(canManageTeam || isOwner) && <th></th>}
          </tr>
        </thead>
        <tbody>
          {team?.map((u) => {
            const statusBadge = membershipStatusBadge(u.status);
            return (
              <tr key={u.membershipId}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td className="text-muted">{u.email}</td>
                <td>
                  <span className={roleBadgeClass(u.teamRole)}>{ROLE_LABELS[u.teamRole]}</span>
                </td>
                <td className="text-muted">{u.businessName}</td>
                <td>
                  <span className={statusBadge.cls}>{statusBadge.label}</span>
                </td>
                {(canManageTeam || isOwner) && (
                  <td style={{ display: 'flex', gap: 6 }}>
                    {canManageTeam && u.teamRole !== 'OWNER' && (
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => toggleSuspend(u.membershipId)}>
                        {u.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                      </button>
                    )}
                    {isOwner && (
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 12 }}
                        disabled={resettingId === u.membershipId}
                        onClick={() => resetPassword(u.membershipId, u.name)}
                      >
                        {resettingId === u.membershipId ? 'Resetting…' : 'Reset password'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <h4 style={{ marginBottom: 10 }}>What each role can access</h4>
      <table className="table">
        <thead>
          <tr>
            <th>Capability</th>
            {ALL_ROLES.map((r) => (
              <th key={r}>{ROLE_LABELS[r]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CAPABILITIES.map((cap) => (
            <tr key={cap}>
              <td>{CAPABILITY_LABELS[cap]}</td>
              {ALL_ROLES.map((r) => (
                <td key={r}>
                  {CAPABILITY_MATRIX[cap].includes(r) ? (
                    <Check size={15} style={{ color: 'var(--color-accent)' }} />
                  ) : (
                    <X size={15} style={{ opacity: 0.3 }} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
