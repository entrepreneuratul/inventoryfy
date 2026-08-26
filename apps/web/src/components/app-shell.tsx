'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LayoutDashboard, Layers, LogOut, Package } from 'lucide-react';
import { useAuth } from './auth-provider';
import { ThemeToggle } from './theme-toggle';

// Nav items only ever link to pages that actually exist — grows one entry
// per phase (Catalog, Orders, Warehouses, ...) rather than linking ahead
// to screens that aren't built yet.
const NAV_SECTIONS = [
  {
    title: 'General',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Catalog', href: '/catalog', icon: Package },
    ],
  },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, businesses, activeBusinessId, setActiveBusinessId, logout } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const isOwner = role === 'OWNER';
  const isOwnerView = isOwner && activeBusinessId === null;
  const currentBiz = businesses.find((b) => b.id === activeBusinessId) ?? null;
  const currentLabel = isOwnerView ? 'Owner View' : (currentBiz?.name ?? '');
  const currentInitials = isOwnerView ? 'OV' : currentBiz ? initials(currentBiz.name) : '';

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh' }}>
      <aside
        className="mf-sidebar"
        style={{
          width: 232,
          flex: 'none',
          borderRight: '2px solid var(--color-divider)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 0',
        }}
      >
        <div style={{ padding: '0 20px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, background: 'var(--color-accent)', flex: 'none' }} />
          <span
            className="mf-brand-text"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 19, letterSpacing: '-0.02em' }}
          >
            INVENTORYFY
          </span>
        </div>
        <div className="hr" style={{ margin: '0 0 12px' }} />
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px', flex: 1, overflowY: 'auto' }}>
          {NAV_SECTIONS.map((sec) => (
            <div key={sec.title}>
              <div
                className="mf-label"
                style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.5, padding: '14px 10px 4px' }}
              >
                {sec.title}
              </div>
              {sec.items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <button
                    key={item.href}
                    className="mf-nav-btn"
                    onClick={() => router.push(item.href)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '9px 10px',
                      border: 'none',
                      background: active ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
                      color: active ? 'var(--color-accent-700)' : 'var(--color-text)',
                      fontWeight: active ? 700 : 400,
                      font: 'inherit',
                      fontSize: 14,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <item.icon size={16} style={{ flex: 'none' }} />
                    <span className="mf-label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div style={{ padding: '14px 20px 0', marginTop: 8, borderTop: '2px solid var(--color-divider)' }}>
          <span className="tag tag-outline mf-label">{role === 'OWNER' ? 'Owner' : 'Staff'}</span>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header className="nav" style={{ position: 'relative', borderBottom: '2px solid var(--color-divider)' }}>
          <div style={{ position: 'relative' }}>
            <button className="btn btn-secondary" onClick={() => setSwitcherOpen((v) => !v)}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  background: 'var(--color-accent)',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 9,
                  fontWeight: 800,
                  flex: 'none',
                }}
              >
                {currentInitials}
              </div>
              <span className="mf-topbar-label">{currentLabel}</span>
              {isOwner && <ChevronDown size={14} />}
            </button>

            {switcherOpen && isOwner && (
              <div
                style={{
                  position: 'absolute',
                  top: 44,
                  left: 0,
                  width: 290,
                  background: 'var(--color-surface)',
                  border: '2px solid var(--color-divider)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 50,
                }}
              >
                <div className="text-muted" style={{ padding: '8px 12px' }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Switch workspace
                  </span>
                </div>
                <button
                  className="mf-nav-btn"
                  onClick={() => {
                    setActiveBusinessId(null);
                    setSwitcherOpen(false);
                  }}
                  style={switcherRowStyle(isOwnerView)}
                >
                  <Layers size={16} />
                  <span>Owner View — all businesses</span>
                </button>
                <div className="hr" style={{ margin: '4px 12px' }} />
                {businesses.map((biz) => (
                  <button
                    key={biz.id}
                    className="mf-nav-btn"
                    onClick={() => {
                      setActiveBusinessId(biz.id);
                      setSwitcherOpen(false);
                    }}
                    style={switcherRowStyle(activeBusinessId === biz.id)}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        background: 'var(--color-neutral-300)',
                        color: 'var(--color-text)',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 9,
                        fontWeight: 800,
                        flex: 'none',
                      }}
                    >
                      {initials(biz.name)}
                    </div>
                    <span>{biz.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {isOwnerView && (
              <span className="tag" style={{ background: 'var(--color-accent)', color: '#fff', letterSpacing: '0.08em' }}>
                OWNER VIEW
              </span>
            )}
            <ThemeToggle />
            <button
              className="btn btn-icon btn-secondary"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={16} />
            </button>
            <div
              style={{
                width: 30,
                height: 30,
                background: 'var(--color-neutral-300)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 800,
                flex: 'none',
              }}
            >
              {user ? initials(user.name) : ''}
            </div>
          </div>
        </header>

        <main className="mf-main" style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function switcherRowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '9px 12px',
    border: 'none',
    background: active ? 'color-mix(in srgb, var(--color-text) 6%, transparent)' : 'transparent',
    color: 'var(--color-text)',
    font: 'inherit',
    fontSize: 14,
    textAlign: 'left',
    cursor: 'pointer',
  };
}
