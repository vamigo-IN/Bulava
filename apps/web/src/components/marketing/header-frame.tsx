'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'dark' | 'light';

/**
 * The sticky marketing header: a clay bar over the cream canvas. It reads the
 * section just below it (`data-header-tone="dark"` or `"light"`) and switches
 * to dark glass over the dark bands (pricing, footer). Pages that open on a
 * dark section pass `initialTone="dark"` so the first paint matches.
 */
export function HeaderFrame({ children, initialTone = 'light' }: { children: ReactNode; initialTone?: Tone }) {
  const ref = useRef<HTMLElement>(null);
  const [tone, setTone] = useState<Tone>(initialTone);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.min(window.innerHeight - 1, el.getBoundingClientRect().bottom + 1);
      const below = document
        .elementsFromPoint(window.innerWidth / 2, y)
        .map((node) => node.closest<HTMLElement>('[data-header-tone]'))
        .find((node) => node && !el.contains(node));
      setTone(below?.dataset.headerTone === 'dark' ? 'dark' : 'light');
      setScrolled(window.scrollY > 8);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <header
      ref={ref}
      data-tone={tone}
      data-scrolled={scrolled ? '' : undefined}
      className={cn(
        'site-header group/header sticky top-0 z-40 text-[var(--hdr-text)] transition-[background-color,box-shadow] duration-500',
        'bg-[var(--hdr-bg)] backdrop-blur-xl backdrop-saturate-150',
      )}
    >
      {children}
    </header>
  );
}
