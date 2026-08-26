'use client';

import { useEffect, useState } from 'react';
import type { BatchRow, VariantOption } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { batchStatusBadge } from '@/lib/inventory-ui';

export default function BatchesPage() {
  const { accessToken, businesses, activeBusinessId } = useAuth();
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;

  const [batches, setBatches] = useState<BatchRow[] | null>(null);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [variantId, setVariantId] = useState('');
  const [lotCode, setLotCode] = useState('');
  const [qty, setQty] = useState('0');
  const [expiryDate, setExpiryDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!effectiveBusinessId) return;
    apiFetch<BatchRow[]>(`/businesses/${effectiveBusinessId}/batches`, { token: accessToken })
      .then(setBatches)
      .catch(() => setError('Failed to load batches'));
  };

  useEffect(load, [effectiveBusinessId, accessToken]);

  useEffect(() => {
    if (!effectiveBusinessId) return;
    apiFetch<VariantOption[]>(`/businesses/${effectiveBusinessId}/products/variant-options`, { token: accessToken }).then((vs) => {
      setVariants(vs);
      setVariantId((v) => v || vs[0]?.id || '');
    });
  }, [effectiveBusinessId, accessToken]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveBusinessId) return;
    try {
      await apiFetch(`/businesses/${effectiveBusinessId}/batches`, {
        method: 'POST',
        body: { variantId, lotCode, qty: Number(qty) || 0, expiryDate: expiryDate || undefined },
        token: accessToken,
      });
      setAddOpen(false);
      setLotCode('');
      setQty('0');
      setExpiryDate('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add batch');
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Batches &amp; lot expiry</h1>

      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      <button className="btn btn-secondary" style={{ fontSize: 12, marginBottom: 14 }} onClick={() => setAddOpen(true)}>
        + Add batch
      </button>

      {addOpen && (
        <form onSubmit={handleAdd} className="card" style={{ maxWidth: 620, marginBottom: 20, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
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
          <div className="field" style={{ maxWidth: 160 }}>
            <label>Lot code</label>
            <input className="input" value={lotCode} onChange={(e) => setLotCode(e.target.value)} required />
          </div>
          <div className="field" style={{ maxWidth: 100 }}>
            <label>Qty</label>
            <input className="input" type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="field" style={{ maxWidth: 160 }}>
            <label>Expiry (optional)</label>
            <input className="input" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary">
            Add
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(false)}>
            Cancel
          </button>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Lot</th>
            <th>Product</th>
            <th>Qty remaining</th>
            <th>Expiry</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {batches?.map((b) => {
            const badge = batchStatusBadge(b.status);
            return (
              <tr key={b.id}>
                <td style={{ fontWeight: 700 }}>{b.lotCode}</td>
                <td>{b.productName}</td>
                <td>{b.qty}</td>
                <td className="text-muted">{b.expiryDate ?? '—'}</td>
                <td>
                  <span className={badge.cls}>{badge.label}</span>
                </td>
              </tr>
            );
          })}
          {batches?.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                No batches tracked yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
