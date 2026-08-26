'use client';

import { useEffect, useState } from 'react';
import type { VariantOption, WarehouseSummary } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';

export function LocationsTab({ businessId, onStartCount }: { businessId: string; onStartCount: (warehouseId: string) => void }) {
  const { accessToken } = useAuth();
  const [warehouses, setWarehouses] = useState<WarehouseSummary[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [adjustFor, setAdjustFor] = useState<WarehouseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    apiFetch<WarehouseSummary[]>(`/businesses/${businessId}/warehouses`, { token: accessToken })
      .then(setWarehouses)
      .catch(() => setError('Failed to load warehouses'));
  };

  useEffect(load, [businessId, accessToken]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch(`/businesses/${businessId}/warehouses`, { method: 'POST', body: { name: newName }, token: accessToken });
      setNewName('');
      setAddOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create warehouse');
    }
  }

  return (
    <div>
      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      <button className="btn btn-secondary" style={{ fontSize: 12, marginBottom: 14 }} onClick={() => setAddOpen(true)}>
        + Add warehouse
      </button>

      {addOpen && (
        <form onSubmit={handleAdd} className="card" style={{ maxWidth: 420, marginBottom: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Warehouse name</label>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
          </div>
          <button type="submit" className="btn btn-primary">
            Create
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(false)}>
            Cancel
          </button>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Location</th>
            <th>SKUs stocked</th>
            <th>Total units</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {warehouses?.map((w) => (
            <tr key={w.id}>
              <td>{w.name}</td>
              <td>{w.skuCount}</td>
              <td>{w.totalUnits}</td>
              <td>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setAdjustFor(w)}>
                  Adjust stock
                </button>
              </td>
              <td>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => onStartCount(w.id)}>
                  Start count →
                </button>
              </td>
            </tr>
          ))}
          {warehouses?.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                No warehouses yet — add one above.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {adjustFor && (
        <AdjustStockDialog
          businessId={businessId}
          warehouse={adjustFor}
          onClose={() => setAdjustFor(null)}
          onSaved={() => {
            setAdjustFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function AdjustStockDialog({
  businessId,
  warehouse,
  onClose,
  onSaved,
}: {
  businessId: string;
  warehouse: WarehouseSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { accessToken } = useAuth();
  const [options, setOptions] = useState<VariantOption[]>([]);
  const [variantId, setVariantId] = useState('');
  const [delta, setDelta] = useState('0');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<VariantOption[]>(`/businesses/${businessId}/products/variant-options`, { token: accessToken })
      .then((opts) => {
        setOptions(opts);
        setVariantId((v) => v || opts[0]?.id || '');
      })
      .catch(() => setOptions([]));
  }, [businessId, accessToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/businesses/${businessId}/warehouses/${warehouse.id}/adjust`, {
        method: 'POST',
        body: { variantId, delta: Number(delta) || 0 },
        token: accessToken,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to adjust stock');
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="dialog-title">Adjust stock — {warehouse.name}</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label>Product / variant</label>
            <select className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.productName} — {o.label} ({o.sku})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Quantity change (use a negative number to remove stock)</label>
            <input className="input" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} />
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
            <button type="submit" className="btn btn-primary">
              Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
