'use client';

import { useEffect, useState } from 'react';

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
    <span className="relative block h-16 w-full [perspective:300px] sm:h-20" aria-hidden="true">
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

/** Live countdown. Renders a stable placeholder on the server to avoid hydration mismatch. */
export function CountdownClock({ target, labels, static: isStatic, variant = 'boxes' }: { target: string; labels: Labels; static?: boolean; variant?: 'boxes' | 'flip' }) {
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

  if (variant === 'flip') {
    return (
      <div className="grid grid-cols-4 gap-3" role="timer" aria-live="off">
        {cells.map(([key, n]) => {
          const text = n === null ? '––' : String(n).padStart(2, '0');
          return (
            <div key={key} className="text-center">
              <span className="sr-only">
                {text} {labels[key]}
              </span>
              <div className="text-4xl tabular-nums shadow-[0_18px_30px_-18px_rgba(0,0,0,0.6)] [font-family:var(--t-heading)] sm:text-5xl">
                <FlipDigit value={text} />
              </div>
              <div className="mt-2 text-[0.65rem] tracking-[0.25em] uppercase text-[var(--t-muted-ink)]">{labels[key]}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3" role="timer" aria-live="off">
      {cells.map(([key, n]) => (
        <div key={key} className="rounded-[var(--t-radius)] border border-[var(--t-line)] bg-[var(--t-card)] px-2 py-4 text-center shadow-sm">
          <div className="text-3xl tabular-nums [font-family:var(--t-heading)] text-[var(--t-primary-ink)] sm:text-4xl">{n === null ? '–' : String(n).padStart(2, '0')}</div>
          <div className="mt-1 text-[0.65rem] tracking-[0.2em] uppercase text-[var(--t-muted-ink)]">{labels[key]}</div>
        </div>
      ))}
    </div>
  );
}
