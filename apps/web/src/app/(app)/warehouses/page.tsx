'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { LocationsTab } from './locations-tab';
import { TransfersTab } from './transfers-tab';
import { CountsTab } from './counts-tab';

type Tab = 'locations' | 'transfers' | 'counts';

export default function WarehousesPage() {
  const { businesses, activeBusinessId } = useAuth();
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;
  const effectiveBusinessName = businesses.find((b) => b.id === effectiveBusinessId)?.name ?? '';

  const [tab, setTab] = useState<Tab>('locations');
  const [countingWarehouseId, setCountingWarehouseId] = useState<string | null>(null);

  if (!effectiveBusinessId) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <h1 style={{ marginBottom: 0 }}>Warehouses</h1>
        <span className="tag tag-neutral">{effectiveBusinessName}</span>
      </div>

      <div className="seg" style={{ margin: '18px 0', width: 'fit-content' }}>
        <label className="seg-opt">
          <input type="radio" name="whtab" checked={tab === 'locations'} onChange={() => setTab('locations')} />
          Locations
        </label>
        <label className="seg-opt">
          <input type="radio" name="whtab" checked={tab === 'transfers'} onChange={() => setTab('transfers')} />
          Transfers
        </label>
        <label className="seg-opt">
          <input type="radio" name="whtab" checked={tab === 'counts'} onChange={() => setTab('counts')} />
          Cycle counts
        </label>
      </div>

      {tab === 'locations' && (
        <LocationsTab
          businessId={effectiveBusinessId}
          onStartCount={(warehouseId) => {
            setCountingWarehouseId(warehouseId);
            setTab('counts');
          }}
        />
      )}
      {tab === 'transfers' && <TransfersTab businessId={effectiveBusinessId} />}
      {tab === 'counts' && (
        <CountsTab
          businessId={effectiveBusinessId}
          initialWarehouseId={countingWarehouseId}
        />
      )}
    </div>
  );
}
