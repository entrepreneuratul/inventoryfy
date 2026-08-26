import { ThemeToggle } from '@/components/theme-toggle';
import { ApiHealth } from '@/components/api-health';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav className="nav">
        <span className="nav-brand">Inventoryfy</span>
        <ApiHealth />
        <ThemeToggle />
      </nav>

      <main
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          padding: 'var(--space-8)',
        }}
      >
        <div style={{ width: 'min(560px, 100%)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h6 className="text-muted">Phase 1 — Foundations</h6>
          <h1>Multi-tenant inventory, built from the ground up.</h1>
          <p className="text-muted">
            This is the bare app shell: monorepo wired up, Postgres connected through the API,
            and the Modernist design tokens ported in. Domain features land in the phases ahead.
          </p>
          <div className="hr" />
          <div className="card elev-sm">
            <span className="card-kicker">Stack</span>
            <h3 className="card-title">NestJS · Next.js · PostgreSQL · Prisma</h3>
            <p className="card-body">
              Deployed to Render. Design system tokens live in{' '}
              <code>packages/design-tokens</code>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
