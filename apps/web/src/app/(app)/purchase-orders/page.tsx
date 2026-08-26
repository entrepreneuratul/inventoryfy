'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PoColumn, ReorderSuggestion } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch } from '@/lib/api';
import { CreatePoDialog } from './create-po-dialog';

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { accessToken, businesses, activeBusinessId } = useAuth();
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;

  const [columns, setColumns] = useState<PoColumn[] | null>(null);
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitial, setCreateInitial] = useState<{ variantId: string; qty: number; supplierId: string | null } | undefined>();

  const load = () => {
    if (!effectiveBusinessId) return;
    apiFetch<PoColumn[]>(`/businesses/${effectiveBusinessId}/purchase-orders`, { token: accessToken }).then(setColumns);
    apiFetch<ReorderSuggestion[]>(`/businesses/${effectiveBusinessId}/reorder-suggestions`, { token: accessToken }).then(
      setSuggestions,
    );
  };

  useEffect(load, [effectiveBusinessId, accessToken]);

  function openCreateFromSuggestion(s: ReorderSuggestion) {
    setCreateInitial({
      variantId: s.variantId,
      qty: Math.max(s.threshold * 2 - s.stock, 1),
      supplierId: s.preferredSupplierId,
    });
    setCreateOpen(true);
  }

  if (!effectiveBusinessId) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ marginBottom: 0 }}>Purchase orders</h1>
        <button
          className="btn btn-primary"
          style={{ marginLeft: 'auto', fontSize: 12 }}
          onClick={() => {
            setCreateInitial(undefined);
            setCreateOpen(true);
          }}
        >
          + New PO
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="card" style={{ background: 'var(--color-surface)', marginBottom: 20 }}>
          <div className="card-title" style={{ fontSize: 14 }}>
            Suggested reorders
          </div>
          <div className="card-body" style={{ flex: 'none' }}>
            Based on current stock versus each product&apos;s low-stock threshold.
          </div>
          {suggestions.map((s) => (
            <div
              key={s.productId}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--color-divider)', fontSize: 13 }}
            >
              <span>
                {s.name} <span className="text-muted">· {s.stock} left</span>
              </span>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => openCreateFromSuggestion(s)}>
                Create PO →
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, alignItems: 'start', overflowX: 'auto' }}>
        {columns?.map((col) => (
          <div key={col.status} style={{ minWidth: 180 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: 800,
                paddingBottom: 8,
                borderBottom: '2px solid var(--color-divider)',
                marginBottom: 10,
              }}
            >
              {col.label} ({col.count})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {col.items.map((po) => (
                <button
                  key={po.id}
                  onClick={() => router.push(`/purchase-orders/${po.id}`)}
                  className="card elev-sm"
                  style={{ textAlign: 'left', cursor: 'pointer', border: 'none', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800 }}>{po.displayId}</div>
                  <div style={{ fontSize: 13 }}>{po.supplierName}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{po.totalFmt}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {createOpen && (
        <CreatePoDialog
          businessId={effectiveBusinessId}
          initial={createInitial}
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
