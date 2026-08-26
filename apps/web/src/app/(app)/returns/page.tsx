'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReturnRow } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { returnStatusBadge } from '@/lib/order-ui';

export default function ReturnsPage() {
  const router = useRouter();
  const { accessToken, businesses, activeBusinessId } = useAuth();
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;

  const [returns, setReturns] = useState<ReturnRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveBusinessId) return;
    apiFetch<ReturnRow[]>(`/businesses/${effectiveBusinessId}/returns`, { token: accessToken })
      .then(setReturns)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load returns'));
  }, [effectiveBusinessId, accessToken]);

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Returns &amp; RMA</h1>

      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>RMA</th>
            <th>Order</th>
            <th>Product</th>
            <th>Reason</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {returns?.map((r) => {
            const badge = returnStatusBadge(r.status);
            return (
              <tr key={r.id}>
                <td>
                  <button className="btn btn-ghost" style={{ padding: 0, fontSize: 14 }} onClick={() => router.push(`/returns/${r.id}`)}>
                    {r.displayId}
                  </button>
                </td>
                <td className="text-muted">{r.orderDisplayId}</td>
                <td>{r.product}</td>
                <td className="text-muted">{r.reason}</td>
                <td>
                  <span className={badge.cls}>{badge.label}</span>
                </td>
              </tr>
            );
          })}
          {returns?.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                No returns yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
