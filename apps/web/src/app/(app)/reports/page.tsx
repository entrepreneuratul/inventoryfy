'use client';

import { useEffect, useState } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { PriceTrend, ReportFrequency, ReportsData, ReportType } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { trendMeta } from '@/lib/supplier-ui';

type Tab = 'velocity' | 'turnover' | 'dead-stock';

function TrendIcon({ trend }: { trend: PriceTrend }) {
  if (trend === 'UP') return <TrendingUp size={12} />;
  if (trend === 'DOWN') return <TrendingDown size={12} />;
  return <Minus size={12} />;
}

export default function ReportsPage() {
  const { role, businesses, activeBusinessId, accessToken } = useAuth();
  const isOwnerView = role === 'OWNER' && activeBusinessId === null;
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;

  const [tab, setTab] = useState<Tab>('velocity');
  const [data, setData] = useState<ReportsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [scheduleType, setScheduleType] = useState<ReportType>('VELOCITY');
  const [frequency, setFrequency] = useState<ReportFrequency>('WEEKLY');
  const [email, setEmail] = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [scheduledList, setScheduledList] = useState<{ id: string; reportType: string; frequency: string; email: string }[]>([]);

  const endpoint = isOwnerView ? '/reports/summary' : `/businesses/${effectiveBusinessId}/reports`;

  useEffect(() => {
    if (!isOwnerView && !effectiveBusinessId) return;
    apiFetch<ReportsData>(endpoint, { token: accessToken })
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load reports'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, accessToken]);

  useEffect(() => {
    if (!effectiveBusinessId) return;
    apiFetch<typeof scheduledList>(`/businesses/${effectiveBusinessId}/reports/schedule`, { token: accessToken })
      .then(setScheduledList)
      .catch(() => setScheduledList([]));
  }, [effectiveBusinessId, accessToken]);

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveBusinessId) return;
    try {
      await apiFetch(`/businesses/${effectiveBusinessId}/reports/schedule`, {
        method: 'POST',
        body: { reportType: scheduleType, frequency, email },
        token: accessToken,
      });
      setScheduled(true);
      setTimeout(() => setScheduled(false), 2200);
      apiFetch<typeof scheduledList>(`/businesses/${effectiveBusinessId}/reports/schedule`, { token: accessToken }).then(
        setScheduledList,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to schedule report');
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Reports &amp; analytics</h1>

      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      <div className="seg" style={{ marginBottom: 18, width: 'fit-content' }}>
        <label className="seg-opt">
          <input type="radio" name="reptab" checked={tab === 'velocity'} onChange={() => setTab('velocity')} />
          Sales velocity
        </label>
        <label className="seg-opt">
          <input type="radio" name="reptab" checked={tab === 'turnover'} onChange={() => setTab('turnover')} />
          Turnover
        </label>
        <label className="seg-opt">
          <input type="radio" name="reptab" checked={tab === 'dead-stock'} onChange={() => setTab('dead-stock')} />
          Dead stock
        </label>
      </div>

      {!data ? (
        <span className="text-muted">Loading…</span>
      ) : (
        <>
          {tab === 'velocity' && (
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  {isOwnerView && <th>Business</th>}
                  <th>Estimated velocity</th>
                </tr>
              </thead>
              <tbody>
                {data.bestSellers.map((p) => (
                  <tr key={p.productId}>
                    <td>{p.name}</td>
                    {isOwnerView && <td className="text-muted">{p.businessName}</td>}
                    <td>{p.velocityLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'turnover' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2, background: 'var(--color-divider)' }}>
              {data.turnover.map((t) => {
                const trend = trendMeta(t.trend);
                return (
                  <div key={t.businessId} className="card">
                    <div className="card-kicker">{t.name}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{t.ratioLabel}</div>
                    <div className="text-muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <TrendIcon trend={t.trend} />
                      {trend.label} turnover
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'dead-stock' && (
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  {isOwnerView && <th>Business</th>}
                  <th>Stock on hand</th>
                  <th>Estimated velocity</th>
                </tr>
              </thead>
              <tbody>
                {data.deadStock.map((p) => (
                  <tr key={p.productId}>
                    <td>{p.name}</td>
                    {isOwnerView && <td className="text-muted">{p.businessName}</td>}
                    <td>{p.stock}</td>
                    <td>{p.velocityLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <div className="hr" />

      {effectiveBusinessId && (
        <div className="card" style={{ maxWidth: 460 }}>
          <div className="card-title" style={{ fontSize: 14 }}>
            Schedule this report
          </div>
          <form onSubmit={handleSchedule} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field">
              <label>Report</label>
              <select className="input" value={scheduleType} onChange={(e) => setScheduleType(e.target.value as ReportType)}>
                <option value="VELOCITY">Sales velocity</option>
                <option value="TURNOVER">Turnover</option>
                <option value="DEAD_STOCK">Dead stock</option>
              </select>
            </div>
            <div className="field">
              <label>Frequency</label>
              <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value as ReportFrequency)}>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: 180 }}>
              <label>Send to</label>
              <input
                className="input"
                type="email"
                placeholder="owner@yourbusiness.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit">
              Schedule
            </button>
          </form>
          {scheduled && <span className="tag tag-neutral" style={{ width: 'fit-content', marginTop: 10 }}>Scheduled</span>}
          <div className="text-muted" style={{ fontSize: 11, marginTop: 10 }}>
            Saved for real — actual email delivery lands with Notifications.
          </div>

          {scheduledList.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {scheduledList.map((s) => (
                <div key={s.id} style={{ fontSize: 12, padding: '4px 0', borderTop: '1px solid var(--color-divider)' }} className="text-muted">
                  {s.reportType} · {s.frequency.toLowerCase()} · {s.email}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
