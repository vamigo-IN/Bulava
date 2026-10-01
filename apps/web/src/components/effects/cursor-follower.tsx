'use client';

import { useEffect, useRef } from 'react';

const INTERACTIVE = '[data-cursor], a, button, summary, label, [role="button"], input, textarea, select';

/**
 * A soft ring that trails the pointer on marketing pages. It grows over links
 * and buttons, carries a label over elements marked `data-cursor="view"`
 * (template cards), and steps aside over form fields. Desktop pointers only and
 * never with reduced motion; the native cursor stays visible for precision.
 * The animation loop sleeps whenever the ring has caught up.
 */
export function CursorFollower({ viewLabel }: { viewLabel: string }) {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const r = ring.current;
    const d = dot.current;
    if (!r || !d) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let x = -200;
    let y = -200;
    let rx = -200;
    let ry = -200;
    let frame = 0;
    let shown = false;

    const setState = (state: 'default' | 'link' | 'view' | 'hidden') => {
      if (r.dataset.state === state) return;
      r.dataset.state = state;
      d.dataset.state = state === 'view' || state === 'hidden' ? 'hidden' : 'default';
    };
    const tick = () => {
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      r.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      d.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      frame = Math.abs(x - rx) + Math.abs(y - ry) > 0.2 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!shown) {
        shown = true;
        rx = x;
        ry = y;
        r.style.opacity = '';
        d.style.opacity = '';
      }
      const target = e.target instanceof Element ? (e.target.closest(INTERACTIVE) as HTMLElement | null) : null;
      if (!target) setState('default');
      else if (target.matches('input, textarea, select')) setState('hidden');
      else if (target.dataset.cursor === 'view') {
        if (label.current) label.current.textContent = target.dataset.cursorLabel ?? viewLabel;
        setState('view');
      } else setState('link');
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget) return;
      shown = false;
      r.style.opacity = '0';
      d.style.opacity = '0';
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('mouseout', onOut);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('mouseout', onOut);
    };
  }, [viewLabel]);

  return (
    <>
      <div ref={ring} className="cursor-ring" data-state="default" aria-hidden="true" style={{ opacity: 0 }}>
        <span ref={label} className="cursor-label">
          {viewLabel}
        </span>
      </div>
      <div ref={dot} className="cursor-dot" aria-hidden="true" style={{ opacity: 0 }} />
    </>
  );
}
