'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { BINDINGS, FONT_FAMILIES, PALETTE_KEYS, PATTERNS, VALUE_FORMATS, type ColorRef, type Fill, type ThemeColors, type Value } from '@bulava/template-schema';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button, Input, Select, Textarea } from '../ui';

/** Collapsible group of properties. */
export function Group({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-stone-200">
      <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-semibold tracking-wide text-stone-700 uppercase select-none">
        {title}
        <ChevronDown className="size-3.5 text-stone-400 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-2 px-3 pb-3">{children}</div>
    </details>
  );
}

/** Label on the left, control on the right. */
export function Row({ label, children, htmlFor, compact }: { label: string; children: ReactNode; htmlFor?: string; compact?: boolean }) {
  return (
    <div className={cn('grid items-center gap-2', compact ? 'grid-cols-[52px_minmax(0,1fr)]' : 'grid-cols-[88px_minmax(0,1fr)]')}>
      <label htmlFor={htmlFor} className="truncate text-xs text-stone-600" title={label}>
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const small = 'min-h-8 py-0 text-xs';

/** A number that commits on blur or Enter, so typing "12" does not pass through "1". */
export function NumberField({ label, value, onChange, min, max, step = 1, suffix, id: givenId, compact }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string; id?: string; compact?: boolean }) {
  const auto = useId();
  const id = givenId ?? auto;
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number(text);
    if (!Number.isFinite(n) || text.trim() === '') return setText(String(value));
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    if (clamped !== value) onChange(clamped);
    else setText(String(value));
  };
  return (
    <Row label={label} htmlFor={id} compact={compact}>
      <div className="flex items-center gap-1">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          className={cn(small, 'tabular-nums')}
          value={text}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setText(String(value));
          }}
        />
        {suffix ? <span className="text-xs text-stone-400">{suffix}</span> : null}
      </div>
    </Row>
  );
}

export function SelectField<T extends string>({ label, value, onChange, options, id: givenId, compact }: { label: string; value: T; onChange: (v: T) => void; options: ReadonlyArray<T | { value: T; label: string }>; id?: string; compact?: boolean }) {
  const auto = useId();
  const id = givenId ?? auto;
  return (
    <Row label={label} htmlFor={id} compact={compact}>
      <Select id={id} className={small} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </Select>
    </Row>
  );
}

export function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center gap-2 text-xs text-stone-700">
      <input type="checkbox" className="size-4 rounded border-stone-300 text-brand-700 focus:ring-brand-200" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function TextField({ label, value, onChange, placeholder, list, maxLength = 120 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; list?: string; maxLength?: number }) {
  const id = useId();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <Row label={label} htmlFor={id}>
      <Input id={id} className={cn(small, list ? 'font-mono' : '')} value={text} placeholder={placeholder} list={list} maxLength={maxLength} onChange={(e) => setText(e.target.value)} onBlur={() => text !== value && onChange(text)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    </Row>
  );
}

// ─────────────────────────── Colours ───────────────────────────

const PALETTE_LABEL: Record<(typeof PALETTE_KEYS)[number], string> = { primary: 'Primary', secondary: 'Secondary', accent: 'Accent', background: 'Background', surface: 'Surface', text: 'Text', muted: 'Muted' };

/**
 * A colour reference: one of the palette's roles (follows the host's colours),
 * a fixed hex, or transparent. Palette roles are the designer's friend: the
 * design restyles itself when a host picks another preset.
 */
export function ColorField({ label, value, onChange, colors, allowNone, allowTransparent }: { label: string; value: ColorRef | undefined; onChange: (v: ColorRef | undefined) => void; colors: ThemeColors; allowNone?: boolean; allowTransparent?: boolean }) {
  const isHex = typeof value === 'string' && value.startsWith('#');
  const hex6 = isHex ? value.slice(0, 7) : '#888888';
  const [text, setText] = useState(isHex ? value : '');
  useEffect(() => setText(isHex ? value : ''), [value, isHex]);
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-2">
      <span className="truncate pt-1.5 text-xs text-stone-600" title={label}>
        {label}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1">
          {PALETTE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              title={PALETTE_LABEL[key]}
              aria-label={PALETTE_LABEL[key]}
              aria-pressed={value === key}
              onClick={() => onChange(key)}
              className={cn('size-6 rounded-full border shadow-sm', value === key ? 'ring-2 ring-brand-600 ring-offset-1' : 'border-stone-300')}
              style={{ background: colors[key] }}
            />
          ))}
          <label className={cn('relative size-6 cursor-pointer overflow-hidden rounded-full border border-stone-300 shadow-sm', isHex ? 'ring-2 ring-brand-600 ring-offset-1' : '')} title={t('canvas.color.custom')} style={{ background: isHex ? hex6 : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}>
            <input type="color" aria-label={t('canvas.color.custom')} className="absolute inset-0 size-full cursor-pointer opacity-0" value={hex6} onChange={(e) => onChange(e.target.value as ColorRef)} />
          </label>
          {allowTransparent ? (
            <button type="button" aria-pressed={value === 'transparent'} title={t('canvas.color.transparent')} aria-label={t('canvas.color.transparent')} onClick={() => onChange('transparent')} className={cn('size-6 rounded-full border border-stone-300 bg-[repeating-conic-gradient(#e7e5e4_0%_25%,#fff_0%_50%)] bg-[length:8px_8px]', value === 'transparent' ? 'ring-2 ring-brand-600 ring-offset-1' : '')} />
          ) : null}
          {allowNone ? (
            <Button size="sm" variant={value === undefined ? 'secondary' : 'ghost'} className="min-h-6 px-2 text-[11px]" onClick={() => onChange(undefined)}>
              {t('canvas.color.none')}
            </Button>
          ) : null}
        </div>
        {isHex || text ? (
          <Input
            aria-label={`${label} (hex)`}
            className="mt-1 min-h-7 py-0 font-mono text-xs"
            value={text}
            placeholder="#rrggbb"
            maxLength={9}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(text) && text !== value && onChange(text as ColorRef)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────── Fills ───────────────────────────

export function FillField({ value, onChange, colors, onPickAsset }: { value: Fill; onChange: (f: Fill) => void; colors: ThemeColors; onPickAsset: (cb: (assetId: string) => void) => void }) {
  const types = [
    { value: 'none', label: t('canvas.fill.none') },
    { value: 'color', label: t('canvas.fill.color') },
    { value: 'gradient', label: t('canvas.fill.gradient') },
    { value: 'pattern', label: t('canvas.fill.pattern') },
    { value: 'image', label: t('canvas.fill.image') },
  ] as const;
  const switchTo = (type: Fill['type']) => {
    switch (type) {
      case 'none':
        return onChange({ type: 'none' });
      case 'color':
        return onChange({ type: 'color', color: value.type === 'gradient' ? value.gradient.from : 'surface' });
      case 'gradient':
        return onChange({ type: 'gradient', gradient: { from: value.type === 'color' ? value.color : 'background', to: 'accent', angle: 180 } });
      case 'pattern':
        return onChange({ type: 'pattern', pattern: 'jaali', color: 'secondary', base: 'background', strength: 0.25 });
      case 'image':
        return onPickAsset((assetId) => onChange({ type: 'image', assetId, fit: 'cover' }));
      default:
        return undefined;
    }
  };
  return (
    <>
      <SelectField label={t('canvas.fill.type')} value={value.type} onChange={switchTo} options={types} />
      {value.type === 'color' ? <ColorField label={t('canvas.color')} value={value.color} onChange={(c) => onChange({ type: 'color', color: c ?? 'surface' })} colors={colors} allowTransparent /> : null}
      {value.type === 'gradient' ? (
        <>
          <ColorField label={t('canvas.fill.from')} value={value.gradient.from} onChange={(c) => onChange({ ...value, gradient: { ...value.gradient, from: c ?? 'background' } })} colors={colors} allowTransparent />
          <ColorField label={t('canvas.fill.to')} value={value.gradient.to} onChange={(c) => onChange({ ...value, gradient: { ...value.gradient, to: c ?? 'accent' } })} colors={colors} allowTransparent />
          <NumberField label={t('canvas.fill.angle')} value={value.gradient.angle} min={0} max={360} suffix="°" onChange={(angle) => onChange({ ...value, gradient: { ...value.gradient, angle } })} />
        </>
      ) : null}
      {value.type === 'pattern' ? (
        <>
          <SelectField label={t('canvas.fill.pattern.name')} value={value.pattern} onChange={(pattern) => onChange({ ...value, pattern })} options={PATTERNS.filter((p) => p !== 'none')} />
          <ColorField label={t('canvas.color')} value={value.color} onChange={(c) => onChange({ ...value, color: c ?? 'secondary' })} colors={colors} />
          <ColorField label={t('canvas.fill.base')} value={value.base} onChange={(c) => onChange({ ...value, base: c ?? 'background' })} colors={colors} allowTransparent />
          <NumberField label={t('canvas.fill.strength')} value={value.strength} min={0} max={1} step={0.05} onChange={(strength) => onChange({ ...value, strength })} />
        </>
      ) : null}
      {value.type === 'image' ? (
        <>
          <Row label={t('canvas.image')}>
            <Button size="sm" variant="secondary" className="w-full justify-start truncate font-mono" onClick={() => onPickAsset((assetId) => onChange({ ...value, assetId }))}>
              {value.assetId.slice(0, 8)}…
            </Button>
          </Row>
          <SelectField label={t('canvas.fit')} value={value.fit} onChange={(fit) => onChange({ ...value, fit })} options={['cover', 'contain']} />
          <ColorField label={t('canvas.fill.overlay')} value={value.overlay} onChange={(overlay) => onChange({ ...value, overlay })} colors={colors} allowNone />
        </>
      ) : null}
    </>
  );
}

// ─────────────────────────── Values (content) ───────────────────────────

type Mode = 'literal' | 'binding' | 't' | 'template';

function modeOf(v: Value): Mode {
  if ('literal' in v) return 'literal';
  if ('binding' in v) return 'binding';
  if ('t' in v) return 't';
  return 'template';
}

const TEXT_BINDINGS = Object.entries(BINDINGS)
  .filter(([, b]) => b.type === 'text' || b.type === 'datetime')
  .map(([key]) => key);

/**
 * What a text layer or button says: fixed text, a field of the event (with a
 * date format and a fallback), a translated phrase, or a template mixing text
 * with {{fields}}.
 */
export function ValueField({ label, value, onChange, textSlots, multiline }: { label: string; value: Value; onChange: (v: Value) => void; textSlots: Array<{ key: string; label: string }>; multiline?: boolean }) {
  const mode = modeOf(value);
  const id = useId();
  const [draft, setDraft] = useState(() => ('literal' in value ? String(value.literal) : 'template' in value ? value.template : 't' in value ? value.t : ''));
  useEffect(() => setDraft('literal' in value ? String(value.literal) : 'template' in value ? value.template : 't' in value ? value.t : ''), [value]);
  const switchMode = (m: Mode) => {
    if (m === mode) return;
    const current = 'literal' in value ? String(value.literal) : 'template' in value ? value.template : '';
    switch (m) {
      case 'literal':
        return onChange({ literal: current || 'Text' });
      case 'binding':
        return onChange({ binding: 'event.title' });
      case 't':
        return onChange({ t: 'template.joinUs' });
      default:
        return onChange({ template: current || '{{couple.partnerOne}} & {{couple.partnerTwo}}', fallback: { binding: 'event.title' } });
    }
  };
  const bindingOptions = [...TEXT_BINDINGS, ...textSlots.map((s) => `custom.${s.key}`)];
  const fallbackText = 'binding' in value && value.fallback && 'literal' in value.fallback ? String(value.fallback.literal) : '';
  return (
    <div className="space-y-2">
      <SelectField
        label={label}
        value={mode}
        onChange={switchMode}
        options={[
          { value: 'literal', label: t('canvas.value.literal') },
          { value: 'binding', label: t('canvas.value.binding') },
          { value: 't', label: t('canvas.value.t') },
          { value: 'template', label: t('canvas.value.template') },
        ]}
      />
      {mode === 'literal' || mode === 'template' ? (
        <div>
          {multiline || mode === 'template' ? (
            <Textarea
              id={id}
              aria-label={label}
              rows={mode === 'template' ? 2 : 3}
              className={cn('py-1.5 text-xs', mode === 'template' ? 'font-mono' : '')}
              value={draft}
              maxLength={2000}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                const current = 'literal' in value ? String(value.literal) : 'template' in value ? value.template : '';
                if (draft === current) return;
                onChange(mode === 'literal' ? { literal: draft } : { ...value, template: draft });
              }}
            />
          ) : (
            <Input id={id} aria-label={label} className={small} value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== ('literal' in value ? String(value.literal) : '') && onChange({ literal: draft })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
          )}
          {mode === 'template' ? <p className="mt-1 text-[11px] text-stone-500">{t('canvas.value.templateHint')}</p> : null}
        </div>
      ) : null}
      {mode === 'binding' && 'binding' in value ? (
        <>
          <Row label={t('canvas.value.binding')}>
            <Select className={cn(small, 'font-mono')} value={bindingOptions.includes(value.binding) ? value.binding : ''} onChange={(e) => onChange({ ...value, binding: e.target.value })}>
              {!bindingOptions.includes(value.binding) ? <option value="">{value.binding}</option> : null}
              {bindingOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Row>
          {BINDINGS[value.binding]?.type === 'datetime' ? (
            <SelectField
              label={t('canvas.value.format')}
              value={value.format ?? 'dateWithWeekday'}
              onChange={(format) => onChange({ ...value, format })}
              options={VALUE_FORMATS.filter((f) => f !== 'upper' && f !== 'lower')}
            />
          ) : null}
          <TextField label={t('canvas.value.fallback')} value={fallbackText} onChange={(text) => onChange({ ...value, fallback: text ? { literal: text } : undefined })} />
        </>
      ) : null}
      {mode === 't' && 't' in value ? <TextField label={t('canvas.value.key')} value={value.t} onChange={(key) => onChange({ t: key.trim() || 'template.joinUs' })} list="canvas-t-keys" /> : null}
    </div>
  );
}

const FONT_ROLES = [
  { value: 'heading', label: 'Heading font (theme)' },
  { value: 'body', label: 'Body font (theme)' },
  { value: 'script', label: 'Script font (theme)' },
] as const;

export function FontField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <Row label={label} htmlFor={id}>
      <Select id={id} className={small} value={value} onChange={(e) => onChange(e.target.value)}>
        <optgroup label="Theme">
          {FONT_ROLES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Fixed family">
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </optgroup>
      </Select>
    </Row>
  );
}
