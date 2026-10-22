'use client';

import { useEffect } from 'react';

/**
 * Below the hero, for themes with `theme.motion: 'stage'` (Signature 3D, spec §3.7). The renderer puts
 * `bulava-motion-stage` on the template root and mounts this beside `RevealOnScroll`:
 *
 * - **Section entrances in 3D.** A section tips up from the floor as it scrolls in (it starts leaning
 *   back, hinged at its foot, and settles flat on a soft spring), and its heading and content rise
 *   forward from depth one after another. Pure CSS on the classes `RevealOnScroll` already sets
 *   (`reveal-ready`, `.bulava-reveal`, `.is-visible`), so it costs nothing per frame and is off
 *   wherever reveals are off (reduced motion, previews without the observer, thumbnails).
 * - **Card tilt.** On a desktop with a fine pointer, a `.bulava-tilt` card under the cursor leans
 *   toward it (at most 6°), lifted a touch, and springs back flat when the cursor leaves. One
 *   delegated listener; work only inside requestAnimationFrame and only while a card is moving, so
 *   nothing runs while the page is idle, scrolled or hidden.
 *
 * Reduced motion: nothing runs and the CSS is wrapped in `prefers-reduced-motion: no-preference`.
 */

/** The largest lean, in degrees. */
export const TILT_MAX = 6;
/** The spring under the cursor (per second²) and its damping ratio. */
const STIFFNESS = 140;
const DAMPING_RATIO = 0.78;

const ROOT = '.bulava-template.bulava-motion-stage.reveal-ready';
const SECTION = `${ROOT} .bulava-reveal:not(.bulava-canvas)`;

const STYLES = `
@media (prefers-reduced-motion: no-preference) {
  ${SECTION} {
    transform: perspective(1200px) rotateX(10deg) translateY(40px);
    transform-origin: 50% 100%;
    transition: opacity 0.9s cubic-bezier(0.22, 0.8, 0.3, 1), transform 1.15s cubic-bezier(0.16, 1, 0.3, 1);
  }
  ${SECTION}.is-visible { transform: none; }
  :where(${SECTION}.is-visible > div:last-child > *) {
    animation: bulava-mb-rise 1s cubic-bezier(0.16, 1, 0.3, 1) backwards;
    animation-delay: 0.32s;
  }
  :where(${SECTION}.is-visible > div:last-child > :nth-child(1)) { animation-delay: 0.08s; }
  :where(${SECTION}.is-visible > div:last-child > :nth-child(2)) { animation-delay: 0.2s; }
  :where(${SECTION}.is-visible > div:last-child > :nth-child(3)) { animation-delay: 0.28s; }
  @keyframes bulava-mb-rise {
    from { opacity: 0; transform: perspective(900px) translate3d(0, 26px, -90px) rotateX(9deg); }
    to { opacity: 1; transform: perspective(900px) translate3d(0, 0, 0) rotateX(0deg); }
  }
  @media (hover: hover) and (pointer: fine) {
    .bulava-motion-stage.bulava-tilt-live .bulava-tilt:hover:not([data-tilt]) { transform: none; }
    .bulava-motion-stage .bulava-tilt[data-tilt] {
      transform: perspective(760px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)) translateZ(var(--tilt-z, 0px));
      transition: none;
      will-change: transform;
    }
  }
}
`;

interface Tilt {
  el: HTMLElement;
  rect: DOMRect | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
}

/** The lean for a pointer at (nx, ny) across a card (each -1..1): the card's near edge dips toward it. */
export function tiltFor(nx: number, ny: number, max = TILT_MAX): { x: number; y: number } {
  const c = (v: number) => Math.max(-1, Math.min(1, v));
  const x = -c(ny) * max;
  const y = c(nx) * max;
  return { x: Math.round(x * 100) / 100 || 0, y: Math.round(y * 100) / 100 || 0 };
}

export function BelowHeroMotion({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const tilts = new Map<HTMLElement, Tilt>();
    let hovered: Tilt | null = null;
    let frame = 0;
    let last = 0;

    const write = (t: Tilt) => {
      const s = t.el.style;
      s.setProperty('--tilt-x', `${t.x.toFixed(2)}deg`);
      s.setProperty('--tilt-y', `${t.y.toFixed(2)}deg`);
      // Lift toward the eye in step with the lean (≤ 14px at the full 6°).
      const lift = Math.min(1, Math.hypot(t.x, t.y) / TILT_MAX) * 14;
      s.setProperty('--tilt-z', `${lift.toFixed(1)}px`);
    };
    const release = (t: Tilt) => {
      t.el.removeAttribute('data-tilt');
      t.el.style.removeProperty('--tilt-x');
      t.el.style.removeProperty('--tilt-y');
      t.el.style.removeProperty('--tilt-z');
      tilts.delete(t.el);
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      const k = STIFFNESS;
      const c = 2 * Math.sqrt(k) * DAMPING_RATIO;
      for (const t of Array.from(tilts.values())) {
        t.vx += (-k * (t.x - t.tx) - c * t.vx) * dt;
        t.vy += (-k * (t.y - t.ty) - c * t.vy) * dt;
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        const settled =
          Math.abs(t.x - t.tx) < 0.01 &&
          Math.abs(t.y - t.ty) < 0.01 &&
          Math.abs(t.vx) < 0.05 &&
          Math.abs(t.vy) < 0.05;
        if (settled) {
          t.x = t.tx;
          t.y = t.ty;
          t.vx = 0;
          t.vy = 0;
          if (t !== hovered && t.tx === 0 && t.ty === 0) {
            release(t);
            continue;
          }
        }
        write(t);
      }
      const moving = Array.from(tilts.values()).some(
        (t) => t.vx !== 0 || t.vy !== 0 || t.x !== t.tx || t.y !== t.ty,
      );
      if (moving && !document.hidden) schedule();
      else last = 0;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const letGo = (t: Tilt | null) => {
      if (!t) return;
      t.tx = 0;
      t.ty = 0;
      t.rect = null;
      schedule();
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !fine.matches) return;
      const el =
        e.target instanceof Element
          ? (e.target.closest('.bulava-tilt') as HTMLElement | null)
          : null;
      if (!el || !root.contains(el)) {
        if (hovered) letGo(hovered);
        hovered = null;
        return;
      }
      let t = tilts.get(el);
      if (!t) {
        t = { el, rect: null, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
        tilts.set(el, t);
        el.setAttribute('data-tilt', '');
        write(t);
      }
      if (hovered && hovered !== t) letGo(hovered);
      hovered = t;
      // Measure once per visit: the card's own lean must not move the target under the cursor.
      if (!t.rect) t.rect = el.getBoundingClientRect();
      const r = t.rect;
      const lean = tiltFor(
        ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1,
        ((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1,
      );
      t.tx = lean.x;
      t.ty = lean.y;
      schedule();
    };
    const onLeave = () => {
      letGo(hovered);
      hovered = null;
    };
    // Scrolling moves the cards from under a still cursor: let them settle flat.
    const onScroll = () => {
      if (!tilts.size) return;
      onLeave();
    };

    root.classList.add('bulava-tilt-live');
    root.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerleave', onLeave, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('blur', onLeave);
    return () => {
      root.classList.remove('bulava-tilt-live');
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('blur', onLeave);
      if (frame) cancelAnimationFrame(frame);
      for (const t of Array.from(tilts.values())) release(t);
    };
  }, [rootId]);

  return (
    <style href="bulava-motion-below" precedence="bulava">
      {STYLES}
    </style>
  );
}
