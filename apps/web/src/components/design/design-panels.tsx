'use client';

import { useRef, useState } from 'react';
import { fontStack } from '@bulava/template-engine';
import type { MessageKey } from '@bulava/localization';
import { EFFECTS, FONT_PAIRINGS, INTROS, type Customization, type EffectName, type IntroName, type PhotoSlot, type TemplateDefinition, type ThemeColors } from '@bulava/template-schema';
import { MusicPicker } from '@/components/events/music-picker';
import { Alert, Input, Textarea } from '@/components/ui/primitives';
import { useT } from '@/lib/i18n';
import type { MediaItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { uploadDesignPhoto } from './upload-design-photo';

type Set = (next: Customization) => void;

interface PanelProps {
  definition: TemplateDefinition;
  custom: Customization;
  setCustom: Set;
}

// ─────────────────────────── Style: colours and typography ───────────────────────────

const COLOR_KEYS = ['primary', 'secondary', 'accent', 'background'] as const;

export function StylePanel({ definition, custom, setCustom }: PanelProps) {
  const t = useT();
  const caps = definition.capabilities;
  const presets = caps.colorPresets;
  const base: ThemeColors = presets.find((p) => p.name === custom.colorPreset)?.colors ?? definition.theme.colors;
  const sample = 'Riya & Aman';

  return (
    <div className="space-y-8">
      {caps.editable.colors ? (
        <section className="space-y-4">
          {presets.length ? (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{t('design.colors.presets')}</legend>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => {
                  const on = custom.colorPreset === preset.name && !custom.colors;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setCustom({ ...custom, colorPreset: preset.name, colors: undefined })}
                      aria-pressed={on}
                      className={cn('flex items-center gap-2 rounded-full border px-3 py-2 text-sm', on ? 'border-brand-700 bg-brand-50' : 'border-gold-200 bg-white hover:border-gold-400')}
                    >
                      <span className="flex">
                        {[preset.colors.primary, preset.colors.accent, preset.colors.background].map((c, i) => (
                          <span key={i} className="-ml-1.5 size-5 rounded-full border-2 border-white shadow-sm first:ml-0" style={{ background: c }} />
                        ))}
                      </span>
                      {preset.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{t('design.colors.custom')}</legend>
            <div className="flex flex-wrap gap-4">
              {COLOR_KEYS.map((key) => (
                <label key={key} className="flex flex-col items-center gap-1.5 text-xs text-stone-600">
                  <input
                    type="color"
                    value={custom.colors?.[key] ?? base[key]}
                    onChange={(e) => setCustom({ ...custom, colors: { ...custom.colors, [key]: e.target.value } })}
                    className="size-12 cursor-pointer rounded-xl border border-gold-200 bg-white p-1"
                  />
                  {t(`design.color.${key}`)}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-500">{t('design.colors.note')}</p>
            {custom.colors ? (
              <button type="button" className="mt-2 text-sm font-medium text-brand-700 underline" onClick={() => setCustom({ ...custom, colors: undefined })}>
                {t('design.colors.reset')}
              </button>
            ) : null}
          </fieldset>
        </section>
      ) : null}

      {caps.editable.fonts ? (
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">{t('design.fonts')}</legend>
          <p className="mb-3 text-xs text-stone-500">{t('design.fonts.note')}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <FontCard
              label={t('design.fonts.template')}
              selected={!custom.fontPairing}
              onClick={() => setCustom({ ...custom, fontPairing: undefined })}
              heading={fontStack(definition.fonts.heading, 'serif')}
              script={fontStack(definition.fonts.script ?? definition.fonts.heading, 'cursive')}
              sample={sample}
            />
            {FONT_PAIRINGS.map((p) => (
              <FontCard
                key={p.key}
                label={p.label}
                selected={custom.fontPairing === p.key}
                onClick={() => setCustom({ ...custom, fontPairing: p.key })}
                heading={fontStack(p.fonts.heading, 'serif')}
                script={fontStack(p.fonts.script ?? p.fonts.heading, 'cursive')}
                sample={sample}
              />
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

function FontCard({ label, selected, onClick, heading, script, sample }: { label: string; selected: boolean; onClick: () => void; heading: string; script: string; sample: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn('rounded-2xl border bg-white px-3 py-3 text-left transition-colors', selected ? 'border-brand-700 ring-2 ring-brand-700/20' : 'border-gold-200 hover:border-gold-400')}
    >
      <span className="block truncate text-2xl leading-tight text-brand-700" style={{ fontFamily: script }}>
        {sample}
      </span>
      <span className="mt-1 block text-xs tracking-[0.2em] uppercase text-stone-600" style={{ fontFamily: heading }}>
        {label}
      </span>
    </button>
  );
}

// ─────────────────────────── Photos: named places and the gallery ───────────────────────────

export function PhotosPanel({ definition, custom, setCustom, eventId, photos, onUploaded }: PanelProps & { eventId: string; photos: MediaItem[]; onUploaded: (p: MediaItem) => void }) {
  const t = useT();
  const caps = definition.capabilities;
  const slots = caps.photoSlots ?? [];
  const byId = new Map(photos.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-600">{t('design.photo.note')}</p>
      {slots.length ? (
        <ul className="space-y-3">
          {slots.map((slot) => (
            <PhotoSlotRow
              key={slot}
              slot={slot}
              photo={custom.photoSlots?.[slot] ? byId.get(custom.photoSlots[slot]!) : undefined}
              photos={photos}
              eventId={eventId}
              onUploaded={onUploaded}
              onChange={(id) => {
                const next = { ...custom.photoSlots };
                if (id) next[slot] = id;
                else delete next[slot];
                setCustom({ ...custom, photoSlots: next });
              }}
            />
          ))}
        </ul>
      ) : null}

      {caps.maxPhotos > 0 && photos.length ? (
        <fieldset>
          <legend className="text-sm font-semibold">{t('design.photo.extra')}</legend>
          <p className="mb-2 text-xs text-stone-500">{t('design.photo.extraHint', { count: caps.maxPhotos })}</p>
          <div className="grid grid-cols-5 gap-2">
            {photos.slice(0, 30).map((p) => {
              const chosen = custom.photoIds?.includes(p.id) ?? false;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={chosen}
                  aria-label={t('design.photo.choose')}
                  onClick={() => {
                    const ids = custom.photoIds ?? [];
                    const next = chosen ? ids.filter((x) => x !== p.id) : [...ids, p.id].slice(0, caps.maxPhotos);
                    setCustom({ ...custom, photoIds: next });
                  }}
                  className={cn('relative aspect-square overflow-hidden rounded-lg border-2', chosen ? 'border-brand-700' : 'border-transparent')}
                >
                  <img src={p.thumbUrl ?? p.viewUrl} alt="" className="h-full w-full object-cover" />
                  {chosen ? <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-brand-700 text-[10px] text-white">{(custom.photoIds?.indexOf(p.id) ?? 0) + 1}</span> : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

function PhotoSlotRow({
  slot,
  photo,
  photos,
  eventId,
  onChange,
  onUploaded,
}: {
  slot: PhotoSlot;
  photo: MediaItem | undefined;
  photos: MediaItem[];
  eventId: string;
  onChange: (id: string | null) => void;
  onUploaded: (p: MediaItem) => void;
}) {
  const t = useT();
  const file = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const upload = async (f: File) => {
    setBusy(true);
    setFailed(false);
    try {
      const uploaded = await uploadDesignPhoto(eventId, f);
      onUploaded(uploaded);
      onChange(uploaded.id);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = '';
    }
  };

  return (
    <li className="rounded-2xl border border-gold-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-dashed border-gold-300 bg-sand">
          {photo ? <img src={photo.thumbUrl ?? photo.viewUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-2xl text-gold-500">✦</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t(`design.photo.${slot}` as MessageKey)}</p>
          <p className="text-xs text-stone-500">{busy ? t('design.photo.uploading') : photo ? '' : t('design.photo.empty')}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <button type="button" className="font-medium text-brand-700 underline disabled:opacity-50" disabled={busy} onClick={() => file.current?.click()}>
              {t('design.photo.upload')}
            </button>
            {photos.length ? (
              <button type="button" className="font-medium text-brand-700 underline" aria-expanded={picking} onClick={() => setPicking((v) => !v)}>
                {t('design.photo.choose')}
              </button>
            ) : null}
            {photo ? (
              <button type="button" className="text-stone-600 underline" onClick={() => onChange(null)}>
                {t('design.photo.remove')}
              </button>
            ) : null}
          </div>
        </div>
        <input
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
      </div>
      {failed ? (
        <div className="mt-2">
          <Alert>{t('design.photo.failed')}</Alert>
        </div>
      ) : null}
      {picking ? (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {photos.slice(0, 30).map((p) => (
            <button
              key={p.id}
              type="button"
              aria-label={t('design.photo.choose')}
              onClick={() => {
                onChange(p.id);
                setPicking(false);
              }}
              className={cn('aspect-square overflow-hidden rounded-lg border-2', photo?.id === p.id ? 'border-brand-700' : 'border-transparent hover:border-gold-300')}
            >
              <img src={p.thumbUrl ?? p.viewUrl} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

// ─────────────────────────── Words ───────────────────────────

export function WordsPanel({ definition, custom, setCustom }: PanelProps) {
  const slots = definition.capabilities.textSlots;
  return (
    <div className="space-y-3">
      {slots.map((slot) => (
        <label key={slot.key} className="block text-sm">
          <span className="font-medium text-stone-700">{slot.label}</span>
          {slot.maxLength > 160 ? (
            <Textarea className="mt-1" maxLength={slot.maxLength} value={custom.custom?.[slot.key] ?? ''} onChange={(e) => setCustom({ ...custom, custom: { ...custom.custom, [slot.key]: e.target.value } })} />
          ) : (
            <Input className="mt-1" maxLength={slot.maxLength} value={custom.custom?.[slot.key] ?? ''} onChange={(e) => setCustom({ ...custom, custom: { ...custom.custom, [slot.key]: e.target.value } })} />
          )}
        </label>
      ))}
    </div>
  );
}

// ─────────────────────────── Motion & music ───────────────────────────

const EFFECT_ICONS: Record<EffectName, string> = { none: '○', petals: '🌸', marigold: '🏵️', goldDust: '✨', fireflies: '🪲', confetti: '🎊', lanterns: '🏮', snow: '❄️' };

export function MotionPanel({ definition, custom, setCustom }: PanelProps) {
  const t = useT();
  const caps = definition.capabilities;
  const intro = custom.intro ?? definition.website?.intro ?? 'none';
  const effect = custom.effect ?? definition.theme.effect ?? 'none';
  return (
    <div className="space-y-8">
      {caps.editable.animation ? (
        <>
          <fieldset>
            <legend className="text-sm font-semibold">{t('design.motion.opening')}</legend>
            <p className="mb-3 text-xs text-stone-500">{t('design.motion.openingNote')}</p>
            <div className="grid grid-cols-2 gap-2">
              {INTROS.map((name: IntroName) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={intro === name}
                  onClick={() => setCustom({ ...custom, intro: name })}
                  className={cn('rounded-xl border px-3 py-2.5 text-left text-sm first-letter:uppercase', intro === name ? 'border-brand-700 bg-brand-50' : 'border-gold-200 bg-white hover:border-gold-400')}
                >
                  {name === 'none' ? t('design.motion.none') : t(`intro.name.${name}` as MessageKey)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-semibold">{t('design.motion.effect')}</legend>
            <p className="mb-3 text-xs text-stone-500">{t('design.motion.effectNote')}</p>
            <div className="flex flex-wrap gap-2">
              {EFFECTS.map((name: EffectName) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={effect === name}
                  onClick={() => setCustom({ ...custom, effect: name })}
                  className={cn('flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm', effect === name ? 'border-brand-700 bg-brand-50' : 'border-gold-200 bg-white hover:border-gold-400')}
                >
                  <span aria-hidden="true">{EFFECT_ICONS[name]}</span>
                  {t(`effect.${name}` as MessageKey)}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}
      {caps.editable.music ? <MusicPicker value={custom.musicId} onChange={(musicId) => setCustom({ ...custom, musicId })} /> : null}
    </div>
  );
}

// ─────────────────────────── Sections ───────────────────────────

export function SectionsPanel({ definition, custom, setCustom }: PanelProps) {
  const t = useT();
  // The hero stays: a hero section, or a canvas design opening the page.
  const sections = (definition.website?.pages[0]?.sections ?? []).filter((s, i) => s.section !== 'hero' && !(i === 0 && s.section === 'canvas'));
  const hidden = new Set(custom.hiddenSections ?? []);
  return (
    <div>
      <p className="mb-4 text-sm text-stone-600">{t('design.sections.note')}</p>
      <ul className="divide-y divide-gold-100 rounded-2xl border border-gold-200 bg-white">
        {sections.map((s) => {
          const shown = !hidden.has(s.id);
          return (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm font-medium">{t(`design.section.${s.section}` as MessageKey)}</span>
              <button
                type="button"
                role="switch"
                aria-checked={shown}
                aria-label={t(`design.section.${s.section}` as MessageKey)}
                onClick={() => {
                  const next = new Set(hidden);
                  if (shown) next.add(s.id);
                  else next.delete(s.id);
                  setCustom({ ...custom, hiddenSections: [...next] });
                }}
                className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', shown ? 'bg-emerald-700' : 'bg-stone-300')}
              >
                <span className={cn('absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform', shown && 'translate-x-5')} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
