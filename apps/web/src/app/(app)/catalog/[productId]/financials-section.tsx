'use client';

import { useEffect, useState } from 'react';
import type { LandedCost, ValuationMethod, ValuationResult } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch } from '@/lib/api';

export function FinancialsSection({ businessId, productId }: { businessId: string; productId: string }) {
  const { accessToken } = useAuth();
  const [landedCost, setLandedCost] = useState<LandedCost | null>(null);
  const [method, setMethod] = useState<ValuationMethod>('WEIGHTED');
  const [valuation, setValuation] = useState<ValuationResult | null>(null);

  useEffect(() => {
    apiFetch<LandedCost>(`/businesses/${businessId}/products/${productId}/landed-cost`, { token: accessToken })
      .then(setLandedCost)
      .catch(() => setLandedCost(null));
  }, [businessId, productId, accessToken]);

  useEffect(() => {
    apiFetch<ValuationResult>(`/businesses/${businessId}/products/${productId}/valuation?method=${method}`, {
      token: accessToken,
    })
      .then(setValuation)
      .catch(() => setValuation(null));
  }, [businessId, productId, method, accessToken]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
      <div>
        <h4 style={{ marginBottom: 10 }}>Landed cost</h4>
        {landedCost ? (
          <table className="table">
            <tbody>
              <tr>
                <td className="text-muted">Base cost</td>
                <td>{landedCost.baseFmt}</td>
              </tr>
              <tr>
                <td className="text-muted">Freight</td>
                <td>{landedCost.freightFmt}</td>
              </tr>
              <tr>
                <td className="text-muted">Duty</td>
                <td>{landedCost.dutyFmt}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 800 }}>Landed unit cost</td>
                <td style={{ fontWeight: 800 }}>{landedCost.totalFmt}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <span className="text-muted" style={{ fontSize: 13 }}>
            Loading…
          </span>
        )}
      </div>
      <div>
        <h4 style={{ marginBottom: 10 }}>Stock valuation</h4>
        <div className="seg" style={{ marginBottom: 10 }}>
          <label className="seg-opt">
            <input type="radio" name="valmethod" checked={method === 'FIFO'} onChange={() => setMethod('FIFO')} />
            FIFO
          </label>
          <label className="seg-opt">
            <input type="radio" name="valmethod" checked={method === 'LIFO'} onChange={() => setMethod('LIFO')} />
            LIFO
          </label>
          <label className="seg-opt">
            <input type="radio" name="valmethod" checked={method === 'WEIGHTED'} onChange={() => setMethod('WEIGHTED')} />
            Weighted avg
          </label>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
          {valuation?.amountFmt ?? '—'}
        </div>
        {valuation?.note && (
          <div className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>
            {valuation.note}
          </div>
        )}
      </div>
    </div>
  );
}
