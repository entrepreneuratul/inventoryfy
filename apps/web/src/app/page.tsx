'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';

export default function Home() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <span className="text-muted">Loading…</span>
    </div>
  );
}
