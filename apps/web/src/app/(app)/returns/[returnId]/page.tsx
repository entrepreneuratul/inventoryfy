'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { ReturnDetail, WarehouseSummary } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { returnStatusBadge } from '@/lib/order-ui';

export default function ReturnDetailPage({ params }: PageProps<'/returns/[returnId]'>) {
  const { returnId } = use(params);
  const router = useRouter();
  const { accessToken, businesses, activeBusinessId } = useAuth();
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;

  const [ret, setRet] = useState<ReturnDetail | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    if (!effectiveBusinessId) return;
    apiFetch<ReturnDetail>(`/businesses/${effectiveBusinessId}/returns/${returnId}`, { token: accessToken })
      .then(setRet)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load return'));
  };

  useEffect(load, [effectiveBusinessId, returnId, accessToken]);

  useEffect(() => {
    if (!effectiveBusinessId) return;
    apiFetch<WarehouseSummary[]>(`/businesses/${effectiveBusinessId}/warehouses`, { token: accessToken }).then((ws) => {
      setWarehouses(ws);
      setWarehouseId((v) => v || ws[0]?.id || '');
    });
  }, [effectiveBusinessId, accessToken]);

  async function runAction(path: 'approve' | 'mark-received') {
    if (!effectiveBusinessId) return;
    setActionError(null);
    try {
      await apiFetch(`/businesses/${effectiveBusinessId}/returns/${returnId}/${path}`, { method: 'POST', token: accessToken });
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action failed');
    }
  }

  async function decide(restock: boolean) {
    if (!effectiveBusinessId) return;
    setActionError(null);
    if (restock && !warehouseId) {
      setActionError('Add a warehouse first to restock into.');
      return;
    }
    try {
      await apiFetch(`/businesses/${effectiveBusinessId}/returns/${returnId}/decide`, {
        method: 'POST',
        body: { restock, warehouseId: restock ? warehouseId : undefined },
        token: accessToken,
      });
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to record decision');
    }
  }

  if (error) {
    return (
      <div>
        <button className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 12 }} onClick={() => router.push('/returns')}>
          <ArrowLeft size={14} />
          Back to returns
        </button>
        <div className="tag tag-outline" style={{ display: 'block', padding: '8px 10px' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!ret) return <span className="text-muted">Loading…</span>;

  const badge = returnStatusBadge(ret.status);

  return (
    <div>
      <button className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 12 }} onClick={() => router.push('/returns')}>
        <ArrowLeft size={14} />
        Back to returns
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        <h1 style={{ marginBottom: 0 }}>{ret.displayId}</h1>
        <span className={badge.cls}>{badge.label}</span>
      </div>
      <div className="text-muted" style={{ fontSize: 13, marginBottom: 24 }}>
        {ret.orderDisplayId} · {ret.product}
      </div>

      <div className="card" style={{ maxWidth: 420, marginBottom: 20 }}>
        <div className="card-kicker">Reason</div>
        <div className="card-body" style={{ flex: 'none' }}>
          {ret.reason}
        </div>
      </div>

      {actionError && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {actionError}
        </div>
      )}

      {ret.status === 'REQUESTED' && (
        <button className="btn btn-primary" onClick={() => runAction('approve')}>
          Approve return
        </button>
      )}

      {ret.status === 'APPROVED' && (
        <button className="btn btn-primary" onClick={() => runAction('mark-received')}>
          Mark item received
        </button>
      )}

      {ret.needsDecision && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {warehouses.length > 0 && (
            <select className="input" style={{ width: 'auto' }} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn btn-primary" onClick={() => decide(true)}>
            Restock item
          </button>
          <button className="btn btn-secondary" onClick={() => decide(false)}>
            Scrap item
          </button>
        </div>
      )}

      {ret.restockLabel && <span className="tag tag-neutral">{ret.restockLabel}</span>}
    </div>
  );
}
