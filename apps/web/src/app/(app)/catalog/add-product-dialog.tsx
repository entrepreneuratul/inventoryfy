'use client';

import { useState } from 'react';
import type { Category, CreateProductRequest, ProductDetail } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';

interface Props {
  businessId: string;
  categories: Category[];
  onClose: () => void;
  onCreated: (product: ProductDetail) => void;
}

export function AddProductDialog({ businessId, categories, onClose, onCreated }: Props) {
  const { accessToken } = useAuth();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('0');
  const [stock, setStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [isBundle, setIsBundle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const body: CreateProductRequest = {
      name,
      sku,
      categoryId: categoryId || null,
      price: Number(price) || 0,
      stock: Number(stock) || 0,
      lowStockThreshold: Number(lowStockThreshold) || 10,
      isBundle,
    };
    try {
      const product = await apiFetch<ProductDetail>(`/businesses/${businessId}/products`, {
        method: 'POST',
        body,
        token: accessToken,
      });
      onCreated(product);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="dialog-title">Add product</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>SKU</label>
            <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} required />
          </div>
          <div className="field">
            <label>Category</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Price</label>
              <input className="input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Stock</label>
              <input className="input" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Reorder below</label>
              <input
                className="input"
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
              />
            </div>
          </div>
          <label className="radio">
            <input type="checkbox" checked={isBundle} onChange={(e) => setIsBundle(e.target.checked)} style={{ position: 'static', opacity: 1, width: 16, height: 16 }} />
            This is a bundle/kit (add components after creating)
          </label>

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
              {submitting ? 'Creating…' : 'Create product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
