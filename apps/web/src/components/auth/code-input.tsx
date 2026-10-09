'use client';

import { useEffect, useState, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'inputMode' | 'maxLength'> & { value: string; onChange: (value: string) => void };

/**
 * Six boxes for a one-time code, drawn over one real input, so typing,
 * pasting, the phone's suggested code and screen readers all work as with any
 * field. Only digits are kept. The parent sends the code when the sixth digit
 * arrives.
 */
export function CodeInput({ value, onChange, className, onFocus, onBlur, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  const cells = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  const active = Math.min(value.length, 5);
  const invalid = Boolean(props['aria-invalid']);
  return (
    <div className={cn('relative', className)}>
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        // The caret always sits after the last digit, where the next box lights up.
        onSelect={(e) => {
          const end = e.currentTarget.value.length;
          if (e.currentTarget.selectionStart !== end) e.currentTarget.setSelectionRange(end, end);
        }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        spellCheck={false}
        className="absolute inset-0 z-10 size-full cursor-text rounded-2xl text-base opacity-0"
      />
      <div aria-hidden="true" className="grid grid-cols-6 gap-2 sm:gap-2.5">
        {cells.map((digit, i) => {
          const current = focused && i === active && value.length < 6;
          return (
            <span
              key={i}
              className={cn(
                'grid h-14 place-items-center rounded-2xl border font-mono text-2xl font-semibold text-ink shadow-clay-inset transition-[border-color,box-shadow,background-color] duration-200 motion-reduce:transition-none sm:h-16',
                invalid ? 'border-red-500 bg-white' : current ? 'border-brand-600 bg-white ring-4 ring-brand-100' : digit ? 'border-[#d3bda5] bg-white' : 'border-[#e2d2c0] bg-[#f8f2ea]',
              )}
            >
              {digit || (current ? <span className="h-7 w-0.5 animate-pulse rounded bg-brand-700 motion-reduce:animate-none" /> : null)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Seconds left before something may happen again (another code); `restart` sets a new wait. */
export function useCountdown(initial: number): [number, (seconds: number) => void] {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return [left, setLeft];
}
