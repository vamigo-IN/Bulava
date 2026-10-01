'use client';

import { useEffect } from 'react';

/**
 * Fade sections in as they scroll into view. Progressive enhancement: the
 * hiding class is only added once this script runs, and every section is
 * revealed as soon as any part of it is visible, so content can never get
 * stuck hidden (e.g. the last section on a short page or a tall screen).
 */
export function RevealOnScroll({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>('.bulava-reveal'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0 },
    );
    root.classList.add('reveal-ready');
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [rootId]);
  return null;
}
