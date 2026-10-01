'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Interactive pieces with real depth (CSS 3D). Each works with touch, mouse
 * and keyboard, exposes a proper button, and degrades to a still layout for
 * reduced-motion users (the transitions are disabled in the template styles).
 */

// ─────────────────────────── Photo stack ───────────────────────────

export interface StackPhoto {
  url: string;
  thumbUrl: string;
  label: string;
}

/**
 * A 3D stack of photo cards. Swipe, drag or press "Next" to send the top card
 * to the back; the rest shuffle forward in perspective.
 */
export function PhotoStack({ photos, labels }: { photos: StackPhoto[]; labels: { next: string; previous: string; hint: string } }) {
  const [order, setOrder] = useState(() => photos.map((_, i) => i));
  const [fling, setFling] = useState<null | 'left' | 'right'>(null);
  const start = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);

  useEffect(() => setOrder(photos.map((_, i) => i)), [photos]);

  const advance = (dir: 'left' | 'right') => {
    if (fling || order.length < 2) return;
    setFling(dir);
    window.setTimeout(() => {
      setOrder((o) => (dir === 'left' ? [...o.slice(1), o[0]!] : [o[o.length - 1]!, ...o.slice(0, -1)]));
      setFling(null);
      setDrag(0);
    }, 380);
  };

  const visible = order.slice(0, 4);
  return (
    <div className="mx-auto w-full max-w-xs select-none">
      <div
        className="relative mx-auto aspect-[3/4] w-[78%] [perspective:1100px]"
        onPointerDown={(e) => {
          start.current = e.clientX;
        }}
        onPointerMove={(e) => {
          if (start.current !== null) setDrag(e.clientX - start.current);
        }}
        onPointerUp={() => {
          if (start.current !== null && Math.abs(drag) > 50) advance(drag < 0 ? 'left' : 'right');
          else setDrag(0);
          start.current = null;
        }}
        onPointerCancel={() => {
          start.current = null;
          setDrag(0);
        }}
        style={{ touchAction: 'pan-y' }}
      >
        {visible
          .map((index, depth) => {
            const photo = photos[index]!;
            const top = depth === 0;
            const offset = top && fling ? (fling === 'left' ? -130 : 130) : top ? drag / 3 : 0;
            const style: CSSProperties = {
              transform: top
                ? `translate3d(${offset}%, 0, 0) rotateZ(${offset / 9}deg) rotateY(${offset / 6}deg)`
                : `translate3d(${depth * 7}%, ${depth * -5}%, ${depth * -70}px) rotateZ(${depth % 2 ? 4 : -4}deg)`,
              opacity: top && fling ? 0 : 1 - depth * 0.12,
              zIndex: 10 - depth,
            };
            return (
              <figure
                key={index}
                className="bulava-3d-card absolute inset-0 m-0 overflow-hidden rounded-[calc(var(--t-radius)*1.2)] border-4 border-[var(--t-card)] bg-[var(--t-card)] shadow-[0_24px_50px_-18px_rgba(0,0,0,0.55)]"
                style={style}
                aria-hidden={!top}
              >
                <img src={photo.thumbUrl} alt={top ? photo.label : ''} className="h-full w-full object-cover" draggable={false} loading={depth > 1 ? 'lazy' : 'eager'} />
              </figure>
            );
          })
          .reverse()}
      </div>
      <p className="mt-5 text-center text-xs tracking-[0.3em] uppercase text-[var(--t-muted-ink)]">{labels.hint}</p>
      <div className="mt-3 flex justify-center gap-3">
        <button type="button" onClick={() => advance('right')} className="min-h-11 rounded-full border border-[var(--t-line)] px-5 text-sm" aria-label={labels.previous}>
          ←
        </button>
        <button type="button" onClick={() => advance('left')} className="min-h-11 rounded-full bg-[var(--t-button)] px-5 text-sm font-semibold text-[var(--t-on-button)]" aria-label={labels.next}>
          →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── Flip card ───────────────────────────

/**
 * A card that turns over in 3D when tapped. Each face has a full-size turn
 * button behind its content, so links on a face (directions) stay real links;
 * the hidden face is inert, so keyboard focus never lands on it.
 */
export function FlipCard({ front, back, label, className }: { front: ReactNode; back: ReactNode; label: string; className?: string }) {
  const [flipped, setFlipped] = useState(false);
  const turn = <button type="button" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped} aria-label={label} className="absolute inset-0 z-0 cursor-pointer rounded-[inherit]" />;
  return (
    <div className={`[perspective:1200px] ${className ?? ''}`}>
      <div className="bulava-flip relative h-full w-full [transform-style:preserve-3d]" style={{ transform: flipped ? 'rotateY(180deg)' : undefined }}>
        <div className="relative h-full w-full [backface-visibility:hidden]" inert={flipped}>
          {turn}
          <div className="pointer-events-none relative z-10 h-full">{front}</div>
        </div>
        <div className="absolute inset-0 h-full w-full [backface-visibility:hidden] [transform:rotateY(180deg)]" inert={!flipped}>
          {turn}
          <div className="pointer-events-none relative z-10 h-full [&_a]:pointer-events-auto">{back}</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Curtain reveal ───────────────────────────

/**
 * Velvet curtains over a moment worth revealing (the save-the-date, the couple).
 * Tapping draws them apart in 3D; the content is always in the DOM, so screen
 * readers and search see it regardless.
 */
export function Curtain({ children, label, color }: { children: ReactNode; label: string; color: string }) {
  const [open, setOpen] = useState(false);
  const velvet = `repeating-linear-gradient(90deg, rgba(0,0,0,0.28) 0 6%, rgba(255,255,255,0.08) 9%, rgba(0,0,0,0.22) 14%), linear-gradient(180deg, ${color}, ${color})`;
  return (
    <div className="relative overflow-hidden rounded-[calc(var(--t-radius)*1.2)] [perspective:1400px]">
      <div className={open ? '' : 'pointer-events-none'} aria-hidden={!open ? undefined : undefined}>
        {children}
      </div>
      <div className={`absolute inset-0 flex ${open ? 'pointer-events-none' : ''}`} aria-hidden="true">
        <span className="bulava-curtain h-full w-1/2 origin-left shadow-[inset_-18px_0_30px_rgba(0,0,0,0.35)]" style={{ background: velvet, transform: open ? 'rotateY(78deg) translateX(-30%)' : undefined }} />
        <span className="bulava-curtain h-full w-1/2 origin-right shadow-[inset_18px_0_30px_rgba(0,0,0,0.35)]" style={{ background: velvet, transform: open ? 'rotateY(-78deg) translateX(30%)' : undefined }} />
      </div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="absolute inset-0 flex items-center justify-center" aria-label={label}>
          <span className="bulava-breathe rounded-full border border-[var(--t-accent)] bg-black/35 px-6 py-3 text-sm font-semibold tracking-[0.25em] text-white uppercase shadow-lg backdrop-blur-sm">{label}</span>
        </button>
      ) : null}
    </div>
  );
}
