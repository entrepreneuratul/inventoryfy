'use client';

import { useEffect, useState } from 'react';

type Status = 'checking' | 'ok' | 'error';

export function ApiHealth() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    fetch(`${apiUrl}/health`)
      .then((res) => (res.ok ? setStatus('ok') : setStatus('error')))
      .catch(() => setStatus('error'));
  }, []);

  const badgeCls =
    status === 'ok' ? 'tag tag-accent' : status === 'error' ? 'tag tag-neutral' : 'tag tag-outline';
  const label = status === 'ok' ? 'API connected' : status === 'error' ? 'API unreachable' : 'Checking API…';

  return <span className={badgeCls}>{label}</span>;
}
