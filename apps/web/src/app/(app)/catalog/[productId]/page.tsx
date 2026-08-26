'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { BatchRow, ProductDetail, ProductWarehouseBreakdown, SerialRow } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { statusBadge } from '@/lib/catalog-ui';
import { batchStatusBadge, serialStatusBadge } from '@/lib/inventory-ui';
import { AddVariantForm } from './add-variant-form';
import { LinkedSuppliersSection } from './linked-suppliers-section';
import { FinancialsSection } from './financials-section';

export default function ProductDetailPage({ params }: PageProps<'/catalog/[productId]'>) {
  const { productId } = use(params);
  const router = useRouter();
  const { accessToken, businesses, activeBusinessId } = useAuth();

  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;
  const effectiveBusinessName = businesses.find((b) => b.id === effectiveBusinessId)?.name ?? '';

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [warehouseStock, setWarehouseStock] = useState<ProductWarehouseBreakdown | null>(null);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [serials, setSerials] = useState<SerialRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState('');
  const [thresholdSaved, setThresholdSaved] = useState(false);
  const [taxRateDraft, setTaxRateDraft] = useState('');
  const [taxRateSaved, setTaxRateSaved] = useState(false);

  const load = async () => {
    if (!effectiveBusinessId) return;
    try {
      const p = await apiFetch<ProductDetail>(`/businesses/${effectiveBusinessId}/products/${productId}`, {
        token: accessToken,
      });
      setProduct(p);
      setThresholdDraft(String(p.lowStockThreshold));
      setTaxRateDraft(String(p.taxRatePercent));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load product');
      return;
    }
    apiFetch<ProductWarehouseBreakdown>(`/businesses/${effectiveBusinessId}/products/${productId}/warehouse-stock`, {
      token: accessToken,
    })
      .then(setWarehouseStock)
      .catch(() => setWarehouseStock(null));
    apiFetch<BatchRow[]>(`/businesses/${effectiveBusinessId}/batches?productId=${productId}`, { token: accessToken })
      .then(setBatches)
      .catch(() => setBatches([]));
    apiFetch<SerialRow[]>(`/businesses/${effectiveBusinessId}/serials?productId=${productId}`, { token: accessToken })
      .then(setSerials)
      .catch(() => setSerials([]));
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

  async function saveTaxRate() {
    if (!effectiveBusinessId) return;
    try {
      await apiFetch<ProductDetail>(`/businesses/${effectiveBusinessId}/products/${productId}`, {
        method: 'PATCH',
        body: { taxRatePercent: Number(taxRateDraft) || 0 },
        token: accessToken,
      });
      setTaxRateSaved(true);
      setTimeout(() => setTaxRateSaved(false), 2000);
      load();
    } catch {
      setError('Failed to save tax rate');
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
        <div>
          <h4 style={{ marginBottom: 10 }}>Stock across warehouses</h4>
          {warehouseStock ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th>Units</th>
                </tr>
              </thead>
              <tbody>
                {warehouseStock.warehouses.map((w) => (
                  <tr key={w.warehouseId}>
                    <td>{w.warehouseName}</td>
                    <td>{w.qty}</td>
                  </tr>
                ))}
                {warehouseStock.unallocated > 0 && (
                  <tr>
                    <td className="text-muted">Unallocated</td>
                    <td className="text-muted">{warehouseStock.unallocated}</td>
                  </tr>
                )}
                {warehouseStock.warehouses.length === 0 && warehouseStock.unallocated === 0 && (
                  <tr>
                    <td colSpan={2} className="text-muted">
                      No stock recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <span className="text-muted" style={{ fontSize: 13 }}>
              Loading…
            </span>
          )}
        </div>
        <div>
          <h4 style={{ marginBottom: 10 }}>Low-stock threshold</h4>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
            <div className="field" style={{ maxWidth: 120 }}>
              <label>Reorder below</label>
              <input className="input" type="number" value={thresholdDraft} onChange={(e) => setThresholdDraft(e.target.value)} />
            </div>
            <button className="btn btn-secondary" onClick={saveThreshold}>
              Save
            </button>
            {thresholdSaved && <span className="tag tag-neutral">Saved</span>}
          </div>

          <h4 style={{ marginBottom: 10 }}>Tax rate</h4>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div className="field" style={{ maxWidth: 120 }}>
              <label>GST / sales tax %</label>
              <input className="input" type="number" min="0" value={taxRateDraft} onChange={(e) => setTaxRateDraft(e.target.value)} />
            </div>
            <button className="btn btn-secondary" onClick={saveTaxRate}>
              Save
            </button>
            {taxRateSaved && <span className="tag tag-neutral">Saved</span>}
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h4 style={{ marginBottom: 0 }}>Batches / lots</h4>
            <Link href="/batches" className="btn btn-ghost" style={{ fontSize: 11, padding: 0 }}>
              Manage →
            </Link>
          </div>
          {batches.length === 0 ? (
            <span className="text-muted" style={{ fontSize: 13 }}>
              None tracked for this product yet.
            </span>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {batches.map((b) => {
                const bBadge = batchStatusBadge(b.status);
                return (
                  <span key={b.id} className={bBadge.cls}>
                    {b.lotCode} · {b.qty} units {b.expiryDate ? `· exp ${b.expiryDate}` : ''}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h4 style={{ marginBottom: 0 }}>Serial numbers</h4>
            <Link href="/serials" className="btn btn-ghost" style={{ fontSize: 11, padding: 0 }}>
              Manage →
            </Link>
          </div>
          {serials.length === 0 ? (
            <span className="text-muted" style={{ fontSize: 13 }}>
              None tracked for this product yet.
            </span>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {serials.map((s) => {
                const sBadge = serialStatusBadge(s.status);
                return (
                  <span key={s.id} className={sBadge.cls}>
                    {s.serial}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {effectiveBusinessId && <FinancialsSection businessId={effectiveBusinessId} productId={productId} />}

      {effectiveBusinessId && <LinkedSuppliersSection businessId={effectiveBusinessId} productId={productId} />}
      <PlaceholderCard title="Stock movement history" note="A unified per-unit ledger (sales, receipts, transfers, counts in one timeline) isn't built as its own screen — the pieces exist across Warehouses → Transfers, Purchase Orders, and Financials → Transaction log." />
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
