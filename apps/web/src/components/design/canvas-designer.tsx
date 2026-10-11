'use client';

import { CopyPlus, ImagePlus, Images, LayoutPanelTop, Palette, RotateCcw, Shapes, Trash2, Type } from 'lucide-react';
import { useMemo } from 'react';
import { createTranslator, type MessageKey } from '@bulava/localization';
import { CanvasArtboard, TemplateRenderer, themeStyle } from '@bulava/template-engine';
import {
  ADDED_SECTION_WIDTH,
  ADDED_SECTIONS_MAX,
  ArtboardSchema,
  canvasSectionsOf,
  effectiveColors,
  effectiveFonts,
  stableStringify,
  type AddedSection,
  type Artboard,
  type ArtboardInput,
  type Customization,
  type Fonts,
  type RenderContext,
  type TemplateDefinition,
  type ThemeColors,
} from '@bulava/template-schema';
import { photoLayer } from '@/components/cards/editor-model';
import { ElementsPanel, TextPanel } from '@/components/cards/editor-panels';
import type { BoardEditorApi } from '@/components/cards/editor-types';
import { IconButton, PanelSection } from '@/components/cards/editor-ui';
import { BoardStudio, type StudioApi, type StudioPanel, type StudioSide, type StudioTarget } from '@/components/editor/board-studio';
import { useT } from '@/lib/i18n';
import type { MediaItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PhotosPanel, StylePanel } from './design-panels';
import { uploadDesignPhoto } from './upload-design-photo';

/** One of the website's artboards, drawn as the website draws it (its theme, the host's data). */
function WebsiteBoard({ board, colors, fonts, theme, ctx, language, mode }: { board: Artboard; colors: ThemeColors; fonts: Fonts; theme: TemplateDefinition['theme']; ctx: RenderContext; language: string; mode: 'edit' | 'thumbnail' }) {
  const t = useMemo(() => createTranslator(language), [language]);
  return (
    <div className="bulava-template" lang={language} style={{ ...themeStyle(theme, colors, fonts), width: '100%', backgroundColor: 'transparent' }}>
      <CanvasArtboard board={board} ctx={ctx} colors={colors} fonts={fonts} t={t} language={language} timeZone={ctx.event.timezone} mode={mode} />
    </div>
  );
}

export interface CanvasDesignerProps {
  eventId: string;
  definition: TemplateDefinition;
  templateName: string;
  /** The event's data with the host's photos (the design page's preview context). */
  context: RenderContext;
  custom: Customization;
  setCustom: (next: Customization) => void;
  photos: MediaItem[];
  onUploaded: (photo: MediaItem) => void;
  language: string;
  watermark: boolean;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

type Starter = 'words' | 'photo' | 'date' | 'blank';
const STARTERS: Starter[] = ['words', 'photo', 'date', 'blank'];

/** A new section's first design: phone-wide, on the invitation's own colours. */
function starterBoard(kind: Starter, t: ReturnType<typeof useT>): Artboard {
  const W = ADDED_SECTION_WIDTH;
  const text = (id: string, y: number, h: number, content: unknown, style: Record<string, unknown>) => ({ id, kind: 'text', frame: { x: 30, y, w: W - 60, h }, content, style, overflow: 'shrink' });
  const boards: Record<Starter, unknown> = {
    words: {
      width: W,
      height: 420,
      background: { type: 'color', color: 'background' },
      layers: [
        { id: 'flourish', kind: 'ornament', ornament: 'flourish', color: 'secondary', frame: { x: 125, y: 40, w: 140, h: 36 } },
        text('heading', 96, 64, { literal: t('design.canvas.starter.heading') }, { font: 'script', size: 40, color: 'primary', align: 'center' }),
        { ...text('words', 176, 160, { literal: t('cards.text.sample.body') }, { font: 'body', size: 16, color: 'text', align: 'center', lineHeight: 1.6 }), overflow: 'wrap' },
      ],
    },
    photo: {
      width: W,
      height: 600,
      background: { type: 'color', color: 'surface' },
      layers: [
        { id: 'photo', kind: 'image', source: { type: 'binding', binding: 'photos[0]' }, frame: { x: 65, y: 50, w: 260, h: 380 }, fit: 'cover', mask: 'arch', border: { width: 4, color: 'secondary' }, alt: '' },
        text('caption', 460, 80, { literal: t('design.canvas.starter.caption') }, { font: 'script', size: 30, color: 'primary', align: 'center' }),
      ],
    },
    date: {
      width: W,
      height: 440,
      background: { type: 'color', color: 'background' },
      layers: [
        { id: 'mandala', kind: 'ornament', ornament: 'mandala', color: 'secondary', opacity: 0.35, frame: { x: 95, y: 40, w: 200, h: 200 } },
        text('eyebrow', 70, 24, { t: 'template.saveTheDate' }, { font: 'body', size: 12, weight: 600, color: 'muted', align: 'center', letterSpacing: 0.26, transform: 'upper' }),
        text('names', 112, 80, { template: '{{couple.partnerOne}} & {{couple.partnerTwo}}', fallback: { binding: 'honoree.name', fallback: { binding: 'event.title' } } }, { font: 'script', size: 44, color: 'primary', align: 'center' }),
        text('date', 270, 30, { binding: 'event.startDate', format: 'dateWithWeekday' }, { font: 'heading', size: 18, weight: 600, color: 'text', align: 'center', letterSpacing: 0.06, transform: 'upper' }),
        text('venue', 312, 28, { binding: 'venue.name' }, { font: 'body', size: 15, color: 'muted', align: 'center' }),
      ],
    },
    blank: { width: W, height: 360, background: { type: 'color', color: 'surface' }, layers: [] },
  };
  return ArtboardSchema.parse(boards[kind] as ArtboardInput);
}

const newSectionId = () => `my-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/**
 * The invitation's canvas editor (ADR-057, ADR-059): the template's canvas
 * sections and the sections the host adds, each edited like a card. What the
 * host changes is the design page's customization (saved with its Save):
 * their own artboards (`canvas`) and their sections (`addedSections`).
 */
export function CanvasDesigner(props: CanvasDesignerProps) {
  const { definition, custom, setCustom, context, photos, language, eventId } = props;
  const t = useT();
  const own = useMemo(() => canvasSectionsOf(definition), [definition]);
  const added = useMemo(() => custom.addedSections ?? [], [custom.addedSections]);
  const colors = useMemo(() => effectiveColors(definition, custom), [definition, custom]);
  const fonts = useMemo(() => effectiveFonts(definition, custom), [definition, custom]);
  const photoUrls = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, p.viewUrl])), [photos]);
  const ctxBase = useMemo((): RenderContext => (custom.custom ? { ...context, custom: { ...context.custom, ...custom.custom } } : context), [context, custom.custom]);
  const sectionsOfPage = useMemo(() => definition.website?.pages[0]?.sections ?? [], [definition]);
  const pageLabel = (id: string) => {
    const s = sectionsOfPage.find((x) => x.id === id);
    return s ? t(`design.section.${s.section}` as MessageKey) : t('design.canvas.atTheEnd');
  };

  const targets: StudioTarget[] = useMemo(() => {
    const perFunction = ctxBase.functions[0] ? { ...ctxBase, function: ctxBase.functions[0], venue: ctxBase.functions[0].venue ?? ctxBase.venue } : ctxBase;
    const fromTemplate = own.map(
      (s, i): StudioTarget => ({
        id: s.id,
        label: s.canvas.repeatPerFunction ? t('design.canvas.functionCard') : i === 0 ? t('design.canvas.opening') : t('design.canvas.sectionN', { n: i + 1 }),
        sides: s.canvas.desktop ? ['mobile', 'desktop'] : ['mobile'],
        board: (side) => custom.canvas?.[s.id]?.[side] ?? (side === 'desktop' && s.canvas.desktop ? s.canvas.desktop : s.canvas.mobile),
        ctx: s.canvas.repeatPerFunction ? perFunction : ctxBase,
      }),
    );
    const mine = added.map((a, i): StudioTarget => ({ id: a.id, label: t('design.canvas.yourSectionN', { n: i + 1 }), sides: ['mobile'], board: () => a.mobile, ctx: ctxBase }));
    return [...fromTemplate, ...mine];
  }, [own, added, custom.canvas, ctxBase, t]);

  const writeBoard = (c: Customization, targetId: string, side: StudioSide, board: Artboard): Customization => {
    const mineIndex = (c.addedSections ?? []).findIndex((a) => a.id === targetId);
    if (mineIndex !== -1) {
      const next = [...(c.addedSections ?? [])];
      next[mineIndex] = { ...next[mineIndex]!, mobile: board };
      return { ...c, addedSections: next };
    }
    const section = own.find((s) => s.id === targetId);
    if (!section) return c;
    const original = side === 'desktop' && section.canvas.desktop ? section.canvas.desktop : section.canvas.mobile;
    const canvas = { ...(c.canvas ?? {}) };
    const entry = { ...(canvas[targetId] ?? {}) };
    if (stableStringify(board) === stableStringify(original)) delete entry[side];
    else entry[side] = board;
    if (entry.mobile || entry.desktop) canvas[targetId] = entry;
    else delete canvas[targetId];
    const out: Customization = { ...c, canvas };
    if (!Object.keys(canvas).length) delete out.canvas;
    return out;
  };

  const panelProps = (api: StudioApi | null) => ({ definition, custom, setCustom: (next: Customization) => (api ? api.commit(next) : setCustom(next)) });
  const panels: StudioPanel[] = [
    {
      key: 'sections',
      label: t('design.canvas.panel.sections'),
      icon: <LayoutPanelTop aria-hidden className="size-5" />,
      render: (api) => (
        <SectionsPanel
          targets={targets}
          current={api?.target.id ?? null}
          own={own.map((s) => s.id)}
          custom={custom}
          definition={definition}
          colors={colors}
          fonts={fonts}
          language={language}
          pageSections={sectionsOfPage.map((s) => ({ id: s.id, label: t(`design.section.${s.section}` as MessageKey) }))}
          pageLabel={pageLabel}
          onPick={(id) => api?.selectTarget(id)}
          commit={(next) => (api ? api.commit(next) : setCustom(next))}
          onAdded={(id) => api?.selectTarget(id)}
          t={t}
        />
      ),
    },
    { key: 'text', label: t('cards.panel.text'), icon: <Type aria-hidden className="size-5" />, render: (api) => (api ? <TextPanel editor={api.editor} /> : null) },
    { key: 'style', label: t('design.canvas.panel.style'), icon: <Palette aria-hidden className="size-5" />, render: (api) => <StylePanel {...panelProps(api)} /> },
    {
      key: 'photos',
      label: t('cards.panel.photos'),
      icon: <Images aria-hidden className="size-5" />,
      render: (api) => (
        <div className="space-y-6">
          {api ? <AddPhotoFrame editor={api.editor} definition={definition} /> : null}
          <PhotosPanel {...panelProps(api)} eventId={eventId} photos={photos} onUploaded={props.onUploaded} />
        </div>
      ),
    },
    { key: 'elements', label: t('cards.panel.elements'), icon: <Shapes aria-hidden className="size-5" />, render: (api) => (api ? <ElementsPanel editor={api.editor} /> : null) },
  ];

  return (
    <BoardStudio
      kind="website"
      title={props.templateName}
      labels={{ dialog: t('design.canvas.title'), canvas: t('design.canvas.canvas'), hint: t('design.canvas.hint'), close: t('design.canvas.close'), empty: t('design.canvas.empty') }}
      targets={targets}
      custom={custom}
      setCustom={setCustom}
      writeBoard={writeBoard}
      colors={colors}
      fonts={fonts}
      language={language}
      renderBoard={(board, target) => <WebsiteBoard board={board} colors={colors} fonts={fonts} theme={definition.theme} ctx={target.ctx} language={language} mode="edit" />}
      panels={panels}
      renderPreview={() => (
        <div className="h-[min(78dvh,760px)] w-[min(86vw,375px)] overflow-y-auto overscroll-contain bg-white" tabIndex={0} role="region" aria-label={t('design.livePreview')}>
          <TemplateRenderer definition={definition} context={context} customization={custom} mode="preview" language={language} slots={{ watermark: props.watermark }} />
        </div>
      )}
      framed={(side) => side === 'mobile'}
      photoUrls={photoUrls}
      uploadPhoto={async (file) => {
        const photo = await uploadDesignPhoto(eventId, file);
        props.onUploaded(photo);
        return photo.id;
      }}
      actions={(api) =>
        api && own.some((s) => s.id === api.target.id) ? (
          <IconButton
            label={t('design.canvas.reset')}
            tone="plain"
            disabled={!custom.canvas?.[api.target.id]}
            onClick={() => {
              if (!window.confirm(t('design.canvas.resetConfirm'))) return;
              const canvas = { ...(custom.canvas ?? {}) };
              delete canvas[api.target.id];
              const next: Customization = { ...custom, canvas };
              if (!Object.keys(canvas).length) delete next.canvas;
              api.commit(next);
            }}
          >
            <RotateCcw aria-hidden className="size-5" />
          </IconButton>
        ) : null
      }
      primary={{ label: props.saving ? t('common.saving') : props.dirty ? t('design.saveChanges') : t('design.savedBadge'), onClick: props.onSave, disabled: !props.dirty, busy: props.saving }}
      onClose={props.onClose}
    />
  );
}

/** The sections on the canvas: the template's (small, marked when edited) and the host's own, which they place, add and remove. */
function SectionsPanel({
  targets,
  current,
  own,
  custom,
  definition,
  colors,
  fonts,
  language,
  pageSections,
  pageLabel,
  onPick,
  commit,
  onAdded,
  t,
}: {
  targets: StudioTarget[];
  current: string | null;
  own: string[];
  custom: Customization;
  definition: TemplateDefinition;
  colors: ThemeColors;
  fonts: Fonts;
  language: string;
  pageSections: Array<{ id: string; label: string }>;
  pageLabel: (id: string) => string;
  onPick: (id: string) => void;
  commit: (next: Customization) => void;
  onAdded: (id: string) => void;
  t: ReturnType<typeof useT>;
}) {
  const added = custom.addedSections ?? [];
  const setAdded = (next: AddedSection[]) => {
    const out: Customization = { ...custom, addedSections: next };
    if (!next.length) delete out.addedSections;
    commit(out);
  };
  const add = (kind: Starter) => {
    if (added.length >= ADDED_SECTIONS_MAX) return;
    const id = newSectionId();
    // Right after the section on screen: a template section, or one of the host's (same place, next in line).
    const at = added.findIndex((a) => a.id === current);
    const after = current && own.includes(current) ? current : at !== -1 ? added[at]!.after : '';
    const section = { id, after, mobile: starterBoard(kind, t) };
    setAdded(at === -1 ? [...added, section] : [...added.slice(0, at + 1), section, ...added.slice(at + 1)]);
    requestAnimationFrame(() => onAdded(id));
  };
  const starters = STARTERS.filter((kind) => kind !== 'photo' || definition.capabilities.editable.photos);
  return (
    <div className="space-y-6">
      {targets.length ? (
        <PanelSection title={t('design.canvas.sections')} hint={t('design.canvas.sectionsHint')}>
          <ul className="grid grid-cols-2 gap-3">
            {targets.map((target) => {
              const mine = added.find((a) => a.id === target.id);
              const active = target.id === current;
              return (
                <li key={target.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onPick(target.id)}
                    className={cn('group block w-full rounded-2xl p-1.5 text-left transition-colors', active ? 'bg-surface shadow-clay-sm ring-2 ring-brand-600' : 'hover:bg-white/60')}
                  >
                    <span className="pointer-events-none block max-h-56 overflow-hidden rounded-xl ring-1 ring-[var(--ed-line)]">
                      <WebsiteBoard board={target.board('mobile')} colors={colors} fonts={fonts} theme={definition.theme} ctx={target.ctx} language={language} mode="thumbnail" />
                    </span>
                    <span className="mt-1.5 flex items-center justify-between gap-1 px-0.5 text-xs font-semibold text-stone-700">
                      <span className="truncate">{target.label}</span>
                      {custom.canvas?.[target.id] ? <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-0.5 text-[0.625rem] text-brand-700">{t('design.canvas.edited')}</span> : null}
                    </span>
                  </button>
                  {mine ? (
                    <div className="mt-1 flex items-center gap-1 px-0.5">
                      <label className="sr-only" htmlFor={`after-${mine.id}`}>
                        {t('design.canvas.placeAfter')}
                      </label>
                      <select
                        id={`after-${mine.id}`}
                        value={mine.after}
                        onChange={(e) => setAdded(added.map((a) => (a.id === mine.id ? { ...a, after: e.target.value } : a)))}
                        className="min-h-8 min-w-0 flex-1 rounded-lg border border-[var(--ed-field-line)] bg-[var(--ed-field)] px-1 text-[0.6875rem] text-stone-800"
                        title={t('design.canvas.placeAfter')}
                      >
                        {pageSections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {t('design.canvas.after', { section: s.label })}
                          </option>
                        ))}
                        <option value="">{t('design.canvas.atTheEnd')}</option>
                      </select>
                      <IconButton
                        label={t('design.canvas.removeSection')}
                        tone="plain"
                        className="size-8 !text-red-700"
                        onClick={() => {
                          if (window.confirm(t('design.canvas.removeConfirm'))) setAdded(added.filter((a) => a.id !== mine.id));
                        }}
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </IconButton>
                    </div>
                  ) : null}
                  {mine ? <p className="px-0.5 text-[0.6875rem] text-stone-500">{mine.after ? t('design.canvas.after', { section: pageLabel(mine.after) }) : t('design.canvas.atTheEnd')}</p> : null}
                </li>
              );
            })}
          </ul>
        </PanelSection>
      ) : null}
      <PanelSection title={t('design.canvas.addSection')} hint={added.length >= ADDED_SECTIONS_MAX ? t('design.canvas.addSectionFull', { max: ADDED_SECTIONS_MAX }) : t('design.canvas.addSectionHint')}>
        <div className="grid grid-cols-2 gap-2">
          {starters.map((kind) => (
            <button key={kind} type="button" disabled={added.length >= ADDED_SECTIONS_MAX} onClick={() => add(kind)} className="btn-3d btn-3d-light min-h-12 justify-center gap-1.5 rounded-xl px-2 text-xs disabled:opacity-50">
              <CopyPlus aria-hidden className="size-4" />
              {t(`design.canvas.starter.${kind}`)}
            </button>
          ))}
        </div>
      </PanelSection>
    </div>
  );
}

/** A new photo frame on this section, in the first photo spot the template offers that it does not use yet. */
function AddPhotoFrame({ editor, definition }: { editor: BoardEditorApi; definition: TemplateDefinition }) {
  const { t } = editor;
  const caps = definition.capabilities;
  if (!caps.editable.photos) return null;
  const used = new Set(editor.design.board.layers.flatMap((l) => (l.kind === 'image' && l.source.type === 'binding' ? [l.source.binding] : [])));
  // The template's photo places, then its extra photos (photos[0] to photos[2] are the ones a design can show).
  const binding = [...caps.photoSlots.map((s) => `photo.${s}`), ...Array.from({ length: Math.min(caps.maxPhotos, 3) }, (_, i) => `photos[${i}]`)].find((b) => !used.has(b));
  if (!binding) return null;
  return (
    <button type="button" onClick={() => editor.addLayer(photoLayer(editor.design.board, binding))} className="btn-3d min-h-12 w-full justify-center gap-2 rounded-xl text-sm">
      <ImagePlus aria-hidden className="size-4" /> {t('design.canvas.addPhoto')}
    </button>
  );
}
