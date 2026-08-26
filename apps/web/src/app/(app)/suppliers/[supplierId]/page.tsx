'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { PriceTrend, SupplierDetail } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { poStatusBadge, trendMeta, billLabel } from '@/lib/supplier-ui';

function TrendIcon({ trend }: { trend: PriceTrend }) {
  if (trend === 'UP') return <TrendingUp size={18} />;
  if (trend === 'DOWN') return <TrendingDown size={18} />;
  return <Minus size={18} />;
}

export default function SupplierDetailPage({ params }: PageProps<'/suppliers/[supplierId]'>) {
  const { supplierId } = use(params);
  const router = useRouter();
  const { accessToken, businesses, activeBusinessId } = useAuth();
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;

  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveBusinessId) return;
    apiFetch<SupplierDetail>(`/businesses/${effectiveBusinessId}/suppliers/${supplierId}`, { token: accessToken })
      .then(setSupplier)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load supplier'));
  }, [effectiveBusinessId, supplierId, accessToken]);

  if (error) {
    return (
      <div>
        <button className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 12 }} onClick={() => router.push('/suppliers')}>
          <ArrowLeft size={14} />
          Back to suppliers
        </button>
        <div className="tag tag-outline" style={{ display: 'block', padding: '8px 10px' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!supplier) return <span className="text-muted">Loading…</span>;

  const trend = trendMeta(supplier.trend);

  return (
    <div>
      <button className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 12 }} onClick={() => router.push('/suppliers')}>
        <ArrowLeft size={14} />
        Back to suppliers
      </button>
      <h1 style={{ marginBottom: 2 }}>{supplier.name}</h1>
      <div className="text-muted" style={{ fontSize: 13, marginBottom: 20 }}>
        {supplier.category ?? 'Uncategorized'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, background: 'var(--color-divider)', marginBottom: 28 }}>
        <div className="card">
          <div className="card-kicker">On-time delivery</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{supplier.onTimePercent}%</div>
        </div>
        <div className="card">
          <div className="card-kicker">Price trend</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendIcon trend={supplier.trend} />
            {trend.label}
          </div>
        </div>
        <div className="card">
          <div className="card-kicker">Linked products</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{supplier.productsCount}</div>
        </div>
      </div>

      <h4 style={{ marginBottom: 10 }}>Purchase order history</h4>
      <table className="table">
        <thead>
          <tr>
            <th>PO</th>
            <th>Total</th>
            <th>Status</th>
            <th>Bill</th>
          </tr>
        </thead>
        <tbody>
          {supplier.pos.map((po) => {
            const badge = poStatusBadge(po.status);
            const bill = billLabel(po.billStatus);
            return (
              <tr key={po.id}>
                <td>
                  <button className="btn btn-ghost" style={{ padding: 0, fontSize: 14 }} onClick={() => router.push(`/purchase-orders/${po.id}`)}>
                    {po.displayId}
                  </button>
                </td>
                <td>{po.totalFmt}</td>
                <td>
                  <span className={badge.cls}>{badge.label}</span>
                </td>
                <td>
                  <span style={bill.style}>{bill.label}</span>
                </td>
              </tr>
            );
          })}
          {supplier.pos.length === 0 && (
            <tr>
              <td colSpan={4} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                No purchase orders yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
