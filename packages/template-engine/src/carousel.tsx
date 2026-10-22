'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface CarouselPhoto {
  url: string;
  thumbUrl: string;
  width?: number | null;
  height?: number | null;
  /** "Open photo 2 of 9". */
  label: string;
}

/**
 * The gallery as one row of equal square tiles (the heirloom's carousel): five across the content column on
 * wide pages, three on tablets, one with the next peeking on phones. It scrolls and snaps by swipe, by the
 * round gold-ringed buttons either side (one photo at a time, smoothly), by the arrow keys while it has
 * focus, and by its dots, one for each place the row can stop (a "3 / 24" counter past twelve photos). The
 * row runs to the band's edges, its first photo aligned to the page's content column; a short row is
 * centred. Each photo opens its full image.
 */
export function CarouselGallery({ photos, labels, label }: { photos: CarouselPhoto[]; labels: { previous: string; next: string; goTo: string[] }; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [ends, setEnds] = useState({ start: true, end: photos.length < 2 });
  // Buttons and dots only when the row runs past the page (measured in the browser), and how many tiles one view shows.
  const [scrollable, setScrollable] = useState(false);
  const [perView, setPerView] = useState(1);

  const items = useCallback(() => Array.from(track.current?.querySelectorAll<HTMLElement>('[data-slide]') ?? []), []);
  const padOf = (el: HTMLElement) => Number.parseFloat(getComputedStyle(el).paddingLeft) || 0;

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const list = items();
    const pad = padOf(el);
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    list.forEach((item, i) => {
      const distance = Math.abs(item.offsetLeft - pad - el.scrollLeft);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    const first = list[0];
    const step = first && list[1] ? list[1].offsetLeft - first.offsetLeft : (first?.offsetWidth ?? 1);
    setPerView(first ? Math.max(1, Math.round((el.clientWidth - 2 * pad + (step - first.offsetWidth)) / Math.max(1, step))) : 1);
    setActive(best);
    setEnds({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
    setScrollable(el.scrollWidth > el.clientWidth + 2);
  }, [items]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(() => ((frame = 0), measure()));
    };
    measure();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [measure]);

  // The places the row can stop: one per photo, less the ones a full view already shows at the end.
  const stops = Math.max(1, photos.length - perView + 1);
  const at = Math.min(active, stops - 1);

  const go = (index: number) => {
    const el = track.current;
    const item = items()[Math.max(0, Math.min(stops - 1, index))];
    if (!el || !item) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: item.offsetLeft - padOf(el), behavior: reduce ? 'auto' : 'smooth' });
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(at + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(at - 1);
    }
  };

  // Ivory discs ringed in gold; at the row's end the disc stays and only its chevron fades.
  const button =
    'group absolute top-1/2 z-[1] flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--t-surface)] text-[var(--t-primary-ink)] shadow-[0_8px_20px_-12px_rgba(0,0,0,0.5)] ring-1 ring-[color-mix(in_srgb,var(--t-orn)_75%,transparent)] transition-shadow hover:shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--t-accent)] @min-[640px]:size-[46px]';
  const chevron = (back: boolean) => (
    <svg viewBox="0 0 14 14" className="size-3.5 transition-opacity group-disabled:opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={back ? 'M9 2.5 4.5 7 9 11.5' : 'M5 2.5 9.5 7 5 11.5'} />
    </svg>
  );

  return (
    <div>
      <div className="relative">
        <div
          ref={track}
          tabIndex={0}
          role="group"
          aria-roledescription="carousel"
          aria-label={label}
          onKeyDown={onKey}
          className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto pt-2 pb-6 [scrollbar-width:none] focus-visible:outline-none @min-[640px]:gap-4 [&::-webkit-scrollbar]:hidden"
          style={{ paddingInline: 'max(24px, calc((100cqw - 1240px) / 2))', scrollPaddingInline: 'max(24px, calc((100cqw - 1240px) / 2))' }}
        >
          {photos.map((photo, i) => (
            <a
              key={photo.url + i}
              data-slide=""
              href={photo.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={photo.label}
              className="block aspect-square w-[76cqw] shrink-0 snap-start overflow-hidden rounded-[6px] bg-[var(--t-surface)] shadow-[0_12px_28px_-18px_rgba(0,0,0,0.45)] first:ml-auto last:mr-auto @min-[640px]:w-[calc((100cqw_-_48px_-_32px)_/_3)] @min-[1100px]:w-[calc((min(100cqw_-_48px,1240px)_-_64px)_/_5)]"
            >
              <img src={photo.thumbUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover [object-position:50%_35%]" />
            </a>
          ))}
        </div>
        {scrollable ? (
          <>
            <button type="button" className={`${button} left-3 @min-[1100px]:left-[max(12px,calc((100cqw_-_1240px)_/_2_-_62px))]`} onClick={() => go(at - 1)} disabled={ends.start} aria-label={labels.previous}>
              {chevron(true)}
            </button>
            <button type="button" className={`${button} right-3 @min-[1100px]:right-[max(12px,calc((100cqw_-_1240px)_/_2_-_62px))]`} onClick={() => go(at + 1)} disabled={ends.end} aria-label={labels.next}>
              {chevron(false)}
            </button>
          </>
        ) : null}
      </div>
      {!scrollable ? null : photos.length > 12 ? (
        <p className="mt-1 text-center text-[13px] tracking-[0.14em] text-[var(--t-muted-ink)] tabular-nums" aria-live="polite">
          {at + 1} / {photos.length}
        </p>
      ) : stops > 1 ? (
        <div className="mt-1 flex items-center justify-center gap-1">
          {Array.from({ length: stops }, (_, i) => (
            <button key={i} type="button" onClick={() => go(i)} aria-label={labels.goTo[i] ?? String(i + 1)} aria-current={i === at ? 'true' : undefined} className="flex size-7 items-center justify-center">
              <span className={`block rounded-full transition-all ${i === at ? 'size-2.5 bg-[var(--t-secondary-ink)]' : 'size-2 bg-[color-mix(in_srgb,var(--t-orn)_55%,transparent)]'}`} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
