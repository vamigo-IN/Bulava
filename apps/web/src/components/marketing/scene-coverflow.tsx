'use client';

import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface CoverflowItem {
  key: string;
  name: string;
  blurb: string;
  node: ReactNode;
}

/**
 * A 3D coverflow of illustrated templates: the centred card faces the viewer
 * under a pool of light, its neighbours turn away in perspective and dim. It is
 * a native scroll-snap strip (touch, trackpad and keyboard work as usual); the
 * 3D pose is computed from each card's distance to the centre.
 */
export function SceneCoverflow({ items, labels }: { items: CoverflowItem[]; labels: { demo: string; details: string; previous: string; next: string } }) {
  const track = useRef<HTMLUListElement>(null);
  const [offsets, setOffsets] = useState<number[]>(() => items.map((_, i) => i));

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const center = el.scrollLeft + el.clientWidth / 2;
      const cards = Array.from(el.children) as HTMLElement[];
      setOffsets(cards.map((c) => (c.offsetLeft + c.offsetWidth / 2 - center) / c.offsetWidth));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    // Start on the second card so the effect is visible on arrival.
    const second = el.children[1] as HTMLElement | undefined;
    if (second && !reduced) el.scrollLeft = second.offsetLeft + second.offsetWidth / 2 - el.clientWidth / 2;
    measure();
    if (reduced) return;
    el.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      el.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items.length]);

  const step = (dir: 1 | -1) => {
    const el = track.current;
    const card = el?.children[0] as HTMLElement | undefined;
    if (el && card) el.scrollBy({ left: dir * (card.offsetWidth + 24), behavior: 'smooth' });
  };

  const navButton = 'btn-3d btn-3d-light size-12 rounded-full';

  return (
    <div className="relative">
      {/* A pool of light where the centred card stands. */}
      <div className="pointer-events-none absolute top-6 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.8),rgba(233,200,127,0.28)_50%,transparent)]" aria-hidden="true" />

      <ul ref={track} data-lenis-prevent className="relative flex snap-x snap-mandatory gap-6 overflow-x-auto px-[calc(50%-150px)] pt-6 pb-12 [perspective:1400px] [scrollbar-width:none]" aria-label={labels.details}>
        {items.map((item, i) => {
          const d = Math.max(-2.5, Math.min(2.5, offsets[i] ?? 0));
          const near = Math.abs(d);
          const centred = near < 0.3;
          return (
            <li key={item.key} className="w-[300px] shrink-0 snap-center">
              <div
                className="flex flex-col items-center transition-[transform,opacity] duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transform-none"
                style={{
                  transform: `rotateY(${-d * 30}deg) translateZ(${-near * 90}px) scale(${1 - Math.min(0.18, near * 0.07)})`,
                  opacity: 1 - Math.min(0.6, near * 0.25),
                }}
              >
                <Link
                  href={`/templates/${item.key}`}
                  data-cursor="view"
                  className={`block rounded-[2.2rem] transition-shadow duration-500 ${centred ? 'shadow-[0_34px_70px_-26px_rgba(122,29,39,0.5)]' : 'shadow-[0_24px_50px_-26px_rgba(70,40,26,0.5)]'}`}
                  aria-label={`${item.name}: ${labels.details}`}
                >
                  {item.node}
                </Link>
                <p className="mt-6 font-display text-2xl text-ink">{item.name}</p>
                <p className="mt-1 line-clamp-2 max-w-[260px] text-center text-sm text-stone-600">{item.blurb}</p>
                <Link href={`/templates/${item.key}/demo`} className={`mt-5 min-h-11 rounded-xl px-5 text-sm ${centred ? 'btn-3d' : 'btn-3d btn-3d-light'}`}>
                  <Play aria-hidden className="size-3.5 fill-current" />
                  {labels.demo}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-center gap-3">
        <button type="button" onClick={() => step(-1)} className={navButton} aria-label={labels.previous}>
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <button type="button" onClick={() => step(1)} className={navButton} aria-label={labels.next}>
          <ChevronRight aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  );
}
