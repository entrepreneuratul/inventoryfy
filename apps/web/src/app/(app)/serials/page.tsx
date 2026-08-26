'use client';

import { useEffect, useState } from 'react';
import type { SerialRow, VariantOption } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { serialStatusBadge } from '@/lib/inventory-ui';

export default function SerialsPage() {
  const { accessToken, businesses, activeBusinessId } = useAuth();
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;

  const [serials, setSerials] = useState<SerialRow[] | null>(null);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [variantId, setVariantId] = useState('');
  const [serial, setSerial] = useState('');
  const [warrantyUntil, setWarrantyUntil] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!effectiveBusinessId) return;
    apiFetch<SerialRow[]>(`/businesses/${effectiveBusinessId}/serials`, { token: accessToken })
      .then(setSerials)
      .catch(() => setError('Failed to load serial numbers'));
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
      await apiFetch(`/businesses/${effectiveBusinessId}/serials`, {
        method: 'POST',
        body: { variantId, serial, warrantyUntil: warrantyUntil || undefined },
        token: accessToken,
      });
      setAddOpen(false);
      setSerial('');
      setWarrantyUntil('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add serial number');
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Serial numbers</h1>

      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      <button className="btn btn-secondary" style={{ fontSize: 12, marginBottom: 14 }} onClick={() => setAddOpen(true)}>
        + Add serial number
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
          <div className="field" style={{ maxWidth: 200 }}>
            <label>Serial number</label>
            <input className="input" value={serial} onChange={(e) => setSerial(e.target.value)} required />
          </div>
          <div className="field" style={{ maxWidth: 160 }}>
            <label>Warranty until (optional)</label>
            <input className="input" type="date" value={warrantyUntil} onChange={(e) => setWarrantyUntil(e.target.value)} />
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
            <th>Serial</th>
            <th>Product</th>
            <th>Status</th>
            <th>Warranty until</th>
          </tr>
        </thead>
        <tbody>
          {serials?.map((s) => {
            const badge = serialStatusBadge(s.status);
            return (
              <tr key={s.id}>
                <td style={{ fontWeight: 700 }}>{s.serial}</td>
                <td>{s.productName}</td>
                <td>
                  <span className={badge.cls}>{badge.label}</span>
                </td>
                <td className="text-muted">{s.warrantyUntil ?? '—'}</td>
              </tr>
            );
          })}
          {serials?.length === 0 && (
            <tr>
              <td colSpan={4} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                No serial numbers tracked yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
