'use client';

import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { cn } from '@/lib/utils';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Variant = 'up' | 'scale' | 'left' | 'right';

// Opacity only, never `visibility` (GSAP's autoAlpha): content waiting for its reveal stays in the
// accessibility tree, so screen readers and AI agents read the whole page, and Tab can reach it
// (focus scrolls it into view, which reveals it).
const FROM: Record<Variant, gsap.TweenVars> = {
  up: { y: 40, opacity: 0 },
  scale: { y: 30, scale: 0.95, opacity: 0 },
  left: { x: -48, opacity: 0 },
  right: { x: 48, opacity: 0 },
};

/**
 * Reveals its content once, as it scrolls into view. With `stagger`, the
 * elements matching that selector come in one after another instead (keep CSS
 * transitions on those elements to colours and shadows, or they fight GSAP).
 * Inline styles are cleared afterwards so hover effects work as written.
 */
export function Reveal({ children, variant = 'up', delay = 0, stagger, className }: { children: ReactNode; variant?: Variant; delay?: number; stagger?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reducedMotion()) return;
      const targets = stagger ? gsap.utils.toArray<HTMLElement>(stagger, el) : [el];
      if (!targets.length) return;
      gsap.from(targets, {
        ...FROM[variant],
        duration: 1,
        delay,
        stagger: stagger ? 0.08 : 0,
        ease: 'power3.out',
        clearProps: 'transform,opacity,visibility',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * The "How it works" rail: a line that fills as the section scrolls past, and
 * steps (`[data-step]`) that light up as the line reaches them. Without motion
 * the rail is simply full.
 */
export function StepsProgress({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reducedMotion()) {
        el?.querySelectorAll('[data-step]').forEach((s) => s.setAttribute('data-active', ''));
        return;
      }
      const bar = el.querySelector('[data-progress]');
      if (bar) gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 72%', end: 'bottom 60%', scrub: 0.6 } });
      for (const step of gsap.utils.toArray<HTMLElement>('[data-step]', el)) {
        ScrollTrigger.create({
          trigger: step,
          start: 'top 72%',
          onEnter: () => step.setAttribute('data-active', ''),
          onLeaveBack: () => step.removeAttribute('data-active'),
        });
      }
      gsap.from(gsap.utils.toArray('[data-step]', el), { y: 40, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out', clearProps: 'transform,opacity,visibility', scrollTrigger: { trigger: el, start: 'top 82%', once: true } });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={cn('relative', className)}>
      {children}
    </div>
  );
}

/** Moves decoration (mandalas, glows) at its own speed while the page scrolls: `speed` is a share of its height. */
export function Parallax({ children, speed = 0.2, className }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reducedMotion()) return;
      gsap.fromTo(el, { yPercent: speed * 50 }, { yPercent: -speed * 50, ease: 'none', scrollTrigger: { trigger: el.parentElement ?? el, start: 'top bottom', end: 'bottom top', scrub: true } });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} aria-hidden="true" className={cn('pointer-events-none', className)}>
      {children}
    </div>
  );
}
