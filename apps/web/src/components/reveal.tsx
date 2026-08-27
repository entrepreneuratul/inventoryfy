'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Wraps children in a fade-in-up reveal that triggers once the element
 * scrolls into view (IntersectionObserver), landing-page only — pairs
 * with the `.reveal` / `.is-visible` classes in landing.css. Same
 * pattern as Ritkalp's FadeIn.tsx (a connected client of this
 * platform), kept independent rather than shared since these are two
 * separate apps/repos.
 */
export function Reveal({
  children,
  className = '',
  delay = 0,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in ms, useful for a grid of cards. */
  delay?: number;
  as?: 'div' | 'section';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Comp = Tag as 'div';
  return (
    <Comp
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Comp>
  );
}
