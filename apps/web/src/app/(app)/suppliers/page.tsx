'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { PriceTrend, SupplierCard } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { trendMeta } from '@/lib/supplier-ui';

function TrendIcon({ trend }: { trend: PriceTrend }) {
  if (trend === 'UP') return <TrendingUp size={13} />;
  if (trend === 'DOWN') return <TrendingDown size={13} />;
  return <Minus size={13} />;
}

export default function SuppliersPage() {
  const router = useRouter();
  const { accessToken, businesses, activeBusinessId } = useAuth();
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;

  const [suppliers, setSuppliers] = useState<SupplierCard[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('7');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!effectiveBusinessId) return;
    apiFetch<SupplierCard[]>(`/businesses/${effectiveBusinessId}/suppliers`, { token: accessToken })
      .then(setSuppliers)
      .catch(() => setError('Failed to load suppliers'));
  };

  useEffect(load, [effectiveBusinessId, accessToken]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveBusinessId) return;
    try {
      await apiFetch(`/businesses/${effectiveBusinessId}/suppliers`, {
        method: 'POST',
        body: { name, category: category || undefined, leadTimeDays: Number(leadTimeDays) || 7 },
        token: accessToken,
      });
      setAddOpen(false);
      setName('');
      setCategory('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add supplier');
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Suppliers</h1>

      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      <button className="btn btn-secondary" style={{ fontSize: 12, marginBottom: 20 }} onClick={() => setAddOpen(true)}>
        + Add supplier
      </button>

      {addOpen && (
        <form onSubmit={handleAdd} className="card" style={{ maxWidth: 480, marginBottom: 20, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
          <div className="field" style={{ minWidth: 180, flex: 1 }}>
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="field" style={{ minWidth: 140 }}>
            <label>Category</label>
            <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="field" style={{ maxWidth: 100 }}>
            <label>Lead time (days)</label>
            <input className="input" type="number" min="0" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary">
            Create
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(false)}>
            Cancel
          </button>
        </form>
      )}

      {suppliers && suppliers.length === 0 && (
        <div className="card" style={{ alignItems: 'center', textAlign: 'center', padding: '48px 20px' }}>
          <div className="card-title">No suppliers yet</div>
          <div className="card-body" style={{ flex: 'none' }}>
            Add your first supplier to start creating purchase orders.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 2, background: 'var(--color-divider)' }}>
        {suppliers?.map((s) => {
          const trend = trendMeta(s.trend);
          return (
            <button
              key={s.id}
              onClick={() => router.push(`/suppliers/${s.id}`)}
              className="card"
              style={{ textAlign: 'left', cursor: 'pointer', border: 'none', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
            >
              <div className="card-kicker">{s.category ?? 'Uncategorized'}</div>
              <div className="card-title" style={{ fontSize: 16 }}>
                {s.name}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 13 }}>{s.onTimePercent}% on-time</span>
                <span className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12 }}>
                  <TrendIcon trend={s.trend} />
                  {trend.label}
                </span>
              </div>
              <div className="text-muted" style={{ fontSize: 11 }}>
                {s.productsCount} linked product{s.productsCount === 1 ? '' : 's'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
