'use client';

import { Box, ChevronLeft, ChevronRight, DoorOpen, Play } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface StageItem {
  key: string;
  name: string;
  blurb: string;
  /** The pre-rendered top of the website (`cardPreview`), or null until the previews are made. */
  image: string | null;
  /** The template's palette, for the doorway when there is no image yet. */
  colors: { primary: string; accent: string; background: string } | null;
}

/** The doorway's screen, in CSS pixels (the previews' 1:2 phone shape, cropped from the top). */
const SCREEN_W = 236;
const SCREEN_H = 420;

/**
 * The Signature 3D templates as doorways down a corridor: the centred one faces
 * the viewer under a pool of light and its picture steps toward you; the others
 * turn in like the walls of a hall. A native scroll-snap strip (touch, trackpad
 * and keyboard as usual); the pose comes from each card's distance to the centre,
 * kept in step as the strip scrolls, and reduced motion keeps every card flat
 * (only the neighbours dim) and the strip where the visitor left it.
 */
export function StageCarousel({ items, labels }: { items: StageItem[]; labels: { list: string; badge: string; demo: string; previous: string; next: string } }) {
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
    // Start on the second doorway so the corridor shows on arrival (reduced motion: no scroll the visitor did not make).
    const second = el.children[1] as HTMLElement | undefined;
    if (second && !reduced) el.scrollLeft = second.offsetLeft + second.offsetWidth / 2 - el.clientWidth / 2;
    measure();
    // Reduced motion too: which doorway is centred (its light, its button) and how far the others dim follow the strip.
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
    if (el && card) el.scrollBy({ left: dir * (card.offsetWidth + 28), behavior: 'smooth' });
  };

  const navButton = 'btn-3d btn-3d-light size-12 rounded-full';

  return (
    <div className="relative">
      {/* The pool of light the centred doorway stands in. */}
      <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.85),rgba(233,200,127,0.3)_55%,transparent)]" />

      <ul ref={track} data-lenis-prevent aria-label={labels.list} className="relative flex snap-x snap-mandatory gap-7 overflow-x-auto px-[calc(50%-128px)] pt-8 pb-12 [scrollbar-width:none]">
        {items.map((item, i) => {
          const d = Math.max(-2.5, Math.min(2.5, offsets[i] ?? 0));
          const near = Math.abs(d);
          const centred = near < 0.3;
          return (
            <li key={item.key} className="w-[256px] shrink-0 snap-center">
              <div
                className="flex flex-col items-center transition-[transform,opacity] duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transform-none"
                style={{
                  // Neighbours turn toward the middle, like the walls of a hall you are walking down. The perspective is
                  // the card's own (a strip's `perspective` would not reach through the <li>, and drew the turn flat).
                  transform: `perspective(1200px) rotateY(${-d * 34}deg) translateZ(${-near * 110}px) scale(${1 - Math.min(0.16, near * 0.06)})`,
                  opacity: 1 - Math.min(0.55, near * 0.22),
                }}
              >
                <Link
                  href={`/templates/${item.key}`}
                  data-cursor="view"
                  aria-label={item.name}
                  className={cn(
                    'clay group/door relative block rounded-t-[112px] rounded-b-[1.75rem] p-2.5 transition-shadow duration-500',
                    centred ? 'shadow-[0_38px_70px_-28px_rgba(122,29,39,0.55)]' : 'shadow-[0_24px_50px_-26px_rgba(70,40,26,0.5)]',
                  )}
                >
                  <div className="relative overflow-hidden rounded-t-[104px] rounded-b-[1.35rem] bg-gold-100 shadow-clay-inset" style={{ width: SCREEN_W, height: SCREEN_H }}>
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        width={SCREEN_W}
                        height={SCREEN_H}
                        loading="lazy"
                        decoding="async"
                        className={cn('block size-full object-cover object-top transition-[scale] duration-700 ease-out group-hover/door:scale-[1.06] motion-reduce:transition-none', centred && 'scale-[1.03]')}
                      />
                    ) : (
                      <Doorway item={item} />
                    )}
                    {/* The arch's own shade: light falls in from the hall, the edges stay in shadow. */}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_14px_24px_-10px_rgba(40,14,10,0.45),inset_0_-30px_40px_-30px_rgba(40,14,10,0.35)]" />
                  </div>
                  <span className="absolute -bottom-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[11px] font-semibold tracking-wide whitespace-nowrap text-brand-700 shadow-clay-sm">
                    <Box aria-hidden className="size-3.5" />
                    {labels.badge}
                  </span>
                </Link>
                <p className="mt-8 font-display text-2xl text-ink">{item.name}</p>
                {item.blurb ? <p className="mt-1 line-clamp-2 max-w-[250px] text-center text-sm text-stone-600">{item.blurb}</p> : null}
                <Link href={`/templates/${item.key}/demo`} className={cn('mt-5 min-h-11 rounded-xl px-5 text-sm', centred ? 'btn-3d' : 'btn-3d btn-3d-light')}>
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

/** Until a template's preview is made: its palette as a lit hall behind an open door, with its name. */
function Doorway({ item }: { item: StageItem }) {
  const c = item.colors ?? { primary: '#7a1d27', accent: '#c9a24a', background: '#f6eee5' };
  return (
    <div
      className="flex size-full flex-col items-center justify-center gap-5 px-6 text-center"
      style={{ background: `radial-gradient(ellipse at 50% 38%, ${c.background}, ${c.accent} 62%, ${c.primary})` }}
    >
      <span className="icon-3d size-14 rounded-2xl">
        <DoorOpen aria-hidden className="size-6" />
      </span>
      <span className="rounded-2xl bg-white/75 px-4 py-2.5 font-display text-xl leading-tight text-ink shadow-clay-sm backdrop-blur-sm">{item.name}</span>
    </div>
  );
}
