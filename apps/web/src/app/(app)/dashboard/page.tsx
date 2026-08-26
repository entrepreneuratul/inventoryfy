'use client';

import { useAuth } from '@/components/auth-provider';

export default function DashboardPage() {
  const { user, role, businesses, activeBusinessId } = useAuth();
  const isOwnerView = role === 'OWNER' && activeBusinessId === null;
  const currentBiz = businesses.find((b) => b.id === activeBusinessId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <h6 className="text-muted">Phase 2 — Auth &amp; Multi-Tenancy</h6>
      <h1>Welcome, {user?.name}.</h1>

      {isOwnerView ? (
        <p className="text-muted">
          You&apos;re in <strong>Owner View</strong>, with access to {businesses.length} business
          {businesses.length === 1 ? '' : 'es'}. Use the switcher in the top bar to focus on one, or
          stay here for the consolidated view (built in Phase 8).
        </p>
      ) : (
        <p className="text-muted">
          You&apos;re viewing <strong>{currentBiz?.name}</strong>. The real dashboard — revenue, stock
          alerts, per-business breakdowns — lands in Phase 8 once catalog and order data exists.
        </p>
      )}

      <div className="hr" />

      <div className="card elev-sm" style={{ maxWidth: 480 }}>
        <span className="card-kicker">Session</span>
        <h3 className="card-title">{role === 'OWNER' ? 'Owner' : 'Staff'} login</h3>
        <p className="card-body">
          Signed in as {user?.email}. Try the theme toggle, the logout button, and — if you're
          logged in as the owner — the business switcher in the top bar.
        </p>
      </div>
    </div>
  );
}
