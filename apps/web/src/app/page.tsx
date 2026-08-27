'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  DollarSign,
  Plug,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Reveal } from '@/components/reveal';
import { LandingRequestAccessForm } from '@/components/landing-request-access-form';
import { ThemeToggle } from '@/components/theme-toggle';
import './landing.css';

const FEATURES = [
  {
    icon: Boxes,
    title: 'Multi-warehouse inventory',
    body: 'Real-time stock across every warehouse — transfers, cycle counts, batches and serial numbers, all reconciled automatically.',
  },
  {
    icon: ClipboardList,
    title: 'Suppliers & purchase orders',
    body: 'Landed cost (freight, duty), partial receiving, and a supplier catalog that keeps your COGS honest.',
  },
  {
    icon: ShoppingCart,
    title: 'Orders & returns',
    body: 'One order pipeline for every channel — backorders handled cleanly, returns reconciled against real stock.',
  },
  {
    icon: DollarSign,
    title: 'Financials, built in',
    body: 'P&L, GST breakdown, accounts payable/receivable and a full transaction log — no spreadsheet reconciliation.',
  },
  {
    icon: Users,
    title: 'Team & roles',
    body: 'Owner, business admin, inventory manager, sales staff, accountant — each sees exactly what their role needs.',
  },
  {
    icon: Plug,
    title: 'Connect any storefront',
    body: 'A generic API-key + webhook contract, the same shape as connecting to Zoho or any third-party channel.',
  },
];

const MARQUEE_ITEMS = [
  'Warehouses', 'Purchase orders', 'Batches & serials', 'Financials', 'Team roles',
  'Integrations', 'Cycle counts', 'GST', 'Returns', 'Multi-tenant',
];

export default function Home() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <span className="text-muted">Loading…</span>
      </div>
    );
  }

  return (
    <div className="landing">
      <div className="landing-blobs" aria-hidden="true">
        <div className="landing-blob landing-blob-1" />
        <div className="landing-blob landing-blob-2" />
        <div className="landing-blob landing-blob-3" />
      </div>

      <div className="landing-inner">
        <nav className="landing-nav">
          <span className="landing-brand">INVENTORYFY</span>
          <div className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#integrations">Integrations</a>
            <a href="#request-access">Request access</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle />
            <Link href="/login" className="btn btn-secondary" style={{ fontSize: 13 }}>
              Log in
            </Link>
          </div>
        </nav>

        {/* ---- Hero ---- */}
        <header className="landing-hero landing-section">
          <div className="landing-hero-kicker">Multi-tenant inventory, done right</div>
          <h1 className="landing-hero-title">
            Run every business&apos;s <span className="accent">inventory</span> from one place
          </h1>
          <p className="landing-hero-sub">
            Stock, purchase orders, sales, and finances — unified across every business you run, synced with the
            storefronts you already use, in one login.
          </p>
          <div className="landing-hero-ctas">
            <a href="#request-access" className="btn btn-primary" style={{ fontSize: 15, padding: '12px 22px' }}>
              Request access <ArrowRight size={16} />
            </a>
            <Link href="/login" className="btn btn-secondary" style={{ fontSize: 15, padding: '12px 22px' }}>
              Log in
            </Link>
          </div>

          <div className="landing-marquee" aria-hidden="true">
            <div className="landing-marquee-track">
              {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
                <span key={i}>{item}</span>
              ))}
            </div>
          </div>
        </header>

        {/* ---- Features ---- */}
        <section id="features" className="landing-section">
          <Reveal>
            <div className="landing-section-kicker">What you get</div>
            <div className="landing-section-title">Everything an inventory-driven business actually needs</div>
            <p className="landing-section-sub">
              No bolted-on modules — one data model across catalog, warehouses, purchasing, sales and finance.
            </p>
          </Reveal>

          <div className="landing-features">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <div className="landing-feature-card">
                  <div className="landing-feature-icon">
                    <f.icon size={20} />
                  </div>
                  <div className="landing-feature-title">{f.title}</div>
                  <div className="landing-feature-body">{f.body}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---- Integrations ---- */}
        <section id="integrations" className="landing-section">
          <Reveal>
            <div className="landing-section-kicker">Stay in sync</div>
            <div className="landing-section-title">Your storefront, your stock, always agreeing</div>
            <p className="landing-section-sub">
              A connected storefront gets a real-time catalog feed and pushes orders back — Inventoryfy stays the
              single source of truth for price and stock, the same way it would connecting to any third-party
              inventory platform.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="landing-diagram">
              <div className="landing-diagram-node">
                <strong>Your storefront</strong>
                <span>Website, app, or POS</span>
              </div>
              <div className="landing-diagram-link" />
              <div className="landing-diagram-node accent">
                <strong>Inventoryfy</strong>
                <span>Stock &amp; price, source of truth</span>
              </div>
              <div className="landing-diagram-link" />
              <div className="landing-diagram-node">
                <strong>Your team</strong>
                <span>One dashboard, every business</span>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---- Request access ---- */}
        <section id="request-access" className="landing-section">
          <Reveal>
            <div style={{ textAlign: 'center' }}>
              <div className="landing-section-kicker">Get started</div>
              <div className="landing-section-title" style={{ margin: '0 auto 14px' }}>
                Tell us about your business
              </div>
              <p className="landing-section-sub" style={{ margin: '0 auto' }}>
                Send a few details and we&apos;ll set up your account personally — no self-serve signup, so nothing
                is created until we&apos;ve actually spoken with you.
              </p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <LandingRequestAccessForm />
          </Reveal>
        </section>

        <footer className="landing-footer">
          <span className="landing-brand" style={{ fontSize: 14 }}>
            INVENTORYFY
          </span>
          <span>Already have an account? <Link href="/login" style={{ color: 'var(--color-accent)' }}>Log in</Link></span>
        </footer>
      </div>
    </div>
  );
}
