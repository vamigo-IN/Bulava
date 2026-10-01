'use client';

import { useState } from 'react';
import { FONT_FAMILIES, INTROS, ORNAMENTS, PATTERNS, type FontRef, type ThemeColors } from '@bulava/template-schema';
import { t } from '@/lib/i18n';
import { Card, CardTitle, Field, Input, Select } from '../ui';
import { EditError, type EditorProps } from './common';

const COLOR_KEYS: Array<keyof ThemeColors> = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted'];
/** Families that include Devanagari glyphs themselves. */
const DEVANAGARI_CAPABLE = new Set<string>(['Noto Sans Devanagari', 'Noto Serif Devanagari', 'Tiro Devanagari Hindi', 'Poppins']);
const DEVANAGARI_FALLBACKS = ['Noto Sans Devanagari', 'Noto Serif Devanagari', 'Tiro Devanagari Hindi'] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

type FontSlot = 'heading' | 'body' | 'script';

function fontRef(family: string, fallback: string | undefined): FontRef {
  const deva = DEVANAGARI_CAPABLE.has(family);
  return {
    family: family as FontRef['family'],
    scripts: deva ? ['Latn', 'Deva'] : ['Latn'],
    fallbacks: deva || !fallback ? {} : { Deva: fallback as FontRef['family'] },
  };
}

export function ThemeTab({ definition, edit }: EditorProps) {
  const [error, setError] = useState<string | null>(null);
  const theme = definition.theme;
  const run = (fn: Parameters<EditorProps['edit']>[0]) => setError(edit(fn));

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>{t('theme.colors')}</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {COLOR_KEYS.map((key) => (
            <ColorInput key={`${key}-${theme.colors[key]}`} label={t(`theme.color.${key}`)} value={theme.colors[key]} onCommit={(hex) => run((d) => void (d.theme.colors[key] = hex))} />
          ))}
        </div>
        <div className="mt-4 flex h-10 overflow-hidden rounded-lg border border-stone-200" aria-hidden>
          {COLOR_KEYS.map((key) => (
            <div key={key} className="flex-1" style={{ background: theme.colors[key] }} />
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>{t('studio.tab.theme')}</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t('theme.radius')} · ${theme.radius}px`}>
            {(p) => <input {...p} type="range" min={0} max={48} value={theme.radius} onChange={(e) => run((d) => void (d.theme.radius = Number(e.target.value)))} className="w-full accent-brand-700" />}
          </Field>
          <Field label={t('theme.ornament')}>
            {(p) => (
              <Select {...p} value={theme.ornament} onChange={(e) => run((d) => void (d.theme.ornament = e.target.value as (typeof ORNAMENTS)[number]))}>
                {ORNAMENTS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {definition.type === 'WEBSITE' ? (
            <>
              <Field label={t('theme.pattern')}>
                {(p) => (
                  <Select {...p} value={theme.pattern} onChange={(e) => run((d) => void (d.theme.pattern = e.target.value as (typeof PATTERNS)[number]))}>
                    {PATTERNS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('theme.heroTone')}>
                {(p) => (
                  <Select {...p} value={theme.heroTone} onChange={(e) => run((d) => void (d.theme.heroTone = e.target.value as 'light' | 'dark'))}>
                    <option value="light">{t('theme.heroTone.light')}</option>
                    <option value="dark">{t('theme.heroTone.dark')}</option>
                  </Select>
                )}
              </Field>
              <Field label={t('theme.intro')}>
                {(p) => (
                  <Select
                    {...p}
                    value={definition.website?.intro ?? 'none'}
                    onChange={(e) =>
                      run((d) => {
                        if (d.website) d.website.intro = e.target.value as (typeof INTROS)[number];
                      })
                    }
                  >
                    {INTROS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardTitle>{t('theme.fonts')}</CardTitle>
        <div className="space-y-4">
          {(['heading', 'body', 'script'] as const).map((slot) => (
            <FontRow key={slot} slot={slot} value={definition.fonts[slot]} onChange={(ref) => run((d) => void (d.fonts[slot] = ref as FontRef))} />
          ))}
        </div>
      </Card>
      <EditError message={error} />
    </div>
  );
}

function ColorInput({ label, value, onCommit }: { label: string; value: string; onCommit: (hex: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <Field label={label}>
      {(p) => (
        <div className="flex items-center gap-2">
          <input type="color" aria-label={label} value={value} onChange={(e) => onCommit(e.target.value)} className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-stone-300 bg-white p-1" />
          <Input
            {...p}
            value={text}
            maxLength={7}
            className="font-mono uppercase"
            aria-invalid={HEX.test(text) ? undefined : true}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => (HEX.test(text) ? text.toLowerCase() !== value.toLowerCase() && onCommit(text.toLowerCase()) : setText(value))}
          />
        </div>
      )}
    </Field>
  );
}

function FontRow({ slot, value, onChange }: { slot: FontSlot; value: FontRef | undefined; onChange: (ref: FontRef | undefined) => void }) {
  const family = value?.family ?? '';
  const fallback = value?.fallbacks?.Deva;
  const needsFallback = !!family && !DEVANAGARI_CAPABLE.has(family);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t(`theme.font.${slot}`)}>
        {(p) => (
          <Select {...p} value={family} onChange={(e) => onChange(e.target.value ? fontRef(e.target.value, fallback ?? 'Noto Sans Devanagari') : undefined)}>
            {slot === 'script' ? <option value="">{t('common.none')}</option> : null}
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>
                {f}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {needsFallback ? (
        <Field label={t('theme.font.devanagari')}>
          {(p) => (
            <Select {...p} value={fallback ?? ''} onChange={(e) => onChange(fontRef(family, e.target.value || undefined))}>
              <option value="">{t('common.none')}</option>
              {DEVANAGARI_FALLBACKS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : (
        <div />
      )}
    </div>
  );
}
