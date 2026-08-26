'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';

export function AddVariantForm({
  businessId,
  productId,
  onAdded,
}: {
  businessId: string;
  productId: string;
  onAdded: () => void;
}) {
  const { accessToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('0');
  const [stock, setStock] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return (
      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setOpen(true)}>
        + Add variant
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/businesses/${businessId}/products/${productId}/variants`, {
        method: 'POST',
        body: { label, sku, price: Number(price) || 0, stock: Number(stock) || 0 },
        token: accessToken,
      });
      setOpen(false);
      setLabel('');
      setSku('');
      setPrice('0');
      setStock('0');
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add variant');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ background: 'var(--color-surface)', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
      <div className="field" style={{ maxWidth: 140 }}>
        <label>Label</label>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} required />
      </div>
      <div className="field" style={{ maxWidth: 160 }}>
        <label>SKU</label>
        <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} required />
      </div>
      <div className="field" style={{ maxWidth: 100 }}>
        <label>Price</label>
        <input className="input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div className="field" style={{ maxWidth: 100 }}>
        <label>Stock</label>
        <input className="input" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
      </div>
      {error && <span className="tag tag-outline">{error}</span>}
      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add'}
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}
