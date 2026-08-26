'use client';

import { useEffect, useState } from 'react';
import type {
  CreateIntegrationConnectionResult,
  IntegrationConnectionRow,
  IntegrationEventRow,
  WarehouseSummary,
} from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';

export default function IntegrationsPage() {
  const { accessToken, businesses, activeBusinessId, can } = useAuth();
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;
  const canManage = can('MANAGE_INTEGRATIONS');

  const [connections, setConnections] = useState<IntegrationConnectionRow[] | null>(null);
  const [events, setEvents] = useState<IntegrationEventRow[] | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [defaultWarehouseId, setDefaultWarehouseId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreateIntegrationConnectionResult | null>(null);

  const load = () => {
    if (!effectiveBusinessId) return;
    apiFetch<IntegrationConnectionRow[]>(`/businesses/${effectiveBusinessId}/integrations`, { token: accessToken })
      .then(setConnections)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load connections'));
    apiFetch<IntegrationEventRow[]>(`/businesses/${effectiveBusinessId}/integrations/events`, { token: accessToken }).then(setEvents);
    apiFetch<WarehouseSummary[]>(`/businesses/${effectiveBusinessId}/warehouses`, { token: accessToken }).then((ws) => {
      setWarehouses(ws);
      setDefaultWarehouseId((current) => current || ws[0]?.id || '');
    });
  };

  useEffect(load, [effectiveBusinessId, accessToken]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveBusinessId) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<CreateIntegrationConnectionResult>(`/businesses/${effectiveBusinessId}/integrations`, {
        method: 'POST',
        body: { name, webhookUrl, defaultWarehouseId },
        token: accessToken,
      });
      setCreated(result);
      setName('');
      setWebhookUrl('');
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create connection');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(id: string) {
    if (!effectiveBusinessId) return;
    try {
      await apiFetch(`/businesses/${effectiveBusinessId}/integrations/${id}/toggle-status`, { method: 'POST', token: accessToken });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update connection');
    }
  }

  async function revoke(id: string) {
    if (!effectiveBusinessId) return;
    if (!confirm('Revoke this connection? The storefront’s API key will stop working immediately.')) return;
    try {
      await apiFetch(`/businesses/${effectiveBusinessId}/integrations/${id}`, { method: 'DELETE', token: accessToken });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke connection');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 8 }}>
        <h1 style={{ marginBottom: 0 }}>Integrations</h1>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? 'Cancel' : 'New connection'}
          </button>
        )}
      </div>
      <p className="text-muted" style={{ marginBottom: 20, maxWidth: 640 }}>
        Connect an independently-run storefront so its sales decrement real stock here, and any stock change here —
        from any channel — pushes back out to it within about a second.
      </p>

      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      {created && (
        <div className="card" style={{ background: 'var(--color-surface)', maxWidth: 620, marginBottom: 20, fontSize: 13 }}>
          <div className="card-title" style={{ fontSize: 14 }}>
            &ldquo;{created.connection.name}&rdquo; connected
          </div>
          <div className="card-body" style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              These are shown once — copy them into the storefront&rsquo;s config now, they can&rsquo;t be
              retrieved again:
            </div>
            <div>
              API key: <code>{created.apiKey}</code>
            </div>
            <div>
              Webhook secret: <code>{created.webhookSecret}</code>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 12, width: 'fit-content' }} onClick={() => setCreated(null)}>
            Dismiss
          </button>
        </div>
      )}

      {formOpen && canManage && (
        <div className="card" style={{ maxWidth: 560, marginBottom: 24 }}>
          <div className="card-title" style={{ fontSize: 14 }}>
            New connection
          </div>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="field">
              <label>Name</label>
              <input className="input" placeholder="e.g. My Shopify Store" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Webhook URL</label>
              <input
                className="input"
                placeholder="http://localhost:4001/webhooks/inventory"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Fulfills from</label>
              <select className="input" value={defaultWarehouseId} onChange={(e) => setDefaultWarehouseId(e.target.value)}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting || !defaultWarehouseId} style={{ width: 'fit-content' }}>
              {submitting ? 'Creating…' : 'Create connection'}
            </button>
          </form>
        </div>
      )}

      <div style={{ overflowX: 'auto', marginBottom: 32 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>API key</th>
              <th>Webhook URL</th>
              <th>Fulfills from</th>
              <th>Status</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {connections?.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td className="text-muted">
                  <code>{c.apiKeyMasked}</code>
                </td>
                <td className="text-muted">{c.webhookUrl}</td>
                <td className="text-muted">{c.defaultWarehouseName}</td>
                <td>
                  <span className={c.status === 'ACTIVE' ? 'tag tag-neutral' : 'tag tag-outline'}>
                    {c.status === 'ACTIVE' ? 'Active' : 'Paused'}
                  </span>
                </td>
                {canManage && (
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => toggleStatus(c.id)}>
                      {c.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => revoke(c.id)}>
                      Revoke
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {connections?.length === 0 && (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                  No storefronts connected yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h4 style={{ marginBottom: 10 }}>Sync log</h4>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Connection</th>
              <th>Direction</th>
              <th>Event</th>
              <th>Status</th>
              <th>Attempts</th>
            </tr>
          </thead>
          <tbody>
            {events?.map((e) => (
              <tr key={e.id}>
                <td className="text-muted">{new Date(e.createdAt).toLocaleString()}</td>
                <td>{e.connectionName}</td>
                <td className="text-muted">{e.direction === 'INBOUND' ? 'In ←' : 'Out →'}</td>
                <td className="text-muted">{e.eventType === 'ORDER_RECEIVED' ? 'Order received' : 'Inventory updated'}</td>
                <td>
                  <span className={e.status === 'SUCCESS' ? 'tag tag-neutral' : 'tag tag-outline'} title={e.errorMessage ?? undefined}>
                    {e.status === 'SUCCESS' ? 'Success' : 'Failed'}
                  </span>
                </td>
                <td className="text-muted">{e.attempts}</td>
              </tr>
            ))}
            {events?.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                  Nothing synced yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
