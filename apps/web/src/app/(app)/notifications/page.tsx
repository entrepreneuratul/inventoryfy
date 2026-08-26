'use client';

import { useEffect, useState } from 'react';
import { ROLE_LABELS, type AlertChannelRow, type NotificationHistoryRow, type TeamRole, type ThresholdRow } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';

const ALL_ROLES = Object.keys(ROLE_LABELS) as TeamRole[];

export default function NotificationsPage() {
  const { accessToken, businesses, activeBusinessId } = useAuth();
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;

  const [thresholds, setThresholds] = useState<ThresholdRow[] | null>(null);
  const [channels, setChannels] = useState<AlertChannelRow[] | null>(null);
  const [history, setHistory] = useState<NotificationHistoryRow[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedProductId, setSavedProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [digestMsg, setDigestMsg] = useState<string | null>(null);

  const load = () => {
    if (!effectiveBusinessId) return;
    apiFetch<ThresholdRow[]>(`/businesses/${effectiveBusinessId}/notifications/thresholds`, { token: accessToken }).then((rows) => {
      setThresholds(rows);
      setDrafts(Object.fromEntries(rows.map((r) => [r.productId, String(r.threshold)])));
    });
    apiFetch<AlertChannelRow[]>(`/businesses/${effectiveBusinessId}/notifications/channels`, { token: accessToken }).then(setChannels);
    apiFetch<NotificationHistoryRow[]>(`/businesses/${effectiveBusinessId}/notifications/history`, { token: accessToken }).then(
      setHistory,
    );
  };

  useEffect(load, [effectiveBusinessId, accessToken]);

  async function saveThreshold(productId: string) {
    if (!effectiveBusinessId) return;
    try {
      await apiFetch(`/businesses/${effectiveBusinessId}/notifications/thresholds/${productId}`, {
        method: 'PATCH',
        body: { threshold: Number(drafts[productId]) || 0 },
        token: accessToken,
      });
      setSavedProductId(productId);
      setTimeout(() => setSavedProductId(null), 1800);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save threshold');
    }
  }

  async function updateChannel(alertType: string, patch: Partial<AlertChannelRow>) {
    if (!effectiveBusinessId) return;
    try {
      await apiFetch(`/businesses/${effectiveBusinessId}/notifications/channels/${alertType}`, {
        method: 'PATCH',
        body: patch,
        token: accessToken,
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update channel');
    }
  }

  function toggleRole(row: AlertChannelRow, role: TeamRole) {
    const has = row.recipientRoles.includes(role);
    const next = has ? row.recipientRoles.filter((r) => r !== role) : [...row.recipientRoles, role];
    updateChannel(row.alertType, { recipientRoles: next });
  }

  async function sendDigest() {
    if (!effectiveBusinessId) return;
    setDigestMsg(null);
    try {
      const result = await apiFetch<{ queued: number; failed: number }>(
        `/businesses/${effectiveBusinessId}/notifications/send-digest`,
        { method: 'POST', token: accessToken },
      );
      setDigestMsg(`${result.queued} queued, ${result.failed} failed (no eligible recipient).`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send digest');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <h1 style={{ marginBottom: 0 }}>Notifications &amp; alerts</h1>
        <button className="btn btn-primary" onClick={sendDigest}>
          Send low-stock digest now
        </button>
      </div>

      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}
      {digestMsg && (
        <div className="tag tag-neutral" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {digestMsg}
        </div>
      )}

      <h4 style={{ marginBottom: 10 }}>Low-stock thresholds</h4>
      <table className="table" style={{ marginBottom: 28 }}>
        <thead>
          <tr>
            <th>Product</th>
            <th>Current stock</th>
            <th>Threshold</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {thresholds?.map((p) => (
            <tr key={p.productId}>
              <td>{p.name}</td>
              <td>{p.stock}</td>
              <td>
                <input
                  className="input"
                  style={{ maxWidth: 80 }}
                  type="number"
                  min="0"
                  value={drafts[p.productId] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [p.productId]: e.target.value }))}
                />
              </td>
              <td>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => saveThreshold(p.productId)}>
                  {savedProductId === p.productId ? 'Saved' : 'Save'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={{ marginBottom: 10 }}>Alert channels</h4>
      <div style={{ overflowX: 'auto', marginBottom: 28 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Alert type</th>
              <th>Email</th>
              <th>WhatsApp</th>
              <th>Recipients</th>
            </tr>
          </thead>
          <tbody>
            {channels?.map((c) => (
              <tr key={c.alertType}>
                <td>{c.label}</td>
                <td>
                  <input
                    className="mf-row-check"
                    type="checkbox"
                    checked={c.emailEnabled}
                    onChange={(e) => updateChannel(c.alertType, { emailEnabled: e.target.checked })}
                  />
                </td>
                <td>
                  <input
                    className="mf-row-check"
                    type="checkbox"
                    checked={c.whatsappEnabled}
                    onChange={(e) => updateChannel(c.alertType, { whatsappEnabled: e.target.checked })}
                  />
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {ALL_ROLES.map((role) => {
                      const active = c.recipientRoles.includes(role);
                      return (
                        <button
                          key={role}
                          onClick={() => toggleRole(c, role)}
                          className={active ? 'tag tag-accent' : 'tag tag-neutral'}
                          style={{ border: 'none', cursor: 'pointer' }}
                        >
                          {ROLE_LABELS[role]}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 style={{ marginBottom: 10 }}>Notification history</h4>
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Channel</th>
            <th>Recipient</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {history?.map((n) => (
            <tr key={n.id}>
              <td className="text-muted">{new Date(n.date).toLocaleString()}</td>
              <td>{n.type}</td>
              <td className="text-muted">{n.channel === 'EMAIL' ? 'Email' : 'WhatsApp'}</td>
              <td className="text-muted">{n.recipient}</td>
              <td>
                <span className={n.status === 'SENT' ? 'tag tag-neutral' : 'tag tag-outline'}>
                  {n.status === 'SENT' ? 'Sent' : 'Failed'}
                </span>
              </td>
            </tr>
          ))}
          {history?.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                Nothing sent yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
