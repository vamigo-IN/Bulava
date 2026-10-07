'use client';

import { useEffect, useState, type CSSProperties } from 'react';

function remaining(target: number) {
  const ms = Math.max(0, target - Date.now());
  return { days: Math.floor(ms / 86_400_000), hours: Math.floor(ms / 3_600_000) % 24, minutes: Math.floor(ms / 60_000) % 60, seconds: Math.floor(ms / 1000) % 60 };
}

export interface CanvasCountdownProps {
  variant: 'boxes' | 'flip' | 'inline';
  /** ISO start of the function or event; null shows placeholders. */
  target: string | null;
  /** Static renders (thumbnails, the editor) show fixed illustrative numbers, so server and client agree. */
  isStatic: boolean;
  /** Days, hours, minutes, seconds. */
  labels: [string, string, string, string];
  /** Styles are computed by the server renderer in design units, so no functions cross into this client component. */
  numberStyle: CSSProperties;
  labelStyle: CSSProperties;
  boxStyle: CSSProperties;
  gap: string;
  inlineGap: string;
}

/** The live countdown inside an artboard. */
export function CanvasCountdown({ variant, target, isStatic, labels, numberStyle, labelStyle, boxStyle, gap, inlineGap }: CanvasCountdownProps) {
  const time = target ? new Date(target).getTime() : null;
  const [now, setNow] = useState<ReturnType<typeof remaining> | null>(isStatic || time === null ? { days: 42, hours: 8, minutes: 30, seconds: 15 } : null);
  useEffect(() => {
    if (isStatic || time === null) return;
    setNow(remaining(time));
    const id = setInterval(() => setNow(remaining(time)), 1000);
    return () => clearInterval(id);
  }, [time, isStatic]);
  const cells: Array<[string, number | null]> = [
    [labels[0], now?.days ?? null],
    [labels[1], now?.hours ?? null],
    [labels[2], now?.minutes ?? null],
    [labels[3], now?.seconds ?? null],
  ];
  const digit = (n: number | null) => (n === null ? '––' : String(n).padStart(2, '0'));

  if (variant === 'inline') {
    return (
      <div role="timer" aria-live="off" style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: inlineGap, textAlign: 'center' }}>
        {cells.map(([label, n], i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap }}>
            <span style={numberStyle}>{digit(n)}</span>
            <span style={{ ...labelStyle, marginTop: 0 }}>{label.slice(0, 3)}</span>
            {i < 3 ? <span style={{ ...numberStyle, opacity: 0.4 }}>:</span> : null}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div role="timer" aria-live="off" style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'stretch', gap, textAlign: 'center' }}>
      {cells.map(([label, n]) => (
        <div key={label} style={boxStyle}>
          {variant === 'flip' ? <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(0,0,0,0.12)' }} /> : null}
          <span style={numberStyle}>{digit(n)}</span>
          <span style={labelStyle}>{label}</span>
        </div>
      ))}
    </div>
  );
}
