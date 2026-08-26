'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { OrderDetail } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { channelLabel, orderStatusBadge } from '@/lib/order-ui';
import { CreateReturnDialog } from './create-return-dialog';

export default function OrderDetailPage({ params }: PageProps<'/orders/[orderId]'>) {
  const { orderId } = use(params);
  const router = useRouter();
  const { accessToken, businesses, activeBusinessId } = useAuth();
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [returnFor, setReturnFor] = useState<{ id: string; name: string } | null>(null);

  const load = () => {
    if (!effectiveBusinessId) return;
    apiFetch<OrderDetail>(`/businesses/${effectiveBusinessId}/orders/${orderId}`, { token: accessToken })
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load order'));
  };

  useEffect(load, [effectiveBusinessId, orderId, accessToken]);

  async function runAction(action: 'ship' | 'deliver' | 'cancel') {
    if (!effectiveBusinessId) return;
    setActionError(null);
    try {
      await apiFetch(`/businesses/${effectiveBusinessId}/orders/${orderId}/${action}`, { method: 'POST', token: accessToken });
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Failed to ${action} order`);
    }
  }

  if (error) {
    return (
      <div>
        <button className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 12 }} onClick={() => router.push('/orders')}>
          <ArrowLeft size={14} />
          Back to orders
        </button>
        <div className="tag tag-outline" style={{ display: 'block', padding: '8px 10px' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!order || !effectiveBusinessId) return <span className="text-muted">Loading…</span>;

  const badge = orderStatusBadge(order.status);
  const canShip = order.status === 'PROCESSING';
  const canDeliver = order.status === 'SHIPPED';
  const canCancel = order.status === 'PROCESSING' || order.status === 'SHIPPED' || order.status === 'BACKORDERED';

  return (
    <div>
      <button className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 12 }} onClick={() => router.push('/orders')}>
        <ArrowLeft size={14} />
        Back to orders
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        <h1 style={{ marginBottom: 0 }}>{order.displayId}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={badge.cls}>{badge.label}</span>
          {canShip && (
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => runAction('ship')}>
              Mark shipped
            </button>
          )}
          {canDeliver && (
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => runAction('deliver')}>
              Mark delivered
            </button>
          )}
          {canCancel && (
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => runAction('cancel')}>
              Cancel order
            </button>
          )}
        </div>
      </div>
      <div className="text-muted" style={{ fontSize: 13, marginBottom: 24 }}>
        {channelLabel(order.channel)} · {order.customer} · {order.warehouseName} · {order.date}
      </div>

      {order.note && (
        <div className="card" style={{ background: 'var(--color-surface)', maxWidth: 420, marginBottom: 20, fontSize: 13 }}>
          {order.note}
        </div>
      )}

      {actionError && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {actionError}
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Line total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it) => (
            <tr key={it.id}>
              <td>{it.name}</td>
              <td>{it.qty}</td>
              <td>${it.unitPrice.toFixed(2)}</td>
              <td>${it.lineTotal.toFixed(2)}</td>
              <td>
                {order.status === 'DELIVERED' &&
                  (it.hasOpenReturn ? (
                    <span className="text-muted" style={{ fontSize: 12 }}>
                      Return requested
                    </span>
                  ) : (
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setReturnFor({ id: it.id, name: it.name })}>
                      Return
                    </button>
                  ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16, fontSize: 15, fontWeight: 800, textAlign: 'right' }}>Total: {order.totalFmt}</div>

      {returnFor && (
        <CreateReturnDialog
          businessId={effectiveBusinessId}
          orderItemId={returnFor.id}
          productName={returnFor.name}
          onClose={() => setReturnFor(null)}
          onCreated={() => {
            setReturnFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}
