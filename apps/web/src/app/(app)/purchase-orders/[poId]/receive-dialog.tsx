'use client';

import { useEffect, useState } from 'react';
import type { PurchaseOrderDetail, WarehouseSummary } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';

export function ReceiveDialog({
  businessId,
  po,
  onClose,
  onReceived,
}: {
  businessId: string;
  po: PurchaseOrderDetail;
  onClose: () => void;
  onReceived: () => void;
}) {
  const { accessToken } = useAuth();
  const [warehouses, setWarehouses] = useState<WarehouseSummary[] | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(po.items.map((it) => [it.id, String(it.qty - it.receivedQty)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<WarehouseSummary[]>(`/businesses/${businessId}/warehouses`, { token: accessToken }).then((ws) => {
      setWarehouses(ws);
      setWarehouseId(ws[0]?.id ?? '');
    });
  }, [businessId, accessToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/businesses/${businessId}/purchase-orders/${po.id}/receive`, {
        method: 'POST',
        body: {
          warehouseId,
          lines: po.items.map((it) => ({ itemId: it.id, receivedQty: Number(quantities[it.id]) || 0 })),
        },
        token: accessToken,
      });
      onReceived();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to receive stock');
    } finally {
      setSubmitting(false);
    }
  }

  if (warehouses === null) return null;

  if (warehouses.length === 0) {
    return (
      <div className="dialog-backdrop" onClick={onClose}>
        <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
          <div className="dialog-title">Receive stock</div>
          <div className="dialog-body">
            You need at least one warehouse before receiving stock. Add one under Warehouses → Locations.
          </div>
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
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="dialog-title">Receive stock — {po.displayId}</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label>Into warehouse</label>
            <select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          {po.items.map((it) => {
            const remaining = it.qty - it.receivedQty;
            return (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{it.name}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>
                    {it.receivedQty} / {it.qty} received
                  </div>
                </div>
                <input
                  className="input"
                  style={{ maxWidth: 90 }}
                  type="number"
                  min="0"
                  max={remaining}
                  value={quantities[it.id]}
                  onChange={(e) => setQuantities((q) => ({ ...q, [it.id]: e.target.value }))}
                  disabled={remaining === 0}
                />
              </div>
            );
          })}
          {error && (
            <div className="tag tag-outline" style={{ display: 'block', padding: '8px 10px' }}>
              {error}
            </div>
          )}
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Receiving…' : 'Receive'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
