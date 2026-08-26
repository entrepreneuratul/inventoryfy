'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, RotateCcw, ShoppingCart, Truck, Wallet } from 'lucide-react';
import type { ActivityItem, DashboardData, LowStockAlertRow } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { statusBadge } from '@/lib/catalog-ui';

function ActivityIcon({ icon }: { icon: ActivityItem['icon'] }) {
  const style = { width: 15, height: 15, flex: 'none' as const, marginTop: 2, color: 'var(--color-accent)' };
  if (icon === 'order') return <ShoppingCart style={style} />;
  if (icon === 'po') return <Truck style={style} />;
  if (icon === 'return') return <RotateCcw style={style} />;
  return <Wallet style={style} />;
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export default function DashboardPage() {
  const router = useRouter();
  const { role, businesses, activeBusinessId, accessToken, setActiveBusinessId } = useAuth();
  const isOwnerView = role === 'OWNER' && activeBusinessId === null;
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const endpoint = isOwnerView ? '/dashboard/summary' : `/businesses/${effectiveBusinessId}/dashboard`;
    if (!isOwnerView && !effectiveBusinessId) return;
    apiFetch<DashboardData>(endpoint, { token: accessToken })
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load dashboard'));
  }, [isOwnerView, effectiveBusinessId, accessToken]);

  if (error) {
    return (
      <div className="tag tag-outline" style={{ display: 'block', padding: '8px 10px' }}>
        {error}
      </div>
    );
  }

  if (!data) return <span className="text-muted">Loading…</span>;

  if (data.view === 'OWNER') {
    return (
      <div>
        <div style={{ background: 'var(--color-accent)', color: '#fff', padding: '28px 32px', marginBottom: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 6 }}>
            Consolidated · all {data.businesses.length} business{data.businesses.length === 1 ? '' : 'es'}
          </div>
          <h1 style={{ color: '#fff', marginBottom: 18 }}>{data.totalProfitFmt} profit</h1>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Revenue</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{data.totalRevenueFmt}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Expenses</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{data.totalExpensesFmt}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Cash position</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{data.totalCashFmt}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Pending supplier bills</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{data.pendingBillsCount}</div>
            </div>
          </div>
        </div>

        <h3 style={{ marginBottom: 14 }}>Per-business breakdown</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 2, background: 'var(--color-divider)', marginBottom: 28 }}>
          {data.businesses.map((biz) => (
            <button
              key={biz.businessId}
              onClick={() => {
                setActiveBusinessId(biz.businessId);
                router.push('/dashboard');
              }}
              style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--color-surface)', border: 'none', padding: 18, display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 22, height: 22, background: 'var(--color-neutral-300)', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 800, flex: 'none' }}>
                  {initials(biz.name)}
                </div>
                <div className="card-title" style={{ fontSize: 14 }}>
                  {biz.name}
                </div>
              </div>
              <div className="text-muted" style={{ fontSize: 11 }}>
                {biz.type ?? '—'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{biz.profitFmt}</div>
              <div className="text-muted" style={{ fontSize: 11 }}>
                profit · {biz.revenueFmt} revenue
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                {biz.lowStockCount > 0 && <span className="tag tag-outline">{biz.lowStockCount} low stock</span>}
                <span className="tag tag-neutral">{biz.pendingBillsCount} bills due</span>
              </div>
            </button>
          ))}
        </div>

        <h3 style={{ marginBottom: 14 }}>Low-stock alerts across all businesses</h3>
        <LowStockAlerts alerts={data.lowStockAlerts} showBusiness />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>{data.businessName}</h1>
      <div className="text-muted" style={{ fontSize: 13, marginBottom: 24 }}>
        {data.businessType ?? '—'} · Today&apos;s overview
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2, background: 'var(--color-divider)', marginBottom: 28 }}>
        <div className="card">
          <div className="card-kicker">Today&apos;s sales</div>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{data.todaySalesFmt}</div>
        </div>
        <div className="card">
          <div className="card-kicker">Cash position</div>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{data.cashPositionFmt}</div>
        </div>
        <div className="card">
          <div className="card-kicker">Pending POs</div>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{data.pendingPos}</div>
        </div>
        <div className="card">
          <div className="card-kicker">Pending bills</div>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{data.pendingBills}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24, alignItems: 'start' }}>
        <div>
          <h3 style={{ marginBottom: 10 }}>Low-stock alerts</h3>
          <LowStockAlerts alerts={data.lowStockAlerts} />
        </div>
        <div>
          <h3 style={{ marginBottom: 10 }}>Recent activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {data.activity.map((act, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--color-divider)' }}>
                <ActivityIcon icon={act.icon} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{act.text}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>
                    {act.time}
                  </div>
                </div>
              </div>
            ))}
            {data.activity.length === 0 && (
              <span className="text-muted" style={{ fontSize: 13 }}>
                Nothing yet.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LowStockAlerts({ alerts, showBusiness }: { alerts: LowStockAlertRow[]; showBusiness?: boolean }) {
  if (alerts.length === 0) {
    return (
      <div className="card" style={{ alignItems: 'center', textAlign: 'center', padding: '40px 20px' }}>
        <CheckCircle2 size={28} style={{ color: 'var(--color-accent)' }} />
        <div className="card-title">All stock is healthy</div>
        <div className="card-body" style={{ flex: 'none' }}>
          Nothing here needs a reorder yet.
        </div>
      </div>
    );
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Product</th>
          {showBusiness && <th>Business</th>}
          <th>Stock</th>
          {showBusiness && <th>Threshold</th>}
          <th></th>
        </tr>
      </thead>
      <tbody>
        {alerts.map((a) => {
          const badge = statusBadge(a.status);
          return (
            <tr key={a.productId}>
              <td>{a.name}</td>
              {showBusiness && <td className="text-muted">{a.businessName}</td>}
              <td>
                <span className={badge.cls}>{badge.label}</span>
              </td>
              {showBusiness && <td className="text-muted">{a.threshold}</td>}
              <td>
                <Link href="/purchase-orders" className="btn btn-ghost" style={{ fontSize: 12 }}>
                  Create PO →
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
