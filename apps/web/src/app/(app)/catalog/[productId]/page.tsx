'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { ProductDetail } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { statusBadge } from '@/lib/catalog-ui';
import { AddVariantForm } from './add-variant-form';

export default function ProductDetailPage({ params }: PageProps<'/catalog/[productId]'>) {
  const { productId } = use(params);
  const router = useRouter();
  const { accessToken, role, businesses, activeBusinessId } = useAuth();

  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;
  const effectiveBusinessName = businesses.find((b) => b.id === effectiveBusinessId)?.name ?? '';

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState('');
  const [thresholdSaved, setThresholdSaved] = useState(false);

  const load = async () => {
    if (!effectiveBusinessId) return;
    try {
      const p = await apiFetch<ProductDetail>(`/businesses/${effectiveBusinessId}/products/${productId}`, {
        token: accessToken,
      });
      setProduct(p);
      setThresholdDraft(String(p.lowStockThreshold));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load product');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveBusinessId, productId, accessToken]);

  async function saveThreshold() {
    if (!effectiveBusinessId) return;
    try {
      await apiFetch<ProductDetail>(`/businesses/${effectiveBusinessId}/products/${productId}`, {
        method: 'PATCH',
        body: { lowStockThreshold: Number(thresholdDraft) || 0 },
        token: accessToken,
      });
      setThresholdSaved(true);
      setTimeout(() => setThresholdSaved(false), 2000);
      load();
    } catch {
      setError('Failed to save threshold');
    }
  }

  if (error) {
    return (
      <div>
        <button className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 12 }} onClick={() => router.push('/catalog')}>
          <ArrowLeft size={14} />
          Back to catalog
        </button>
        <div className="tag tag-outline" style={{ display: 'block', padding: '8px 10px' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!product) return <span className="text-muted">Loading…</span>;

  const badge = statusBadge(product.status);

  return (
    <div>
      <button className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 12 }} onClick={() => router.push('/catalog')}>
        <ArrowLeft size={14} />
        Back to catalog
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        <h1 style={{ marginBottom: 0 }}>{product.name}</h1>
        <span className={badge.cls}>{badge.label}</span>
      </div>
      <div className="text-muted" style={{ fontSize: 13, marginBottom: 24 }}>
        {product.sku} · {product.category ?? 'Uncategorized'} · {effectiveBusinessName}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
        <PlaceholderCard title="Stock across warehouses" note="Per-warehouse breakdown lands in Phase 4 (Warehouses). Total stock shown above sums every variant." />
        <div>
          <h4 style={{ marginBottom: 10 }}>Low-stock threshold</h4>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div className="field" style={{ maxWidth: 120 }}>
              <label>Reorder below</label>
              <input className="input" type="number" value={thresholdDraft} onChange={(e) => setThresholdDraft(e.target.value)} />
            </div>
            <button className="btn btn-secondary" onClick={saveThreshold}>
              Save
            </button>
            {thresholdSaved && <span className="tag tag-neutral">Saved</span>}
          </div>
        </div>
      </div>

      <h4 style={{ marginBottom: 10 }}>Variants</h4>
      <table className="table" style={{ marginBottom: 12 }}>
        <thead>
          <tr>
            <th>Variant</th>
            <th>SKU</th>
            <th>Stock</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {product.variants.map((v) => (
            <tr key={v.id}>
              <td>{v.label}</td>
              <td className="text-muted">{v.sku}</td>
              <td>{v.stock}</td>
              <td>${v.price.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {effectiveBusinessId && (
        <div style={{ marginBottom: 28 }}>
          <AddVariantForm businessId={effectiveBusinessId} productId={productId} onAdded={load} />
        </div>
      )}

      {product.isBundle && (
        <>
          <h4 style={{ marginBottom: 10 }}>Bundle components</h4>
          <div className="card" style={{ background: 'var(--color-surface)', marginBottom: 28 }}>
            <div className="card-body" style={{ flex: 'none' }}>
              This is a kit — selling one unit deducts each component below from its own stock.
            </div>
            {product.bundleComponents.length === 0 ? (
              <div className="text-muted" style={{ fontSize: 13 }}>
                No components set yet.
              </div>
            ) : (
              product.bundleComponents.map((b) => (
                <div
                  key={b.id}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderTop: '1px solid var(--color-divider)' }}
                >
                  <span>{b.name}</span>
                  <span className="text-muted">× {b.qty}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
        <PlaceholderCard title="Batches / lots" note="Lot + expiry tracking lands in Phase 4 (Warehouses)." />
        <PlaceholderCard title="Serial numbers" note="Serial + warranty tracking lands in Phase 4 (Warehouses)." />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
        <PlaceholderCard title="Landed cost" note="Base cost, freight & duty roll-up lands in Phase 7 (Financials)." />
        <PlaceholderCard title="Stock valuation" note="FIFO / LIFO / weighted-average valuation lands in Phase 7 (Financials)." />
      </div>

      <PlaceholderCard title="Linked suppliers" note="Supplier pricing & lead times land in Phase 5 (Suppliers & POs)." style={{ marginBottom: 28 }} />
      <PlaceholderCard title="Stock movement history" note="The full stock ledger lands alongside Warehouses (Phase 4) and Financials (Phase 7)." />
    </div>
  );
}

function PlaceholderCard({ title, note, style }: { title: string; note: string; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <h4 style={{ marginBottom: 10 }}>{title}</h4>
      <div className="card" style={{ background: 'var(--color-surface)' }}>
        <div className="card-body text-muted" style={{ flex: 'none' }}>
          {note}
        </div>
      </div>
    </div>
  );
}
