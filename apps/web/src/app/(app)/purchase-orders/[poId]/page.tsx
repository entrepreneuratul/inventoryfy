'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { BillStatus, PurchaseOrderDetail } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { billLabel, poStatusBadge } from '@/lib/supplier-ui';
import { ReceiveDialog } from './receive-dialog';

const BILL_OPTIONS: BillStatus[] = ['NONE', 'UNPAID', 'PARTIAL', 'PAID'];

export default function PoDetailPage({ params }: PageProps<'/purchase-orders/[poId]'>) {
  const { poId } = use(params);
  const router = useRouter();
  const { accessToken, businesses, activeBusinessId } = useAuth();
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    if (!effectiveBusinessId) return;
    apiFetch<PurchaseOrderDetail>(`/businesses/${effectiveBusinessId}/purchase-orders/${poId}`, { token: accessToken })
      .then(setPo)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load purchase order'));
  };

  useEffect(load, [effectiveBusinessId, poId, accessToken]);

  async function handleApprove() {
    if (!effectiveBusinessId) return;
    setActionError(null);
    try {
      await apiFetch(`/businesses/${effectiveBusinessId}/purchase-orders/${poId}/approve`, { method: 'POST', token: accessToken });
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to approve');
    }
  }

  async function handleClose() {
    if (!effectiveBusinessId) return;
    setActionError(null);
    try {
      await apiFetch(`/businesses/${effectiveBusinessId}/purchase-orders/${poId}/close`, { method: 'POST', token: accessToken });
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to close PO');
    }
  }

  async function handleBillStatus(billStatus: BillStatus) {
    if (!effectiveBusinessId) return;
    try {
      await apiFetch(`/businesses/${effectiveBusinessId}/purchase-orders/${poId}/bill-status`, {
        method: 'POST',
        body: { billStatus },
        token: accessToken,
      });
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to update bill status');
    }
  }

  if (error) {
    return (
      <div>
        <button className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 12 }} onClick={() => router.push('/purchase-orders')}>
          <ArrowLeft size={14} />
          Back to purchase orders
        </button>
        <div className="tag tag-outline" style={{ display: 'block', padding: '8px 10px' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!po || !effectiveBusinessId) return <span className="text-muted">Loading…</span>;

  const badge = poStatusBadge(po.status);
  const bill = billLabel(po.billStatus);
  const canReceive = po.status === 'SENT' || po.status === 'PARTIAL';
  const canClose = po.status === 'RECEIVED';

  return (
    <div>
      <button className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 12 }} onClick={() => router.push('/purchase-orders')}>
        <ArrowLeft size={14} />
        Back to purchase orders
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        <h1 style={{ marginBottom: 0 }}>{po.displayId}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={badge.cls}>{badge.label}</span>
          {po.needsApproval && (
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleApprove}>
              Approve &amp; send
            </button>
          )}
          {canReceive && (
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setReceiveOpen(true)}>
              Receive stock
            </button>
          )}
          {canClose && (
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={handleClose}>
              Close PO
            </button>
          )}
        </div>
      </div>
      <div className="text-muted" style={{ fontSize: 13, marginBottom: 24 }}>
        {po.supplierName} · expected {po.expectedDate ?? '—'}
      </div>

      {actionError && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {actionError}
        </div>
      )}

      {po.needsApproval && (
        <div className="card" style={{ background: 'var(--color-surface)', maxWidth: 420, marginBottom: 20, fontSize: 13 }}>
          Awaiting approval before this order is sent to the supplier.
        </div>
      )}

      <table className="table" style={{ marginBottom: 24 }}>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Received</th>
            <th>Unit cost</th>
            <th>Line total</th>
          </tr>
        </thead>
        <tbody>
          {po.items.map((it) => (
            <tr key={it.id}>
              <td>{it.name}</td>
              <td>{it.qty}</td>
              <td className="text-muted">{it.receivedQty}</td>
              <td>${it.unitCost.toFixed(2)}</td>
              <td>${it.lineTotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="card" style={{ maxWidth: 360, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <div className="card-kicker">Linked supplier bill</div>
          <div className="card-title" style={{ fontSize: 15 }}>
            {po.totalFmt}
          </div>
        </div>
        <select
          className="input"
          style={{ width: 'auto' }}
          value={po.billStatus}
          onChange={(e) => handleBillStatus(e.target.value as BillStatus)}
        >
          {BILL_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {billLabel(opt).label}
            </option>
          ))}
        </select>
      </div>

      {receiveOpen && (
        <ReceiveDialog
          businessId={effectiveBusinessId}
          po={po}
          onClose={() => setReceiveOpen(false)}
          onReceived={() => {
            setReceiveOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
