'use client';

import { ArrowDown, ArrowUp, CopyPlus, Eye, EyeOff, ImagePlus, Images, LayoutPanelTop, MousePointerClick, Palette, PenTool, Plus, RotateCcw, Shapes, Trash2, Type } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createTranslator, type MessageKey } from '@bulava/localization';
import { CanvasArtboard, sectionDrawer, TemplateRenderer, themeStyle } from '@bulava/template-engine';
import {
  ADDED_SECTION_WIDTH,
  ADDED_SECTIONS_MAX,
  ArtboardSchema,
  SECTION_SCREEN_HEIGHT,
  canRedraw,
  effectiveColors,
  effectiveFonts,
  orderKeys,
  resolveBinding,
  sectionBoard,
  stableStringify,
  withCanvasCustomization,
  type AddedSection,
  type Artboard,
  type ArtboardInput,
  type CanvasSectionInstance,
  type Customization,
  type Fonts,
  type Layer,
  type RenderContext,
  type SectionInstance,
  type SectionKey,
  type TemplateDefinition,
  type ThemeColors,
} from '@bulava/template-schema';
import { layerShown, photoLayer } from '@/components/cards/editor-model';
import { ElementsPanel, TextPanel } from '@/components/cards/editor-panels';
import type { BoardEditorApi } from '@/components/cards/editor-types';
import { PanelSection } from '@/components/cards/editor-ui';
import { BoardStudio, type StudioControls, type StudioFlow, type StudioPanel, type StudioSide, type StudioTarget } from '@/components/editor/board-studio';
import { FrameDocument } from '@/components/editor/frame-document';
import { useT } from '@/lib/i18n';
import type { MediaItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PhotosPanel, StylePanel } from './design-panels';
import { snapshotSection } from './section-snapshot';
import { uploadDesignPhoto } from './upload-design-photo';

/** One of the website's artboards, drawn as the website draws it (its theme, the host's data, a redrawn section's template drawing behind). */
function WebsiteBoard({
  board,
  colors,
  fonts,
  theme,
  ctx,
  language,
  mode,
  drawSection,
}: {
  board: Artboard;
  colors: ThemeColors;
  fonts: Fonts;
  theme: TemplateDefinition['theme'];
  ctx: RenderContext;
  language: string;
  mode: 'edit' | 'thumbnail';
  drawSection?: (sectionId: string) => ReactNode;
}) {
  const t = useMemo(() => createTranslator(language), [language]);
  return (
    <div className={`bulava-template bulava-look-${theme.look ?? 'classic'}`} lang={language} style={{ ...themeStyle(theme, colors, fonts), width: '100%', backgroundColor: 'transparent' }}>
      <CanvasArtboard board={board} ctx={ctx} colors={colors} fonts={fonts} t={t} language={language} timeZone={ctx.event.timezone} mode={mode} drawSection={drawSection} />
    </div>
  );
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
  /** The free plan's mark across the whole invitation, in the preview (ADR-067). */
  veil?: string;
  /** Kinds of section guests won't see (no replies, no gallery): left out of the page here too. */
  without?: readonly SectionKey[];
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  /** The main button, when it is not Save (the design page: publish). */
  primary?: { label: string; onClick: () => void; disabled?: boolean; busy?: boolean };
}

type Starter = 'words' | 'photo' | 'date' | 'blank';
const STARTERS: Starter[] = ['words', 'photo', 'date', 'blank'];
/** A phone page, and a desktop one (the website's own breakpoints answer to these widths inside the editor's frame). */
const PAGE_WIDTH: Record<StudioSide, number> = { mobile: 390, desktop: 1440 };
const ACCENT = '#2563eb';
/** The phone's screen in the editor (screen-high heroes follow it, as a redrawn section's drawing does). */
const SCREEN: Record<StudioSide, string> = { mobile: `${SECTION_SCREEN_HEIGHT / 100}px`, desktop: '9px' };

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
type Part = { id: string; kind: 'template'; section: SectionInstance } | { id: string; kind: 'canvas'; section: CanvasSectionInstance; n: number } | { id: string; kind: 'mine'; added: AddedSection; n: number; original?: SectionInstance };

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

/** The page's parts in the order it draws them (the host's own order included, ADR-065). */
function partsOf(definition: TemplateDefinition, custom: Customization, ctx: RenderContext): Part[] {
  const added = custom.addedSections ?? [];
  const byAdded = new Map(added.map((a) => [a.id, a]));
  const own = new Map((definition.website?.pages[0]?.sections ?? []).map((s) => [s.id, s]));
  const keys = orderKeys(definition, added);
  const page = withCanvasCustomization(definition, null, added, custom.sectionOrder).website?.pages[0]?.sections ?? [];
  const out: Part[] = [];
  let mine = 0;
  let canvases = 0;
  for (const s of page) {
    const a = byAdded.get(s.id);
    if (a) {
      const original = keys.has(a.id) ? own.get(keys.get(a.id)!) : undefined;
      out.push({ id: a.id, kind: 'mine', added: a, n: ++mine, ...(original ? { original } : {}) });
    } else if (s.section === 'canvas' && s.canvas) out.push({ id: s.id, kind: 'canvas', section: s as CanvasSectionInstance, n: ++canvases });
    else if (shown(s, ctx)) out.push({ id: s.id, kind: 'template', section: s });
  }
  return out;
}

/** What a part is ordered by: a redrawn section keeps its original's place (ADR-065). */
const keyOf = (part: Part) => (part.kind === 'mine' ? (part.original?.id ?? part.added.id) : part.section.id);
const isFooter = (part: Part) => part.kind === 'template' && part.section.section === 'footer';

/** The layer under a point of a board (the topmost one shown there), to pick what the host clicked. */
function layerAt(board: Artboard, x: number, y: number, ctx: RenderContext): string | null {
  for (let i = board.layers.length - 1; i >= 0; i--) {
    const layer: Layer = board.layers[i]!;
    if (layer.hidden || !layerShown(layer, ctx)) continue;
    const f = layer.frame;
    if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) return layer.id;
  }
  return null;
}

/**
 * The invitation's canvas editor (ADR-057, ADR-059, ADR-060, ADR-065): the
 * whole page in one flow, drawn in a frame of the phone's (or desktop's) width
 * exactly as guests see it. The template's canvases and the host's own
 * sections are edited where they stand, like cards; clicking any other section
 * of the template makes it the host's to edit (redrawn in its place) with what
 * was clicked chosen. Sections move up and down, hide, and take new sections
 * between them. What the host changes is the design page's customization
 * (saved with its Save).
 */
export function CanvasDesigner(props: CanvasDesignerProps) {
  const { definition, custom, setCustom, context, photos, language, eventId } = props;
  const t = useT();
  const added = useMemo(() => custom.addedSections ?? [], [custom.addedSections]);
  const colors = useMemo(() => effectiveColors(definition, custom), [definition, custom]);
  const fonts = useMemo(() => effectiveFonts(definition, custom), [definition, custom]);
  const photoUrls = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, p.viewUrl])), [photos]);
  const ctxBase = useMemo((): RenderContext => (custom.custom ? { ...context, custom: { ...context.custom, ...custom.custom } } : context), [context, custom.custom]);
  const template = useMemo(() => new Map((definition.website?.pages[0]?.sections ?? []).map((s) => [s.id, s])), [definition]);
  // Sections guests won't see (no replies, no gallery) are not parts of the page here either.
  const without = props.without;
  const parts = useMemo(() => partsOf(definition, custom, ctxBase).filter((p) => p.kind !== 'template' || !without?.includes(p.section.section)), [definition, custom, ctxBase, without]);
  const hidden = useMemo(() => new Set(custom.hiddenSections ?? []), [custom.hiddenSections]);
  const sectionLabel = (s: SectionInstance) => t(`design.section.${s.section}` as MessageKey);
  const full = added.length >= ADDED_SECTIONS_MAX;
  const starters = STARTERS.filter((kind) => kind !== 'photo' || definition.capabilities.editable.photos);
  // The parts that move (the opening stays first and the footer last), by their order keys.
  const movable = useMemo(() => parts.filter((p, i) => i > 0 && !isFooter(p)).map(keyOf), [parts]);

  const labelOf = (part: Part): string => {
    if (part.kind === 'template') return sectionLabel(part.section);
    if (part.kind === 'mine') return part.original ? t('design.canvas.redrawnLabel', { section: sectionLabel(part.original) }) : t('design.canvas.yourSectionN', { n: part.n });
    const s = part.section;
    return s.canvas.repeatPerFunction ? t('design.canvas.functionCard') : part.n === 1 && definition.website?.pages[0]?.sections[0]?.id === s.id ? t('design.canvas.opening') : t('design.canvas.sectionN', { n: part.n });
  };

  // ── Where the page's parts are, and the part picked once it exists ──
  const partEls = useRef(new Map<string, HTMLElement>());
  const scrollTo = (id: string) => partEls.current.get(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  const flowApi = useRef<StudioFlow | null>(null);
  const pending = useRef<{ id: string; layer?: string | null; at?: { x: number; y: number; w: number; h: number } } | null>(null);
  const nodeOf = (id: string) => partEls.current.get(id)?.querySelector<HTMLElement>('[data-flow-node]') ?? null;
  const slots = useMemo(() => definition.capabilities.textSlots.map((s) => s.key), [definition]);
  // A redrawn section's drawing: the template's own section, in the host's colours and fonts.
  const drawer = useMemo(() => sectionDrawer({ definition, context, customization: custom, language, mode: 'preview' }), [definition, context, custom, language]);

  // ── What can be done with the page's parts ──
  const commitOrder = (controls: StudioControls, order: string[]) => controls.commit({ ...controls.custom, sectionOrder: order });
  const move = (part: Part, dir: -1 | 1, controls: StudioControls) => {
    const i = movable.indexOf(keyOf(part));
    const j = i + dir;
    if (i < 0 || j < 0 || j >= movable.length) return;
    const next = [...movable];
    [next[i], next[j]] = [next[j]!, next[i]!];
    commitOrder(controls, next);
    requestAnimationFrame(() => requestAnimationFrame(() => scrollTo(part.id)));
  };
  const toggleHidden = (part: Part, controls: StudioControls) => {
    if (part.kind === 'mine') return;
    const id = part.section.id;
    const list = controls.custom.hiddenSections ?? [];
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    const out: Customization = { ...controls.custom, hiddenSections: next };
    if (!next.length) delete out.hiddenSections;
    controls.commit(out);
  };
  const removeMine = (id: string, controls: StudioControls) => {
    const next = (controls.custom.addedSections ?? []).filter((a) => a.id !== id);
    const order = controls.custom.sectionOrder?.filter((key) => key !== id);
    const out: Customization = { ...controls.custom, addedSections: next, sectionOrder: order };
    if (!next.length) delete out.addedSections;
    if (!order?.length) delete out.sectionOrder;
    controls.commit(out);
  };
  /** A redrawn section's template drawing behind the host's words, shown or not. */
  const toggleDrawing = (part: Part, controls: StudioControls) => {
    if (part.kind !== 'mine') return;
    const next = (controls.custom.addedSections ?? []).map((a) => (a.id !== part.added.id ? a : { ...a, mobile: { ...a.mobile, layers: a.mobile.layers.map((l) => (l.kind === 'section' ? { ...l, hidden: !l.hidden } : l)) } }));
    controls.commit({ ...controls.custom, addedSections: next });
  };
  const resetCanvas = (id: string, controls: StudioControls) => {
    const canvas = { ...(controls.custom.canvas ?? {}) };
    delete canvas[id];
    const out: Customization = { ...controls.custom, canvas };
    if (!Object.keys(canvas).length) delete out.canvas;
    controls.commit(out);
  };
  /** A new section after a part (or at the end), in the page's order from then on. */
  const addAfter = (part: Part | null, kind: Starter, controls: StudioControls) => {
    const list = controls.custom.addedSections ?? [];
    if (list.length >= ADDED_SECTIONS_MAX) return controls.notify(t('design.canvas.full', { max: ADDED_SECTIONS_MAX }));
    const id = newSectionId();
    const anchor = part ? (part.kind === 'mine' ? (part.original?.id ?? part.added.after) : part.section.id) : '';
    const section: AddedSection = { id, after: anchor, mobile: starterBoard(kind, t) };
    const at = part && !isFooter(part) ? movable.indexOf(keyOf(part)) + 1 : movable.length;
    const order = [...movable.slice(0, at), id, ...movable.slice(at)];
    controls.commit({ ...controls.custom, addedSections: [...list, section], sectionOrder: order });
    pending.current = { id };
  };
  /**
   * One of the template's sections made the host's, in its place (ADR-065): read
   * from the phone's page, it keeps the template's drawing behind and its words
   * become the host's text layers, with what was clicked chosen. A timeline
   * (one card per function) is laid out afresh instead.
   */
  const redraw = (section: SectionInstance, controls: StudioControls, at?: { x: number; y: number; w: number; h: number }) => {
    const list = controls.custom.addedSections ?? [];
    if (list.length >= ADDED_SECTIONS_MAX) {
      controls.notify(t('design.canvas.full', { max: ADDED_SECTIONS_MAX }));
      return false;
    }
    // Sections are read from the phone's layout: on the desktop page, the editor turns to the phone first.
    if (controls.side !== 'mobile') {
      controls.setSide('mobile');
      controls.notify(t('design.canvas.toPhone'));
      whenOnPhone(section.id, () => redraw(section, { ...controls, side: 'mobile' }));
      return true;
    }
    const node = section.section === 'eventTimeline' ? null : nodeOf(section.id);
    const snap = node ? snapshotSection(node, section, { ctx: ctxBase, colors, language, slots }, at ? { x: at.x, y: at.y } : undefined) : null;
    const made = snap ? { board: snap.board, perFunction: false } : sectionBoard(definition, section);
    if (!made) return false;
    const id = newSectionId();
    const stand: AddedSection = { id, after: section.id, replaces: true, mobile: made.board, ...(made.perFunction ? { perFunction: true } : {}) };
    controls.commit({ ...controls.custom, addedSections: [...list, stand] });
    pending.current = snap ? { id, layer: snap.pick } : { id, ...(at ? { at } : {}) };
    controls.notify(t('design.canvas.nowYours', { section: sectionLabel(section) }));
    return true;
  };
  /** Runs once the section is drawn on the phone's page (the phone's frame loads after the switch). */
  const whenOnPhone = (id: string, run: () => void, tries = 0) => {
    const node = nodeOf(id);
    if (node && Math.abs(node.getBoundingClientRect().width - PAGE_WIDTH.mobile) < 2) run();
    else if (tries < 180) requestAnimationFrame(() => whenOnPhone(id, run, tries + 1));
  };

  const targets: StudioTarget[] = useMemo(() => {
    const perFunction = ctxBase.functions[0] ? { ...ctxBase, function: ctxBase.functions[0], venue: ctxBase.functions[0].venue ?? ctxBase.venue } : ctxBase;
    const aside = (part: Part) => (controls: StudioControls) => (
      <PartAside
        part={part}
        drawing={part.kind === 'mine' ? part.added.mobile.layers.find((l) => l.kind === 'section') : undefined}
        onToggleDrawing={() => toggleDrawing(part, controls)}
        label={labelOf(part)}
        hidden={part.kind !== 'mine' && hidden.has(part.section.id)}
        fixed={parts[0]?.id === part.id || isFooter(part)}
        first={movable.indexOf(keyOf(part)) <= 0}
        last={movable.indexOf(keyOf(part)) === movable.length - 1}
        edited={part.kind === 'canvas' && Boolean(controls.custom.canvas?.[part.section.id])}
        full={full}
        starters={starters}
        onMove={(dir) => move(part, dir, controls)}
        onToggleHidden={() => toggleHidden(part, controls)}
        onRedraw={part.kind === 'template' ? () => redraw(part.section, controls) : undefined}
        onReset={part.kind === 'canvas' ? () => window.confirm(t('design.canvas.resetConfirm')) && resetCanvas(part.section.id, controls) : undefined}
        onRemove={part.kind === 'mine' ? () => window.confirm(t(part.original ? 'design.canvas.restoreOriginalConfirm' : 'design.canvas.removeConfirm')) && removeMine(part.added.id, controls) : undefined}
        onAdd={(kind) => addAfter(part, kind, controls)}
        t={t}
      />
    );
    return parts.map((part): StudioTarget => {
      if (part.kind === 'canvas') {
        const s = part.section;
        const own = template.get(s.id) as CanvasSectionInstance | undefined;
        const canvas = own?.canvas ?? s.canvas;
        return {
          id: s.id,
          label: labelOf(part),
          sides: canvas.desktop ? ['mobile', 'desktop'] : ['mobile'],
          board: (side) => custom.canvas?.[s.id]?.[side] ?? (side === 'desktop' && canvas.desktop ? canvas.desktop : canvas.mobile),
          ctx: canvas.repeatPerFunction ? perFunction : ctxBase,
          aside: aside(part),
        };
      }
      if (part.kind === 'mine') {
        const a = part.added;
        return { id: a.id, label: labelOf(part), sides: ['mobile'], board: () => a.mobile, ctx: a.perFunction ? perFunction : ctxBase, aside: aside(part) };
      }
      return { id: part.id, label: labelOf(part), sides: ['mobile'], ctx: ctxBase, view: { width: PAGE_WIDTH.mobile, height: 844, render: () => null, aside: aside(part) }, aside: aside(part) };
    });
    // The callbacks read the latest customization through the studio's controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, custom, ctxBase, definition, hidden, movable, full, t]);

  // A part just made (a redrawn section, a new one): pick it once it is on the page, with the layer under the click.
  useEffect(() => {
    const want = pending.current;
    const api = flowApi.current;
    if (!want || !api) return;
    const target = targets.find((x) => x.id === want.id);
    const board = target?.board?.('mobile');
    if (!target || !board) return;
    pending.current = null;
    const layer = want.layer !== undefined ? want.layer : want.at ? layerAt(board, (want.at.x / want.at.w) * board.width, (want.at.y / want.at.h) * board.height, target.ctx) : null;
    api.activate(target.id, layer);
    requestAnimationFrame(() => requestAnimationFrame(() => (want.at || want.layer !== undefined ? undefined : scrollTo(target.id))));
  }, [targets]);

  const writeBoard = (c: Customization, targetId: string, side: StudioSide, board: Artboard): Customization => {
    const mineIndex = (c.addedSections ?? []).findIndex((a) => a.id === targetId);
    if (mineIndex !== -1) {
      const next = [...(c.addedSections ?? [])];
      next[mineIndex] = { ...next[mineIndex]!, mobile: board };
      return { ...c, addedSections: next };
    }
    const section = template.get(targetId) as CanvasSectionInstance | undefined;
    if (!section?.canvas) return c;
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
        <SectionsList
          parts={parts}
          labelOf={labelOf}
          controls={controls}
          hidden={hidden}
          movable={movable}
          full={full}
          starters={starters}
          onPick={(part) => {
            controls.selectTarget(part.id);
            scrollTo(part.id);
          }}
          onMove={(part, dir) => move(part, dir, controls)}
          onToggleHidden={(part) => toggleHidden(part, controls)}
          onAdd={(kind) => addAfter(parts.find((p) => p.id === controls.target?.id) ?? null, kind, controls)}
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

  // The page as the website draws it, every section shown (hidden ones dimmed here), with the editor's tools around each part.
  const pageCustom = useMemo(() => {
    const { hiddenSections: _hidden, ...rest } = custom;
    return rest;
  }, [custom]);
  const byId = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);

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
      renderBoard={(board, target) => (
        <WebsiteBoard
          board={board}
          colors={colors}
          fonts={fonts}
          theme={definition.theme}
          ctx={target.ctx}
          language={language}
          mode="edit"
          drawSection={(id) => drawer(id, Math.max(0, parts.findIndex((p) => p.id === target.id)))}
        />
      )}
      panels={panels}
      flow={{
        width: (side) => PAGE_WIDTH[side],
        render: (args) => {
          flowApi.current = args;
          return (
            <PageFlow
              args={args}
              definition={definition}
              context={context}
              custom={pageCustom}
              language={language}
              without={props.without}
              byId={byId}
              parts={parts}
              hidden={hidden}
              movable={movable}
              starters={starters}
              labelOf={labelOf}
              register={(id, el) => {
                if (el) partEls.current.set(id, el);
                else partEls.current.delete(id);
              }}
              onTemplateClick={(part, at) => {
                if (part.kind !== 'template') return;
                // A hidden section is shown again before it is made the host's (its tools say so).
                if (hidden.has(part.section.id) || !canRedraw(part.section) || !redraw(part.section, args.controls, args.side === 'mobile' ? at : undefined)) args.activate(part.id, null);
              }}
              onMove={(part, dir) => move(part, dir, args.controls)}
              onToggleHidden={(part) => toggleHidden(part, args.controls)}
              onRestore={(part) => {
                if (part.kind === 'mine' && window.confirm(t(part.original ? 'design.canvas.restoreOriginalConfirm' : 'design.canvas.removeConfirm'))) removeMine(part.added.id, args.controls);
                if (part.kind === 'canvas' && window.confirm(t('design.canvas.resetConfirm'))) resetCanvas(part.section.id, args.controls);
              }}
              onAdd={(part, kind) => addAfter(part, kind, args.controls)}
              t={t}
            />
          );
        },
      }}
      renderPreview={() => (
        <FrameDocument width={PAGE_WIDTH.mobile} height={760} title={t('design.livePreview')}>
          <TemplateRenderer definition={definition} context={context} customization={custom} mode="preview" language={language} without={props.without} slots={{ watermark: props.watermark, veil: props.veil }} />
        </FrameDocument>
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
      primary={props.primary ?? { label: props.saving ? t('common.saving') : props.dirty ? t('design.saveChanges') : t('design.savedBadge'), onClick: props.onSave, disabled: !props.dirty, busy: props.saving }}
      onClose={props.onClose}
    />
  );
}

/**
 * The page inside the editor's frame: the website drawn by the template's own
 * renderer, each part wrapped with its tools. Boards are live stages; the
 * template's other sections take a click to become the host's.
 */
function PageFlow({
  args,
  definition,
  context,
  custom,
  language,
  without,
  byId,
  parts,
  hidden,
  movable,
  starters,
  labelOf,
  register,
  onTemplateClick,
  onMove,
  onToggleHidden,
  onRestore,
  onAdd,
  t,
}: {
  args: StudioFlow;
  definition: TemplateDefinition;
  context: RenderContext;
  custom: Customization;
  language: string;
  without?: readonly SectionKey[];
  byId: Map<string, Part>;
  parts: Part[];
  hidden: Set<string>;
  movable: string[];
  starters: Starter[];
  labelOf: (part: Part) => string;
  register: (id: string, el: HTMLElement | null) => void;
  /** A click on one of the template's sections, where it landed in the section. */
  onTemplateClick: (part: Part, at: { x: number; y: number; w: number; h: number }) => void;
  onMove: (part: Part, dir: -1 | 1) => void;
  onToggleHidden: (part: Part) => void;
  onRestore: (part: Part) => void;
  onAdd: (part: Part, kind: Starter) => void;
  t: ReturnType<typeof useT>;
}) {
  const [inserting, setInserting] = useState<string | null>(null);
  const counter = 1 / Math.max(args.zoom, 0.2);
  const lastId = parts[parts.length - 1]?.id;

  const wrap = (instance: SectionInstance, node: ReactNode): ReactNode => {
    const part = byId.get(instance.id);
    if (!part) return node;
    const active = args.activeId === part.id;
    const isHidden = part.kind !== 'mine' && hidden.has(part.section.id);
    const index = parts.indexOf(part);
    const key = keyOf(part);
    const fixed = index === 0 || isFooter(part);
    const i = movable.indexOf(key);
    const board = part.kind !== 'template';
    // A phone board on a wide page sits centred, as the website shows it.
    const narrowOnWide = args.side === 'desktop' && (part.kind === 'mine' || (part.kind === 'canvas' && !part.section.canvas.desktop));
    const perFunction = (part.kind === 'canvas' && part.section.canvas.repeatPerFunction) || (part.kind === 'mine' && part.added.perFunction);
    const redrawable = part.kind === 'template' && canRedraw(part.section);
    return (
      <div ref={(el) => register(part.id, el)} data-flow-part={part.id} className="group/part relative" style={{ scrollMarginTop: 24 }}>
        <div className={cn(isHidden && 'opacity-35 saturate-50')}>
          {board ? (
            narrowOnWide ? <div className="flex justify-center bg-black/[0.04] py-14">{args.stage(part.id)}</div> : args.stage(part.id)
          ) : (
            <div className="relative" data-flow-node="">
              {node}
              <button
                type="button"
                aria-label={redrawable ? t('design.canvas.editNamed', { section: labelOf(part) }) : labelOf(part)}
                className={cn('absolute inset-0 z-10 block w-full bg-transparent', redrawable ? 'cursor-pointer' : 'cursor-default')}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  onTemplateClick(part, { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
                }}
              />
            </div>
          )}
        </div>
        {/* The part's edge and name: on hover, and while it is the one being edited. */}
        <div aria-hidden className={cn('pointer-events-none absolute inset-0 z-20 transition-shadow duration-150', active ? 'shadow-[inset_0_0_0_2px_#2563eb]' : 'group-hover/part:shadow-[inset_0_0_0_1px_rgba(37,99,235,0.6)]')} />
        <div className={cn('pointer-events-none absolute top-2 left-2 z-30 flex origin-top-left items-center gap-1 transition-opacity', active ? 'opacity-100' : 'opacity-0 group-hover/part:opacity-100')} style={{ zoom: counter }}>
          <span className="rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold text-white shadow" style={{ background: ACCENT }}>
            {labelOf(part)}
          </span>
          {isHidden ? <span className="rounded-full bg-stone-900/85 px-2 py-0.5 font-sans text-[11px] font-semibold text-white">{t('design.canvas.hidden')}</span> : null}
          {perFunction ? <span className="rounded-full bg-stone-900/85 px-2 py-0.5 font-sans text-[11px] text-white">{t('design.canvas.perFunction')}</span> : null}
          {part.kind === 'template' && !active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 font-sans text-[11px] font-medium text-stone-800 shadow">
              <MousePointerClick aria-hidden className="size-3" />
              {redrawable ? t('design.canvas.clickToEdit') : t('design.canvas.worksOnItsOwn')}
            </span>
          ) : null}
        </div>
        {/* The part's tools. */}
        <div
          role="toolbar"
          aria-label={t('design.canvas.sectionTools')}
          className={cn('absolute top-2 right-2 z-30 flex origin-top-right items-center gap-0.5 rounded-xl bg-stone-900/90 p-1 font-sans text-white shadow-lg backdrop-blur transition-opacity', active ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover/part:pointer-events-auto group-hover/part:opacity-100')}
          style={{ zoom: counter }}
        >
          {!fixed ? (
            <>
              <ToolButton label={t('design.canvas.moveUp')} disabled={i <= 0} onClick={() => onMove(part, -1)}>
                <ArrowUp aria-hidden className="size-4" />
              </ToolButton>
              <ToolButton label={t('design.canvas.moveDown')} disabled={i === movable.length - 1} onClick={() => onMove(part, 1)}>
                <ArrowDown aria-hidden className="size-4" />
              </ToolButton>
            </>
          ) : null}
          {part.kind !== 'mine' && index !== 0 ? (
            <ToolButton label={isHidden ? t('design.canvas.showSection') : t('design.canvas.hideSection')} onClick={() => onToggleHidden(part)}>
              {isHidden ? <Eye aria-hidden className="size-4" /> : <EyeOff aria-hidden className="size-4" />}
            </ToolButton>
          ) : null}
          {part.kind === 'mine' && part.original ? (
            <ToolButton label={t('design.canvas.restoreOriginal')} onClick={() => onRestore(part)}>
              <RotateCcw aria-hidden className="size-4" />
            </ToolButton>
          ) : null}
          {part.kind === 'canvas' && custom.canvas?.[part.section.id] ? (
            <ToolButton label={t('design.canvas.reset')} onClick={() => onRestore(part)}>
              <RotateCcw aria-hidden className="size-4" />
            </ToolButton>
          ) : null}
          {part.kind === 'mine' && !part.original ? (
            <ToolButton label={t('design.canvas.removeSection')} onClick={() => onRestore(part)}>
              <Trash2 aria-hidden className="size-4" />
            </ToolButton>
          ) : null}
        </div>
        {/* A new section after this one (never after the footer). */}
        {part.id !== lastId && !isFooter(part) ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex translate-y-1/2 justify-center" style={{ zoom: counter }}>
            <div className="pointer-events-auto relative">
              <button
                type="button"
                aria-label={t('design.canvas.insertHere')}
                aria-expanded={inserting === part.id}
                title={t('design.canvas.insertHere')}
                onClick={() => setInserting((v) => (v === part.id ? null : part.id))}
                className={cn('grid size-7 place-items-center rounded-full text-white shadow-lg ring-2 ring-white transition-opacity focus-visible:opacity-100', active || inserting === part.id ? 'opacity-100' : 'opacity-0 group-hover/part:opacity-100')}
                style={{ background: ACCENT }}
              >
                <Plus aria-hidden className="size-4" />
              </button>
              {inserting === part.id ? (
                <div className="absolute top-9 left-1/2 flex -translate-x-1/2 gap-1 rounded-xl bg-stone-900/95 p-1 font-sans shadow-xl">
                  {starters.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => {
                        setInserting(null);
                        onAdd(part, kind);
                      }}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap text-white hover:bg-white/15"
                    >
                      <CopyPlus aria-hidden className="size-3.5" />
                      {t(`design.canvas.starter.${kind}`)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-[120px] bg-white" style={{ ['--bulava-screen' as string]: SCREEN[args.side] }}>
      <TemplateRenderer definition={definition} context={context} customization={custom} mode="preview" language={language} without={without} wrapSection={wrap} />
    </div>
  );
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid size-8 place-items-center rounded-lg text-white transition-colors hover:bg-white/15 disabled:opacity-35">
      {children}
    </button>
  );
}

/** Beside the part being edited, while none of its layers is chosen: what it is and what can be done with it. */
function PartAside({
  part,
  drawing,
  onToggleDrawing,
  label,
  hidden,
  fixed,
  first,
  last,
  edited,
  full,
  starters,
  onMove,
  onToggleHidden,
  onRedraw,
  onReset,
  onRemove,
  onAdd,
  t,
}: {
  part: Part;
  /** A redrawn section's template drawing, behind the host's words. */
  drawing?: Layer;
  onToggleDrawing: () => void;
  label: string;
  hidden: boolean;
  fixed: boolean;
  first: boolean;
  last: boolean;
  edited: boolean;
  full: boolean;
  starters: Starter[];
  onMove: (dir: -1 | 1) => void;
  onToggleHidden: () => void;
  onRedraw?: () => void;
  onReset?: () => void;
  onRemove?: () => void;
  onAdd: (kind: Starter) => void;
  t: ReturnType<typeof useT>;
}) {
  const redrawable = part.kind === 'template' && canRedraw(part.section);
  const badge = part.kind === 'template' ? t('design.canvas.badge.template') : part.kind === 'mine' ? (part.original ? t('design.canvas.badge.redrawn') : t('design.canvas.badge.yours')) : edited ? t('design.canvas.edited') : null;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex flex-wrap items-center gap-2 font-display text-xl">
          {label}
          {badge ? <span className="rounded-full bg-[var(--ed-dot)] px-2 py-0.5 font-sans text-[0.625rem] font-semibold text-stone-700">{badge}</span> : null}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
          {hidden ? t('design.canvas.hiddenNote') : part.kind === 'template' ? (redrawable ? t('design.canvas.templatePart') : t('design.canvas.notRedrawable')) : t('design.canvas.partHint')}
        </p>
        {(part.kind === 'canvas' && part.section.canvas.repeatPerFunction) || (part.kind === 'mine' && part.added.perFunction) ? <p className="mt-1.5 text-xs text-stone-500">{t('design.canvas.repeatsNote')}</p> : null}
      </div>
      {onRedraw && redrawable && !hidden ? (
        <div>
          <button type="button" onClick={onRedraw} disabled={full} className="btn-3d min-h-12 w-full justify-center gap-2 rounded-xl text-sm disabled:opacity-50">
            <PenTool aria-hidden className="size-4" /> {t('design.canvas.redraw')}
          </button>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-500">{full ? t('design.canvas.full', { max: ADDED_SECTIONS_MAX }) : t('design.canvas.redrawHint')}</p>
        </div>
      ) : null}
      {!fixed ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onMove(-1)} disabled={first} className="btn-3d btn-3d-light min-h-11 justify-center gap-1.5 rounded-xl text-sm disabled:opacity-40">
            <ArrowUp aria-hidden className="size-4" /> {t('design.canvas.moveUp')}
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={last} className="btn-3d btn-3d-light min-h-11 justify-center gap-1.5 rounded-xl text-sm disabled:opacity-40">
            <ArrowDown aria-hidden className="size-4" /> {t('design.canvas.moveDown')}
          </button>
        </div>
      ) : part.kind === 'template' && part.section.section === 'hero' ? (
        <p className="text-xs leading-relaxed text-stone-500">{t('design.canvas.openingAlways')}</p>
      ) : null}
      {part.kind !== 'mine' && !(part.kind === 'template' && part.section.section === 'hero') && !(fixed && !isFooter(part)) ? (
        <button type="button" onClick={onToggleHidden} className="btn-3d btn-3d-light min-h-11 w-full justify-center gap-2 rounded-xl text-sm">
          {hidden ? <Eye aria-hidden className="size-4" /> : <EyeOff aria-hidden className="size-4" />}
          {hidden ? t('design.canvas.showSection') : t('design.canvas.hideSection')}
        </button>
      ) : null}
      {drawing ? (
        <div>
          <button type="button" onClick={onToggleDrawing} aria-pressed={!drawing.hidden} className="btn-3d btn-3d-light min-h-11 w-full justify-center gap-2 rounded-xl text-sm">
            {drawing.hidden ? <Eye aria-hidden className="size-4" /> : <EyeOff aria-hidden className="size-4" />}
            {drawing.hidden ? t('design.canvas.showDrawing') : t('design.canvas.hideDrawing')}
          </button>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-500">{t('design.canvas.drawingHint')}</p>
        </div>
      ) : null}
      {onReset && edited ? (
        <button type="button" onClick={onReset} className="btn-3d btn-3d-light min-h-11 w-full justify-center gap-2 rounded-xl text-sm">
          <RotateCcw aria-hidden className="size-4" /> {t('design.canvas.reset')}
        </button>
      ) : null}
      {onRemove ? (
        <button type="button" onClick={onRemove} className="btn-3d btn-3d-light min-h-11 w-full justify-center gap-2 rounded-xl text-sm">
          {part.kind === 'mine' && part.original ? <RotateCcw aria-hidden className="size-4" /> : <Trash2 aria-hidden className="size-4" />}
          {part.kind === 'mine' && part.original ? t('design.canvas.restoreOriginal') : t('design.canvas.removeSection')}
        </button>
      ) : null}
      {!isFooter(part) ? (
        <PanelSection title={t('design.canvas.addAfter')} hint={full ? t('design.canvas.full', { max: ADDED_SECTIONS_MAX }) : undefined}>
          <div className="grid grid-cols-2 gap-2">
            {starters.map((kind) => (
              <button key={kind} type="button" disabled={full} onClick={() => onAdd(kind)} className="btn-3d btn-3d-light min-h-11 justify-center gap-1.5 rounded-xl px-2 text-xs disabled:opacity-50">
                <CopyPlus aria-hidden className="size-4" />
                {t(`design.canvas.starter.${kind}`)}
              </button>
            ))}
          </div>
        </PanelSection>
      ) : null}
    </div>
  );
}

/** The page's parts from top to bottom: go to one, move it, hide it, or add a new section. */
function SectionsList({
  parts,
  labelOf,
  controls,
  hidden,
  movable,
  full,
  starters,
  onPick,
  onMove,
  onToggleHidden,
  onAdd,
  t,
}: {
  parts: Part[];
  labelOf: (part: Part) => string;
  controls: StudioControls;
  hidden: Set<string>;
  movable: string[];
  full: boolean;
  starters: Starter[];
  onPick: (part: Part) => void;
  onMove: (part: Part, dir: -1 | 1) => void;
  onToggleHidden: (part: Part) => void;
  onAdd: (kind: Starter) => void;
  t: ReturnType<typeof useT>;
}) {
  const small = 'grid size-8 shrink-0 place-items-center rounded-lg text-stone-600 transition-colors hover:bg-white/70 hover:text-ink disabled:opacity-30';
  return (
    <div className="space-y-6">
      <PanelSection title={t('design.canvas.page')} hint={t('design.canvas.sectionsHint')}>
        <ol className="space-y-1">
          {parts.map((part, index) => {
            const active = controls.target?.id === part.id;
            const isHidden = part.kind !== 'mine' && hidden.has(part.section.id);
            const i = movable.indexOf(keyOf(part));
            const fixed = index === 0 || isFooter(part);
            const badge = part.kind === 'mine' ? (part.original ? t('design.canvas.badge.redrawn') : t('design.canvas.badge.yours')) : part.kind === 'canvas' && controls.custom.canvas?.[part.section.id] ? t('design.canvas.edited') : null;
            return (
              <li key={part.id} className={cn('flex items-center gap-0.5 rounded-xl py-0.5 pr-0.5 pl-1 transition-colors', active ? 'bg-surface shadow-clay-sm ring-2 ring-brand-600' : 'hover:bg-white/60')}>
                <button type="button" aria-current={active ? 'true' : undefined} onClick={() => onPick(part)} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 text-left">
                  <span className="w-5 shrink-0 text-right text-[0.6875rem] text-stone-500 tabular-nums">{index + 1}</span>
                  <span className={cn('min-w-0 truncate text-sm font-medium', isHidden && 'text-stone-500 line-through')}>{labelOf(part)}</span>
                  {badge ? <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-0.5 text-[0.625rem] text-brand-700">{badge}</span> : null}
                </button>
                {!fixed ? (
                  <>
                    <button type="button" className={small} disabled={i <= 0} onClick={() => onMove(part, -1)} aria-label={`${t('design.canvas.moveUp')}: ${labelOf(part)}`} title={t('design.canvas.moveUp')}>
                      <ArrowUp aria-hidden className="size-4" />
                    </button>
                    <button type="button" className={small} disabled={i === movable.length - 1} onClick={() => onMove(part, 1)} aria-label={`${t('design.canvas.moveDown')}: ${labelOf(part)}`} title={t('design.canvas.moveDown')}>
                      <ArrowDown aria-hidden className="size-4" />
                    </button>
                  </>
                ) : null}
                {part.kind !== 'mine' && index !== 0 ? (
                  <button
                    type="button"
                    className={small}
                    onClick={() => onToggleHidden(part)}
                    aria-label={`${isHidden ? t('design.canvas.showSection') : t('design.canvas.hideSection')}: ${labelOf(part)}`}
                    title={isHidden ? t('design.canvas.showSection') : t('design.canvas.hideSection')}
                  >
                    {isHidden ? <Eye aria-hidden className="size-4" /> : <EyeOff aria-hidden className="size-4" />}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      </PanelSection>
      <PanelSection title={t('design.canvas.addSection')} hint={full ? t('design.canvas.full', { max: ADDED_SECTIONS_MAX }) : t('design.canvas.addSectionHint')}>
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
