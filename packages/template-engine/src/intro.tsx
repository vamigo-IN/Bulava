'use client';

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { IntroName, StageIntro, ThemeColors } from '@bulava/template-schema';
import { cuspedHead } from './art/kit';
import { easeInOut, RibbonCover, ZipperCover, type CoverProps } from './covers';
import { Crescent, GateLeaf, Lantern, StarField } from './ornaments-signature';
import { StageOpening, type StageOpeningPlan } from './stage/opening';
import { INTRO_DONE_EVENT, isStageOpening } from './stage/openings';

export type IntroVariant = Exclude<IntroName, 'none'>;
export type { StageOpeningPlan } from './stage/opening';

/** Fired when the guest opens the invitation (a user gesture), e.g. to start music. */
export const INTRO_OPEN_EVENT = 'bulava:intro-open';

/** Fired when an opening has finished and the invitation is open (a stage opening: on the hero's rest pose). */
export { INTRO_DONE_EVENT };

/**
 * A stage opening with no stage to play on (the hero redrawn on the canvas without it): its 2D twin,
 * the same idea drawn flat (final.md §3.2).
 */
const STAGE_TWIN: Readonly<Record<StageIntro, IntroVariant>> = { arrival: 'gates', doorway: 'doors', silk: 'curtain', unfold: 'envelope' };

/** How long each opening plays before the overlay is removed (ms). */
const DURATION: Record<IntroVariant, number> = {
  envelope: 1400,
  curtain: 1400,
  doors: 1400,
  gates: 1700,
  seal: 1600,
  lanterns: 2600,
  petals: 2400,
  celestial: 1900,
  scratch: 900,
  // The cover has already moved off when these open: the overlay only fades.
  zipper: 500,
  ribbon: 500,
  // Stage openings (Signature 3D): played on the hero itself by StageOpening (stage/openings.ts OPENING_MS).
  arrival: 2800,
  doorway: 2400,
  silk: 2000,
  unfold: 2400,
  // The flap lifts (1.4 s), the light rises, then the page comes up out of it.
  sealedEnvelope: 2600,
};

/** Openings the guest pulls (ADR-074): the invitation shows through them as they open. */
const PULLED = new Set<IntroVariant>(['zipper', 'ribbon']);

/** Deterministic pseudo-random in [0, 1): identical on server and client (no hydration drift). */
const rand = (i: number, salt = 1) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export interface IntroLabels {
  open: string;
  lanterns: string;
  seal: string;
  scratch: string;
  reveal: string;
  /** "Pull the tag to open" (the zipper). */
  zipper?: string;
  /** "Pull the ribbon to open". */
  ribbon?: string;
  /** Stage openings (Signature 3D): "Tap to enter", "Tap to open the doors", "Lift the silk to enter", "Tap to unfold your invitation". */
  arrival?: string;
  doorway?: string;
  silk?: string;
  unfold?: string;
}

/**
 * "Open your invitation" overlays. Each plays once per browser session per
 * invitation and is skipped for users who prefer reduced motion.
 */
export function IntroOverlay({
  variant,
  monogram,
  labels,
  revealText,
  storageKey,
  colors,
  coverMonogram,
  rootId,
  stage,
  frame,
  children,
}: {
  variant: IntroVariant;
  /** The theme's frame (`theme.dress.frame`): the doors of a `cusped` suite are palace doors (a cusped inlay, brass studs, lotus bosses). */
  frame?: string;
  monogram: string;
  labels: IntroLabels;
  /** Shown under the scratch card (usually the date). */
  revealText?: string;
  storageKey: string;
  /** The invitation's palette: the pulled openings draw their fabric, metal and satin from it. */
  colors?: ThemeColors;
  /** The monogram the pulled openings print ("R & A"); the medallions' `monogram` otherwise. */
  coverMonogram?: string;
  /** The page's root element id: a stage opening finds its hero under it. */
  rootId?: string;
  /** A stage opening's plan (renderer.tsx); without it, or without a stage hero on the page, it plays its 2D twin. */
  stage?: StageOpeningPlan | null;
  children?: ReactNode;
}) {
  const [state, setState] = useState<'closed' | 'opening' | 'gone'>('closed');
  const [twin, setTwin] = useState(false);
  const announced = useRef(false);
  const doneSent = useRef(false);
  const stageKind = isStageOpening(variant) ? variant : null;
  const onStage = !!(stageKind && stage && rootId && !twin);
  // What is drawn: the variant itself, or a stage opening's 2D twin when it has no stage to play on.
  const shown: IntroVariant = stageKind && !onStage ? STAGE_TWIN[stageKind] : variant;
  const openLabel = stageKind ? (labels[stageKind] ?? labels.open) : labels.open;

  // Whether it plays is decided once, after hydration: a stage opening touches the hero only after this says so.
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let skip = false;
    try {
      skip = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!sessionStorage.getItem(storageKey);
    } catch {
      /* storage unavailable: still show the intro */
    }
    if (skip) setState('gone');
    else setChecked(true);
  }, [storageKey]);

  useEffect(() => {
    document.documentElement.style.overflow = state === 'gone' ? '' : 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [state]);

  /** The guest's first touch: the music may start (once). */
  const announce = useCallback(() => {
    if (announced.current) return;
    announced.current = true;
    window.dispatchEvent(new CustomEvent(INTRO_OPEN_EVENT));
  }, []);

  const open = useCallback(() => {
    setState((s) => (s === 'closed' ? 'opening' : s));
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
    announce();
    setTimeout(() => {
      setState('gone');
      if (doneSent.current) return;
      doneSent.current = true;
      window.dispatchEvent(new CustomEvent(INTRO_DONE_EVENT, { detail: { opening: shown } }));
    }, DURATION[shown]);
  }, [announce, storageKey, shown]);

  /** A stage opening has landed on the hero's rest pose (it fired bulava:intro-done itself). */
  const opened = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
    setState('gone');
  }, [storageKey]);
  const toTwin = useCallback(() => setTwin(true), []);

  if (state === 'gone') return null;

  if (onStage && stageKind && stage && rootId) {
    // The overlay draws no stage: it drives the hero's own (stage/opening.tsx). Reduced motion hides it by CSS from first paint.
    return (
      <div data-stage-opening="" className="fixed inset-0 z-50 overflow-hidden">
        <StageOpening
          variant={stageKind}
          rootId={rootId}
          active={checked}
          plan={stage}
          label={openLabel}
          medallion={<Medallion monogram={monogram} />}
          onGesture={announce}
          onOpen={opened}
          onFallback={toTwin}
        />
        <style href="bulava-stage-opening" precedence="bulava">
          {'@media (prefers-reduced-motion: reduce) { [data-stage-opening] { display: none !important; } }'}
        </style>
        {children}
      </div>
    );
  }

  const opening = state === 'opening';
  const fadeDelay = Math.max(0, DURATION[shown] - 700);
  const pulled = PULLED.has(shown) && !!colors;
  // Doors and curtains cover the whole screen and open onto the invitation itself: no backdrop behind them.
  const seeThrough = pulled || shown === 'doors' || shown === 'curtain';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden transition-opacity duration-700 ${seeThrough ? '' : 'bg-[var(--t-bg)]'}`}
      style={{ opacity: opening ? 0 : 1, transitionDelay: opening ? `${fadeDelay}ms` : '0ms' }}
    >
      {shown === 'envelope' ? <Envelope opening={opening} monogram={monogram} label={openLabel} onOpen={open} /> : null}
      {shown === 'sealedEnvelope' ? <SealedEnvelope opening={opening} monogram={coverMonogram ?? monogram} label={openLabel} onOpen={open} /> : null}
      {shown === 'curtain' || shown === 'doors' ? <Panels variant={shown} palace={shown === 'doors' && frame === 'cusped'} opening={opening} monogram={monogram} label={openLabel} onOpen={open} /> : null}
      {shown === 'gates' ? <Gates opening={opening} monogram={monogram} label={openLabel} onOpen={open} /> : null}
      {shown === 'seal' ? <Seal opening={opening} monogram={monogram} label={labels.seal} onOpen={open} /> : null}
      {shown === 'lanterns' ? <Lanterns opening={opening} monogram={monogram} label={labels.lanterns} onOpen={open} /> : null}
      {shown === 'petals' ? <Petals opening={opening} monogram={monogram} label={labels.open} onOpen={open} /> : null}
      {shown === 'celestial' ? <Celestial opening={opening} monogram={monogram} label={labels.open} onOpen={open} /> : null}
      {shown === 'scratch' ? <Scratch opening={opening} monogram={monogram} labels={labels} revealText={revealText} onOpen={open} /> : null}
      {pulled && shown === 'zipper' ? <Pulled cover={ZipperCover} colors={colors} monogram={coverMonogram ?? monogram} label={labels.zipper ?? labels.open} hintAt={0.2} onGesture={announce} onOpen={open} /> : null}
      {pulled && shown === 'ribbon' ? <Pulled cover={RibbonCover} colors={colors} monogram={coverMonogram ?? monogram} label={labels.ribbon ?? labels.open} hintAt={0.13} onGesture={announce} onOpen={open} /> : null}
      {/* Without a palette (an older caller) a pulled opening falls back to the envelope. */}
      {PULLED.has(shown) && !colors ? <Envelope opening={opening} monogram={monogram} label={labels.open} onOpen={open} /> : null}
      {children}
    </div>
  );
}

type PartProps = { opening: boolean; monogram: string; label: string; onOpen: () => void };

function Medallion({ monogram, className }: { monogram: string; className?: string }) {
  return (
    <span
      className={`flex size-24 items-center justify-center rounded-full bg-[var(--t-secondary)] text-3xl text-[var(--t-on-secondary)] shadow-xl ring-4 ring-[var(--t-accent)]/60 [font-family:var(--t-script)] ${className ?? ''}`}
    >
      {monogram}
    </span>
  );
}

function Envelope({ opening, monogram, label, onOpen }: PartProps) {
  return (
    <button type="button" onClick={onOpen} className="group relative flex flex-col items-center" aria-label={label}>
      <div className="relative h-56 w-80 max-w-[85vw]" style={{ perspective: '800px' }}>
        <div className="absolute inset-0 rounded-md bg-[var(--t-primary)] shadow-2xl" />
        <div
          className="absolute inset-x-0 top-0 h-32 origin-top rounded-t-md bg-[var(--t-primary)] brightness-110 transition-transform duration-700"
          style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)', transform: opening ? 'rotateX(180deg)' : 'rotateX(0deg)' }}
        />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[var(--t-primary)] brightness-90" style={{ clipPath: 'polygon(0 100%, 50% 30%, 100% 100%)' }} />
        <div
          className="absolute top-1/2 left-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--t-secondary)] text-2xl text-[var(--t-on-secondary)] shadow-lg ring-4 ring-[var(--t-accent)]/60 transition-all duration-500 [font-family:var(--t-script)] group-hover:scale-105"
          style={{ opacity: opening ? 0 : 1 }}
        >
          {monogram}
        </div>
      </div>
      <span className="mt-8 bulava-breathe text-sm tracking-[0.3em] uppercase text-[var(--t-primary-ink)]">{label}</span>
    </button>
  );
}

/** Twelve directions round a circle (30° steps) for the wax's lobes, without runtime trigonometry. */
const WAX_DIAL: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0.866, 0.5],
  [0.5, 0.866],
  [0, 1],
  [-0.5, 0.866],
  [-0.866, 0.5],
  [-1, 0],
  [-0.866, -0.5],
  [-0.5, -0.866],
  [0, -1],
  [0.5, -0.866],
  [0.866, -0.5],
];

/** The wax pool's outline round (cx, cy): twelve points joined by bulges outward, each a little different. */
function waxOutline(cx: number, cy: number, r: number): string {
  const radius = (i: number) => r * (0.93 + rand(i % 12, 7) * 0.08);
  const at = (i: number, k: number) => [cx + WAX_DIAL[i % 12]![0] * k, cy + WAX_DIAL[i % 12]![1] * k] as const;
  const round = (n: number) => Math.round(n * 100) / 100;
  let d = `M${at(0, radius(0)).map(round).join(' ')}`;
  for (let i = 0; i < 12; i++) {
    const [ax, ay] = WAX_DIAL[i]!;
    const [bx, by] = WAX_DIAL[(i + 1) % 12]!;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const len = Math.sqrt(mx * mx + my * my) || 1;
    const bulge = r * (1.13 + rand(i, 11) * 0.06);
    const end = at(i + 1, radius(i + 1));
    d += ` Q${round(cx + (mx / len) * bulge)} ${round(cy + (my / len) * bulge)} ${round(end[0])} ${round(end[1])}`;
  }
  return `${d}Z`;
}

/** A sprig embossed in paper: a gently curving stem with paired leaves and three small flowers, ~150 units tall. */
function Sprig({ id }: { id: string }) {
  const leaves: ReactNode[] = [];
  for (let k = 0; k < 7; k++) {
    const y = -18 - k * 19;
    const x = Math.round((k % 2 ? 3 : -2) * 10) / 10;
    leaves.push(<ellipse key={`a${k}`} cx={x - 7} cy={y} rx="7" ry="2.6" transform={`rotate(-32 ${x - 7} ${y})`} />);
    leaves.push(<ellipse key={`b${k}`} cx={x + 7} cy={y - 8} rx="6.4" ry="2.4" transform={`rotate(32 ${x + 7} ${y - 8})`} />);
  }
  const flower = (cx: number, cy: number, r: number, key: string) => (
    <g key={key}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={cx} cy={cy - r * 0.9} rx={r * 0.55} ry={r * 0.9} transform={`rotate(${a} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.32} />
    </g>
  );
  return (
    <g id={id} fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
      <path d="M0 0 C7 -40 -7 -84 2 -148" />
      {leaves}
      {flower(-15, -58, 5.5, 'f1')}
      {flower(14, -104, 5, 'f2')}
      {flower(2, -156, 5.5, 'f3')}
    </g>
  );
}

/** Three copies of a shape, so it reads as pressed into the paper: a shadow below, a highlight above, the paper between. */
function Embossed({ href, transform, paper }: { href: string; transform: string; paper: string }) {
  return (
    <g transform={transform}>
      <use href={href} transform="translate(0.9 1)" style={{ color: 'rgba(90, 64, 40, 0.28)' }} />
      <use href={href} transform="translate(-0.7 -0.8)" style={{ color: 'rgba(255, 255, 255, 0.95)' }} />
      <use href={href} style={{ color: paper }} />
    </g>
  );
}

/**
 * The sealed envelope (sealedEnvelope): the whole screen is a portrait envelope of cream paper, its flaps embossed
 * with sprigs, sealed where they meet with a pool of wine wax pressed with the couple's initials; "Tap to open"
 * breathes beneath it over a chevron. On a tap the seal warms, the top flap lifts away on its hinge carrying the seal,
 * light rises from inside and the invitation comes up out of it. Paper, wax and gold come from the palette.
 */
function SealedEnvelope({ opening, monogram, label, onOpen }: PartProps) {
  const id = `env${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const paper = 'color-mix(in srgb, var(--t-surface) 55%, #ffffff)';
  const fold = 'color-mix(in srgb, var(--t-surface) 82%, #ffffff)';
  const inside = 'color-mix(in srgb, var(--t-surface) 70%, var(--t-secondary))';
  const initials = monogram.replace(/\s+/g, '');
  // Sprigs on the flaps: two on each side flap, two on the bottom flap, two on the top flap (which turns with it).
  const sides = ['translate(34 470) scale(1.15)', 'translate(64 300) rotate(4) scale(0.92)', 'translate(326 470) scale(-1.15 1.15)', 'translate(296 300) rotate(-4) scale(-0.92 0.92)', 'translate(118 628) rotate(-14) scale(0.82)', 'translate(242 628) rotate(14) scale(-0.82 0.82)'];
  const top = ['translate(116 230) rotate(-22) scale(0.86)', 'translate(244 230) rotate(22) scale(-0.86 0.86)'];
  return (
    <button type="button" onClick={onOpen} aria-label={label} className="absolute inset-0 flex cursor-pointer items-center justify-center [-webkit-tap-highlight-color:transparent]">
      <span
        className="relative block aspect-[9/16] w-[min(100vw,440px,calc(100dvh*0.5625))] transition-transform duration-[900ms] ease-[cubic-bezier(.3,.1,.2,1)]"
        style={{ perspective: '1400px', transform: opening ? 'scale(1.04)' : 'none', transitionDelay: opening ? '900ms' : '0ms' }}
      >
        {/* The envelope: its inside and the light in it, the side and bottom flaps, the sprigs pressed into them. */}
        <svg viewBox="0 0 360 640" aria-hidden="true" className="absolute inset-0 block h-full w-full drop-shadow-[0_18px_30px_rgba(80,56,30,0.18)]">
          <defs>
            <Sprig id={`${id}s`} />
            <radialGradient id={`${id}l`} cx="50%" cy="34%" r="60%">
              <stop offset="0" stopColor="#fffaf0" />
              <stop offset="0.45" stopColor="#ffe9c4" stopOpacity="0.85" />
              <stop offset="1" stopColor="#ffe9c4" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="360" height="640" style={{ fill: inside }} />
          <rect width="360" height="640" fill={`url(#${id}l)`} className="transition-opacity duration-[1100ms]" style={{ opacity: opening ? 1 : 0, transitionDelay: opening ? '350ms' : '0ms' }} />
          <path d="M0 0 L182 330 L0 640Z" style={{ fill: fold }} />
          <path d="M360 0 L178 330 L360 640Z" style={{ fill: fold }} />
          <path d="M0 0 L182 330 L0 640Z" fill="rgba(90, 64, 40, 0.035)" />
          <path d="M0 640 L180 334 L360 640Z" style={{ fill: paper }} />
          <path d="M0 640 L180 334 L360 640" fill="none" stroke="rgba(90, 64, 40, 0.16)" strokeWidth="1.2" />
          <path d="M1 641 L180 336 L359 641" fill="none" stroke="rgba(255, 255, 255, 0.9)" strokeWidth="1" transform="translate(0 1.6)" />
          {sides.map((tf, i) => (
            <Embossed key={i} href={`#${id}s`} transform={tf} paper={i < 4 ? fold : paper} />
          ))}
        </svg>
        {/* The top flap on its hinge, the seal at its point: it turns up and over, and the seal goes with it. */}
        <span
          className="absolute inset-0 block origin-top transition-transform duration-[1150ms] ease-[cubic-bezier(.55,.05,.25,1)] [transform-style:preserve-3d]"
          style={{ transform: opening ? 'rotateX(178deg)' : 'rotateX(0deg)', transitionDelay: opening ? '260ms' : '0ms' }}
        >
          <svg viewBox="0 0 360 640" aria-hidden="true" className="absolute inset-0 block h-full w-full [backface-visibility:hidden]">
            <defs>
              <Sprig id={`${id}t`} />
            </defs>
            <path d="M0 0 H360 L180 330Z" fill="rgba(90, 64, 40, 0.14)" transform="translate(0 4)" />
            <path d="M0 0 H360 L180 322Z" style={{ fill: paper }} />
            <path d="M0 0 L180 322 L360 0" fill="none" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="1.2" />
            {top.map((tf, i) => (
              <Embossed key={i} href={`#${id}t`} transform={tf} paper={paper} />
            ))}
          </svg>
          <svg viewBox="0 0 360 640" aria-hidden="true" className="absolute inset-0 block h-full w-full [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <path d="M0 0 H360 L180 322Z" style={{ fill: 'color-mix(in srgb, var(--t-surface) 88%, #7a5a36)' }} />
          </svg>
          <span className="absolute top-[50.3%] left-1/2 block w-[31%] -translate-x-1/2 -translate-y-1/2 [backface-visibility:hidden]">
            <svg viewBox="0 0 120 120" aria-hidden="true" className="block h-auto w-full transition-[filter] duration-500" style={{ filter: opening ? 'drop-shadow(0 0 14px rgba(255, 214, 150, 0.9))' : 'drop-shadow(0 6px 8px rgba(60, 10, 18, 0.35))' }}>
              <defs>
                <radialGradient id={`${id}w`} cx="38%" cy="32%" r="74%">
                  <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--t-primary) 72%, #ffffff)' }} />
                  <stop offset="0.5" style={{ stopColor: 'var(--t-primary)' }} />
                  <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--t-primary) 62%, #000000)' }} />
                </radialGradient>
                <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--t-secondary) 60%, #ffffff)' }} />
                  <stop offset="0.5" style={{ stopColor: 'var(--t-secondary)' }} />
                  <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--t-secondary) 75%, #000000)' }} />
                </linearGradient>
              </defs>
              <path d={waxOutline(60, 60, 50)} fill={`url(#${id}w)`} />
              <circle cx="60" cy="60" r="36" style={{ fill: 'color-mix(in srgb, var(--t-primary) 88%, #000000)' }} />
              <circle cx="60" cy="60" r="36" fill="none" style={{ stroke: 'color-mix(in srgb, var(--t-primary) 55%, #000000)' }} strokeWidth="2.2" />
              <circle cx="60.6" cy="60.8" r="32" fill="none" style={{ stroke: 'color-mix(in srgb, var(--t-primary) 70%, #ffffff)' }} strokeWidth="0.7" opacity="0.6" />
              <ellipse cx="45" cy="36" rx="16" ry="6" fill="#ffffff" opacity="0.14" transform="rotate(-28 45 36)" />
              <text x="60" y="70" textAnchor="middle" fontSize={initials.length > 3 ? 22 : 30} fill={`url(#${id}g)`} style={{ fontFamily: 'var(--t-script)' }}>
                {initials}
              </text>
            </svg>
          </span>
        </span>
      </span>
      {/* The prompt, over the envelope's lower half: a chevron pointing up and the words in spaced capitals. */}
      <span className="pointer-events-none absolute bottom-[30%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-[7px] transition-opacity duration-300" style={{ opacity: opening ? 0 : 1 }}>
        <span aria-hidden="true" className="bulava-env-chevron block size-[10px] rotate-[-45deg] border-t-[1.5px] border-r-[1.5px] border-[var(--t-secondary-ink)]" />
        <span className="bulava-env-label text-[11px] tracking-[0.26em] whitespace-nowrap text-[var(--t-secondary-ink)] uppercase [font-family:var(--font-cinzel),Cinzel,Georgia,serif]">{label}</span>
      </span>
    </button>
  );
}

function Panels({ variant, palace = false, opening, monogram, label, onOpen }: PartProps & { variant: 'curtain' | 'doors'; palace?: boolean }) {
  return (
    <button type="button" onClick={onOpen} className="absolute inset-0 flex" aria-label={label}>
      {[0, 1].map((side) => (
        <div
          key={side}
          className="relative h-full w-1/2 bg-[var(--t-primary)] transition-transform duration-1000 ease-in-out"
          style={{
            transform: opening
              ? variant === 'doors'
                ? `perspective(1200px) rotateY(${side === 0 ? '-' : ''}100deg)`
                : `translateX(${side === 0 ? '-100%' : '100%'})`
              : 'none',
            transformOrigin: side === 0 ? 'left center' : 'right center',
            backgroundImage:
              variant === 'curtain'
                ? 'repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0 6px, rgba(255,255,255,0.05) 6px 24px)'
                : 'radial-gradient(120% 55% at 50% 0%, rgba(255,255,255,0.07), transparent 62%), linear-gradient(90deg, rgba(0,0,0,0.15), transparent 30%, transparent 70%, rgba(0,0,0,0.15))',
          }}
        >
          {palace ? <PalaceDoorLeaf side={side} /> : variant === 'doors' ? <div className="absolute inset-6 rounded-t-full border-2 border-[var(--t-secondary)]/70" /> : null}
        </div>
      ))}
      <span className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center transition-opacity duration-300" style={{ opacity: opening ? 0 : 1 }}>
        <Medallion monogram={monogram} />
        {variant === 'doors' ? (
          // On a small pill of the doors' own colour, so the seam and the panels' lines never run through the words.
          <span className="mt-5 bulava-breathe rounded-full bg-[var(--t-primary)] px-5 py-2 text-xs font-semibold tracking-[0.3em] uppercase text-[var(--t-on-primary)] shadow-[0_8px_18px_-10px_rgba(0,0,0,0.6)] ring-1 ring-[color-mix(in_srgb,var(--t-secondary)_70%,transparent)]">{label}</span>
        ) : (
          <span className="mt-6 bulava-breathe text-sm tracking-[0.3em] uppercase text-[var(--t-on-primary)]">{label}</span>
        )}
      </span>
    </button>
  );
}

/** A row of brass studs along one edge of a door leaf, as a CSS pattern (any leaf size keeps their spacing). */
function studs(axis: 'x' | 'y'): CSSProperties {
  const head = 'radial-gradient(circle at 50% 50%, var(--t-secondary) 0 2.6px, color-mix(in srgb, var(--t-secondary) 50%, #000) 2.9px 3.5px, transparent 3.9px)';
  const glint = 'radial-gradient(circle at 44% 40%, rgba(255, 248, 226, 0.9) 0 0.9px, transparent 1.5px)';
  return {
    backgroundImage: `${glint}, ${head}`,
    backgroundSize: axis === 'x' ? '22px 100%' : '100% 22px',
    backgroundRepeat: axis === 'x' ? 'repeat-x' : 'repeat-y',
    backgroundPosition: 'center',
  };
}

/** The cusped head of a door's inlay on a 300 × 120 grid: the outer line ends at x 0 and 300, the inner (8 in) at 9 and 291. */
const DOOR_HEAD_OUTER = cuspedHead(0, 120, 300, 116);
const DOOR_HEAD_INNER = cuspedHead(9, 120, 282, 106);

/**
 * One leaf of the palace doors (a `cusped` suite's opening): brass studs round its edges, a cusped arch inlaid
 * in a double gold hairline on darker lacquer, and a gilt lotus boss with its ring at the middle. The head keeps
 * its proportions on any leaf (the inlay is its own inline-size container), so phones and desktops match.
 */
function PalaceDoorLeaf({ side }: { side: number }) {
  const gold = { stroke: 'var(--t-secondary)' };
  const line = 'color-mix(in srgb, var(--t-secondary) 70%, transparent)';
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span className="absolute top-3 right-3 left-3 h-2.5" style={studs('x')} />
      <span className="absolute right-3 bottom-3 left-3 h-2.5" style={studs('x')} />
      <span className="absolute top-8 bottom-8 left-3 w-2.5" style={studs('y')} />
      <span className="absolute top-8 right-3 bottom-8 w-2.5" style={studs('y')} />
      {/* The meeting stile: a shadowed seam with a gold edge. */}
      <span className={`absolute inset-y-0 w-[3px] ${side === 0 ? 'right-0' : 'left-0'}`} style={{ background: `linear-gradient(${side === 0 ? '90deg' : '270deg'}, rgba(0,0,0,0.3), ${line})` }} />
      <span className="absolute top-[11%] right-[15%] bottom-[7%] left-[15%]" style={{ containerType: 'inline-size' }}>
        <svg viewBox="0 0 300 120" preserveAspectRatio="none" className="absolute inset-x-0 top-0 block h-[40cqw] w-full overflow-visible">
          <path d={`${DOOR_HEAD_OUTER} V120 H0Z`} fill="rgba(0,0,0,0.14)" />
          <path d={DOOR_HEAD_OUTER} fill="none" style={gold} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          <path d={DOOR_HEAD_INNER} fill="none" style={gold} strokeOpacity="0.7" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute inset-x-0 top-[40cqw] bottom-0 border-x-[1.4px] border-b-[1.4px] bg-black/[0.14]" style={{ borderColor: 'var(--t-secondary)' }} />
        <span className="absolute top-[40cqw] right-[3cqw] bottom-[3cqw] left-[3cqw] border-x border-b" style={{ borderColor: line }} />
        <span className="absolute top-1/2 left-1/2 block w-[30cqw] max-w-[88px] -translate-x-1/2 -translate-y-1/2">
          <LotusBoss />
        </span>
      </span>
    </span>
  );
}

/** A gilt lotus boss with a ring hanging from it (a door's pull), in the palette's gold. */
function LotusBoss() {
  const petals: ReactNode[] = [];
  for (let i = 0; i < 8; i++) petals.push(<ellipse key={i} cx="0" cy="-5.2" rx="2.5" ry="5" transform={`rotate(${i * 45})`} />);
  return (
    <svg viewBox="-12 -12 24 34" className="block h-auto w-full drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]">
      <circle r="11" fill="none" style={{ stroke: 'var(--t-secondary)' }} strokeWidth="0.8" />
      <g style={{ fill: 'var(--t-secondary)', stroke: 'color-mix(in srgb, var(--t-secondary) 55%, #000)' }} strokeWidth="0.35">
        {petals}
      </g>
      <circle r="3.2" style={{ fill: 'var(--t-accent)', stroke: 'color-mix(in srgb, var(--t-secondary) 55%, #000)' }} strokeWidth="0.4" />
      <circle cy="11.4" r="1.4" style={{ fill: 'var(--t-secondary)' }} />
      <circle cy="16.6" r="4.6" fill="none" style={{ stroke: 'var(--t-secondary)' }} strokeWidth="1.5" />
    </svg>
  );
}

/** Ornate golden palace gates swinging open. */
function Gates({ opening, monogram, label, onOpen }: PartProps) {
  return (
    <button type="button" onClick={onOpen} className="absolute inset-0 flex bg-[var(--t-primary)]" aria-label={label} style={{ perspective: '1400px' }}>
      <span className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 45%, rgba(255,236,170,0.45), transparent 60%)' }} />
      {[0, 1].map((side) => (
        <span
          key={side}
          className="relative h-full w-1/2 transition-transform duration-[1400ms] ease-[cubic-bezier(.6,.05,.3,1)]"
          style={{ transformOrigin: side === 0 ? 'left center' : 'right center', transform: opening ? `rotateY(${side === 0 ? '-' : ''}105deg)` : 'none' }}
        >
          <span className="absolute inset-0 bg-[var(--t-primary)] brightness-90" />
          <GateLeaf className={`absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] text-[var(--t-secondary)] ${side === 1 ? '-scale-x-100' : ''}`} />
        </span>
      ))}
      <span className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center transition-opacity duration-300" style={{ opacity: opening ? 0 : 1 }}>
        <Medallion monogram={monogram} />
        <span className="mt-6 bulava-breathe text-sm tracking-[0.3em] uppercase text-[var(--t-accent)]">{label}</span>
      </span>
    </button>
  );
}

/** A letter sealed with wax: tap to break the seal. */
function Seal({ opening, monogram, label, onOpen }: PartProps) {
  return (
    <button type="button" onClick={onOpen} className="group relative flex flex-col items-center" aria-label={label}>
      <div className="relative h-60 w-80 max-w-[85vw]" style={{ perspective: '900px' }}>
        <div className="absolute inset-0 rounded-sm bg-[var(--t-surface)] shadow-2xl ring-1 ring-[var(--t-secondary)]/30" />
        <div className="absolute inset-3 border border-[var(--t-secondary)]/40" />
        <div
          className="absolute inset-x-0 top-0 h-36 origin-top bg-[var(--t-surface)] shadow-md ring-1 ring-[var(--t-secondary)]/20 transition-transform delay-500 duration-700"
          style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)', transform: opening ? 'rotateX(180deg)' : 'none' }}
        />
        <div
          className="absolute top-[58%] left-1/2 flex size-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-3xl text-[var(--t-on-primary)] shadow-[inset_0_-6px_12px_rgba(0,0,0,0.35),0_6px_14px_rgba(0,0,0,0.3)] transition-all duration-500 [font-family:var(--t-script)] group-hover:scale-105"
          style={{
            background: 'radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--t-primary) 70%, white), var(--t-primary) 60%)',
            transform: opening ? 'translate(-50%, -50%) scale(1.4) rotate(18deg)' : undefined,
            opacity: opening ? 0 : 1,
            clipPath: 'polygon(50% 0, 62% 6%, 76% 4%, 84% 16%, 96% 24%, 94% 38%, 100% 50%, 94% 62%, 96% 76%, 84% 84%, 76% 96%, 62% 94%, 50% 100%, 38% 94%, 24% 96%, 16% 84%, 4% 76%, 6% 62%, 0 50%, 6% 38%, 4% 24%, 16% 16%, 24% 4%, 38% 6%)',
          }}
        >
          {monogram}
        </div>
      </div>
      <span className="mt-8 bulava-breathe text-sm tracking-[0.3em] uppercase text-[var(--t-primary-ink)]">{label}</span>
    </button>
  );
}

/** Night sky: tap to release the lanterns. */
function Lanterns({ opening, monogram, label, onOpen }: PartProps) {
  const lanterns = Array.from({ length: 16 }, (_, i) => ({
    left: 4 + rand(i) * 88,
    bottom: -4 + rand(i, 2) * 30,
    size: 26 + rand(i, 3) * 30,
    delay: rand(i, 4) * 0.6,
    duration: 1.6 + rand(i, 5) * 1.1,
  }));
  return (
    <button
      type="button"
      onClick={onOpen}
      className="absolute inset-0 overflow-hidden"
      aria-label={label}
      style={{ background: 'linear-gradient(180deg, #05060f 0%, color-mix(in srgb, var(--t-primary) 80%, #05060f) 100%)' }}
    >
      <StarField className="pointer-events-none absolute inset-0 h-full w-full text-[var(--t-accent)] opacity-70" count={36} />
      {lanterns.map((l, i) => (
        <span
          key={i}
          className={`pointer-events-none absolute text-[var(--t-secondary)] ${opening ? 'bulava-rise' : 'bulava-bob'}`}
          style={{ left: `${l.left}%`, bottom: `${l.bottom}%`, width: l.size, animationDelay: `${l.delay}s`, animationDuration: opening ? `${l.duration}s` : `${3 + (i % 4)}s` }}
        >
          <Lantern className="w-full" />
        </span>
      ))}
      <span className="pointer-events-none absolute inset-x-0 top-[34%] flex flex-col items-center transition-opacity duration-500" style={{ opacity: opening ? 0 : 1 }}>
        <Medallion monogram={monogram} className="shadow-[0_0_40px_rgba(255,210,120,0.6)]" />
        <span className="mt-6 bulava-breathe rounded-full bg-black/35 px-4 py-1.5 text-sm tracking-[0.3em] uppercase text-[var(--t-accent)] backdrop-blur-sm">{label}</span>
      </span>
    </button>
  );
}

/** Tap to shower rose and marigold petals. */
function Petals({ opening, monogram, label, onOpen }: PartProps) {
  const petals = Array.from({ length: 42 }, (_, i) => ({
    left: rand(i) * 100,
    delay: rand(i, 2) * 0.9,
    duration: 1.4 + rand(i, 3) * 1.1,
    size: 10 + rand(i, 4) * 12,
    rotate: rand(i, 5) * 360,
    tone: i % 3,
  }));
  return (
    <button type="button" onClick={onOpen} className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden" aria-label={label}>
      <span className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 40%, var(--t-surface), var(--t-bg) 70%)' }} />
      {opening
        ? petals.map((p, i) => (
            <span
              key={i}
              className="bulava-fall pointer-events-none absolute -top-8 rounded-[60%_0_60%_0]"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.size * 0.7,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                transform: `rotate(${p.rotate}deg)`,
                background: p.tone === 0 ? 'var(--t-primary)' : p.tone === 1 ? 'var(--t-secondary)' : 'var(--t-accent)',
                opacity: 0.9,
              }}
            />
          ))
        : null}
      <span className="relative flex flex-col items-center transition-all duration-700" style={{ opacity: opening ? 0 : 1, transform: opening ? 'scale(1.3)' : 'none' }}>
        <span className="pointer-events-none absolute top-12 left-1/2 size-0" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className="absolute rounded-[60%_0_60%_0] transition-transform duration-700 ease-out"
              style={{
                width: 22,
                height: 14,
                left: -11,
                top: -7,
                background: i % 3 === 0 ? 'var(--t-primary)' : i % 3 === 1 ? 'var(--t-secondary)' : 'var(--t-accent)',
                transform: `rotate(${i * 22.5}deg) translateX(${opening ? 180 : 78}px) rotate(45deg)`,
                opacity: 0.85,
              }}
            />
          ))}
        </span>
        <Medallion monogram={monogram} />
        <span className="mt-6 bulava-breathe text-sm tracking-[0.3em] uppercase text-[var(--t-primary-ink)]">{label}</span>
      </span>
    </button>
  );
}

/** Night sky with a crescent; stars rush past as it opens. */
function Celestial({ opening, monogram, label, onOpen }: PartProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="absolute inset-0 overflow-hidden"
      aria-label={label}
      style={{ background: 'radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--t-secondary) 35%, transparent), transparent 60%), linear-gradient(180deg, color-mix(in srgb, var(--t-primary) 70%, #05060f), #05060f)' }}
    >
      <span className="pointer-events-none absolute inset-0 transition-all duration-[1600ms] ease-in" style={{ transform: opening ? 'scale(3)' : 'none', opacity: opening ? 0 : 1 }}>
        <StarField className="h-full w-full text-[var(--t-accent)]" count={60} />
      </span>
      <Crescent
        className="pointer-events-none absolute top-[12%] right-[12%] w-20 text-[var(--t-accent)] transition-transform duration-[1600ms]"
        style={{ transform: opening ? 'translate(40vw, -30vh) scale(0.6)' : 'none' }}
      />
      <span className="pointer-events-none absolute inset-x-0 top-[38%] flex flex-col items-center transition-opacity duration-500" style={{ opacity: opening ? 0 : 1 }}>
        <Medallion monogram={monogram} className="shadow-[0_0_50px_rgba(220,220,255,0.5)]" />
        <span className="mt-6 bulava-breathe rounded-full bg-black/35 px-4 py-1.5 text-sm tracking-[0.3em] uppercase text-[var(--t-accent)] backdrop-blur-sm">{label}</span>
      </span>
    </button>
  );
}

/** A gold-foil card: scratch to reveal the date, or press Reveal. */
function Scratch({ opening, monogram, labels, revealText, onOpen }: { opening: boolean; monogram: string; labels: IntroLabels; revealText?: string; onOpen: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const moves = useRef(0);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const style = getComputedStyle(canvas);
    const gold = style.getPropertyValue('--t-secondary').trim() || '#b8892b';
    const light = style.getPropertyValue('--t-accent').trim() || '#f1d9a0';
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, gold);
    grad.addColorStop(0.45, light);
    grad.addColorStop(0.55, light);
    grad.addColorStop(1, gold);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    // Fine foil texture.
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 240; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#000000';
      ctx.fillRect(rand(i, 7) * width, rand(i, 8) * height, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(40,24,10,0.65)';
    ctx.font = `600 13px ${style.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText(labels.scratch.toUpperCase(), width / 2, height / 2 + 5);
  }, [labels.scratch]);

  const finish = useCallback(() => {
    if (cleared) return;
    setCleared(true);
    setTimeout(onOpen, 700);
  }, [cleared, onOpen]);

  const scratchAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || cleared) return;
    const rect = canvas.getBoundingClientRect();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(clientX - rect.left, clientY - rect.top, 22, 0, Math.PI * 2);
    ctx.fill();
    moves.current += 1;
    if (moves.current % 12 === 0) {
      // Sample the alpha channel sparsely to estimate how much foil is gone.
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let clear = 0;
      let total = 0;
      for (let i = 3; i < data.length; i += 4 * 37) {
        total++;
        if (data[i] === 0) clear++;
      }
      if (total && clear / total > 0.45) finish();
    }
  };

  return (
    <div className="relative flex flex-col items-center px-6 text-center" style={{ opacity: opening ? 0 : 1, transition: 'opacity 400ms' }}>
      <Medallion monogram={monogram} className="mb-6 size-16 text-2xl" />
      <div className="relative h-40 w-72 max-w-[80vw] overflow-hidden rounded-2xl bg-[var(--t-surface)] shadow-2xl ring-1 ring-[var(--t-secondary)]/40">
        <div className="flex h-full flex-col items-center justify-center p-4">
          <span className="text-2xl leading-snug [font-family:var(--t-heading)] text-[var(--t-primary-ink)]">{revealText ?? monogram}</span>
        </div>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none transition-opacity duration-700"
          style={{ opacity: cleared ? 0 : 1, cursor: 'grab' }}
          aria-hidden="true"
          onPointerDown={(e) => {
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            scratchAt(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => drawing.current && scratchAt(e.clientX, e.clientY)}
          onPointerUp={() => (drawing.current = false)}
        />
      </div>
      <button type="button" onClick={finish} className="mt-6 rounded-full border border-[var(--t-primary)] px-5 py-2 text-xs font-semibold tracking-[0.3em] uppercase text-[var(--t-primary-ink)]">
        {labels.reveal}
      </button>
    </div>
  );
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * An opening the guest pulls (ADR-074): drag down to open it as far as the
 * finger goes, and let go past a third to finish (or before, to let it fall
 * back); a tap, Enter or Space opens it all the way. The cover itself is a
 * pure drawing of the moment (covers.tsx), shared with the films.
 */
function Pulled({
  cover: Cover,
  colors,
  monogram,
  label,
  hintAt,
  onGesture,
  onOpen,
}: {
  cover: (props: CoverProps) => ReactNode;
  colors: ThemeColors;
  monogram: string;
  label: string;
  /** Where the hint sits, as a fraction of the screen's height from its foot. */
  hintAt: number;
  onGesture: () => void;
  onOpen: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 844 });
  const [progress, setProgress] = useState(0);
  const [release, setRelease] = useState(0);
  const [dragging, setDragging] = useState(false);
  const frame = useRef<number | null>(null);
  const drag = useRef<{ y: number; from: number; moved: boolean } | null>(null);
  const finished = useRef(false);
  const now = useRef(0);
  now.current = progress;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth || 390, h: el.clientHeight || 844 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const animate = (from: number, to: number, ms: number, set: (n: number) => void, then?: () => void) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const start = performance.now();
    const step = (t: number) => {
      const k = clamp01((t - start) / Math.max(1, ms));
      set(from + (to - from) * easeInOut(k));
      if (k < 1) frame.current = requestAnimationFrame(step);
      else {
        frame.current = null;
        then?.();
      }
    };
    frame.current = requestAnimationFrame(step);
  };

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onGesture();
    const from = now.current;
    animate(from, 1, 300 + 1500 * (1 - from), setProgress, () => animate(0, 1, 650, setRelease, onOpen));
  };

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (finished.current || e.button !== 0) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    drag.current = { y: e.clientY, from: now.current, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 5) d.moved = true;
    if (!d.moved) return;
    const p = clamp01(d.from + dy / (size.h * 0.78));
    setProgress(p);
    if (p > 0.02) onGesture();
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d || finished.current) return;
    if (!d.moved || now.current > 0.32) finish();
    else animate(now.current, 0, 380, setProgress);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      finish();
    }
  };

  return (
    <div
      ref={box}
      role="button"
      tabIndex={0}
      aria-label={label}
      className="absolute inset-0 cursor-grab touch-none select-none focus-visible:outline-none active:cursor-grabbing"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    >
      <Cover progress={progress} release={release} width={size.w} height={size.h} colors={colors} monogram={monogram} script="var(--t-script)" heading="var(--t-heading)" swing={progress === 0 && !dragging} />
      <span
        className="pointer-events-none absolute inset-x-0 flex justify-center transition-opacity duration-300"
        style={{ bottom: `${hintAt * 100}%`, opacity: progress > 0.04 || finished.current ? 0 : 1 }}
      >
        <span className="bulava-breathe rounded-full bg-black/35 px-4 py-1.5 text-xs font-semibold tracking-[0.28em] text-white uppercase backdrop-blur-sm">{label}</span>
      </span>
    </div>
  );
}
