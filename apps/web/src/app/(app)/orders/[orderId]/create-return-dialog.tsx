'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';

export function CreateReturnDialog({
  businessId,
  orderItemId,
  productName,
  onClose,
  onCreated,
}: {
  businessId: string;
  orderItemId: string;
  productName: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { accessToken } = useAuth();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/businesses/${businessId}/returns`, {
        method: 'POST',
        body: { orderItemId, reason },
        token: accessToken,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create return');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="dialog-title">Return — {productName}</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label>Reason</label>
            <textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus />
          </div>
          {error && (
            <div className="tag tag-outline" style={{ display: 'block', padding: '8px 10px' }}>
              {error}
            </div>
          )}
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Requesting…' : 'Request return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
