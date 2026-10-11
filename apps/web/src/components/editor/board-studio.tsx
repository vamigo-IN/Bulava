'use client';

import { ArrowLeft, ChevronDown, ChevronUp, Eye, EyeOff, LoaderCircle, Monitor, Redo2, Smartphone, Undo2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createTranslator } from '@bulava/localization';
import { Stage, TemplateStyles, useHistory } from '@bulava/template-engine';
import { resolveBinding, type Artboard, type Customization, type Fonts, type GalleryImage, type Layer, type PhotoSlot, type RenderContext, type ThemeColors } from '@bulava/template-schema';
import { LayerInspector } from '@/components/cards/editor-inspector';
import { layerShown, newLayerId, PHOTO_PLACEHOLDER } from '@/components/cards/editor-model';
import type { BoardDesign, BoardEditorApi } from '@/components/cards/editor-types';
import { IconButton } from '@/components/cards/editor-ui';
import { CanvasToolbar, DeviceFrame, ThemeToggle, useEditorTheme } from '@/components/editor/editor-chrome';
import { errorMessage, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * The canvas studio both hosts' editors are built on (ADR-057, ADR-059): the
 * invitation website's canvas editor and the film's. It shows one board at a
 * time (a section of the website, a scene of the film) on the card editor's
 * stage, with its inspector and panels, a whole-design preview, light or dark
 * chrome, one undo history and the keyboard. What a board is, how a change is
 * written back into the customization, and what the panels and preview show
 * come from the editor that uses it.
 */

export type StudioSide = 'mobile' | 'desktop';

export interface StudioTarget {
  id: string;
  /** What the host calls it: "Opening", "Function card", "Section 3". */
  label: string;
  sides: readonly StudioSide[];
  /** The board as the design draws it now. */
  board: (side: StudioSide) => Artboard;
  /** The data its layers read (a per-function section or scene reads the first function). */
  ctx: RenderContext;
}

/** What a panel gets: the board editor the inspector uses, and the studio's own state. */
export interface StudioApi {
  editor: BoardEditorApi;
  target: StudioTarget;
  side: StudioSide;
  custom: Customization;
  /** A change to the whole customization, as one undo step. */
  commit: (next: Customization, merge?: string) => void;
  selectTarget: (id: string) => void;
}

export interface StudioPanel {
  key: string;
  label: string;
  icon: ReactNode;
  render: (api: StudioApi | null) => ReactNode;
}

export interface BoardStudioProps {
  /** A website's sections or a film's scenes (the panels' and inspector's wording). */
  kind: 'website' | 'film';
  /** The design's name, in the top bar. */
  title: string;
  labels: { dialog: string; canvas: string; hint: string; close: string; empty: string };
  targets: StudioTarget[];
  /** The target to open on when it exists (else the first). */
  targetId?: string | null;
  onTargetChange?: (id: string) => void;
  custom: Customization;
  setCustom: (next: Customization) => void;
  /** Writes a board back into the customization (dropping it when it is the template's again). */
  writeBoard: (custom: Customization, targetId: string, side: StudioSide, board: Artboard) => Customization;
  colors: ThemeColors;
  fonts: Fonts;
  language: string;
  /** Draws a board as the design does (a website's theme, a film's backdrop behind it). */
  renderBoard: (board: Artboard, target: StudioTarget, size: { width: number; height: number }) => ReactNode;
  panels: StudioPanel[];
  renderPreview: () => ReactNode;
  /** Draw the phone around this side's board (on big screens). */
  framed: (side: StudioSide) => boolean;
  photoUrls: Record<string, string>;
  uploadPhoto: (file: File) => Promise<string>;
  /** Buttons before the theme switch (Restore). */
  actions?: (api: StudioApi | null) => ReactNode;
  primary: { label: string; onClick: () => void; disabled?: boolean; busy?: boolean };
  onClose: () => void;
}

const SLOT_BINDING = /^photo\.(cover|partnerOne|partnerTwo|story|closing)$/;
const INDEX_BINDING = /^photos\[(\d+)\]$/;
const PLACEHOLDER: GalleryImage = { url: PHOTO_PLACEHOLDER, thumbUrl: PHOTO_PLACEHOLDER, width: 800, height: 800 };
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_LAYERS = 120;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** The photo in each photo spot, by binding, from the host's choices. */
export function photosOf(custom: Customization): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [slot, id] of Object.entries(custom.photoSlots ?? {})) if (id) out[`photo.${slot}`] = id;
  (custom.photoIds ?? []).forEach((id, i) => {
    out[`photos[${i}]`] = id;
  });
  return out;
}

/** The host's choices with the photo spots as the editor left them (photos[n] keep their order; a gap repeats the first photo). */
export function withPhotos(custom: Customization, photos: Partial<Record<string, string>>): Customization {
  const slots: Partial<Record<PhotoSlot, string>> = {};
  const indexed = new Map<number, string>();
  for (const [binding, id] of Object.entries(photos)) {
    if (!id) continue;
    const slot = SLOT_BINDING.exec(binding)?.[1];
    if (slot) slots[slot as PhotoSlot] = id;
    const n = INDEX_BINDING.exec(binding)?.[1];
    if (n !== undefined) indexed.set(Number(n), id);
  }
  const next: Customization = { ...custom };
  if (Object.keys(slots).length) next.photoSlots = slots;
  else delete next.photoSlots;
  if (indexed.size) {
    const first = indexed.get(Math.min(...indexed.keys()))!;
    next.photoIds = Array.from({ length: Math.max(...indexed.keys()) + 1 }, (_, i) => indexed.get(i) ?? first);
  } else delete next.photoIds;
  return next;
}

/** A sample photo in the photo spots that have none yet, so they can be seen and chosen. */
function withPlaceholders(board: Artboard, ctx: RenderContext): RenderContext {
  const empty = board.layers.flatMap((l) => (l.kind === 'image' && l.source.type === 'binding' && !l.hidden && !resolveBinding(l.source.binding, ctx) ? [l.source.binding] : []));
  if (!empty.length) return ctx;
  const slots = { ...(ctx.photoSlots ?? {}) };
  const list = [...ctx.photos];
  for (const binding of empty) {
    const slot = SLOT_BINDING.exec(binding)?.[1];
    if (slot) slots[slot as PhotoSlot] = PLACEHOLDER;
    const n = INDEX_BINDING.exec(binding)?.[1];
    if (n !== undefined) for (let i = list.length; i <= Number(n); i++) list.push(PLACEHOLDER);
  }
  return { ...ctx, photoSlots: slots, photos: list };
}

export function BoardStudio(props: BoardStudioProps) {
  const { targets, custom, setCustom, colors, fonts, language } = props;
  const t = useT();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [theme, setTheme] = useEditorTheme();
  const [chosen, setChosen] = useState<string | null>(props.targetId ?? null);
  const target: StudioTarget | undefined = targets.find((x) => x.id === chosen) ?? targets[0];
  const [sideChoice, setSideChoice] = useState<StudioSide>('mobile');
  const side: StudioSide = target?.sides.includes(sideChoice) ? sideChoice : 'mobile';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<string>(props.panels[0]?.key ?? '');
  const [sheet, setSheet] = useState<'panel' | 'inspector' | null>(null);
  const [sheetFolded, setSheetFolded] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  const selectTarget = useCallback(
    (id: string) => {
      setChosen(id);
      setSelectedId(null);
      props.onTargetChange?.(id);
    },
    [props],
  );

  // ── The host's choices, with one undo history for everything changed here ──
  const customRef = useRef(custom);
  customRef.current = custom;
  const history = useHistory<Customization>(80);
  const lastMerge = useRef<{ key: string; at: number } | null>(null);
  const commit = useCallback(
    (next: Customization, merge?: string) => {
      const current = customRef.current;
      if (next === current) return;
      const now = Date.now();
      const sameBurst = merge !== undefined && lastMerge.current?.key === merge && now - lastMerge.current.at < 1200;
      if (!sameBurst) history.record(current);
      lastMerge.current = merge ? { key: merge, at: now } : null;
      customRef.current = next;
      setCustom(next);
    },
    [history, setCustom],
  );
  const undo = useCallback(() => {
    const previous = history.undo(customRef.current);
    lastMerge.current = null;
    if (previous) {
      customRef.current = previous;
      setCustom(previous);
    }
  }, [history, setCustom]);
  const redo = useCallback(() => {
    const next = history.redo(customRef.current);
    lastMerge.current = null;
    if (next) {
      customRef.current = next;
      setCustom(next);
    }
  }, [history, setCustom]);

  // ── The board on the stage, as a design the shared panels and inspector understand ──
  const board = target?.board(side) ?? null;
  const photoMap = useMemo(() => photosOf(custom), [custom]);
  const design: BoardDesign | null = useMemo(() => (board ? { board, colors, fonts, language, photos: photoMap } : null), [board, colors, fonts, language, photoMap]);
  const designRef = useRef(design);
  designRef.current = design;
  const { writeBoard } = props;

  const change = useCallback(
    (fn: (d: BoardDesign) => BoardDesign, merge?: string) => {
      const current = designRef.current;
      if (!current || !target) return;
      const next = fn(current);
      if (next === current) return;
      let c = customRef.current;
      if (next.board !== current.board) c = writeBoard(c, target.id, side, next.board);
      if (next.colors !== current.colors) c = { ...c, colors: next.colors };
      if (next.photos !== current.photos) c = withPhotos(c, next.photos);
      commit(c, merge);
    },
    [commit, writeBoard, target, side],
  );
  const changeLayer = useCallback(
    (id: string, fn: (l: Layer) => Layer, merge?: string) => change((d) => ({ ...d, board: { ...d.board, layers: d.board.layers.map((l) => (l.id === id ? fn(l) : l)) } }), merge),
    [change],
  );
  const addLayer = useCallback(
    (layer: Layer) => {
      const added = { ...layer, id: newLayerId(layer.kind) } as Layer;
      change((d) => (d.board.layers.length >= MAX_LAYERS ? d : { ...d, board: { ...d.board, layers: [...d.board.layers, added] } }));
      setSelectedId(added.id);
    },
    [change],
  );
  const removeLayer = useCallback(
    (id: string) => {
      change((d) => ({ ...d, board: { ...d.board, layers: d.board.layers.filter((l) => l.id !== id) } }));
      setSelectedId(null);
    },
    [change],
  );
  useEffect(() => {
    if (selectedId && board && !board.layers.some((l) => l.id === selectedId)) setSelectedId(null);
  }, [board, selectedId]);

  const { uploadPhoto: upload } = props;
  const uploadPhoto = useCallback(
    async (file: File): Promise<string | null> => {
      if (!PHOTO_TYPES.includes(file.type)) {
        setToast(t('cards.photos.type'));
        return null;
      }
      setUploading(true);
      try {
        return await upload(file);
      } catch (error) {
        setToast(errorMessage(t, error));
        return null;
      } finally {
        setUploading(false);
      }
    },
    [upload, t],
  );

  const ctx = target?.ctx ?? null;
  const editCtx = useMemo(() => (board && ctx ? withPlaceholders(board, ctx) : ctx), [board, ctx]);
  const designT = useMemo(() => createTranslator(language), [language]);

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (!desktop) setSheet(id ? 'inspector' : null);
    },
    [desktop],
  );
  const focusText = useCallback(
    (id: string) => {
      select(id);
      requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('card-inspector-words')?.focus()));
    },
    [select],
  );

  const editor: BoardEditorApi | null =
    design && ctx
      ? { kind: props.kind, design, t, cardT: designT, ctx, selectedId, select, change, changeLayer, addLayer, removeLayer, uploadPhoto, uploading, photoUrls: props.photoUrls, focusText }
      : null;
  const api: StudioApi | null = editor && target ? { editor, target, side, custom, commit, selectTarget } : null;

  // ── Layout ──
  const stageBox = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = stageBox.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => entry && setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const framed = desktop && props.framed(side);
  const W = board?.width ?? 390;
  const H = board?.height ?? 844;
  // The phone around a board takes about 26 px a side and 72 px of height.
  const fit = Math.max(0.1, Math.min((box.w - (desktop ? 64 : 24) - (framed ? 26 : 0)) / W, (box.h - (desktop ? 168 : 40) - (framed ? 72 : 0)) / H, 2));
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const zoom = zoomMode === 'fit' ? fit : zoomMode;
  const zoomBy = (factor: number) => setZoomMode(Math.min(3, Math.max(0.15, Math.round(zoom * factor * 100) / 100)));
  useEffect(() => setZoomMode('fit'), [target?.id, side]);

  // The studio covers the page: the page behind does not scroll, and focus comes back to where it was.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);

  // Keyboard: undo/redo, save, delete, nudge, deselect (never while typing).
  const { primary } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!primary.disabled && !primary.busy) primary.onClick();
      } else if (!typing && selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        removeLayer(selectedId);
      } else if (!typing && selectedId && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        changeLayer(selectedId, (l) => (l.locked ? l : { ...l, frame: { ...l.frame, x: l.frame.x + dx, y: l.frame.y + dy } }), 'nudge');
      } else if (e.key === 'Escape' && !typing) {
        select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, undo, redo, removeLayer, changeLayer, select, primary]);

  const current = props.panels.find((p) => p.key === panel) ?? props.panels[0];

  // On <body>: a page that animates its content (a transform) would otherwise hold a fixed layer inside its own box.
  return createPortal(
    <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={props.labels.dialog} className="editor-ui fixed inset-0 z-[60] flex flex-col outline-none" data-editor-theme={theme}>
      <TemplateStyles />
      {/* ── Top bar ── */}
      <header className="editor-chrome relative z-20 flex min-h-16 items-center gap-2 border-b border-[var(--ed-line)] bg-surface/95 px-2 text-ink shadow-clay-sm backdrop-blur sm:gap-3 sm:px-4">
        <button type="button" onClick={props.onClose} className="btn-3d btn-3d-light size-10 shrink-0 rounded-xl" aria-label={props.labels.close} title={props.labels.close}>
          <ArrowLeft aria-hidden className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold sm:text-base">{props.title}</h1>
          <p className="truncate text-xs text-stone-500">
            {target ? `${target.label}${target.sides.length > 1 ? ` · ${side === 'desktop' ? t('design.canvas.desktop') : t('design.canvas.phone')}` : ''}` : props.labels.empty}
          </p>
        </div>
        {target && target.sides.length > 1 ? (
          <div className="clay-inset hidden gap-1 rounded-xl p-1 sm:flex" role="radiogroup" aria-label={t('design.canvas.device')}>
            {target.sides.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={side === s}
                onClick={() => {
                  setSideChoice(s);
                  setSelectedId(null);
                }}
                className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold', side === s ? 'bg-surface text-brand-700 shadow-clay-sm' : 'text-stone-600 hover:text-ink')}
              >
                {s === 'mobile' ? <Smartphone aria-hidden className="size-4" /> : <Monitor aria-hidden className="size-4" />}
                {s === 'mobile' ? t('design.canvas.phone') : t('design.canvas.desktop')}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-1">
          <IconButton label={t('cards.editor.undo')} onClick={undo} disabled={!history.canUndo} tone="plain">
            <Undo2 aria-hidden className="size-5" />
          </IconButton>
          <IconButton label={t('cards.editor.redo')} onClick={redo} disabled={!history.canRedo} tone="plain">
            <Redo2 aria-hidden className="size-5" />
          </IconButton>
          {desktop ? props.actions?.(api) : null}
          <ThemeToggle theme={theme} onChange={setTheme} labels={{ dark: t('editor.theme.dark'), light: t('editor.theme.light') }} />
          <IconButton label={previewing ? t('design.canvas.edit') : t('design.canvas.preview')} onClick={() => setPreviewing((v) => !v)} active={previewing} tone="plain">
            {previewing ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
          </IconButton>
        </div>
        <button type="button" onClick={primary.onClick} disabled={primary.disabled || primary.busy} className="btn-3d min-h-11 shrink-0 gap-2 rounded-xl px-3 text-sm sm:px-5">
          {primary.busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
          {primary.label}
        </button>
      </header>

      <div className={cn('relative flex min-h-0 flex-1', !desktop && 'flex-col')}>
        {desktop ? (
          <aside className="editor-chrome flex w-[22rem] shrink-0 border-r border-[var(--ed-line)] bg-[var(--ed-panel)] text-ink" aria-label={t('cards.editor.tools')}>
            <nav className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1 border-r border-[var(--ed-line)] py-3" aria-label={t('cards.editor.tools')}>
              {props.panels.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={current?.key === p.key}
                  onClick={() => setPanel(p.key)}
                  className={cn('flex w-16 flex-col items-center gap-1 rounded-xl py-2 text-[0.6875rem] font-semibold transition-colors', current?.key === p.key ? 'bg-surface text-brand-700 shadow-clay-sm' : 'text-stone-600 hover:bg-white/70 hover:text-ink')}
                >
                  {p.icon}
                  {p.label}
                </button>
              ))}
            </nav>
            <div className="min-w-0 flex-1 overflow-y-auto p-4 [scrollbar-width:thin]">
              <h2 className="mb-4 font-display text-xl">{current?.label}</h2>
              {current?.render(api)}
            </div>
          </aside>
        ) : null}

        {/* ── The canvas, with the zoom bar floating over it ── */}
        <div className="relative flex min-h-0 min-w-0 flex-1">
          <main
            ref={stageBox}
            className="relative min-h-0 min-w-0 flex-1 overflow-auto bg-[radial-gradient(circle,var(--ed-dot)_1px,transparent_1.2px)] [background-size:18px_18px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
            aria-label={props.labels.canvas}
            tabIndex={0}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) select(null);
            }}
          >
            <div className={cn('flex min-h-full min-w-full items-center justify-center p-4 sm:p-8', desktop && 'pb-28')} onPointerDown={(e) => e.target === e.currentTarget && select(null)}>
              {previewing ? (
                <DeviceFrame show>{props.renderPreview()}</DeviceFrame>
              ) : board && target && editCtx ? (
                <div className="flex flex-col items-center gap-3">
                  <DeviceFrame show={framed}>
                    <Stage
                      board={board}
                      zoom={zoom}
                      selectedId={selectedId}
                      onSelect={select}
                      onCommit={(next) => change((d) => ({ ...d, board: next }))}
                      snapping
                      renderBoard={(b) => props.renderBoard(b, { ...target, ctx: editCtx }, { width: Math.round(W * zoom), height: Math.round(H * zoom) })}
                      selectable={(layer) => layerShown(layer, target.ctx)}
                      label={props.labels.canvas}
                      handleSize={desktop ? 10 : 18}
                      onDoubleClick={(id) => {
                        const layer = board.layers.find((l) => l.id === id);
                        if (layer?.kind === 'text') focusText(id);
                      }}
                    />
                  </DeviceFrame>
                  {desktop || sheet ? null : <p className="editor-chrome max-w-sm text-center text-xs text-stone-500">{props.labels.hint}</p>}
                </div>
              ) : (
                <div className="editor-chrome clay max-w-sm rounded-2xl p-6 text-center text-sm leading-relaxed text-stone-600">{props.labels.empty}</div>
              )}
            </div>
          </main>
          {desktop && !previewing && board ? (
            <CanvasToolbar
              className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2"
              zoom={zoom}
              fitted={zoomMode === 'fit'}
              onZoom={zoomBy}
              onFit={() => setZoomMode('fit')}
              labels={{ zoomIn: t('cards.editor.zoomIn'), zoomOut: t('cards.editor.zoomOut'), fit: t('cards.editor.fit') }}
            />
          ) : null}
        </div>

        {desktop ? (
          <aside className="editor-chrome w-[20rem] shrink-0 overflow-y-auto border-l border-[var(--ed-line)] bg-[var(--ed-panel)] p-4 text-ink [scrollbar-width:thin]" aria-label={t('cards.editor.inspector')}>
            {editor ? <LayerInspector editor={editor} /> : null}
          </aside>
        ) : null}

        {!desktop && sheet ? (
          <section
            id="board-studio-sheet"
            className={cn(
              'editor-chrome relative z-30 shrink-0 overflow-y-auto rounded-t-[1.75rem] bg-[var(--ed-panel)] px-4 pt-3 text-ink shadow-[var(--ed-sheet-shadow)] [scrollbar-width:thin]',
              sheetFolded ? 'pb-3' : sheet === 'inspector' ? 'max-h-[36dvh] pb-6' : 'max-h-[44dvh] pb-6',
            )}
            aria-label={sheet === 'panel' ? current?.label : t('cards.editor.inspector')}
          >
            <div className={cn('flex items-center justify-between gap-2', !sheetFolded && 'mb-3')}>
              <h2 className="min-w-0 truncate font-display text-lg">{sheet === 'panel' ? current?.label : t('cards.editor.inspector')}</h2>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSheetFolded((v) => !v)}
                  aria-expanded={!sheetFolded}
                  aria-controls="board-studio-sheet"
                  className="btn-3d btn-3d-light size-9 rounded-full"
                  aria-label={sheetFolded ? t('cards.editor.unfoldSheet') : t('cards.editor.foldSheet')}
                  title={sheetFolded ? t('cards.editor.unfoldSheet') : t('cards.editor.foldSheet')}
                >
                  {sheetFolded ? <ChevronUp aria-hidden className="size-4" /> : <ChevronDown aria-hidden className="size-4" />}
                </button>
                <button type="button" onClick={() => setSheet(null)} className="btn-3d btn-3d-light size-9 rounded-full" aria-label={t('cards.editor.closeSheet')}>
                  <X aria-hidden className="size-4" />
                </button>
              </div>
            </div>
            {sheetFolded ? null : sheet === 'panel' ? current?.render(api) : editor ? <LayerInspector editor={editor} onClose={() => select(null)} /> : null}
          </section>
        ) : null}
      </div>

      {!desktop ? (
        <nav className="editor-chrome relative z-30 flex border-t border-[var(--ed-line)] bg-surface px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]" aria-label={t('cards.editor.tools')}>
          {props.panels.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={sheet === 'panel' && current?.key === p.key}
              onClick={() => {
                if (sheet === 'panel' && current?.key === p.key) setSheet(null);
                else {
                  setPanel(p.key);
                  setSheet('panel');
                  setSheetFolded(false);
                }
              }}
              className={cn('flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.625rem] font-semibold', sheet === 'panel' && current?.key === p.key ? 'text-brand-700' : 'text-stone-600')}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </nav>
      ) : null}

      {toast ? (
        <p role="alert" className="editor-chrome fixed bottom-24 left-1/2 z-[80] w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl bg-ink px-4 py-3 text-center text-sm text-canvas shadow-xl lg:bottom-8">
          {toast}
        </p>
      ) : null}
    </div>,
    document.body,
  );
}
