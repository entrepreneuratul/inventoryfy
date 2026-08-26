'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Package, ShoppingBag, ShoppingCart } from 'lucide-react';
import type { OrderChannel, OrderRow } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { channelLabel, orderStatusBadge } from '@/lib/order-ui';
import { CreateOrderDialog } from './create-order-dialog';

function ChannelIcon({ channel }: { channel: OrderChannel }) {
  if (channel === 'AMAZON') return <Package size={12} />;
  if (channel === 'FLIPKART') return <ShoppingBag size={12} />;
  return <Globe size={12} />;
}

export default function OrdersPage() {
  const router = useRouter();
  const { role, businesses, activeBusinessId, accessToken } = useAuth();
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;
  const isOwnerView = role === 'OWNER' && activeBusinessId === null;
  const scopeLabel = isOwnerView ? 'All businesses' : businesses.find((b) => b.id === effectiveBusinessId)?.name ?? '';

  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = () => {
    if (!effectiveBusinessId) return;
    apiFetch<OrderRow[]>(`/businesses/${effectiveBusinessId}/orders`, { token: accessToken })
      .then(setOrders)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load orders'));
  };

  useEffect(load, [effectiveBusinessId, accessToken]);

  if (!effectiveBusinessId) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <h1 style={{ marginBottom: 0 }}>Orders</h1>
        <span className="tag tag-neutral">{scopeLabel}</span>
        <button className="btn btn-primary" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => setCreateOpen(true)}>
          + New order
        </button>
      </div>

      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      {orders && orders.length === 0 && (
        <div className="card" style={{ alignItems: 'center', textAlign: 'center', padding: '48px 20px' }}>
          <ShoppingCart size={30} />
          <div className="card-title">No orders yet</div>
          <div className="card-body" style={{ flex: 'none' }}>
            Orders from your website and marketplaces will show up here as they come in.
          </div>
        </div>
      )}

      {orders && orders.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Channel</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const badge = orderStatusBadge(o.status);
              return (
                <tr key={o.id}>
                  <td style={{ fontWeight: 700 }}>
                    <button className="btn btn-ghost" style={{ padding: 0, fontSize: 14, fontWeight: 700 }} onClick={() => router.push(`/orders/${o.id}`)}>
                      {o.displayId}
                    </button>
                  </td>
                  <td>
                    <span className="tag tag-neutral" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                      <ChannelIcon channel={o.channel} />
                      {channelLabel(o.channel)}
                    </span>
                  </td>
                  <td className="text-muted">{o.customer}</td>
                  <td>{o.totalFmt}</td>
                  <td>
                    <span className={badge.cls}>{badge.label}</span>
                    {o.note && (
                      <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                        {o.note}
                      </div>
                    )}
                  </td>
                  <td className="text-muted">{o.date}</td>
                  <td>
                    {o.showReturn && (
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => router.push(`/orders/${o.id}`)}>
                        Return
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {createOpen && (
        <CreateOrderDialog
          businessId={effectiveBusinessId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
