'use client';

import { useEffect, useState } from 'react';
import type { CycleCountDetail, CycleCountSummary, WarehouseSummary } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { countStatusBadge } from '@/lib/inventory-ui';

export function CountsTab({ businessId, initialWarehouseId }: { businessId: string; initialWarehouseId: string | null }) {
  const { accessToken } = useAuth();
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [activeCount, setActiveCount] = useState<CycleCountDetail | null>(null);
  const [history, setHistory] = useState<CycleCountSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<WarehouseSummary[]>(`/businesses/${businessId}/warehouses`, { token: accessToken }).then((ws) => {
      setWarehouses(ws);
      setWarehouseId(initialWarehouseId ?? ws[0]?.id ?? '');
    });
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, accessToken]);

  useEffect(() => {
    if (warehouseId) loadActive(warehouseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  function loadHistory() {
    apiFetch<CycleCountSummary[]>(`/businesses/${businessId}/counts`, { token: accessToken })
      .then(setHistory)
      .catch(() => setError('Failed to load count history'));
  }

  function loadActive(whId: string) {
    apiFetch<CycleCountDetail | null>(`/businesses/${businessId}/warehouses/${whId}/active-count`, { token: accessToken })
      .then(setActiveCount)
      .catch(() => setActiveCount(null));
  }

  async function handleStart() {
    setError(null);
    try {
      const count = await apiFetch<CycleCountDetail>(`/businesses/${businessId}/warehouses/${warehouseId}/counts`, {
        method: 'POST',
        token: accessToken,
      });
      setActiveCount(count);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start count');
    }
  }

  async function handleLineChange(lineId: string, counted: number) {
    if (!activeCount) return;
    try {
      const updated = await apiFetch<CycleCountDetail>(
        `/businesses/${businessId}/counts/${activeCount.id}/lines/${lineId}`,
        { method: 'PATCH', body: { counted }, token: accessToken },
      );
      setActiveCount(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update count line');
    }
  }

  async function handleSubmit() {
    if (!activeCount) return;
    try {
      await apiFetch(`/businesses/${businessId}/counts/${activeCount.id}/submit`, { method: 'POST', token: accessToken });
      setActiveCount(null);
      loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit count');
    }
  }

  return (
    <div>
      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      {warehouses.length > 0 && (
        <div className="field" style={{ maxWidth: 260, marginBottom: 16 }}>
          <label>Warehouse</label>
          <select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {warehouseId && !activeCount && (
        <button className="btn btn-secondary" style={{ marginBottom: 20 }} onClick={handleStart}>
          Start count for this warehouse
        </button>
      )}

      {activeCount && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ fontSize: 14 }}>
            Counting {activeCount.warehouseName}
          </div>
          {activeCount.lines.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 13 }}>
              This warehouse has no stock yet — nothing to count.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Expected</th>
                  <th>Counted</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody>
                {activeCount.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.productName}</td>
                    <td className="text-muted">{l.expected}</td>
                    <td>
                      <input
                        className="input"
                        style={{ maxWidth: 90 }}
                        type="number"
                        value={l.counted ?? l.expected}
                        onChange={(e) => handleLineChange(l.id, Number(e.target.value) || 0)}
                      />
                    </td>
                    <td style={{ color: (l.variance ?? 0) < 0 ? 'var(--color-accent-700)' : undefined, fontWeight: (l.variance ?? 0) !== 0 ? 700 : 400 }}>
                      {(l.variance ?? 0) > 0 ? `+${l.variance}` : l.variance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button className="btn btn-primary" style={{ width: 'fit-content' }} onClick={handleSubmit}>
            Submit count
          </button>
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Count</th>
            <th>Warehouse</th>
            <th>Items counted</th>
            <th>Variance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {history?.map((c) => {
            const badge = countStatusBadge(c.status);
            return (
              <tr key={c.id}>
                <td className="text-muted" style={{ fontSize: 12 }}>
                  {c.id.slice(-8)}
                </td>
                <td>{c.warehouseName}</td>
                <td>{c.itemsCounted}</td>
                <td style={{ fontWeight: c.totalVariance !== 0 ? 700 : 400 }}>
                  {c.totalVariance > 0 ? `+${c.totalVariance}` : c.totalVariance}
                </td>
                <td>
                  <span className={badge.cls}>{badge.label}</span>
                </td>
              </tr>
            );
          })}
          {history?.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                No counts yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
