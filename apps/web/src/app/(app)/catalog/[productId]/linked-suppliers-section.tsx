'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LinkedSupplierRow, SupplierCard } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';

export function LinkedSuppliersSection({ businessId, productId }: { businessId: string; productId: string }) {
  const { accessToken } = useAuth();
  const [links, setLinks] = useState<LinkedSupplierRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierCard[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [costPrice, setCostPrice] = useState('0');
  const [preferred, setPreferred] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    apiFetch<LinkedSupplierRow[]>(`/businesses/${businessId}/products/${productId}/suppliers`, { token: accessToken })
      .then(setLinks)
      .catch(() => setLinks([]));
  };

  useEffect(load, [businessId, productId, accessToken]);

  useEffect(() => {
    apiFetch<SupplierCard[]>(`/businesses/${businessId}/suppliers`, { token: accessToken }).then((sups) => {
      setSuppliers(sups);
      setSupplierId((v) => v || sups[0]?.id || '');
    });
  }, [businessId, accessToken]);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/businesses/${businessId}/products/${productId}/suppliers`, {
        method: 'POST',
        body: { supplierId, costPrice: Number(costPrice) || 0, preferred },
        token: accessToken,
      });
      setFormOpen(false);
      setCostPrice('0');
      setPreferred(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to link supplier');
    }
  }

  const linkableSuppliers = suppliers.filter((s) => !links.some((l) => l.supplierId === s.id));

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h4 style={{ marginBottom: 0 }}>Linked suppliers</h4>
        {!formOpen && linkableSuppliers.length > 0 && (
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setFormOpen(true)}>
            + Link supplier
          </button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={handleLink} className="card" style={{ background: 'var(--color-surface)', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10, marginBottom: 12 }}>
          <div className="field" style={{ minWidth: 160, flex: 1 }}>
            <label>Supplier</label>
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              {linkableSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 110 }}>
            <label>Cost price</label>
            <input className="input" type="number" min="0" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
          </div>
          <label className="radio">
            <input type="checkbox" checked={preferred} onChange={(e) => setPreferred(e.target.checked)} style={{ position: 'static', opacity: 1, width: 16, height: 16 }} />
            Preferred
          </label>
          {error && <span className="tag tag-outline">{error}</span>}
          <button type="submit" className="btn btn-primary">
            Link
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>
            Cancel
          </button>
        </form>
      )}

      {links.length === 0 ? (
        <span className="text-muted" style={{ fontSize: 13 }}>
          No suppliers linked yet.
        </span>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Cost price</th>
              <th>Lead time</th>
              <th>Preferred</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link href={`/suppliers/${l.supplierId}`} className="btn btn-ghost" style={{ padding: 0, fontSize: 14 }}>
                    {l.name}
                  </Link>
                </td>
                <td>${l.costPrice.toFixed(2)}</td>
                <td className="text-muted">{l.leadTimeDays} days</td>
                <td>{l.preferred && <span className="tag tag-accent">Preferred</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
