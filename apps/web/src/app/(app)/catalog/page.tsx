'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Grid2x2, Image as ImageIcon, Info, List, PackageSearch, ScanLine, Upload } from 'lucide-react';
import type { Category, ProductSummary } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError, downloadFile } from '@/lib/api';
import { statusBadge } from '@/lib/catalog-ui';
import { AddProductDialog } from './add-product-dialog';

type View = 'table' | 'grid';

export default function CatalogPage() {
  const router = useRouter();
  const { accessToken, role, businesses, activeBusinessId } = useAuth();

  const isOwnerView = role === 'OWNER' && activeBusinessId === null;
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;
  const effectiveBusinessName = businesses.find((b) => b.id === effectiveBusinessId)?.name ?? '';

  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('table');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [labelPreviewOpen, setLabelPreviewOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useMemo(
    () => async () => {
      if (!effectiveBusinessId) return;
      try {
        const list = await apiFetch<ProductSummary[]>(
          `/businesses/${effectiveBusinessId}/products${search ? `?search=${encodeURIComponent(search)}` : ''}`,
          { token: accessToken },
        );
        setProducts(list);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load products');
      }
    },
    [effectiveBusinessId, search, accessToken],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!effectiveBusinessId) return;
    apiFetch<Category[]>(`/businesses/${effectiveBusinessId}/categories`, { token: accessToken })
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [effectiveBusinessId, accessToken]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleExport() {
    if (!effectiveBusinessId) return;
    try {
      await downloadFile(`/businesses/${effectiveBusinessId}/products/export`, accessToken, 'catalog.csv');
    } catch {
      setError('Export failed');
    }
  }

  async function handleImportFile(file: File) {
    if (!effectiveBusinessId) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const result = await apiFetch<{ imported: number; errors: string[] }>(
        `/businesses/${effectiveBusinessId}/products/import`,
        { method: 'POST', body: form, token: accessToken },
      );
      setImportMsg(
        result.errors.length > 0
          ? `Imported ${result.imported} products, ${result.errors.length} row(s) skipped: ${result.errors.join('; ')}`
          : `Imported ${result.imported} products.`,
      );
      await load();
    } catch (err) {
      setImportMsg(err instanceof ApiError ? err.message : 'Import failed');
    }
  }

  const labelProducts = (products ?? []).filter((p) => selected.size === 0 || selected.has(p.id));
  const isEmpty = products !== null && products.length === 0 && !search;
  const hasResults = products !== null && products.length > 0;
  const noSearchResults = products !== null && products.length === 0 && !!search;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <h1 style={{ marginBottom: 0 }}>Product catalog</h1>
        <span className="tag tag-neutral">{effectiveBusinessName}</span>
      </div>

      {isOwnerView && (
        <div
          className="card"
          style={{
            background: 'var(--color-surface)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 18,
            fontSize: 13,
          }}
        >
          <Info size={15} style={{ flex: 'none' }} />
          <span>
            Owner View aggregates dashboards and financials only. Catalog is managed per business —
            showing {effectiveBusinessName}.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '18px 0', flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Search by name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="seg">
          <label className="seg-opt">
            <input type="radio" name="catview" checked={view === 'table'} onChange={() => setView('table')} />
            <List size={14} />
          </label>
          <label className="seg-opt">
            <input type="radio" name="catview" checked={view === 'grid'} onChange={() => setView('grid')} />
            <Grid2x2 size={14} />
          </label>
        </div>
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setLabelPreviewOpen(true)}>
          <ScanLine size={14} />
          Print labels
        </button>
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} />
          Import CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = '';
          }}
        />
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={handleExport}>
          <Download size={14} />
          Export CSV
        </button>
        <button className="btn btn-primary" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => setAddProductOpen(true)}>
          Add product
        </button>
      </div>

      {importMsg && (
        <div
          className="card"
          style={{ background: 'var(--color-surface)', flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 14, fontSize: 13 }}
        >
          {importMsg}
          <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => setImportMsg(null)}>
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      {selected.size > 0 && (
        <div
          className="card"
          style={{ background: 'var(--color-surface)', flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}
        >
          <span style={{ fontSize: 13, fontWeight: 800 }}>{selected.size} selected</span>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} disabled title="Coming soon">
            Bulk price update
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} disabled title="Coming soon">
            Bulk stock adjust
          </button>
        </div>
      )}

      {isEmpty && (
        <div className="card" style={{ alignItems: 'center', textAlign: 'center', padding: '48px 20px' }}>
          <PackageSearch size={30} />
          <div className="card-title">No products yet</div>
          <div className="card-body" style={{ flex: 'none' }}>
            Add your first product to start tracking stock for {effectiveBusinessName}.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 6 }} onClick={() => setAddProductOpen(true)}>
            Add product
          </button>
        </div>
      )}

      {noSearchResults && (
        <div className="card" style={{ alignItems: 'center', textAlign: 'center', padding: '48px 20px' }}>
          <PackageSearch size={30} />
          <div className="card-title">No matches</div>
          <div className="card-body" style={{ flex: 'none' }}>
            Nothing matches &quot;{search}&quot;.
          </div>
        </div>
      )}

      {hasResults && view === 'table' && (
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th></th>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Variants</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {products!.map((p) => {
              const badge = statusBadge(p.status);
              return (
                <tr key={p.id}>
                  <td>
                    <input
                      className="mf-row-check"
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                    />
                  </td>
                  <td>
                    <div style={{ width: 34, height: 34, background: 'var(--color-neutral-200)', display: 'grid', placeItems: 'center' }}>
                      <ImageIcon size={14} style={{ opacity: 0.5 }} />
                    </div>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: 0, fontSize: 14, fontWeight: 600 }}
                      onClick={() => router.push(`/catalog/${p.id}`)}
                    >
                      {p.name}
                    </button>
                  </td>
                  <td className="text-muted" style={{ fontSize: 12 }}>
                    {p.sku}
                  </td>
                  <td className="text-muted">{p.category ?? '—'}</td>
                  <td className="text-muted">{p.variantCount}</td>
                  <td>{p.stock}</td>
                  <td>
                    <span className={badge.cls}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {hasResults && view === 'grid' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 2,
            background: 'var(--color-divider)',
          }}
        >
          {products!.map((p) => {
            const badge = statusBadge(p.status);
            return (
              <button
                key={p.id}
                onClick={() => router.push(`/catalog/${p.id}`)}
                className="card"
                style={{ textAlign: 'left', cursor: 'pointer', border: 'none', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
              >
                <div
                  style={{
                    width: '100%',
                    aspectRatio: 1.6,
                    background: 'var(--color-neutral-200)',
                    display: 'grid',
                    placeItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <ImageIcon size={22} style={{ opacity: 0.5 }} />
                </div>
                <div className="card-title" style={{ fontSize: 14 }}>
                  {p.name}
                </div>
                <div className="text-muted" style={{ fontSize: 11 }}>
                  {p.sku} · {p.category ?? '—'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{p.stock} in stock</span>
                  <span className={badge.cls}>{badge.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {labelPreviewOpen && (
        <div className="dialog-backdrop" onClick={() => setLabelPreviewOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="dialog-title">Label preview</div>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--color-divider)' }}>
              {labelProducts.map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: 'var(--color-bg)',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {p.sku}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 90,
                      height: 32,
                      background: 'repeating-linear-gradient(90deg, var(--color-text) 0 2px, transparent 2px 5px)',
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setLabelPreviewOpen(false)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {addProductOpen && effectiveBusinessId && (
        <AddProductDialog
          businessId={effectiveBusinessId}
          categories={categories}
          onClose={() => setAddProductOpen(false)}
          onCreated={() => {
            setAddProductOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
