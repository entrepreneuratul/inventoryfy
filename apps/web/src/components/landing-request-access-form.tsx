'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { SubmitOnboardingLeadRequest } from '@inventoryfy/shared-types';
import { apiFetch, ApiError } from '@/lib/api';

/**
 * The landing page's "request access" form — public, no auth. Just
 * records the request and emails both sides (see the API's
 * OnboardingService); nothing here auto-creates a tenant. A Super
 * Owner completes the actual onboarding afterward from Platform →
 * Tenants.
 */
export function LandingRequestAccessForm() {
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: SubmitOnboardingLeadRequest = {
        businessName,
        contactName,
        email,
        phone: phone || undefined,
        message: message || undefined,
      };
      await apiFetch('/onboarding/leads', { method: 'POST', body });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="landing-form-card landing-success">
        <div className="landing-success-icon">
          <CheckCircle2 size={28} />
        </div>
        <div className="landing-section-title" style={{ fontSize: 22 }}>
          Request received
        </div>
        <p className="text-muted" style={{ maxWidth: 44 + 'ch', margin: '0 auto' }}>
          We&apos;ll review it and reach out to <strong>{email}</strong> shortly to get {businessName} set up.
        </p>
      </div>
    );
  }

  return (
    <form className="landing-form-card" onSubmit={handleSubmit}>
      <div className="landing-form-row">
        <div className="field">
          <label>Business name</label>
          <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Your name</label>
          <input className="input" value={contactName} onChange={(e) => setContactName(e.target.value)} required />
        </div>
      </div>
      <div className="landing-form-row">
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Phone (optional)</label>
          <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="field" style={{ marginBottom: 18 }}>
        <label>What are you looking to manage? (optional)</label>
        <textarea
          className="input"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      {error && (
        <div className="tag tag-outline" style={{ display: 'block', marginBottom: 14, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>
        {submitting ? 'Sending…' : 'Request access'}
      </button>
      <p className="text-muted" style={{ fontSize: 12, marginTop: 10, textAlign: 'center' }}>
        We&apos;ll email you and our team — no account is created automatically.
      </p>
    </form>
  );
}
