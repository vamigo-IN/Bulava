'use client';

import { useState } from 'react';
import {
  FONT_FAMILIES,
  INTROS,
  isStageIntro,
  LOOKS,
  ORNAMENTS,
  PATTERNS,
  SUITE_CORNERS,
  SUITE_DIVIDERS,
  SUITE_EDGES,
  SUITE_FRAMES,
  SUITE_SEALS,
  SUITE_SKYLINES,
  templateStage,
  THEME_MOTIONS,
  type FontRef,
  type LookName,
  type ThemeColors,
  type ThemeDress,
  type ThemeMotion,
} from '@bulava/template-schema';
import { t } from '@/lib/i18n';
import { Card, CardTitle, Field, Input, Select } from '../ui';
import { EditError, type EditorProps } from './common';

const COLOR_KEYS: Array<Exclude<keyof ThemeColors, 'deep'>> = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted'];

/** The primary taken a third of the way to black: the deep band when a palette sets none (the engine's deepOf). */
function derivedDeep(primary: string): string {
  const n = Number.parseInt(primary.slice(1), 16);
  return `#${[16, 8, 0].map((s) => Math.round(((n >> s) & 255) * 0.66).toString(16).padStart(2, '0')).join('')}`;
}
/** Families that include Devanagari glyphs themselves. */
const DEVANAGARI_CAPABLE = new Set<string>(['Noto Sans Devanagari', 'Noto Serif Devanagari', 'Tiro Devanagari Hindi', 'Poppins']);
const DEVANAGARI_FALLBACKS = ['Noto Sans Devanagari', 'Noto Serif Devanagari', 'Tiro Devanagari Hindi'] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

type FontSlot = 'heading' | 'body' | 'script';

/** The suite's pieces a theme may swap (theme.dress, docs/templates.md#section-suites); unset is the suite's own. */
const DRESS_PIECES = [
  ['frame', SUITE_FRAMES],
  ['edge', SUITE_EDGES],
  ['seal', SUITE_SEALS],
  ['skyline', SUITE_SKYLINES],
  ['corner', SUITE_CORNERS],
  ['divider', SUITE_DIVIDERS],
] as const satisfies ReadonlyArray<readonly [keyof ThemeDress, readonly string[]]>;

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
          {theme.colors.deep ? <div className="flex-1" style={{ background: theme.colors.deep }} /> : null}
        </div>
        {/* The deep band's own colour (optional): shown and kept when the palette has one. */}
        <div className="mt-4 border-t border-stone-100 pt-4">
          <p className="mb-2 text-xs text-stone-500">{t('theme.color.deepHint')}</p>
          {theme.colors.deep ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <ColorInput key={`deep-${theme.colors.deep}`} label={t('theme.color.deep')} value={theme.colors.deep} onCommit={(hex) => run((d) => void (d.theme.colors.deep = hex))} />
              </div>
              <button type="button" className="min-h-10 text-sm text-stone-600 underline underline-offset-2" onClick={() => run((d) => void delete d.theme.colors.deep)}>
                {t('theme.color.deepRemove')}
              </button>
            </div>
          ) : (
            <button type="button" className="min-h-10 text-sm font-medium text-brand-700 underline underline-offset-2" onClick={() => run((d) => void (d.theme.colors.deep = derivedDeep(d.theme.colors.primary)))}>
              {t('theme.color.deepAdd')}
            </button>
          )}
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
              <Field label={t('theme.look')}>
                {(p) => (
                  <Select {...p} value={theme.look} onChange={(e) => run((d) => void (d.theme.look = e.target.value as LookName))}>
                    {LOOKS.map((o) => (
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
              <p className="text-xs text-stone-500 sm:col-span-2">{t('theme.dress.hint')}</p>
              {DRESS_PIECES.map(([piece, options]) => (
                <Field key={piece} label={t(`theme.dress.${piece}`)}>
                  {(p) => (
                    <Select
                      {...p}
                      value={theme.dress?.[piece] ?? ''}
                      onChange={(e) =>
                        run((d) => {
                          const dress: Record<string, string> = { ...(d.theme.dress ?? {}) };
                          if (e.target.value) dress[piece] = e.target.value;
                          else delete dress[piece];
                          if (Object.keys(dress).length) d.theme.dress = dress as ThemeDress;
                          else delete d.theme.dress;
                        })
                      }
                    >
                      <option value="">{t('theme.dress.own')}</option>
                      {options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ))}
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
                    {/* The 3D openings move through a stage hero (ADR-078): offered when the first section is one. */}
                    {INTROS.filter((o) => !isStageIntro(o) || templateStage(definition) || o === definition.website?.intro).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('theme.motion')}>
                {(p) => (
                  <Select
                    {...p}
                    value={theme.motion ?? ''}
                    onChange={(e) =>
                      run((d) => {
                        if (e.target.value) d.theme.motion = e.target.value as ThemeMotion;
                        else delete d.theme.motion;
                      })
                    }
                  >
                    <option value="">{t('theme.motion.none')}</option>
                    {THEME_MOTIONS.map((o) => (
                      <option key={o} value={o}>
                        {t(`theme.motion.${o}`)}
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
