'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * On phones, a template page's preview fills two screens before its name, price and
 * "Use this template". This bar keeps them at the bottom of the screen while the preview
 * scrolls, and steps aside while the page's own button (`watch`, an element id) or the
 * footer is in view. Desktops show the sticky sidebar instead. While it shows, the
 * floating WhatsApp chat button rises above it (`--sticky-cta`).
 */
export function StickyCta({ watch, children }: { watch: string; children: ReactNode }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const targets = [document.getElementById(watch), document.querySelector('footer')].filter((el): el is HTMLElement => el !== null);
    const visible = new Map<Element, boolean>();
    const update = () => setShown(!wide.matches && ![...visible.values()].some(Boolean));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) visible.set(entry.target, entry.isIntersecting);
      update();
    });
    targets.forEach((el) => observer.observe(el));
    wide.addEventListener('change', update);
    return () => {
      observer.disconnect();
      wide.removeEventListener('change', update);
    };
  }, [watch]);

  useEffect(() => {
    const root = document.documentElement;
    if (shown) root.style.setProperty('--sticky-cta', '5.75rem');
    else root.style.removeProperty('--sticky-cta');
    return () => {
      root.style.removeProperty('--sticky-cta');
    };
  }, [shown]);

  return (
    <div
      // Out of the way and out of the tab order while hidden.
      inert={!shown}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[translate,opacity] duration-300 ease-out lg:hidden',
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0',
      )}
    >
      <div className="clay mx-auto flex max-w-md items-center gap-3 rounded-[1.4rem] p-2 pl-4">{children}</div>
    </div>
  );
}
