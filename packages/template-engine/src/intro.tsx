'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { IntroName } from '@bulava/template-schema';
import { Crescent, GateLeaf, Lantern, StarField } from './ornaments-signature';

export type IntroVariant = Exclude<IntroName, 'none'>;

/** Fired when the guest opens the invitation (a user gesture), e.g. to start music. */
export const INTRO_OPEN_EVENT = 'bulava:intro-open';

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
};

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
  children,
}: {
  variant: IntroVariant;
  monogram: string;
  labels: IntroLabels;
  /** Shown under the scratch card (usually the date). */
  revealText?: string;
  storageKey: string;
  children?: ReactNode;
}) {
  const [state, setState] = useState<'closed' | 'opening' | 'gone'>('closed');

  useEffect(() => {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || sessionStorage.getItem(storageKey)) setState('gone');
    } catch {
      /* storage unavailable: still show the intro */
    }
  }, [storageKey]);

  useEffect(() => {
    document.documentElement.style.overflow = state === 'gone' ? '' : 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [state]);

  const open = useCallback(() => {
    setState((s) => (s === 'closed' ? 'opening' : s));
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(INTRO_OPEN_EVENT));
    setTimeout(() => setState('gone'), DURATION[variant]);
  }, [storageKey, variant]);

  if (state === 'gone') return null;
  const opening = state === 'opening';
  const fadeDelay = Math.max(0, DURATION[variant] - 700);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[var(--t-bg)] transition-opacity duration-700"
      style={{ opacity: opening ? 0 : 1, transitionDelay: opening ? `${fadeDelay}ms` : '0ms' }}
    >
      {variant === 'envelope' ? <Envelope opening={opening} monogram={monogram} label={labels.open} onOpen={open} /> : null}
      {variant === 'curtain' || variant === 'doors' ? <Panels variant={variant} opening={opening} monogram={monogram} label={labels.open} onOpen={open} /> : null}
      {variant === 'gates' ? <Gates opening={opening} monogram={monogram} label={labels.open} onOpen={open} /> : null}
      {variant === 'seal' ? <Seal opening={opening} monogram={monogram} label={labels.seal} onOpen={open} /> : null}
      {variant === 'lanterns' ? <Lanterns opening={opening} monogram={monogram} label={labels.lanterns} onOpen={open} /> : null}
      {variant === 'petals' ? <Petals opening={opening} monogram={monogram} label={labels.open} onOpen={open} /> : null}
      {variant === 'celestial' ? <Celestial opening={opening} monogram={monogram} label={labels.open} onOpen={open} /> : null}
      {variant === 'scratch' ? <Scratch opening={opening} monogram={monogram} labels={labels} revealText={revealText} onOpen={open} /> : null}
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

function Panels({ variant, opening, monogram, label, onOpen }: PartProps & { variant: 'curtain' | 'doors' }) {
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
                : 'linear-gradient(90deg, rgba(0,0,0,0.15), transparent 30%, transparent 70%, rgba(0,0,0,0.15))',
          }}
        >
          {variant === 'doors' ? <div className="absolute inset-6 rounded-t-full border-2 border-[var(--t-secondary)]/70" /> : null}
        </div>
      ))}
      <span className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center transition-opacity duration-300" style={{ opacity: opening ? 0 : 1 }}>
        <Medallion monogram={monogram} />
        <span className="mt-6 bulava-breathe text-sm tracking-[0.3em] uppercase text-[var(--t-on-primary)]">{label}</span>
      </span>
    </button>
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
