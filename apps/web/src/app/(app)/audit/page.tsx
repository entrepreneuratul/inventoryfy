'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AuditLogRow } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';

export default function AuditPage() {
  const { accessToken, role, businesses, activeBusinessId } = useAuth();
  const isOwner = role === 'OWNER';
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;

  const [entries, setEntries] = useState<AuditLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterBiz, setFilterBiz] = useState('all');

  useEffect(() => {
    const endpoint = isOwner ? '/audit/summary' : `/businesses/${effectiveBusinessId}/audit`;
    if (!isOwner && !effectiveBusinessId) return;
    apiFetch<AuditLogRow[]>(endpoint, { token: accessToken })
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load audit log'));
  }, [isOwner, effectiveBusinessId, accessToken]);

  const businessNames = useMemo(() => [...new Set(entries?.map((e) => e.businessName) ?? [])], [entries]);
  const filtered = entries?.filter((e) => filterBiz === 'all' || e.businessName === filterBiz);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <h1 style={{ marginBottom: 0 }}>Audit log</h1>
        {isOwner && businessNames.length > 1 && (
          <select className="input" style={{ maxWidth: 220 }} value={filterBiz} onChange={(e) => setFilterBiz(e.target.value)}>
            <option value="all">All businesses</option>
            {businessNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>User</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Business</th>
          </tr>
        </thead>
        <tbody>
          {filtered?.map((a) => (
            <tr key={a.id}>
              <td className="text-muted">{new Date(a.timestamp).toLocaleString()}</td>
              <td>{a.userName}</td>
              <td>{a.action}</td>
              <td className="text-muted">{a.entity}</td>
              <td className="text-muted">{a.businessName}</td>
            </tr>
          ))}
          {filtered?.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                Nothing recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
