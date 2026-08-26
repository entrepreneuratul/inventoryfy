'use client';

import { useEffect, useState } from 'react';
import type { CreatePurchaseOrderRequest, SupplierCard, VariantOption } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';

interface LineDraft {
  variantId: string;
  qty: string;
  unitCost: string;
}

interface Props {
  businessId: string;
  onClose: () => void;
  onCreated: () => void;
  /** Pre-fills a suggested line + supplier when opened from a reorder suggestion. */
  initial?: { variantId: string; qty: number; supplierId: string | null };
}

export function CreatePoDialog({ businessId, onClose, onCreated, initial }: Props) {
  const { accessToken } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierCard[]>([]);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? '');
  const [expectedDate, setExpectedDate] = useState('');
  const [lines, setLines] = useState<LineDraft[]>(
    initial ? [{ variantId: initial.variantId, qty: String(initial.qty), unitCost: '0' }] : [{ variantId: '', qty: '1', unitCost: '0' }],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<SupplierCard[]>(`/businesses/${businessId}/suppliers`, { token: accessToken }).then((sups) => {
      setSuppliers(sups);
      setSupplierId((v) => v || sups[0]?.id || '');
    });
    apiFetch<VariantOption[]>(`/businesses/${businessId}/products/variant-options`, { token: accessToken }).then((vs) => {
      setVariants(vs);
      setLines((ls) => ls.map((l) => ({ ...l, variantId: l.variantId || vs[0]?.id || '' })));
    });
  }, [businessId, accessToken]);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((ls) => [...ls, { variantId: variants[0]?.id ?? '', qty: '1', unitCost: '0' }]);
  }

  function removeLine(index: number) {
    setLines((ls) => ls.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const body: CreatePurchaseOrderRequest = {
      supplierId,
      expectedDate: expectedDate || undefined,
      items: lines
        .filter((l) => l.variantId)
        .map((l) => ({ variantId: l.variantId, qty: Number(l.qty) || 0, unitCost: Number(l.unitCost) || 0 })),
    };
    try {
      await apiFetch(`/businesses/${businessId}/purchase-orders`, { method: 'POST', body, token: accessToken });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="dialog-title">New purchase order</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Supplier</label>
              <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ maxWidth: 160 }}>
              <label>Expected date</label>
              <input className="input" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Items</label>
            {lines.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <select className="input" style={{ flex: 1 }} value={line.variantId} onChange={(e) => updateLine(i, { variantId: e.target.value })}>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.productName} — {v.label} ({v.sku})
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  style={{ maxWidth: 80 }}
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={line.qty}
                  onChange={(e) => updateLine(i, { qty: e.target.value })}
                />
                <input
                  className="input"
                  style={{ maxWidth: 90 }}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit cost"
                  value={line.unitCost}
                  onChange={(e) => updateLine(i, { unitCost: e.target.value })}
                />
                {lines.length > 1 && (
                  <button type="button" className="btn btn-ghost" onClick={() => removeLine(i)}>
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={addLine}>
              + Add item
            </button>
          </div>

          {error && (
            <div className="tag tag-outline" style={{ display: 'block', padding: '8px 10px' }}>
              {error}
            </div>
          )}

          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !supplierId}>
              {submitting ? 'Creating…' : 'Create draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
