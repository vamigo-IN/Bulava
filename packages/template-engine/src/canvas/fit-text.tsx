'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const MIN = 0.4;

/**
 * Shrinks its text (never grows it) until it fits the parent box: long names
 * must never break a canvas composition. The server renders at full size; the
 * browser measures once the fonts are in and whenever the box resizes. The
 * factor is a CSS variable, so the design's own size stays the base.
 */
export function FitText({ children, lineHeight, singleLine }: { children: ReactNode; lineHeight: number; singleLine?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    let frame = 0;
    const measure = () => {
      // Try full size first, then halve the gap until the text fits in both directions.
      let lo = MIN;
      let hi = 1;
      el.style.setProperty('--fit', '1');
      const fits = () => el.scrollWidth <= box.clientWidth + 0.5 && el.scrollHeight <= box.clientHeight + 0.5;
      if (fits()) {
        setFit(1);
        return;
      }
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2;
        el.style.setProperty('--fit', String(mid));
        if (fits()) lo = mid;
        else hi = mid;
      }
      el.style.setProperty('--fit', String(lo));
      setFit(lo);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    schedule();
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    void fonts?.ready.then(schedule);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(box);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [children, singleLine]);

  return (
    <span ref={ref} style={{ display: 'block', width: '100%', whiteSpace: singleLine ? 'nowrap' : undefined, fontSize: 'calc(1em * var(--fit, 1))', lineHeight, ['--fit' as string]: String(fit) }}>
      {children}
    </span>
  );
}
