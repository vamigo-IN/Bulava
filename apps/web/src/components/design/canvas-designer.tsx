'use client';

import { CopyPlus, Eye, EyeOff, ImagePlus, Images, LayoutPanelTop, Palette, PenTool, RotateCcw, Shapes, Trash2, Type } from 'lucide-react';
import { useMemo } from 'react';
import { createTranslator, type MessageKey } from '@bulava/localization';
import { CanvasArtboard, TemplateRenderer, themeStyle } from '@bulava/template-engine';
import {
  ADDED_SECTION_WIDTH,
  ADDED_SECTIONS_MAX,
  ArtboardSchema,
  canRedraw,
  effectiveColors,
  effectiveFonts,
  replacedSections,
  resolveBinding,
  sectionBoard,
  stableStringify,
  type AddedSection,
  type Artboard,
  type ArtboardInput,
  type CanvasSectionInstance,
  type Customization,
  type Fonts,
  type RenderContext,
  type SectionInstance,
  type TemplateDefinition,
  type ThemeColors,
} from '@bulava/template-schema';
import { photoLayer } from '@/components/cards/editor-model';
import { ElementsPanel, TextPanel } from '@/components/cards/editor-panels';
import type { BoardEditorApi } from '@/components/cards/editor-types';
import { IconButton, PanelSection } from '@/components/cards/editor-ui';
import { BoardStudio, type StudioControls, type StudioPanel, type StudioSide, type StudioTarget } from '@/components/editor/board-studio';
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

/** One of the template's own sections, drawn alone as the website draws it (without the host's canvas changes around it). */
function TemplateSectionView({ definition, section, context, custom, language, mode }: { definition: TemplateDefinition; section: SectionInstance; context: RenderContext; custom: Customization; language: string; mode: 'preview' | 'thumbnail' }) {
  const alone = useMemo((): TemplateDefinition => {
    const page = definition.website?.pages[0];
    return page && definition.website ? { ...definition, website: { ...definition.website, pages: [{ ...page, sections: [section] }] } } : definition;
  }, [definition, section]);
  const plain = useMemo(() => {
    const { canvas: _canvas, addedSections: _added, hiddenSections: _hidden, ...rest } = custom;
    return rest;
  }, [custom]);
  return <TemplateRenderer definition={alone} context={context} customization={plain} mode={mode} language={language} />;
}

export interface CanvasDesignerProps {
  /** None on the design page before signing in (ADR-063): photos come with an event. */
  eventId?: string;
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
  /** The main button, when it is not Save (the design page: publish). */
  primary?: { label: string; onClick: () => void; disabled?: boolean; busy?: boolean };
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

/** Each part of the page, in the order guests see it: the template's own sections, its canvases, and the host's sections (a redrawn one in its original's place). */
type Part = { kind: 'template'; section: SectionInstance } | { kind: 'canvas'; section: CanvasSectionInstance; n: number } | { kind: 'mine'; added: AddedSection; n: number; original?: SectionInstance };

/** Shown for this event at all (a section for other occasions, or about details this event has none of, is not). */
function shown(section: SectionInstance, ctx: RenderContext): boolean {
  const cond = section.visibleWhen;
  if (!cond) return true;
  if (cond.eventTypes && !cond.eventTypes.includes(ctx.event.typeKey)) return false;
  if (cond.exists) {
    const v = resolveBinding(cond.exists, ctx);
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return false;
  }
  return true;
}

function partsOf(definition: TemplateDefinition, added: AddedSection[], ctx: RenderContext): Part[] {
  const sections = definition.website?.pages[0]?.sections ?? [];
  const ids = new Set(sections.map((s) => s.id));
  const replaced = replacedSections(definition, added);
  const out: Part[] = [];
  const placed = new Set<string>();
  let mine = 0;
  let canvases = 0;
  const push = (a: AddedSection, original?: SectionInstance) => {
    if (placed.has(a.id)) return;
    placed.add(a.id);
    out.push({ kind: 'mine', added: a, n: ++mine, ...(original ? { original } : {}) });
  };
  for (const s of sections) {
    // The host's sections without a place (or whose place is gone) come before the footer.
    if (s.section === 'footer') for (const a of added) if (!a.after || !ids.has(a.after)) push(a);
    const standIn = replaced.get(s.id);
    if (standIn) push(added.find((a) => a.id === standIn)!, s);
    else if (s.section === 'canvas' && s.canvas) out.push({ kind: 'canvas', section: s as CanvasSectionInstance, n: ++canvases });
    else if (shown(s, ctx)) out.push({ kind: 'template', section: s });
    for (const a of added) if (a.after === s.id) push(a);
  }
  for (const a of added) push(a);
  return out;
}

/**
 * The invitation's canvas editor (ADR-057, ADR-059, ADR-060): every part of
 * the page in order. The template's canvas sections and the host's own are
 * edited like cards; the template's other sections are shown as they are,
 * with "Redraw on the canvas" (a canvas section in their place), hide, and
 * "add your own after it". What the host changes is the design page's
 * customization (saved with its Save).
 */
export function CanvasDesigner(props: CanvasDesignerProps) {
  const { definition, custom, setCustom, context, photos, language, eventId } = props;
  const t = useT();
  const added = useMemo(() => custom.addedSections ?? [], [custom.addedSections]);
  const colors = useMemo(() => effectiveColors(definition, custom), [definition, custom]);
  const fonts = useMemo(() => effectiveFonts(definition, custom), [definition, custom]);
  const photoUrls = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, p.viewUrl])), [photos]);
  const ctxBase = useMemo((): RenderContext => (custom.custom ? { ...context, custom: { ...context.custom, ...custom.custom } } : context), [context, custom.custom]);
  const pageSections = useMemo(() => definition.website?.pages[0]?.sections ?? [], [definition]);
  const parts = useMemo(() => partsOf(definition, added, ctxBase), [definition, added, ctxBase]);
  const sectionLabel = (s: SectionInstance) => t(`design.section.${s.section}` as MessageKey);
  const pageLabel = (id: string) => {
    const s = pageSections.find((x) => x.id === id);
    return s ? sectionLabel(s) : t('design.canvas.atTheEnd');
  };
  const hidden = useMemo(() => new Set(custom.hiddenSections ?? []), [custom.hiddenSections]);

  // ── What can be done with the template's own sections ──
  const redraw = (s: SectionInstance, controls: StudioControls) => {
    const made = sectionBoard(definition, s);
    const list = controls.custom.addedSections ?? [];
    if (!made || list.length >= ADDED_SECTIONS_MAX) return;
    const id = newSectionId();
    const section: AddedSection = { id, after: s.id, replaces: true, mobile: made.board, ...(made.perFunction ? { perFunction: true } : {}) };
    controls.commit({ ...controls.custom, addedSections: [...list, section] });
    requestAnimationFrame(() => controls.selectTarget(id));
  };
  const toggleHidden = (s: SectionInstance, controls: StudioControls) => {
    const list = controls.custom.hiddenSections ?? [];
    const next = list.includes(s.id) ? list.filter((x) => x !== s.id) : [...list, s.id];
    const out: Customization = { ...controls.custom, hiddenSections: next };
    if (!next.length) delete out.hiddenSections;
    controls.commit(out);
  };
  const removeMine = (id: string, controls: StudioControls) => {
    const next = (controls.custom.addedSections ?? []).filter((a) => a.id !== id);
    const out: Customization = { ...controls.custom, addedSections: next };
    if (!next.length) delete out.addedSections;
    controls.commit(out);
  };
  const addStarter = (kind: Starter, controls: StudioControls) => {
    const list = controls.custom.addedSections ?? [];
    if (list.length >= ADDED_SECTIONS_MAX) return;
    const id = newSectionId();
    const current = controls.target?.id ?? null;
    // Right after the part on screen: one of the template's sections, or one of the host's (the same place, next in line).
    const at = list.findIndex((a) => a.id === current);
    const after = current && pageSections.some((s) => s.id === current) ? current : at !== -1 ? list[at]!.after : '';
    const section: AddedSection = { id, after, mobile: starterBoard(kind, t) };
    const next = at === -1 ? [...list, section] : [...list.slice(0, at + 1), section, ...list.slice(at + 1)];
    controls.commit({ ...controls.custom, addedSections: next });
    requestAnimationFrame(() => controls.selectTarget(id));
  };
  const starters = STARTERS.filter((kind) => kind !== 'photo' || definition.capabilities.editable.photos);

  const targets: StudioTarget[] = useMemo(() => {
    const perFunction = ctxBase.functions[0] ? { ...ctxBase, function: ctxBase.functions[0], venue: ctxBase.functions[0].venue ?? ctxBase.venue } : ctxBase;
    return parts.map((part): StudioTarget => {
      if (part.kind === 'canvas') {
        const s = part.section;
        return {
          id: s.id,
          label: s.canvas.repeatPerFunction ? t('design.canvas.functionCard') : part.n === 1 && pageSections[0]?.id === s.id ? t('design.canvas.opening') : t('design.canvas.sectionN', { n: part.n }),
          sides: s.canvas.desktop ? ['mobile', 'desktop'] : ['mobile'],
          board: (side) => custom.canvas?.[s.id]?.[side] ?? (side === 'desktop' && s.canvas.desktop ? s.canvas.desktop : s.canvas.mobile),
          ctx: s.canvas.repeatPerFunction ? perFunction : ctxBase,
        };
      }
      if (part.kind === 'mine') {
        const a = part.added;
        return {
          id: a.id,
          label: part.original ? t('design.canvas.redrawnLabel', { section: sectionLabel(part.original) }) : t('design.canvas.yourSectionN', { n: part.n }),
          sides: ['mobile'],
          board: () => a.mobile,
          ctx: a.perFunction ? perFunction : ctxBase,
        };
      }
      const s = part.section;
      return {
        id: s.id,
        label: sectionLabel(s),
        sides: ['mobile'],
        ctx: ctxBase,
        view: {
          width: 390,
          height: 844,
          render: () => <TemplateSectionView definition={definition} section={s} context={context} custom={custom} language={language} mode="preview" />,
          aside: (controls) => (
            <TemplatePartAside
              section={s}
              label={sectionLabel(s)}
              hidden={hidden.has(s.id)}
              canRedraw={canRedraw(s)}
              full={(controls.custom.addedSections ?? []).length >= ADDED_SECTIONS_MAX}
              starters={starters}
              onRedraw={() => redraw(s, controls)}
              onToggleHidden={() => toggleHidden(s, controls)}
              onAdd={(kind) => addStarter(kind, controls)}
              t={t}
            />
          ),
        },
      };
    });
    // The callbacks read the latest customization through the studio's controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, custom, ctxBase, context, definition, language, hidden, t]);

  const writeBoard = (c: Customization, targetId: string, side: StudioSide, board: Artboard): Customization => {
    const mineIndex = (c.addedSections ?? []).findIndex((a) => a.id === targetId);
    if (mineIndex !== -1) {
      const next = [...(c.addedSections ?? [])];
      next[mineIndex] = { ...next[mineIndex]!, mobile: board };
      return { ...c, addedSections: next };
    }
    const part = parts.find((p): p is Extract<Part, { kind: 'canvas' }> => p.kind === 'canvas' && p.section.id === targetId);
    if (!part) return c;
    const section = part.section;
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

  const panelProps = (controls: StudioControls) => ({ definition, custom, setCustom: (next: Customization) => controls.commit(next) });
  const pickToEdit = <p className="clay-inset rounded-2xl p-4 text-sm leading-relaxed text-stone-600">{t('design.canvas.pickToEdit')}</p>;
  const panels: StudioPanel[] = [
    {
      key: 'sections',
      label: t('design.canvas.panel.sections'),
      icon: <LayoutPanelTop aria-hidden className="size-5" />,
      render: (_api, controls) => (
        <SectionsPanel
          parts={parts}
          targets={targets}
          controls={controls}
          definition={definition}
          context={context}
          colors={colors}
          fonts={fonts}
          language={language}
          hidden={hidden}
          pageSections={pageSections.map((s) => ({ id: s.id, label: sectionLabel(s) }))}
          pageLabel={pageLabel}
          starters={starters}
          onAdd={(kind) => addStarter(kind, controls)}
          onRemove={(id) => removeMine(id, controls)}
          t={t}
        />
      ),
    },
    { key: 'text', label: t('cards.panel.text'), icon: <Type aria-hidden className="size-5" />, render: (api) => (api ? <TextPanel editor={api.editor} /> : pickToEdit) },
    { key: 'style', label: t('design.canvas.panel.style'), icon: <Palette aria-hidden className="size-5" />, render: (_api, controls) => <StylePanel {...panelProps(controls)} /> },
    {
      key: 'photos',
      label: t('cards.panel.photos'),
      icon: <Images aria-hidden className="size-5" />,
      render: (api, controls) => (
        <div className="space-y-6">
          {api ? <AddPhotoFrame editor={api.editor} definition={definition} /> : null}
          <PhotosPanel {...panelProps(controls)} eventId={eventId} photos={photos} onUploaded={props.onUploaded} />
        </div>
      ),
    },
    { key: 'elements', label: t('cards.panel.elements'), icon: <Shapes aria-hidden className="size-5" />, render: (api) => (api ? <ElementsPanel editor={api.editor} /> : pickToEdit) },
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
      uploadPhoto={
        eventId
          ? async (file) => {
              const photo = await uploadDesignPhoto(eventId, file);
              props.onUploaded(photo);
              return photo.id;
            }
          : undefined
      }
      actions={(api, controls) => {
        const part = parts.find((p) => (p.kind === 'template' ? p.section.id : p.kind === 'canvas' ? p.section.id : p.added.id) === controls.target?.id);
        if (part?.kind === 'canvas') {
          return (
            <IconButton
              label={t('design.canvas.reset')}
              tone="plain"
              disabled={!custom.canvas?.[part.section.id]}
              onClick={() => {
                if (!window.confirm(t('design.canvas.resetConfirm'))) return;
                const canvas = { ...(custom.canvas ?? {}) };
                delete canvas[part.section.id];
                const next: Customization = { ...custom, canvas };
                if (!Object.keys(canvas).length) delete next.canvas;
                controls.commit(next);
              }}
            >
              <RotateCcw aria-hidden className="size-5" />
            </IconButton>
          );
        }
        if (part?.kind === 'mine' && part.original && api) {
          return (
            <IconButton
              label={t('design.canvas.restoreOriginal')}
              tone="plain"
              onClick={() => {
                if (window.confirm(t('design.canvas.restoreOriginalConfirm'))) removeMine(part.added.id, controls);
              }}
            >
              <RotateCcw aria-hidden className="size-5" />
            </IconButton>
          );
        }
        return null;
      }}
      primary={props.primary ?? { label: props.saving ? t('common.saving') : props.dirty ? t('design.saveChanges') : t('design.savedBadge'), onClick: props.onSave, disabled: !props.dirty, busy: props.saving }}
      onClose={props.onClose}
    />
  );
}

/** Beside one of the template's own sections: what it is, and what the host can do with it. */
function TemplatePartAside({
  section,
  label,
  hidden,
  canRedraw: redrawable,
  full,
  starters,
  onRedraw,
  onToggleHidden,
  onAdd,
  t,
}: {
  section: SectionInstance;
  label: string;
  hidden: boolean;
  canRedraw: boolean;
  full: boolean;
  starters: Starter[];
  onRedraw: () => void;
  onToggleHidden: () => void;
  onAdd: (kind: Starter) => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl">
          {label}
          <span className="rounded-full bg-[var(--ed-dot)] px-2 py-0.5 font-sans text-[0.625rem] font-semibold text-stone-700">{t('design.canvas.badge.template')}</span>
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{hidden ? t('design.canvas.hiddenNote') : t('design.canvas.templatePart')}</p>
      </div>
      {redrawable ? (
        <div>
          <button type="button" onClick={onRedraw} disabled={full} className="btn-3d min-h-12 w-full justify-center gap-2 rounded-xl text-sm disabled:opacity-50">
            <PenTool aria-hidden className="size-4" /> {t('design.canvas.redraw')}
          </button>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-500">{full ? t('design.canvas.addSectionFull', { max: ADDED_SECTIONS_MAX }) : t('design.canvas.redrawHint')}</p>
        </div>
      ) : (
        <p className="clay-inset rounded-2xl p-3 text-xs leading-relaxed text-stone-600">{t('design.canvas.notRedrawable')}</p>
      )}
      {section.section === 'hero' ? (
        <p className="text-xs leading-relaxed text-stone-500">{t('design.canvas.openingAlways')}</p>
      ) : (
        <button type="button" onClick={onToggleHidden} className="btn-3d btn-3d-light min-h-11 w-full justify-center gap-2 rounded-xl text-sm">
          {hidden ? <Eye aria-hidden className="size-4" /> : <EyeOff aria-hidden className="size-4" />}
          {hidden ? t('design.canvas.showSection') : t('design.canvas.hideSection')}
        </button>
      )}
      <PanelSection title={t('design.canvas.addAfter')} hint={full ? t('design.canvas.addSectionFull', { max: ADDED_SECTIONS_MAX }) : undefined}>
        <div className="grid grid-cols-2 gap-2">
          {starters.map((kind) => (
            <button key={kind} type="button" disabled={full} onClick={() => onAdd(kind)} className="btn-3d btn-3d-light min-h-11 justify-center gap-1.5 rounded-xl px-2 text-xs disabled:opacity-50">
              <CopyPlus aria-hidden className="size-4" />
              {t(`design.canvas.starter.${kind}`)}
            </button>
          ))}
        </div>
      </PanelSection>
    </div>
  );
}

/** Every part of the page in order, small: the template's sections, its canvases and the host's own, which they place, add and remove. */
function SectionsPanel({
  parts,
  targets,
  controls,
  definition,
  context,
  colors,
  fonts,
  language,
  hidden,
  pageSections,
  pageLabel,
  starters,
  onAdd,
  onRemove,
  t,
}: {
  parts: Part[];
  targets: StudioTarget[];
  controls: StudioControls;
  definition: TemplateDefinition;
  context: RenderContext;
  colors: ThemeColors;
  fonts: Fonts;
  language: string;
  hidden: Set<string>;
  pageSections: Array<{ id: string; label: string }>;
  pageLabel: (id: string) => string;
  starters: Starter[];
  onAdd: (kind: Starter) => void;
  onRemove: (id: string) => void;
  t: ReturnType<typeof useT>;
}) {
  const { custom } = controls;
  const added = custom.addedSections ?? [];
  const full = added.length >= ADDED_SECTIONS_MAX;
  const place = (id: string, after: string) => {
    controls.commit({ ...custom, addedSections: added.map((a) => (a.id === id ? { ...a, after } : a)) });
  };
  const badge = (text: string, tone: 'brand' | 'plain' = 'plain') => (
    <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[0.625rem]', tone === 'brand' ? 'bg-brand-50 text-brand-700' : 'bg-[var(--ed-dot)] text-stone-700')}>{text}</span>
  );
  return (
    <div className="space-y-6">
      <PanelSection title={t('design.canvas.sections')} hint={t('design.canvas.sectionsHint')}>
        <ul className="grid grid-cols-2 gap-3">
          {parts.map((part, i) => {
            const target = targets[i]!;
            const active = target.id === controls.target?.id;
            const mine = part.kind === 'mine' ? part.added : null;
            const isHidden = part.kind === 'template' && hidden.has(part.section.id);
            return (
              <li key={target.id}>
                {/* The thumbnail is a picture of the section (its own buttons stay out of reach); one button over the card picks it. */}
                <div className={cn('group relative rounded-2xl p-1.5 transition-colors', active ? 'bg-surface shadow-clay-sm ring-2 ring-brand-600' : 'hover:bg-white/60')}>
                  <div inert aria-hidden="true" className={cn('pointer-events-none max-h-56 overflow-hidden rounded-xl bg-white ring-1 ring-[var(--ed-line)]', isHidden && 'opacity-40')}>
                    {part.kind === 'template' ? (
                      <div style={{ width: 390, zoom: 0.33 }}>
                        <TemplateSectionView definition={definition} section={part.section} context={context} custom={custom} language={language} mode="thumbnail" />
                      </div>
                    ) : (
                      <WebsiteBoard board={target.board!('mobile')} colors={colors} fonts={fonts} theme={definition.theme} ctx={target.ctx} language={language} mode="thumbnail" />
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-1 px-0.5 text-xs font-semibold text-stone-700">
                    <span className="truncate">{target.label}</span>
                    {part.kind === 'template'
                      ? badge(isHidden ? t('design.canvas.hidden') : t('design.canvas.badge.template'))
                      : part.kind === 'canvas'
                        ? custom.canvas?.[part.section.id]
                          ? badge(t('design.canvas.edited'), 'brand')
                          : null
                        : badge(part.original ? t('design.canvas.badge.redrawn') : t('design.canvas.badge.yours'), 'brand')}
                  </div>
                  {(part.kind === 'canvas' && part.section.canvas.repeatPerFunction) || mine?.perFunction ? <p className="px-0.5 text-[0.6875rem] text-stone-500">{t('design.canvas.perFunction')}</p> : null}
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={target.label}
                    onClick={() => controls.selectTarget(target.id)}
                    className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  />
                </div>
                {mine && !mine.replaces ? (
                  <div className="mt-1 flex items-center gap-1 px-0.5">
                    <label className="sr-only" htmlFor={`after-${mine.id}`}>
                      {t('design.canvas.placeAfter')}
                    </label>
                    <select
                      id={`after-${mine.id}`}
                      value={mine.after}
                      onChange={(e) => place(mine.id, e.target.value)}
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
                        if (window.confirm(t('design.canvas.removeConfirm'))) onRemove(mine.id);
                      }}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </IconButton>
                  </div>
                ) : null}
                {mine && !mine.replaces ? <p className="px-0.5 text-[0.6875rem] text-stone-500">{mine.after ? t('design.canvas.after', { section: pageLabel(mine.after) }) : t('design.canvas.atTheEnd')}</p> : null}
                {mine?.replaces ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t('design.canvas.restoreOriginalConfirm'))) onRemove(mine.id);
                    }}
                    className="mt-1 flex min-h-8 w-full items-center justify-center gap-1 rounded-lg px-1 text-[0.6875rem] font-semibold text-stone-600 hover:text-ink"
                  >
                    <RotateCcw aria-hidden className="size-3.5" /> {t('design.canvas.restoreOriginal')}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </PanelSection>
      <PanelSection title={t('design.canvas.addSection')} hint={full ? t('design.canvas.addSectionFull', { max: ADDED_SECTIONS_MAX }) : t('design.canvas.addSectionHint')}>
        <div className="grid grid-cols-2 gap-2">
          {starters.map((kind) => (
            <button key={kind} type="button" disabled={full} onClick={() => onAdd(kind)} className="btn-3d btn-3d-light min-h-12 justify-center gap-1.5 rounded-xl px-2 text-xs disabled:opacity-50">
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
