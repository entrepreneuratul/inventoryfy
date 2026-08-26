'use client';

import { useEffect, useState } from 'react';
import type { TransferRow, VariantOption, WarehouseSummary } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';

export function TransfersTab({ businessId }: { businessId: string }) {
  const { accessToken } = useAuth();
  const [transfers, setTransfers] = useState<TransferRow[] | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [variants, setVariants] = useState<VariantOption[]>([]);

  const [variantId, setVariantId] = useState('');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [qty, setQty] = useState('1');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTransfers = () => {
    apiFetch<TransferRow[]>(`/businesses/${businessId}/transfers`, { token: accessToken })
      .then(setTransfers)
      .catch(() => setError('Failed to load transfers'));
  };

  useEffect(() => {
    loadTransfers();
    apiFetch<WarehouseSummary[]>(`/businesses/${businessId}/warehouses`, { token: accessToken }).then((ws) => {
      setWarehouses(ws);
      setFromId((v) => v || ws[0]?.id || '');
      setToId((v) => v || ws[1]?.id || ws[0]?.id || '');
    });
    apiFetch<VariantOption[]>(`/businesses/${businessId}/products/variant-options`, { token: accessToken }).then((vs) => {
      setVariants(vs);
      setVariantId((v) => v || vs[0]?.id || '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, accessToken]);

  async function handleAddTransfer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await apiFetch(`/businesses/${businessId}/transfers`, {
        method: 'POST',
        body: { variantId, fromWarehouseId: fromId, toWarehouseId: toId, qty: Number(qty) || 0 },
        token: accessToken,
      });
      setSaved(true);
      loadTransfers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to log transfer');
    }
  }

  if (warehouses.length < 2) {
    return (
      <div className="card" style={{ maxWidth: 500 }}>
        <div className="card-body" style={{ flex: 'none' }}>
          You need at least two warehouses to log a transfer. Add another one under the Locations tab.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 20, maxWidth: 680 }}>
        <div className="card-title" style={{ fontSize: 14 }}>
          Log a stock transfer
        </div>
        <form onSubmit={handleAddTransfer} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ minWidth: 200, flex: 1 }}>
            <label>Product / variant</label>
            <select className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.productName} — {v.label} ({v.sku})
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ minWidth: 120 }}>
            <label>From</label>
            <select className="input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ minWidth: 120 }}>
            <label>To</label>
            <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 90 }}>
            <label>Qty</label>
            <input className="input" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary">
            Log transfer
          </button>
        </form>
        {saved && <span className="tag tag-neutral" style={{ width: 'fit-content', marginTop: 10 }}>Transfer logged</span>}
        {error && (
          <div className="tag tag-outline" style={{ display: 'block', marginTop: 10, padding: '8px 10px' }}>
            {error}
          </div>
        )}
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Transfer</th>
            <th>Product</th>
            <th>From → To</th>
            <th>Qty</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {transfers?.map((t) => (
            <tr key={t.id}>
              <td className="text-muted" style={{ fontSize: 12 }}>
                {t.id.slice(-8)}
              </td>
              <td>
                {t.productName} — {t.variantLabel}
              </td>
              <td className="text-muted">
                {t.fromWarehouseName} → {t.toWarehouseName}
              </td>
              <td>{t.qty}</td>
              <td>
                <span className="tag tag-neutral">Completed</span>
              </td>
            </tr>
          ))}
          {transfers?.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                No transfers logged yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
