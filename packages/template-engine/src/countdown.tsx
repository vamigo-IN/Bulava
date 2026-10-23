'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';

interface Labels {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

function remaining(target: number) {
  const ms = Math.max(0, target - Date.now());
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    seconds: Math.floor(ms / 1000) % 60,
    done: ms === 0,
  };
}

/** One flip-clock leaf: the new number folds down over the old one in 3D. */
function FlipDigit({ value }: { value: string }) {
  const [state, setState] = useState({ shown: value, previous: value, turning: false });
  useEffect(() => {
    setState((s) => (s.shown === value ? s : { shown: value, previous: s.shown, turning: true }));
  }, [value]);
  useEffect(() => {
    if (!state.turning) return;
    const id = window.setTimeout(() => setState((s) => ({ ...s, turning: false })), 600);
    return () => window.clearTimeout(id);
  }, [state.turning, state.shown]);
  const { shown, previous, turning } = state;
  const face = 'absolute inset-x-0 flex justify-center overflow-hidden bg-[var(--t-card)] text-[var(--t-primary-ink)]';
  return (
    <span className="relative block h-16 w-full [perspective:300px] @min-[640px]:h-20" aria-hidden="true">
      <span className={`${face} top-0 h-1/2 items-end rounded-t-[calc(var(--t-radius)*0.8)] border-b border-black/15`}>
        <span className="translate-y-1/2">{shown}</span>
      </span>
      <span className={`${face} bottom-0 h-1/2 items-start rounded-b-[calc(var(--t-radius)*0.8)]`}>
        <span className="-translate-y-1/2">{turning ? previous : shown}</span>
      </span>
      {turning ? (
        <span className={`${face} bulava-flip-leaf top-0 h-1/2 origin-bottom items-end rounded-t-[calc(var(--t-radius)*0.8)] border-b border-black/15 [backface-visibility:hidden]`}>
          <span className="translate-y-1/2">{previous}</span>
        </span>
      ) : null}
    </span>
  );
}

/**
 * A figure that rolls when it changes: the old one rises away as the new one comes up from below
 * (transform and opacity only, so it never repaints the page).
 */
function RollNumber({ value }: { value: string }) {
  const [state, setState] = useState<{ old: string | null; now: string }>({ old: null, now: value });
  useEffect(() => {
    setState((s) => (s.now === value ? s : { old: s.now, now: value }));
  }, [value]);
  return (
    <span className="relative block">
      {state.old !== null ? (
        <span key={`o${state.old}`} className="bulava-roll-out bulava-cd-digit absolute inset-0">
          {state.old}
        </span>
      ) : null}
      <span key={`n${state.now}`} className={state.old !== null ? 'bulava-roll-in bulava-cd-digit block' : 'bulava-cd-digit block'}>
        {state.now}
      </span>
    </span>
  );
}

/**
 * Live countdown. Renders a stable placeholder on the server to avoid hydration mismatch.
 * Variants: boxes, flip (flip-clock leaves), rings (each number in a double ring), inline
 * (one line: "42 days · 8 hours · 30 minutes"), shimmer (Ovo figures in candlelit gold that ink in
 * one after another and roll as they change, colons between them, the units' names beneath).
 */
export function CountdownClock({
  target,
  labels,
  static: isStatic,
  variant = 'boxes',
  ornament,
  caps = true,
}: {
  target: string;
  labels: Labels;
  static?: boolean;
  variant?: 'boxes' | 'flip' | 'rings' | 'inline' | 'ornate' | 'shimmer';
  /** ornate: the drawn separator between the units and the flourish at each end (the left one; the right mirrors it). */
  ornament?: { separator: ReactNode; end: ReactNode };
  /** Spaced capitals for the units' names (Latin script only). */
  caps?: boolean;
}) {
  const t = new Date(target).getTime();
  // Static (thumbnail) mode shows fixed illustrative numbers so server and client render identically.
  const [now, setNow] = useState<ReturnType<typeof remaining> | null>(isStatic ? { days: 42, hours: 8, minutes: 30, seconds: 15, done: false } : null);

  useEffect(() => {
    if (isStatic) return;
    setNow(remaining(t));
    const id = setInterval(() => setNow(remaining(t)), 1000);
    return () => clearInterval(id);
  }, [t, isStatic]);

  const cells: Array<[keyof Labels, number | null]> = [
    ['days', now?.days ?? null],
    ['hours', now?.hours ?? null],
    ['minutes', now?.minutes ?? null],
    ['seconds', now?.seconds ?? null],
  ];

  if (variant === 'ornate') {
    // One row: large lining figures in the band's gold, the units' names under them, a drawn separator between
    // each, and on wide pages a flourish at each end pointing in.
    return (
      <div className="flex items-start justify-center" role="timer" aria-live="off" data-live="">
        {ornament ? (
          <span aria-hidden="true" className="mt-[22px] hidden w-[120px] shrink-0 @min-[1100px]:mr-6 @min-[1100px]:block">
            {ornament.end}
          </span>
        ) : null}
        {cells.map(([key, n], i) => (
          <Fragment key={key}>
            {i && ornament ? (
              <span aria-hidden="true" className="mt-1 flex w-[26px] shrink-0 justify-center text-[var(--t-orn)] @min-[640px]:mt-2 @min-[640px]:w-[68px]">
                {ornament.separator}
              </span>
            ) : null}
            <div className="min-w-0 flex-1 text-center @min-[640px]:w-[160px] @min-[640px]:flex-none">
              <span className="sr-only">
                {n === null ? '–' : n} {labels[key]}
              </span>
              <div aria-hidden="true" className="text-[36px] leading-none font-medium text-[var(--t-accent-ink)] [font-family:var(--t-heading)] [font-variant-numeric:lining-nums_tabular-nums] @min-[640px]:text-[60px]">
                {n === null ? '––' : String(n).padStart(2, '0')}
              </div>
              <div aria-hidden="true" className={`mt-3 text-[var(--t-text)] ${caps ? 'text-[10.5px] tracking-[0.14em] uppercase @min-[640px]:text-[13px] @min-[640px]:tracking-[0.2em]' : 'text-[13px] @min-[640px]:text-[15px]'}`}>
                {labels[key]}
              </div>
            </div>
          </Fragment>
        ))}
        {ornament ? (
          <span aria-hidden="true" className="mt-[22px] hidden w-[120px] shrink-0 -scale-x-100 @min-[1100px]:ml-6 @min-[1100px]:block">
            {ornament.end}
          </span>
        ) : null}
      </div>
    );
  }

  if (variant === 'shimmer') {
    return (
      <div className="flex items-start justify-center gap-[6px] [font-family:var(--font-ovo),Ovo,serif]" role="timer" aria-live="off" data-live="">
        {cells.map(([key, n], i) => (
          <Fragment key={key}>
            {i ? (
              <span aria-hidden="true" className="bulava-cd-sep flex h-[56px] items-center text-[52px] leading-none text-[var(--t-secondary-display)]" style={{ ['--cd-delay' as string]: `${0.25 + (i - 1) * 0.18}s` }}>
                :
              </span>
            ) : null}
            <span className="flex min-w-[64px] flex-col items-center">
              <span className="sr-only">
                {n === null ? '–' : n} {labels[key]}
              </span>
              <span aria-hidden="true" className="block h-[56px] overflow-hidden text-[45px] leading-[56px] [font-variant-numeric:lining-nums_tabular-nums]">
                <span className="bulava-cd-num block text-[var(--t-secondary-display)]" style={{ ['--cd-delay' as string]: `${i * 0.18}s` }}>
                  <RollNumber value={n === null ? '––' : key === 'days' ? String(n) : String(n).padStart(2, '0')} />
                </span>
              </span>
              <span aria-hidden="true" className="bulava-cd-label mt-[8px] text-[19px] leading-[1.2] text-[var(--t-secondary-ink)]" style={{ ['--cd-delay' as string]: `${0.9 + i * 0.18}s` }}>
                {labels[key]}
              </span>
            </span>
          </Fragment>
        ))}
      </div>
    );
  }

  if (variant === 'flip') {
    return (
      <div className="grid grid-cols-4 gap-3" role="timer" aria-live="off" data-live="">
        {cells.map(([key, n]) => {
          const text = n === null ? '––' : String(n).padStart(2, '0');
          return (
            <div key={key} className="text-center">
              <span className="sr-only">
                {text} {labels[key]}
              </span>
              <div className="text-4xl tabular-nums shadow-[0_18px_30px_-18px_rgba(0,0,0,0.6)] [font-family:var(--t-heading)] @min-[640px]:text-5xl">
                <FlipDigit value={text} />
              </div>
              <div className="mt-2 text-[0.65rem] tracking-[0.25em] uppercase text-[var(--t-muted-ink)]">{labels[key]}</div>
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === 'rings') {
    return (
      <div className="grid grid-cols-4 gap-3 @min-[640px]:gap-6" role="timer" aria-live="off" data-live="">
        {cells.map(([key, n]) => (
          <div key={key} className="text-center">
            <div className="relative mx-auto flex aspect-square w-full max-w-24 items-center justify-center rounded-full border-2 border-[var(--t-orn,var(--t-secondary))]">
              <span className="absolute inset-1.5 rounded-full border border-[var(--t-orn,var(--t-secondary))] opacity-50" aria-hidden="true" />
              <span className="text-3xl tabular-nums [font-family:var(--t-heading)] text-[var(--t-primary-ink)] @min-[640px]:text-4xl">{n === null ? '–' : String(n).padStart(2, '0')}</span>
            </div>
            <div className="mt-2 text-[0.65rem] tracking-[0.2em] uppercase text-[var(--t-muted-ink)]">{labels[key]}</div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <p className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1 text-center" role="timer" aria-live="off" data-live="">
        {cells.map(([key, n], i) => (
          <span key={key} className="inline-flex items-baseline gap-1.5">
            {i ? <span aria-hidden="true" className="mr-2 text-[var(--t-orn,var(--t-secondary))]">·</span> : null}
            <span className="text-3xl tabular-nums [font-family:var(--t-heading)] text-[var(--t-primary-ink)]">{n === null ? '–' : String(n).padStart(2, '0')}</span>
            <span className="text-[0.7rem] tracking-[0.2em] uppercase text-[var(--t-muted-ink)]">{labels[key]}</span>
          </span>
        ))}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3" role="timer" aria-live="off" data-live="">
      {cells.map(([key, n]) => (
        <div key={key} className="rounded-[var(--t-radius)] border border-[var(--t-line)] bg-[var(--t-card)] px-2 py-4 text-center shadow-sm">
          <div className="text-3xl tabular-nums [font-family:var(--t-heading)] text-[var(--t-primary-ink)] @min-[640px]:text-4xl">{n === null ? '–' : String(n).padStart(2, '0')}</div>
          <div className="mt-1 text-[0.65rem] tracking-[0.2em] uppercase text-[var(--t-muted-ink)]">{labels[key]}</div>
        </div>
      ))}
    </div>
  );
}
