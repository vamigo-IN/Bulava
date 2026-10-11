'use client';

import { useId, type ReactNode } from 'react';
import { PALETTE_KEYS, type ColorRef, type ThemeColors } from '@bulava/template-schema';
import { useOptionalT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Small building blocks of the editors' panels (cards and the invitation's canvas): clay surfaces, as the rest of the site, light or dark (EditorFrame). */

export function PanelSection({ title, hint, actions, children, className }: { title: string; hint?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {hint ? <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{hint}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  active,
  disabled,
  className,
  tone = 'light',
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  tone?: 'light' | 'plain';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'light' ? (active ? 'btn-3d' : 'btn-3d btn-3d-light') : active ? 'bg-brand-700 text-ivory' : 'text-stone-700 hover:bg-sand/80 hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A choice of a few options as a pressed-in track, the chosen one raised. */
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: Array<{ value: T; label: string; icon?: ReactNode }>; value: T; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="clay-inset flex gap-1 rounded-xl p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.label}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors duration-200',
            value === o.value ? 'bg-surface text-brand-700 shadow-clay-sm' : 'text-stone-600 hover:text-ink',
          )}
        >
          {o.icon}
          {o.icon ? <span className="sr-only">{o.label}</span> : o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const id = useId();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <label htmlFor={id} className="font-medium text-stone-700">
          {label}
        </label>
        <span className="text-stone-500 tabular-nums">{format ? format(value) : value}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-brand-700" />
    </div>
  );
}

const hexOf = (ref: ColorRef, colors: ThemeColors): string => {
  if (ref === 'transparent') return '#ffffff';
  if (ref.startsWith('#')) return ref.slice(0, 7);
  return colors[ref as keyof ThemeColors] ?? '#000000';
};

/** A colour: one of the card's palette colours (they follow palette changes), or any colour. */
export function ColorField({ label, value, colors, onChange, allowNone }: { label: string; value: ColorRef; colors: ThemeColors; onChange: (v: ColorRef) => void; allowNone?: boolean }) {
  const t = useOptionalT();
  const id = useId();
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-stone-700" id={id}>
        {label}
      </p>
      <div role="group" aria-labelledby={id} className="flex flex-wrap items-center gap-1.5">
        {PALETTE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            title={t(`cards.palette.${key}`)}
            aria-label={t(`cards.palette.${key}`)}
            aria-pressed={value === key}
            onClick={() => onChange(key)}
            className={cn('size-7 rounded-full border-2 shadow-clay-sm transition-transform duration-150 hover:scale-110', value === key ? 'border-brand-700 ring-2 ring-brand-200' : 'border-white')}
            style={{ background: colors[key] }}
          />
        ))}
        {allowNone ? (
          <button
            type="button"
            title={t('cards.color.none')}
            aria-label={t('cards.color.none')}
            aria-pressed={value === 'transparent'}
            onClick={() => onChange('transparent')}
            className={cn(
              'size-7 rounded-full border-2 bg-[linear-gradient(135deg,#fff_45%,#dc2626_45%,#dc2626_55%,#fff_55%)] shadow-clay-sm',
              value === 'transparent' ? 'border-brand-700 ring-2 ring-brand-200' : 'border-white',
            )}
          />
        ) : null}
        <label className={cn('relative size-7 cursor-pointer overflow-hidden rounded-full border-2 shadow-clay-sm', value.startsWith('#') ? 'border-brand-700 ring-2 ring-brand-200' : 'border-white')} title={t('cards.color.custom')}>
          <span className="absolute inset-0 bg-[conic-gradient(#ef4444,#f59e0b,#84cc16,#06b6d4,#6366f1,#d946ef,#ef4444)]" aria-hidden />
          <input type="color" aria-label={t('cards.color.custom')} value={hexOf(value, colors)} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  );
}

/** The look of every input and select in the editors' panels. */
export const FIELD =
  'block w-full rounded-xl border border-[var(--ed-field-line)] bg-[var(--ed-field)] text-sm text-stone-900 shadow-clay-inset placeholder:text-stone-500 focus:border-brand-600 focus:bg-surface focus:ring-4 focus:ring-brand-100 focus:outline-none';

/** A number with a short label inside the box (X, Y, W, H, size), as design tools show them. */
export function NumberField({
  label,
  short,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  /** Shown inside the box; `label` is what screen readers say. */
  short: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const id = useId();
  const shown = Number.isInteger(step) ? Math.round(value) : Math.round(value * 100) / 100;
  return (
    <div className={cn(FIELD, 'flex min-h-10 items-center gap-1.5 px-2.5 focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100')}>
      <label htmlFor={id} className="w-4 shrink-0 text-center text-[0.6875rem] font-semibold text-stone-500" title={label}>
        <span aria-hidden>{short}</span>
        <span className="sr-only">{label}</span>
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={shown}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(v)) onChange(min !== undefined || max !== undefined ? Math.min(max ?? v, Math.max(min ?? v, v)) : v);
        }}
        className="min-w-0 flex-1 bg-transparent text-sm text-stone-900 tabular-nums focus:outline-none"
      />
      {suffix ? <span className="shrink-0 text-xs text-stone-500">{suffix}</span> : null}
    </div>
  );
}

/** A labelled select in the editors' look. */
export function SelectField({ label, value, onChange, children, hideLabel }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode; hideLabel?: boolean }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'mb-1 block text-xs font-medium text-stone-700'}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(FIELD, 'min-h-10 px-2')}>
        {children}
      </select>
    </div>
  );
}

export function TextField({
  id: fixedId,
  label,
  value,
  onChange,
  multiline,
  placeholder,
  type = 'text',
  maxLength,
  hint,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  hint?: ReactNode;
}) {
  const ownId = useId();
  const id = fixedId ?? ownId;
  const field = cn(FIELD, 'px-3');
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-stone-700">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} rows={3} className={cn(field, 'min-h-20 py-2 leading-relaxed')} />
      ) : (
        <input id={id} type={type} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} className={cn(field, 'min-h-10')} />
      )}
      {hint ? <div className="mt-1 text-xs text-stone-500">{hint}</div> : null}
    </div>
  );
}
