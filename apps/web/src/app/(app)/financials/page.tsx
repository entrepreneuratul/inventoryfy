'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import type { BusinessFinancials } from '@inventoryfy/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError, downloadFile } from '@/lib/api';

export default function FinancialsPage() {
  const { accessToken, role, businesses, activeBusinessId } = useAuth();
  const isOwnerView = role === 'OWNER' && activeBusinessId === null;
  const effectiveBusinessId = activeBusinessId ?? businesses[0]?.id ?? null;

  const [data, setData] = useState<BusinessFinancials | null>(null);
  const [error, setError] = useState<string | null>(null);

  const endpoint = isOwnerView ? '/financials/summary' : `/businesses/${effectiveBusinessId}/financials`;
  const exportEndpoint = isOwnerView ? '/financials/summary/export' : `/businesses/${effectiveBusinessId}/financials/export`;

  useEffect(() => {
    if (!isOwnerView && !effectiveBusinessId) return;
    apiFetch<BusinessFinancials>(endpoint, { token: accessToken })
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load financials'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, accessToken]);

  async function handleExport() {
    try {
      await downloadFile(exportEndpoint, accessToken, 'financials.csv');
    } catch {
      setError('Export failed');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <h1 style={{ marginBottom: 0 }}>Financials</h1>
        <button className="btn btn-primary" onClick={handleExport}>
          <Download size={15} />
          Export CSV
        </button>
      </div>

      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      {!data ? (
        <span className="text-muted">Loading…</span>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2, background: 'var(--color-divider)', marginBottom: 24 }}>
            <div className="card">
              <div className="card-kicker">Accounts payable</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{data.apTotalFmt}</div>
              <div className="text-muted" style={{ fontSize: 11 }}>
                Owed to suppliers
              </div>
            </div>
            <div className="card">
              <div className="card-kicker">Accounts receivable</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{data.arTotalFmt}</div>
              <div className="text-muted" style={{ fontSize: 11 }}>
                Owed by unpaid/credit customers
              </div>
            </div>
          </div>

          <h4 style={{ marginBottom: 10 }}>Profit &amp; loss</h4>
          <table className="table" style={{ marginBottom: 28 }}>
            <thead>
              <tr>
                <th>Business</th>
                <th>Revenue</th>
                <th>COGS &amp; expenses</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {data.pnlRows.map((r) => (
                <tr key={r.businessId || 'total'}>
                  <td style={r.isTotal ? { fontWeight: 800 } : undefined}>{r.name}</td>
                  <td>{r.revenueFmt}</td>
                  <td className="text-muted">{r.expensesFmt}</td>
                  <td style={{ fontWeight: 800 }}>{r.profitFmt}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 style={{ marginBottom: 10 }}>GST breakdown</h4>
          {data.gstRows.length === 0 ? (
            <p className="text-muted" style={{ marginBottom: 28 }}>
              No taxed sales recorded yet.
            </p>
          ) : (
            <table className="table" style={{ marginBottom: 28 }}>
              <thead>
                <tr>
                  <th>Rate</th>
                  <th>Taxable revenue</th>
                  <th>GST collected</th>
                </tr>
              </thead>
              <tbody>
                {data.gstRows.map((g) => (
                  <tr key={g.rate}>
                    <td>{g.rate}%</td>
                    <td>{g.taxableFmt}</td>
                    <td>{g.gstFmt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h4 style={{ marginBottom: 10 }}>Transaction log</h4>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                {isOwnerView && <th>Business</th>}
                <th>Type</th>
                <th>Note</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t, i) => (
                <tr key={i}>
                  <td className="text-muted">{t.date}</td>
                  {isOwnerView && <td className="text-muted">{t.businessName}</td>}
                  <td>{t.type}</td>
                  <td className="text-muted">{t.note}</td>
                  <td style={t.isNegative ? { color: 'var(--color-accent-700)', fontWeight: 700 } : undefined}>{t.amountFmt}</td>
                </tr>
              ))}
              {data.transactions.length === 0 && (
                <tr>
                  <td colSpan={isOwnerView ? 5 : 4} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
