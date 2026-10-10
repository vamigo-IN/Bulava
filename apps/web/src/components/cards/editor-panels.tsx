'use client';

import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Lock, LockOpen, Plus, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { CanvasArtboard, ILLUSTRATION_ASPECT, layerLabel, themeStyle } from '@bulava/template-engine';
import {
  ArtboardSchema,
  CARD_FORMAT_KEYS,
  CARD_LANGUAGES,
  CARD_MAX_FUNCTIONS,
  cardDetailsShown,
  cardFunctionsShown,
  heroCanvas,
  isCardTextValue,
  resolveValue,
  type CardDesign,
  type CardDetailKey,
  type CardFunction,
  type CardFormat,
  type ColorRef,
  type Layer,
  type PaletteKey,
  type TextLayer,
  type ThemeColors,
} from '@bulava/template-schema';
import { cn } from '@/lib/utils';
import { ColorField, PanelSection, Segmented, TextField } from './editor-ui';
import {
  COUPLE_OCCASIONS,
  detailLayer,
  freePhotoBinding,
  HONOREE_OCCASIONS,
  ORNAMENT_CHOICES,
  ornamentAspect,
  ornamentLayer,
  PALETTES,
  photoLayer,
  restack,
  SHAPE_CHOICES,
  shapeLayer,
  textLayer,
  type TextPreset,
} from './editor-model';
import type { CardEditorApi } from './editor-types';

export type PanelKey = 'details' | 'text' | 'colors' | 'photos' | 'elements' | 'size';

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', hi: 'हिन्दी', 'hi-Latn': 'Hinglish' };

/** A text layer's words as the card shows them. */
export function textOf(editor: Pick<CardEditorApi, 'ctx' | 'cardT' | 'design'>, layer: TextLayer): string {
  const value = resolveValue(layer.content, editor.ctx, { t: editor.cardT, language: editor.design.language, timeZone: editor.ctx.event.timezone });
  return value === undefined ? '' : String(value);
}

const isLinked = (layer: TextLayer) => !('literal' in layer.content);

// ─────────────────────────── Details ───────────────────────────

export function DetailsPanel({ editor, occasions }: { editor: CardEditorApi; occasions: Array<{ key: string; name: string }> }) {
  const { design, t, template } = editor;
  const shown = useMemo(() => cardDetailsShown(design.board), [design.board]);
  const timeline = useMemo(() => cardFunctionsShown(design.board), [design.board]);
  const set = (key: CardDetailKey, value: string) => editor.change((d) => ({ ...d, details: { ...d.details, [key]: value } }), `detail:${key}`);
  // The functions the card lists (its timeline): functions[0], functions[1]… on the card follow them.
  const functions = design.details.functions;
  const setFunctions = (next: CardFunction[], group?: string) => editor.change((d) => ({ ...d, details: { ...d.details, functions: next } }), group);
  const setFunction = (i: number, key: keyof CardFunction, value: string) =>
    setFunctions(
      functions.map((f, j) => (j === i ? { ...f, [key]: value } : f)),
      `function:${i}:${key}`,
    );
  const couple = COUPLE_OCCASIONS.has(design.eventType);
  const honoree = HONOREE_OCCASIONS.has(design.eventType);
  const languages = template.definition.languages.filter((l) => (CARD_LANGUAGES as readonly string[]).includes(l));
  const occasionChoices = occasions.filter((o) => template.eventTypes.includes(o.key));

  const add = (key: CardDetailKey) => {
    const layer = detailLayer(design.board, key);
    editor.addLayer(layer);
  };
  const hint = (key: CardDetailKey): ReactNode =>
    shown.has(key) ? null : (
      <button type="button" onClick={() => add(key)} className="inline-flex items-center gap-1 font-semibold text-brand-700 underline-offset-2 hover:underline">
        <Plus aria-hidden className="size-3.5" /> {t('cards.details.addToCard')}
      </button>
    );
  const field = (key: CardDetailKey, label: string, extra: { multiline?: boolean; type?: string; maxLength?: number } = {}) => (
    <TextField label={label} value={design.details[key]} onChange={(v) => set(key, v)} hint={hint(key)} {...extra} />
  );

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-stone-600">{t('cards.details.intro')}</p>
      {occasionChoices.length > 1 || languages.length > 1 ? (
        <div className="grid grid-cols-2 gap-3">
          {occasionChoices.length > 1 ? (
            <label className="block text-xs font-medium text-stone-700">
              {t('cards.details.occasion')}
              <select
                value={design.eventType}
                onChange={(e) => {
                  if (window.confirm(t('cards.details.occasionConfirm'))) editor.restart(e.target.value);
                }}
                className="mt-1 block min-h-10 w-full rounded-xl border border-[#e2d2c0] bg-[#f8f2ea] px-2 text-sm shadow-clay-inset focus:border-brand-600 focus:outline-none"
              >
                {occasionChoices.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {languages.length > 1 ? (
            <label className="block text-xs font-medium text-stone-700">
              {t('cards.details.language')}
              <select
                value={design.language}
                onChange={(e) => editor.change((d) => ({ ...d, language: e.target.value as CardDesign['language'] }))}
                className="mt-1 block min-h-10 w-full rounded-xl border border-[#e2d2c0] bg-[#f8f2ea] px-2 text-sm shadow-clay-inset focus:border-brand-600 focus:outline-none"
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_NAMES[l] ?? l}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <PanelSection title={t('cards.details.people')}>
        {couple ? (
          <div className="grid grid-cols-2 gap-3">
            {field('partnerOne', t('cards.details.bride'), { maxLength: 60 })}
            {field('partnerTwo', t('cards.details.groom'), { maxLength: 60 })}
          </div>
        ) : honoree ? (
          field('honoree', t('cards.details.honoree'), { maxLength: 80 })
        ) : null}
        {field('title', t('cards.details.eventTitle'), { maxLength: 120 })}
        {field('family', t('cards.details.family'), { multiline: true, maxLength: 400 })}
      </PanelSection>

      <PanelSection title={t('cards.details.when')}>
        <div className="grid grid-cols-2 gap-3">
          {field('date', t('cards.details.date'), { type: 'date' })}
          {field('time', t('cards.details.time'), { type: 'time' })}
        </div>
      </PanelSection>

      {timeline > 0 || functions.length > 0 ? (
        <PanelSection title={t('cards.details.functions')}>
          <ol className="space-y-3">
            {functions.map((f, i) => (
              <li key={i} className="space-y-2 rounded-2xl bg-white/60 p-3 ring-1 ring-[#eadfcf]">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <TextField label={t('cards.details.functionName', { n: i + 1 })} value={f.name} onChange={(v) => setFunction(i, 'name', v)} maxLength={60} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFunctions(functions.filter((_, j) => j !== i))}
                    aria-label={t('cards.details.functionRemove', { n: i + 1 })}
                    title={t('cards.details.functionRemove', { n: i + 1 })}
                    className="mb-0.5 grid size-10 shrink-0 place-items-center rounded-xl text-stone-500 transition-colors hover:bg-red-50 hover:text-red-700"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label={t('cards.details.date')} type="date" value={f.date} onChange={(v) => setFunction(i, 'date', v)} />
                  <TextField label={t('cards.details.time')} type="time" value={f.time} onChange={(v) => setFunction(i, 'time', v)} />
                </div>
              </li>
            ))}
          </ol>
          {functions.length < CARD_MAX_FUNCTIONS ? (
            <button
              type="button"
              onClick={() => setFunctions([...functions, { name: '', date: '', time: '' }])}
              className="btn-3d btn-3d-light mt-3 min-h-10 w-full justify-center gap-1.5 rounded-xl text-sm"
            >
              <Plus aria-hidden className="size-4" />
              {t('cards.details.functionAdd')}
            </button>
          ) : null}
        </PanelSection>
      ) : null}

      <PanelSection title={t('cards.details.where')}>
        {field('venue', t('cards.details.venue'), { maxLength: 120 })}
        {field('address', t('cards.details.address'), { multiline: true, maxLength: 200 })}
        {field('city', t('cards.details.city'), { maxLength: 80 })}
      </PanelSection>

      <PanelSection title={t('cards.details.messageTitle')}>{field('message', t('cards.details.message'), { multiline: true, maxLength: 300 })}</PanelSection>
    </div>
  );
}

// ─────────────────────────── Text ───────────────────────────

const PRESETS: TextPreset[] = ['heading', 'subheading', 'body', 'script'];

export function TextPanel({ editor }: { editor: CardEditorApi }) {
  const { design, t } = editor;
  const texts = design.board.layers.filter((l): l is TextLayer => l.kind === 'text').sort((a, b) => a.frame.y - b.frame.y);
  return (
    <div className="space-y-6">
      <PanelSection title={t('cards.text.add')}>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => editor.addLayer(textLayer(design.board, p, { literal: t(`cards.text.sample.${p}`) }))}
              className={cn(
                'btn-3d btn-3d-light min-h-12 justify-center rounded-xl px-3 text-sm',
                p === 'heading' && 'font-display text-base',
                p === 'script' && 'italic',
                p === 'subheading' && 'text-xs tracking-[0.18em] uppercase',
              )}
            >
              {t(`cards.text.preset.${p}`)}
            </button>
          ))}
        </div>
      </PanelSection>
      <PanelSection title={t('cards.text.onCard')} hint={t('cards.text.onCardHint')}>
        <ul className="space-y-3">
          {texts.map((layer) => (
            <li key={layer.id}>
              <TextField
                label={layer.name ?? labelFor(editor, layer)}
                value={textOf(editor, layer)}
                multiline
                onChange={(v) => editor.changeLayer(layer.id, (l) => ({ ...l, content: { literal: v } }) as Layer, `text:${layer.id}`)}
                hint={isLinked(layer) && isCardTextValue(layer.content) && !('t' in layer.content) ? t('cards.text.linked') : undefined}
              />
              <button type="button" onClick={() => editor.select(layer.id)} className="mt-1 text-xs font-semibold text-brand-700 hover:underline">
                {t('cards.text.styleIt')}
              </button>
            </li>
          ))}
        </ul>
      </PanelSection>
    </div>
  );
}

/** A friendly name for a text layer: what it shows, shortened. */
function labelFor(editor: CardEditorApi, layer: TextLayer): string {
  const words = textOf(editor, layer).replace(/\s+/g, ' ').trim();
  return words ? (words.length > 32 ? `${words.slice(0, 32)}…` : words) : layerLabel(layer);
}

// ─────────────────────────── Colours ───────────────────────────

const PALETTE_ORDER: PaletteKey[] = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted'];

export function ColorsPanel({ editor }: { editor: CardEditorApi }) {
  const { design, t, template } = editor;
  const original = template.definition.theme.colors;
  const presets = [{ name: t('cards.colors.templateColors'), colors: original }, ...template.definition.capabilities.colorPresets, ...PALETTES];
  const bg = design.board.background;
  const hero = heroCanvas(template.definition);
  const templateBackground = (design.format === 'landscape' ? (hero?.desktop ?? hero?.mobile) : hero?.mobile)?.background;
  const mode: 'template' | 'color' | 'gradient' = bg.type === 'color' && JSON.stringify(bg) !== JSON.stringify(templateBackground) ? 'color' : bg.type === 'gradient' && JSON.stringify(bg) !== JSON.stringify(templateBackground) ? 'gradient' : 'template';
  const setBackground = (fill: CardDesign['board']['background']) => editor.change((d) => ({ ...d, board: { ...d.board, background: fill } }), 'background');

  return (
    <div className="space-y-6">
      <PanelSection title={t('cards.colors.palettes')} hint={t('cards.colors.palettesHint')}>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => editor.change((d) => ({ ...d, colors: p.colors }))}
              className={cn('clay-lift rounded-xl border bg-surface p-2 text-left shadow-clay-sm', JSON.stringify(p.colors) === JSON.stringify(design.colors) ? 'border-brand-600' : 'border-transparent')}
            >
              <span className="flex h-6 overflow-hidden rounded-md">
                {(['primary', 'secondary', 'accent', 'background'] as const).map((k) => (
                  <span key={k} className="flex-1" style={{ background: p.colors[k] }} />
                ))}
              </span>
              <span className="mt-1.5 block truncate text-xs font-medium text-stone-700">{p.name}</span>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection
        title={t('cards.colors.palette')}
        actions={
          <button type="button" onClick={() => editor.change((d) => ({ ...d, colors: original }))} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
            <RotateCcw aria-hidden className="size-3.5" /> {t('cards.colors.restore')}
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          {PALETTE_ORDER.map((key) => (
            <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-[#f8f2ea] px-2 shadow-clay-inset">
              <span className="relative size-7 shrink-0 overflow-hidden rounded-full border-2 border-white shadow-clay-sm" style={{ background: design.colors[key] }}>
                <input
                  type="color"
                  value={design.colors[key]}
                  aria-label={t(`cards.palette.${key}`)}
                  onChange={(e) => editor.change((d) => ({ ...d, colors: { ...d.colors, [key]: e.target.value } as ThemeColors }), `palette:${key}`)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </span>
              <span className="text-xs font-medium text-stone-700">{t(`cards.palette.${key}`)}</span>
            </label>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-stone-500">{t('cards.colors.readable')}</p>
      </PanelSection>

      <PanelSection title={t('cards.colors.background')}>
        <Segmented
          label={t('cards.colors.background')}
          value={mode}
          onChange={(m) => {
            if (m === 'template' && templateBackground) setBackground(templateBackground);
            if (m === 'color') setBackground({ type: 'color', color: 'background' });
            if (m === 'gradient') setBackground({ type: 'gradient', gradient: { kind: 'linear', from: 'background', to: 'accent', angle: 180 } });
          }}
          options={[
            { value: 'template', label: t('cards.colors.bg.template') },
            { value: 'color', label: t('cards.colors.bg.color') },
            { value: 'gradient', label: t('cards.colors.bg.gradient') },
          ]}
        />
        {bg.type === 'color' && mode === 'color' ? <ColorField label={t('cards.colors.bg.color')} value={bg.color} colors={design.colors} onChange={(c) => setBackground({ type: 'color', color: c })} /> : null}
        {bg.type === 'gradient' && mode === 'gradient' ? (
          <div className="space-y-3">
            <ColorField label={t('cards.colors.bg.from')} value={bg.gradient.from} colors={design.colors} onChange={(c: ColorRef) => setBackground({ ...bg, gradient: { ...bg.gradient, from: c } })} />
            <ColorField label={t('cards.colors.bg.to')} value={bg.gradient.to} colors={design.colors} onChange={(c: ColorRef) => setBackground({ ...bg, gradient: { ...bg.gradient, to: c } })} />
          </div>
        ) : null}
        <p className="text-xs leading-relaxed text-stone-500">{t('cards.colors.sections')}</p>
      </PanelSection>
    </div>
  );
}

// ─────────────────────────── Photos ───────────────────────────

export function PhotosPanel({ editor }: { editor: CardEditorApi }) {
  const { design, t } = editor;
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const spots = design.board.layers.filter((l) => l.kind === 'image' && l.source.type === 'binding');

  const pick = (binding: string | null) => {
    setTarget(binding);
    input.current?.click();
  };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const id = await editor.uploadPhoto(file);
    if (!id) return;
    if (target) {
      editor.change((d) => ({ ...d, photos: { ...d.photos, [target]: id } }));
      return;
    }
    const binding = freePhotoBinding(design);
    if (!binding) {
      window.alert(t('cards.photos.full'));
      return;
    }
    const layer = photoLayer(design.board, binding, 1);
    editor.change((d) => ({ ...d, photos: { ...d.photos, [binding]: id }, board: { ...d.board, layers: [...d.board.layers, layer] } }));
    editor.select(layer.id);
  };

  return (
    <div className="space-y-6">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button type="button" disabled={editor.uploading} onClick={() => pick(null)} className="btn-3d min-h-12 w-full justify-center gap-2 rounded-xl text-sm disabled:opacity-60">
        <ImagePlus aria-hidden className="size-4" /> {editor.uploading ? t('cards.photos.uploading') : t('cards.photos.add')}
      </button>
      <PanelSection title={t('cards.photos.spots')} hint={spots.length ? t('cards.photos.spotsHint') : t('cards.photos.none')}>
        <ul className="grid grid-cols-2 gap-3">
          {spots.map((layer) => {
            if (layer.kind !== 'image' || layer.source.type !== 'binding') return null;
            const binding = layer.source.binding;
            const id = design.photos[binding as keyof CardDesign['photos']];
            const url = id ? editor.photoUrls[id] : undefined;
            return (
              <li key={layer.id} className="clay rounded-2xl p-2">
                <button type="button" onClick={() => editor.select(layer.id)} className="block aspect-square w-full overflow-hidden rounded-xl bg-[#efe6da]" aria-label={t('cards.photos.select')}>
                  {url ? <img src={url} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-xs text-stone-500">{t('cards.photos.empty')}</span>}
                </button>
                <div className="mt-2 flex gap-1">
                  <button type="button" disabled={editor.uploading} onClick={() => pick(binding)} className="btn-3d btn-3d-light min-h-9 flex-1 justify-center gap-1 rounded-lg px-2 text-xs">
                    <Upload aria-hidden className="size-3.5" /> {url ? t('cards.photos.replace') : t('cards.photos.upload')}
                  </button>
                  {url ? (
                    <button
                      type="button"
                      aria-label={t('cards.photos.remove')}
                      title={t('cards.photos.remove')}
                      onClick={() =>
                        editor.change((d) => {
                          const photos = { ...d.photos };
                          delete photos[binding as keyof CardDesign['photos']];
                          return { ...d, photos };
                        })
                      }
                      className="btn-3d btn-3d-light min-h-9 rounded-lg px-2"
                    >
                      <Trash2 aria-hidden className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </PanelSection>
      <p className="text-xs leading-relaxed text-stone-500">{t('cards.photos.private')}</p>
    </div>
  );
}

// ─────────────────────────── Elements ───────────────────────────

/** One layer drawn alone, small: the add menu shows decorations as they will look. */
function LayerThumb({ layer, editor }: { layer: Layer; editor: CardEditorApi }) {
  const parsed = useMemo(() => ArtboardSchema.safeParse({ width: 200, height: 200, background: { type: 'none' }, layers: [{ ...layer, frame: fitThumb(layer.frame) }] }), [layer]);
  const theme = useMemo(() => themeStyle({ colors: editor.design.colors, radius: 16, ornament: 'none', pattern: 'none', heroTone: 'light', look: 'classic', effect: 'none' }, editor.design.colors, editor.design.fonts), [editor.design.colors, editor.design.fonts]);
  if (!parsed.success) return null;
  return (
    <div className="bulava-template pointer-events-none size-full" style={{ ...theme, backgroundColor: 'transparent' }}>
      <CanvasArtboard board={parsed.data} ctx={editor.ctx} colors={editor.design.colors} t={editor.cardT} language={editor.design.language} timeZone={editor.ctx.event.timezone} mode="thumbnail" />
    </div>
  );
}

function fitThumb(frame: Layer['frame']): Layer['frame'] {
  const k = Math.min(180 / frame.w, 180 / frame.h);
  const w = frame.w * k;
  const h = frame.h * k;
  return { x: (200 - w) / 2, y: (200 - h) / 2, w, h, rotate: 0 };
}

export function ElementsPanel({ editor }: { editor: CardEditorApi }) {
  const { design, t } = editor;
  const decorations = useMemo(() => ORNAMENT_CHOICES.map((name) => ornamentLayer(design.board, name, ornamentAspect(name, ILLUSTRATION_ASPECT))), [design.board]);
  const shapes = useMemo(() => SHAPE_CHOICES.map((s) => shapeLayer(design.board, s)), [design.board]);
  const layers = [...design.board.layers].reverse();
  return (
    <div className="space-y-6">
      <PanelSection title={t('cards.elements.decorations')}>
        <ul className="grid grid-cols-4 gap-2">
          {decorations.map((layer) => (
            <li key={layer.kind === 'ornament' ? layer.ornament : layer.id}>
              <button
                type="button"
                title={layerLabel(layer)}
                aria-label={t('cards.elements.addNamed', { name: layerLabel(layer) })}
                onClick={() => editor.addLayer(layer)}
                className="clay-lift block aspect-square w-full rounded-xl bg-surface p-1.5 shadow-clay-sm"
              >
                <LayerThumb layer={layer} editor={editor} />
              </button>
            </li>
          ))}
        </ul>
      </PanelSection>
      <PanelSection title={t('cards.elements.shapes')}>
        <ul className="grid grid-cols-4 gap-2">
          {shapes.map((layer) => (
            <li key={layer.kind === 'shape' ? layer.shape : layer.id}>
              <button
                type="button"
                title={layerLabel(layer)}
                aria-label={t('cards.elements.addNamed', { name: layerLabel(layer) })}
                onClick={() => editor.addLayer(layer)}
                className="clay-lift block aspect-square w-full rounded-xl bg-surface p-1.5 shadow-clay-sm"
              >
                <LayerThumb layer={layer} editor={editor} />
              </button>
            </li>
          ))}
        </ul>
      </PanelSection>
      <PanelSection title={t('cards.elements.layers')} hint={t('cards.elements.layersHint')}>
        <ul className="space-y-1">
          {layers.map((layer) => {
            const selected = layer.id === editor.selectedId;
            const label = layer.kind === 'text' ? labelFor(editor, layer) : layerLabel(layer);
            return (
              <li key={layer.id} className={cn('flex items-center gap-1 rounded-xl px-1.5 py-1', selected ? 'bg-surface shadow-clay-sm' : 'hover:bg-white/60')}>
                <button type="button" onClick={() => editor.select(layer.id)} className={cn('min-h-9 min-w-0 flex-1 truncate text-left text-sm', layer.hidden ? 'text-stone-400' : 'text-stone-800', selected && 'font-semibold text-brand-700')}>
                  {label}
                </button>
                <button
                  type="button"
                  aria-label={layer.hidden ? t('cards.layer.show') : t('cards.layer.hide')}
                  title={layer.hidden ? t('cards.layer.show') : t('cards.layer.hide')}
                  onClick={() => editor.changeLayer(layer.id, (l) => ({ ...l, hidden: !l.hidden }))}
                  className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-sand/80 hover:text-ink"
                >
                  {layer.hidden ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                </button>
                <button
                  type="button"
                  aria-label={layer.locked ? t('cards.layer.unlock') : t('cards.layer.lock')}
                  title={layer.locked ? t('cards.layer.unlock') : t('cards.layer.lock')}
                  onClick={() => editor.changeLayer(layer.id, (l) => ({ ...l, locked: !l.locked }))}
                  className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-sand/80 hover:text-ink"
                >
                  {layer.locked ? <Lock aria-hidden className="size-4" /> : <LockOpen aria-hidden className="size-4" />}
                </button>
                <button
                  type="button"
                  aria-label={t('cards.layer.up')}
                  title={t('cards.layer.up')}
                  onClick={() => editor.change((d) => ({ ...d, board: restack(d.board, layer.id, 'up') }))}
                  className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-sand/80 hover:text-ink"
                >
                  <ArrowUp aria-hidden className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={t('cards.layer.down')}
                  title={t('cards.layer.down')}
                  onClick={() => editor.change((d) => ({ ...d, board: restack(d.board, layer.id, 'down') }))}
                  className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-sand/80 hover:text-ink"
                >
                  <ArrowDown aria-hidden className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </PanelSection>
    </div>
  );
}

// ─────────────────────────── Size ───────────────────────────

export function SizePanel({ editor }: { editor: CardEditorApi }) {
  const { design, t, config } = editor;
  return (
    <div className="space-y-6">
      <PanelSection title={t('cards.size.title')} hint={t('cards.size.hint')}>
        <ul className="space-y-2">
          {CARD_FORMAT_KEYS.map((format: CardFormat) => {
            const spec = config?.formats[format];
            const active = design.format === format;
            const ratio = spec ? spec.width / spec.height : 1;
            return (
              <li key={format}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => editor.setFormat(format)}
                  className={cn('flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors', active ? 'border-brand-600 bg-surface shadow-clay-sm' : 'border-transparent bg-white/50 hover:bg-white/80')}
                >
                  <span className="grid size-12 shrink-0 place-items-center">
                    <span className={cn('block rounded-[3px] border-2', active ? 'border-brand-700 bg-brand-50' : 'border-stone-400')} style={{ width: ratio >= 1 ? 40 : 40 * ratio, height: ratio >= 1 ? 40 / ratio : 40 }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{t(`cards.format.${format}`)}</span>
                    <span className="block text-xs text-stone-500">
                      {t(`cards.format.${format}.use`)}
                      {spec ? ` · ${spec.pixels.width} × ${spec.pixels.height} px` : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PanelSection>
      <PanelSection title={t('cards.size.reset')} hint={t('cards.size.resetHint')}>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t('cards.size.resetConfirm'))) editor.restart();
          }}
          className="btn-3d btn-3d-light min-h-11 w-full justify-center gap-2 rounded-xl text-sm"
        >
          <RotateCcw aria-hidden className="size-4" /> {t('cards.size.resetButton')}
        </button>
      </PanelSection>
    </div>
  );
}
