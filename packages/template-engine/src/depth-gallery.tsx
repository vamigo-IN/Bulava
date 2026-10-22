'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

/**
 * The depth gallery (gallery variant `depth`, Signature 3D, spec §3.7): photos stand on a ring that
 * recedes in 3D, each card turned by its place on the ring (rotateY) and pushed out to the rim
 * (translateZ). Swipe or drag, the arrow keys, a trackpad's sideways scroll or the two buttons turn it;
 * it settles on a card with a spring that carries the hand's speed. Depth is drawn with gradients only
 * (a shade across each turned card, a sheen on the front one, a contact shadow on the floor and a faint
 * reflection), never `filter`.
 *
 * The server renders the ring at rest, so the first paint (and a page without JavaScript) already
 * stands in 3D. Reduced motion shows the fallback (the mosaic wall) from first paint by CSS, and
 * nothing runs; the ring breathes only while it is on screen.
 */

export interface DepthPhoto {
  url: string;
  thumbUrl: string;
  /** The accessible name of the card's link ("Open photo 3 of 12"). */
  label: string;
  width?: number;
  height?: number;
}

export interface DepthGalleryLabels {
  next: string;
  previous: string;
  hint: string;
}

/** Fewer photos than this are repeated round the ring, so it always reads as a ring. */
const MIN_SLOTS = 8;
/** Air between neighbouring cards on the rim, as a share of a card's width. */
const GAP = 1.08;
/** The idle breath: a slow sway (degrees, seconds) while the ring is on screen and untouched. */
const BREATH_DEG = 1.4;
const BREATH_PERIOD = 9;
/** The swing-in: a ring that scrolls into view arrives turned by this many cards and settles. */
const SWING_IN = 1.35;
/** The spring that settles the ring (per second²; damping below 1 leaves a whisper of overshoot). */
const STIFFNESS = 118;
const DAMPING_RATIO = 0.82;
/** How long after a drag's release its click may still come (ms): a touch's tap is sent just after the finger lifts. */
const CLICK_AFTER_DRAG_MS = 350;

export interface RingGeometry {
  /** Cards on the ring (photos, repeated when there are few). */
  slots: number;
  /** Degrees between neighbouring cards. */
  step: number;
  /** The rim's radius in card widths. */
  radius: number;
}

/** The ring for n photos: n slots (or n repeated up to at least MIN_SLOTS), sized so neighbours just clear. */
export function ringGeometry(n: number): RingGeometry {
  const count = Math.max(1, Math.floor(n));
  const slots = count >= MIN_SLOTS ? count : count * Math.ceil(MIN_SLOTS / count);
  const step = 360 / slots;
  const radius = Math.max(0.62, (0.5 / Math.tan((step / 2) * (Math.PI / 180))) * GAP);
  return { slots, step, radius: Math.round(radius * 1000) / 1000 };
}

/** An angle folded into (-180, 180]. */
export function wrapDeg(a: number): number {
  const r = ((((a + 180) % 360) + 360) % 360) - 180;
  return r === -180 ? 180 : r;
}

/** A whole slot folded into 0..slots-1. */
export function slotOf(pos: number, slots: number): number {
  return ((Math.round(pos) % slots) + slots) % slots;
}

export interface CardLook {
  opacity: number;
  /** Shade at the card's left and right edges (0..1 black): the edge further from the eye is darker. */
  left: number;
  right: number;
  /** The front card's sheen and reflection strength, 0..1. */
  front: number;
}

/** How a card looks at `rel` degrees from the front (positive: to the right). Pure, so SSR and frames agree. */
export function cardLook(rel: number): CardLook {
  const a = Math.abs(rel);
  const opacity = a <= 72 ? 1 : a >= 112 ? 0 : 1 - (a - 72) / 40;
  const turn = Math.min(1, a / 90);
  const base = 0.04 + 0.34 * turn;
  const far = base + 0.26 * turn;
  const front = Math.max(0, 1 - a / 38);
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    opacity: r3(opacity),
    left: r3(rel > 0 ? base : far),
    right: r3(rel > 0 ? far : base),
    front: r3(front),
  };
}

const STYLES = `
.bulava-dg { container-type: inline-size; position: relative; width: 100%; }
.bulava-dg-stage { --w: min(52cqw, 300px); position: relative; height: calc(var(--w) * 1.78); perspective: calc(var(--w) * 2.6); perspective-origin: 50% 34%; touch-action: pan-y; user-select: none; -webkit-user-select: none; cursor: grab; outline: none; }
.bulava-dg-stage[data-dragging] { cursor: grabbing; }
.bulava-dg-ring { position: absolute; inset: 0; transform-style: preserve-3d; }
.bulava-dg-card { position: absolute; top: calc(var(--w) * 0.08); left: calc(50% - var(--w) / 2); width: var(--w); height: calc(var(--w) * 1.25); transform-style: preserve-3d; display: block; color: inherit; -webkit-tap-highlight-color: transparent; }
.bulava-dg-card:focus { outline: none; }
.bulava-dg-face { position: absolute; inset: 0; overflow: hidden; border-radius: calc(var(--t-radius, 12px) * 1.1); background: var(--t-card, #fff); border: 3px solid var(--t-card, #fff); box-shadow: 0 34px 60px -34px rgba(0,0,0,0.65), 0 2px 6px -2px rgba(0,0,0,0.25); opacity: var(--o, 1); backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.bulava-dg-card:focus-visible .bulava-dg-face { box-shadow: 0 0 0 3px var(--t-bg, #fff), 0 0 0 6px var(--t-button, #333), 0 34px 60px -34px rgba(0,0,0,0.65); }
.bulava-dg-face img { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.bulava-dg-shade { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(90deg, rgba(8,6,4,var(--sl,0)) 0%, rgba(8,6,4,calc(var(--sl,0) * 0.6 + var(--sr,0) * 0.4)) 55%, rgba(8,6,4,var(--sr,0)) 100%); }
.bulava-dg-sheen { position: absolute; inset: 0; pointer-events: none; opacity: var(--front, 0); background: linear-gradient(118deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.08) 26%, rgba(255,255,255,0) 44%), linear-gradient(to top, rgba(0,0,0,0.18), rgba(0,0,0,0) 32%); }
.bulava-dg-glow { position: absolute; left: -14%; right: -14%; top: -10%; bottom: -12%; pointer-events: none; border-radius: 50%; opacity: calc(var(--o, 1) * var(--front, 0) * 0.55); background: radial-gradient(closest-side, color-mix(in srgb, var(--t-accent, #c9a24a) 42%, transparent), transparent); transform: translateZ(-2px); }
.bulava-dg-floor { position: absolute; left: -8%; right: -8%; top: calc(100% - var(--w) * 0.21); height: calc(var(--w) * 0.42); pointer-events: none; opacity: calc(var(--o, 1) * (0.55 + var(--front, 0) * 0.45)); transform: rotateX(90deg); background: radial-gradient(closest-side, rgba(20,10,4,0.38), rgba(20,10,4,0.12) 60%, rgba(20,10,4,0)); }
.bulava-dg-reflect { position: absolute; left: 0; right: 0; top: calc(100% + 4px); height: 34%; overflow: hidden; pointer-events: none; border-radius: calc(var(--t-radius, 12px) * 1.1) calc(var(--t-radius, 12px) * 1.1) 0 0; opacity: calc(var(--o, 1) * (0.3 + var(--front, 0) * 0.25)); backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.bulava-dg-reflect img { position: absolute; top: 0; left: 0; display: block; width: 100%; height: calc(100% / 0.34); object-fit: cover; transform: scaleY(-1); }
.bulava-dg-reflect::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, color-mix(in srgb, var(--t-band, var(--t-bg, #fff)) 35%, transparent) 0%, var(--t-band, var(--t-bg, #fff)) 92%); }
.bulava-dg-bar { margin-top: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 1rem; }
.bulava-dg-btn { display: inline-flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; border-radius: 9999px; border: 1px solid var(--t-line, rgba(0,0,0,0.2)); background: color-mix(in srgb, var(--t-card, #fff) 70%, transparent); color: inherit; cursor: pointer; transition: transform 0.25s cubic-bezier(0.2, 0.7, 0.2, 1), background-color 0.25s ease; }
.bulava-dg-btn[data-primary] { border-color: transparent; background: var(--t-button, #333); color: var(--t-on-button, #fff); }
.bulava-dg-btn:hover { transform: translateY(-1px) scale(1.05); }
.bulava-dg-btn:active { transform: scale(0.94); }
.bulava-dg-btn:focus-visible { outline: 2px solid var(--t-button, #333); outline-offset: 3px; }
.bulava-dg-btn svg { width: 1.1rem; height: 1.1rem; }
.bulava-dg-dots { display: flex; align-items: center; gap: 0.35rem; }
.bulava-dg-dot { width: 0.4rem; height: 0.4rem; border-radius: 9999px; background: currentColor; opacity: 0.28; transition: width 0.45s cubic-bezier(0.2, 0.7, 0.2, 1), opacity 0.45s ease; }
.bulava-dg-dot[data-on] { width: 1.3rem; opacity: 0.85; }
.bulava-dg-hint { margin-top: 0.9rem; text-align: center; font-size: 0.7rem; letter-spacing: 0.3em; text-transform: uppercase; color: var(--t-muted-ink, inherit); }
.bulava-dg-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.bulava-dg-fallback { display: none; }
@media (prefers-reduced-motion: reduce) {
  .bulava-dg-live { display: none; }
  .bulava-dg-fallback { display: block; }
}
`;

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The rest transform of the ring at `deg` of turn. */
function ringTransform(deg: number, radius: number): string {
  return `translateZ(calc(var(--w) * ${-radius})) rotateY(${r3(-deg)}deg)`;
}

function cardVars(look: CardLook): CSSProperties {
  return {
    ['--o' as string]: look.opacity,
    visibility: look.opacity > 0 ? 'visible' : 'hidden',
    ['--sl' as string]: look.left,
    ['--sr' as string]: look.right,
    ['--front' as string]: look.front,
  };
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

/**
 * A ring of up to 12 photos. `fallback` (the mosaic wall, server-rendered by the gallery) is what
 * reduced-motion visitors see instead. `label` names the region (the section's heading).
 */
export function DepthGallery({
  photos,
  labels,
  label,
  fallback,
}: {
  photos: DepthPhoto[];
  labels: DepthGalleryLabels;
  label?: string;
  fallback?: ReactNode;
}) {
  const n = photos.length;
  const { slots, step, radius } = ringGeometry(n);
  const [index, setIndex] = useState(0); // the front slot
  const [said, setSaid] = useState<string>(''); // what the live region reads: the photo a visitor turned to
  const stage = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const cards = useRef<Array<HTMLAnchorElement | null>>([]);
  /** Imperative motion state: continuous position in slots, its velocity and the slot it settles on. */
  const motion = useRef({
    pos: 0,
    vel: 0,
    target: 0,
    dragging: false,
    onScreen: false,
    keyed: false,
    reduced: false,
  });
  const kick = useRef<() => void>(() => {});
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  const turnTo = useRef<(target: number, keyed?: boolean) => void>(() => {});

  useEffect(() => {
    const m = motion.current;
    const ringEl = ring.current;
    const stageEl = stage.current;
    if (!ringEl || !stageEl) return;
    m.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let last = 0;
    let shown = new Float64Array(slots).fill(NaN); // last rel written per card (skip unchanged writes)
    let front = 0;

    const paint = (now: number) => {
      const breath =
        m.onScreen && !m.dragging && !m.reduced
          ? Math.sin((now / 1000 / BREATH_PERIOD) * Math.PI * 2) * BREATH_DEG
          : 0;
      ringEl.style.transform = ringTransform(m.pos * step + breath, radius);
      // Shade follows the turn, not the breath (the breath stays a pure compositor move).
      for (let i = 0; i < slots; i++) {
        const rel = r3(wrapDeg(i * step - m.pos * step));
        if (shown[i] === rel) continue;
        shown[i] = rel;
        const el = cards.current[i];
        if (!el) continue;
        const look = cardLook(rel);
        el.style.setProperty('--o', String(look.opacity));
        el.style.visibility = look.opacity > 0 ? 'visible' : 'hidden';
        el.style.setProperty('--sl', String(look.left));
        el.style.setProperty('--sr', String(look.right));
        el.style.setProperty('--front', String(look.front));
      }
      const f = slotOf(m.pos, slots);
      if (f !== front) {
        front = f;
        setIndex(f);
      }
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      let moving = false;
      if (!m.dragging) {
        const k = STIFFNESS;
        const c = 2 * Math.sqrt(k) * DAMPING_RATIO;
        const force = -k * (m.pos - m.target) - c * m.vel;
        m.vel += force * dt;
        m.pos += m.vel * dt;
        if (Math.abs(m.pos - m.target) < 0.0005 && Math.abs(m.vel) < 0.002) {
          m.pos = m.target;
          m.vel = 0;
        } else moving = true;
        // Keep the numbers small: fold whole turns away once settled.
        if (!moving && Math.abs(m.target) >= slots) {
          const fold = Math.trunc(m.target / slots) * slots;
          m.pos -= fold;
          m.target -= fold;
        }
      }
      paint(now);
      if (moving || m.dragging || (m.onScreen && !m.reduced && !document.hidden)) schedule();
      else last = 0;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    kick.current = () => {
      if (!m.reduced || m.dragging) schedule();
      else {
        // Reduced motion (the live ring is hidden by CSS, but keep it honest): jump.
        m.pos = m.target;
        m.vel = 0;
        paint(performance.now());
      }
    };
    turnTo.current = (target, keyed = false) => {
      m.target = target;
      const list = photosRef.current;
      setSaid(list[slotOf(target, slots) % list.length]?.label ?? '');
      m.keyed = keyed;
      kick.current();
    };

    // A ring still below the fold swings in as it arrives (one that is already on screen never jumps).
    let swing = !m.reduced && stageEl.getBoundingClientRect().top > window.innerHeight;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) m.onScreen = e.isIntersecting;
        if (m.onScreen && swing && !m.dragging && m.pos === m.target) {
          swing = false;
          m.pos = m.target - SWING_IN;
          m.vel = 0;
        }
        if (m.onScreen) schedule();
      },
      { rootMargin: '80px 0px' },
    );
    io.observe(stageEl);
    const onVisibility = () => {
      if (!document.hidden && m.onScreen) schedule();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // A trackpad's sideways scroll turns the ring one card per notch.
    let wheelAcc = 0;
    let wheelAt = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2) return;
      e.preventDefault();
      const now = performance.now();
      if (now - wheelAt > 260) wheelAcc = 0;
      wheelAt = now;
      wheelAcc += e.deltaX;
      if (Math.abs(wheelAcc) > 60) {
        turnTo.current(Math.round(m.target) + Math.sign(wheelAcc));
        wheelAcc = 0;
        wheelAt = now + 220; // one notch per gesture burst
      }
    };
    stageEl.addEventListener('wheel', onWheel, { passive: false });

    shown = new Float64Array(slots).fill(NaN);
    paint(performance.now());
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      stageEl.removeEventListener('wheel', onWheel);
      if (frame) cancelAnimationFrame(frame);
      kick.current = () => {};
    };
  }, [slots, step, radius]);

  // Keyboard turns keep the focus on the front card, so screen readers read the new photo. A turn of several
  // slots (Home, End, keys pressed before the ring settles) passes cards on its way: the focus follows each
  // until the turn reaches its target.
  useEffect(() => {
    const m = motion.current;
    if (!m.keyed) return;
    if (index === slotOf(m.target, slots)) m.keyed = false;
    const active = document.activeElement;
    if (active && ring.current?.contains(active))
      cards.current[index]?.focus({ preventScroll: true });
  }, [index, slots]);

  // Pointer: drag turns the ring 1:1 under the finger; a release carries its speed into the spring.
  const drag = useRef({
    id: -1,
    x0: 0,
    pos0: 0,
    lastX: 0,
    lastT: 0,
    vel: 0,
    moved: false,
    width: 1,
    /** Until when (performance.now()) a click is the one a drag's release sends. */
    until: 0,
  });
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || n < 2) return;
    const d = drag.current;
    const m = motion.current;
    d.id = e.pointerId;
    d.x0 = e.clientX;
    d.lastX = e.clientX;
    d.lastT = performance.now();
    d.pos0 = m.pos;
    d.vel = 0;
    d.moved = false;
    d.width = Math.max(1, cards.current[index]?.offsetWidth ?? 200) * GAP;
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const m = motion.current;
    if (d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    if (!d.moved) {
      if (Math.abs(dx) < 6) return;
      d.moved = true;
      m.dragging = true;
      m.vel = 0;
      stage.current?.setAttribute('data-dragging', '');
      try {
        stage.current?.setPointerCapture(e.pointerId);
      } catch {
        /* the pointer may already be gone */
      }
    }
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT) / 1000;
    const v = -(e.clientX - d.lastX) / d.width / dt;
    d.vel = d.vel * 0.7 + v * 0.3;
    d.lastX = e.clientX;
    d.lastT = now;
    m.pos = d.pos0 - dx / d.width;
    kick.current();
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const m = motion.current;
    if (d.id !== e.pointerId) return;
    d.id = -1;
    if (!d.moved) return;
    // A mouse's release clicks at once and a touch's just after (a swipe sends none): only that click is the drag's.
    d.until = performance.now() + CLICK_AFTER_DRAG_MS;
    stage.current?.removeAttribute('data-dragging');
    m.dragging = false;
    const vel = Math.max(-6, Math.min(6, d.vel));
    m.vel = vel;
    const throwTo = Math.round(m.pos + vel * 0.22);
    turnTo.current(Math.max(Math.round(m.pos) - 3, Math.min(Math.round(m.pos) + 3, throwTo)));
  };
  const onClickCapture = (e: MouseEvent) => {
    // A drag never opens a photo; a later click (Enter on the front card, a screen reader's activation) is the visitor's own.
    const d = drag.current;
    if (d.moved && performance.now() < d.until) {
      e.preventDefault();
      e.stopPropagation();
      d.moved = false;
    }
  };

  const by = (delta: number, keyed = false) =>
    turnTo.current(Math.round(motion.current.target) + delta, keyed);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement;
    const onButton = target.closest('button');
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      by(e.key === 'ArrowRight' ? 1 : -1, !onButton);
    } else if ((e.key === 'Home' || e.key === 'End') && !onButton) {
      e.preventDefault();
      const m = motion.current;
      const here = Math.round(m.target);
      const photo = slotOf(here, slots) % n;
      // Home: the first photo, End: the last, by the shortest way round.
      const want = e.key === 'Home' ? 0 : n - 1;
      let delta = want - photo;
      if (delta > slots / 2) delta -= slots;
      if (delta < -slots / 2) delta += slots;
      turnTo.current(here + delta, true);
    }
  };

  const current = index % Math.max(1, n);
  return (
    <>
      <style href="bulava-depth-gallery" precedence="bulava">
        {STYLES}
      </style>
      <div
        className="bulava-dg bulava-dg-live"
        role="region"
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        <div
          ref={stage}
          className="bulava-dg-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
          onDragStart={(e) => e.preventDefault()}
        >
          <div
            ref={ring}
            className="bulava-dg-ring"
            style={{ transform: ringTransform(0, radius) }}
          >
            {Array.from({ length: slots }, (_, i) => {
              const photo = photos[i % n]!;
              const isFront = i === index;
              const near = Math.abs(wrapDeg(i * step)) <= step * 1.5;
              const dims =
                photo.width && photo.height ? { width: photo.width, height: photo.height } : {};
              return (
                <a
                  key={i}
                  ref={(el) => {
                    cards.current[i] = el;
                  }}
                  href={photo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bulava-dg-card"
                  aria-label={photo.label}
                  aria-hidden={isFront ? undefined : true}
                  tabIndex={isFront ? 0 : -1}
                  draggable={false}
                  onClick={(e) => {
                    if (isFront) return;
                    // A card at the side comes to the front first.
                    e.preventDefault();
                    const m = motion.current;
                    let delta = i - slotOf(m.target, slots);
                    if (delta > slots / 2) delta -= slots;
                    if (delta < -slots / 2) delta += slots;
                    turnTo.current(Math.round(m.target) + delta);
                  }}
                  style={{
                    transform: `rotateY(${r3(i * step)}deg) translateZ(calc(var(--w) * ${radius}))`,
                    ...cardVars(cardLook(wrapDeg(i * step))),
                  }}
                >
                  <span className="bulava-dg-glow" aria-hidden="true" />
                  <span className="bulava-dg-floor" aria-hidden="true" />
                  <span className="bulava-dg-reflect" aria-hidden="true">
                    <img
                      src={photo.thumbUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  </span>
                  <span className="bulava-dg-face">
                    <img
                      src={photo.thumbUrl}
                      alt=""
                      loading={near ? 'eager' : 'lazy'}
                      decoding="async"
                      draggable={false}
                      {...dims}
                    />
                    <span className="bulava-dg-shade" />
                    <span className="bulava-dg-sheen" />
                  </span>
                </a>
              );
            })}
          </div>
        </div>
        <div className="bulava-dg-bar">
          <button
            type="button"
            className="bulava-dg-btn"
            aria-label={labels.previous}
            onClick={() => by(-1)}
          >
            <Chevron dir="left" />
          </button>
          {n <= 12 ? (
            <span className="bulava-dg-dots" aria-hidden="true">
              {photos.map((ph, i) => (
                <span
                  key={ph.url + i}
                  className="bulava-dg-dot"
                  data-on={i === current ? '' : undefined}
                />
              ))}
            </span>
          ) : null}
          <button
            type="button"
            className="bulava-dg-btn"
            data-primary=""
            aria-label={labels.next}
            onClick={() => by(1)}
          >
            <Chevron dir="right" />
          </button>
        </div>
        <p className="bulava-dg-hint">{labels.hint}</p>
        <p className="bulava-dg-sr" aria-live="polite">
          {said}
        </p>
      </div>
      {fallback ? <div className="bulava-dg-fallback">{fallback}</div> : null}
    </>
  );
}
