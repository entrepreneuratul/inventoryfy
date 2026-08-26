'use client';

import { useEffect, useState } from 'react';
import type { CreateOrderRequest, OrderChannel, VariantOption, WarehouseSummary } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';

interface LineDraft {
  variantId: string;
  qty: string;
  unitPrice: string;
}

const CHANNELS: OrderChannel[] = ['WEBSITE', 'AMAZON', 'FLIPKART'];

export function CreateOrderDialog({ businessId, onClose, onCreated }: { businessId: string; onClose: () => void; onCreated: () => void }) {
  const { accessToken } = useAuth();
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [channel, setChannel] = useState<OrderChannel>('WEBSITE');
  const [customer, setCustomer] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ variantId: '', qty: '1', unitPrice: '0' }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<WarehouseSummary[]>(`/businesses/${businessId}/warehouses`, { token: accessToken }).then((ws) => {
      setWarehouses(ws);
      setWarehouseId((v) => v || ws[0]?.id || '');
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
    setLines((ls) => [...ls, { variantId: variants[0]?.id ?? '', qty: '1', unitPrice: '0' }]);
  }

  function removeLine(index: number) {
    setLines((ls) => ls.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const body: CreateOrderRequest = {
      channel,
      customer,
      warehouseId,
      items: lines
        .filter((l) => l.variantId)
        .map((l) => ({ variantId: l.variantId, qty: Number(l.qty) || 0, unitPrice: Number(l.unitPrice) || 0 })),
    };
    try {
      await apiFetch(`/businesses/${businessId}/orders`, { method: 'POST', body, token: accessToken });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  }

  if (warehouses.length === 0) {
    return (
      <div className="dialog-backdrop" onClick={onClose}>
        <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
          <div className="dialog-title">New order</div>
          <div className="dialog-body">You need at least one warehouse before creating orders. Add one under Warehouses → Locations.</div>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div className="dialog-title">New order</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Channel</label>
              <select className="input" value={channel} onChange={(e) => setChannel(e.target.value as OrderChannel)}>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c === 'WEBSITE' ? 'Website' : c === 'AMAZON' ? 'Amazon' : 'Flipkart'}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Customer</label>
              <input className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} required />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Fulfill from</label>
              <select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
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
                  placeholder="Price"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
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
            <button type="submit" className="btn btn-primary" disabled={submitting || !customer}>
              {submitting ? 'Creating…' : 'Create order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
