'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpToLine,
  Copy,
  Group,
  Image as ImageIcon,
  Layers,
  Lock,
  LockOpen,
  Magnet,
  Minus,
  Monitor,
  Plus,
  Redo2,
  Save,
  Shapes,
  Smartphone,
  Trash2,
  Ungroup,
  Undo2,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { createTranslator } from '@bulava/localization';
import { CanvasArtboard, Stage, themeStyle, useHistory, type AlignMode } from '@bulava/template-engine';
import {
  artboardAssetIds,
  ArtboardSchema,
  BINDINGS,
  canvasAssetIds,
  effectiveColors,
  effectiveFonts,
  SAMPLE_PRESETS,
  templateAssetIds,
  templateSampleContext,
  type Artboard,
  type CanvasSection,
  type Layer,
  type LayerInput,
  type Scene,
  type TemplateDefinition,
  type TextLayer,
} from '@bulava/template-schema';
import { apiPost } from '@/lib/api';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { EditorProps } from '../studio/common';
import { Alert, Badge, Button, Checkbox, Select } from '../ui';
import { AssetPicker } from './asset-picker';
import { ElementsPanel, PRESET_MIME } from './elements-panel';
import { ImportPanel } from './import-panel';
import { InlineText, inlineEditable } from './inline-text';
import { Inspector } from './inspector';
import { LayersPanel } from './layers-panel';
import { addPage, designPages, duplicatePage, movePage, pageBoard, removePage, sceneOf, sectionOf, toCanvasScene, writeBoard, type DesignPage, type Side } from './pages';
import { PagesStrip } from './pages-strip';
import { SceneBackdropStill } from './scene-backdrop';
import { layerId, newLayer, type LayerPreset } from './presets';
import {
  alignLayers,
  anyGrouped,
  copyLayers,
  deleteLayers,
  distributeLayers,
  duplicateLayers,
  groupLayers,
  nudgeLayers,
  pasteLayers,
  pickedLayers,
  readClipboard,
  reorderLayers,
  setLocked,
  ungroupLayers,
} from './selection';

const ROLE = 'canvas';
const LANGUAGE_LABELS: Record<string, string> = { en: 'English', hi: 'हिन्दी', 'hi-Latn': 'Hinglish' };
const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];

/** Keep `definition.assets` listing every image a board shows (sections and scenes), so publishing checks each licence. */
function syncCanvasAssets(d: TemplateDefinition) {
  const used = new Set<string>();
  d.website?.pages.forEach((p) => p.sections.forEach((s) => s.section === 'canvas' && s.canvas && canvasAssetIds(s.canvas).forEach((id) => used.add(id))));
  d.scenes?.forEach((s) => s.canvas && artboardAssetIds(s.canvas.board).forEach((id) => used.add(id)));
  d.assets = [...d.assets.filter((a) => a.role !== ROLE && !used.has(a.assetId)), ...[...used].map((assetId) => ({ assetId, role: ROLE }))];
}

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file']);

/** A field the user types into: it keeps its own undo, arrows and Delete. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === 'TEXTAREA' || el.isContentEditable) return true;
  return el.tagName === 'INPUT' && !NON_TEXT_INPUTS.has((el as HTMLInputElement).type);
}

/** Any form control: arrows and Delete belong to it, shortcuts with Ctrl do not. */
function inFormField(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
}

type Panel = 'elements' | 'photos' | 'layers' | 'import';
const PANELS: Array<{ key: Panel; icon: LucideIcon }> = [
  { key: 'elements', icon: Shapes },
  { key: 'photos', icon: ImageIcon },
  { key: 'layers', icon: Layers },
  { key: 'import', icon: Upload },
];

/**
 * The Design Studio (docs/template-studio.md#design-studio), after Canva:
 * every board of the template (a website's canvas sections, a film's or a
 * card's scenes) as pages along the foot; elements to search and drag onto
 * the page, photos, layers and imports on the left; the selected layers'
 * properties, or the page's, on the right. Several layers can be picked
 * (Shift-click or a marquee), moved, resized, grouped, aligned, distributed,
 * copied and pasted, and text is typed on the page. It edits the Studio's
 * draft through `edit`, which validates every change, so saving, checks and
 * publishing work as everywhere else; Ctrl+Z undoes any change made here.
 */
export function DesignStudio({ definition, pageId, edit, onClose, onSave, saving, dirty }: EditorProps & { pageId?: string | null; onClose: () => void; onSave: () => void; saving: boolean; dirty: boolean }) {
  const pages = useMemo(() => designPages(definition), [definition]);
  const [current, setCurrent] = useState<string | null>(pageId ?? null);
  const page: DesignPage | null = pages.find((p) => p.id === current) ?? pages[0] ?? null;
  const [requestedSide, setSide] = useState<Side>('mobile');
  const side: Side = page?.sides.includes(requestedSide) ? requestedSide : 'mobile';
  const [selection, setSelection] = useState<string[]>([]);
  const [zoomMode, setZoomMode] = useState<number | 'fit'>('fit');
  const [snapping, setSnapping] = useState(true);
  const [panel, setPanel] = useState<Panel>('elements');
  const [picking, setPicking] = useState<((assetId: string) => void) | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(definition.languages[0] ?? 'en');
  const [typeKey, setTypeKey] = useState(definition.eventTypes[0] ?? 'WEDDING');
  const [longNames, setLongNames] = useState(false);
  const [noPhotos, setNoPhotos] = useState(false);
  const [panning, setPanning] = useState(false);
  /** A design file dropped on the page: the Import tab reads it. */
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const history = useHistory<TemplateDefinition>();
  const mainRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const clipboard = useRef<string | null>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [stageSize, setStageSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const measure = () => setStageSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(id);
  }, [error]);

  // A new page or side starts with nothing picked.
  useEffect(() => {
    setSelection([]);
    setEditingText(null);
  }, [page?.id, side]);

  const board: Artboard | null = page ? pageBoard(definition, page, side) : null;
  const scene: Scene | null = page ? sceneOf(definition, page) : null;
  const canvas: CanvasSection | null = page ? sectionOf(definition, page) : null;
  const picked = board ? pickedLayers(board, selection) : [];
  const single = picked.length === 1 ? picked[0]! : null;

  /** One change to the draft, undoable; returns whether it was applied. */
  const change = useCallback(
    (mutate: (d: TemplateDefinition) => void, record = true): boolean => {
      if (record) history.record(definition);
      const result = edit((d) => {
        mutate(d);
        syncCanvasAssets(d);
      });
      setError(result);
      return !result;
    },
    [definition, edit, history],
  );
  const replaceWith = (snapshot: TemplateDefinition) =>
    setError(
      edit((d) => {
        for (const key of Object.keys(d)) delete (d as Record<string, unknown>)[key];
        Object.assign(d, structuredClone(snapshot));
      }),
    );
  const undo = () => {
    const prev = history.undo(definition);
    if (prev) replaceWith(prev);
  };
  const redo = () => {
    const next = history.redo(definition);
    if (next) replaceWith(next);
  };

  const commitBoard = (next: Artboard) => page && change((d) => writeBoard(d, page, side, next));
  const mutateBoard = (fn: (b: Artboard) => void) => {
    if (!board) return;
    const next = structuredClone(board);
    fn(next);
    commitBoard(next);
  };
  const withBoard = (fn: (b: Artboard) => Artboard | { board: Artboard; ids: string[] }) => {
    if (!board) return;
    const out = fn(board);
    if ('ids' in out) {
      commitBoard(out.board);
      setSelection(out.ids);
    } else commitBoard(out);
  };

  // ─── Adding ───
  const place = (preset: LayerPreset, at?: { x: number; y: number }, assetId?: string) => {
    if (!board) return;
    const input = newLayer(preset, board, new Set(board.layers.map((l) => l.id)), assetId) as LayerInput & { frame: Layer['frame'] };
    if (at) input.frame = { ...input.frame, x: Math.round(at.x - input.frame.w / 2), y: Math.round(at.y - input.frame.h / 2) };
    const layer = input as unknown as Layer;
    if (commitBoard({ ...board, layers: [...board.layers, layer] })) setSelection([layer.id]);
  };
  const add = (preset: LayerPreset, at?: { x: number; y: number }) => {
    if (preset.group === 'image' && preset.key === 'library') setPicking(() => (assetId: string) => place(preset, at, assetId));
    else place(preset, at);
  };

  // ─── Clipboard ───
  const copy = async (cut = false) => {
    if (!board || !selection.length) return;
    const text = copyLayers(board, selection);
    clipboard.current = text;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* the internal clipboard still has it */
    }
    if (cut) {
      commitBoard(deleteLayers(board, selection));
      setSelection([]);
    }
  };
  const paste = async () => {
    if (!board) return;
    let text = clipboard.current;
    try {
      const fromSystem = await navigator.clipboard.readText();
      if (readClipboard(fromSystem)) text = fromSystem;
    } catch {
      /* no permission: the internal clipboard */
    }
    const clip = text ? readClipboard(text) : null;
    if (clip) withBoard((b) => pasteLayers(b, clip));
  };

  const align = (mode: AlignMode) => withBoard((b) => alignLayers(b, selection, mode));
  const remove = () => {
    withBoard((b) => deleteLayers(b, selection));
    setSelection([]);
  };

  // ─── Keyboard ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      // Save works from anywhere (and never opens the browser's own save dialog).
      if (mod && key === 's') {
        e.preventDefault();
        if (dirty && !saving) onSave();
        return;
      }
      if (isTyping(e.target)) return;
      if (e.key === ' ' && !e.repeat && !inFormField(e.target)) {
        e.preventDefault();
        setPanning(true);
        return;
      }
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && (key === '=' || key === '+' || key === '-' || key === '0')) {
        e.preventDefault();
        if (key === '0') setZoomMode('fit');
        else stepZoom(key === '-' ? -1 : 1);
        return;
      }
      if (e.key === 'Escape') {
        if (picking) setPicking(null);
        else setSelection([]);
        return;
      }
      if (!board || !page?.onCanvas) return;
      if (mod && key === 'a') {
        e.preventDefault();
        setSelection(board.layers.filter((l) => !l.hidden && !l.locked).map((l) => l.id));
        return;
      }
      if (mod && key === 'v') {
        e.preventDefault();
        void paste();
        return;
      }
      if (!selection.length) return;
      if (mod && (key === 'c' || key === 'x')) {
        e.preventDefault();
        void copy(key === 'x');
        return;
      }
      if (mod && key === 'd') {
        e.preventDefault();
        withBoard((b) => duplicateLayers(b, selection));
        return;
      }
      if (mod && key === 'g') {
        e.preventDefault();
        withBoard((b) => (e.shiftKey ? ungroupLayers(b, selection) : selection.length > 1 ? groupLayers(b, selection) : b));
        return;
      }
      // A focused select or checkbox keeps its arrows and Delete.
      if (inFormField(e.target)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        remove();
        return;
      }
      if (e.key === ']' || e.key === '[') {
        e.preventDefault();
        withBoard((b) => reorderLayers(b, selection, e.key === ']' ? (mod ? 'front' : 'forward') : mod ? 'back' : 'backward'));
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const d = delta[e.key];
      if (d) {
        e.preventDefault();
        withBoard((b) => nudgeLayers(b, selection, d[0], d[1]));
      }
    };
    const release = (e: KeyboardEvent) => {
      if (e.key === ' ') setPanning(false);
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', release);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', release);
    };
  });

  // ─── Sample data, as the Studio preview shows it; images may be unpublished, so URLs are signed ───
  const effectiveLanguage = definition.languages.includes(language) ? language : (definition.languages[0] ?? 'en');
  const typeOptions = useMemo(() => (definition.eventTypes.length ? definition.eventTypes : Object.keys(SAMPLE_PRESETS)).filter((k) => k in SAMPLE_PRESETS), [definition.eventTypes]);
  const effectiveType = typeOptions.includes(typeKey) ? typeKey : (typeOptions[0] ?? 'WEDDING');
  const assetIds = templateAssetIds(definition).sort();
  const assetUrls = useQuery({ queryKey: ['admin', 'asset-urls', assetIds], queryFn: () => apiPost<Record<string, string>>('/admin/assets/urls', { ids: assetIds }), enabled: assetIds.length > 0, staleTime: 30 * 60_000 });
  const ctx = useMemo(
    () => ({ ...templateSampleContext(definition, { language: effectiveLanguage, longNames, noPhotos, typeKey: effectiveType }), ...(assetUrls.data ? { assets: assetUrls.data } : {}) }),
    [definition, effectiveLanguage, longNames, noPhotos, effectiveType, assetUrls.data],
  );
  const colors = useMemo(() => effectiveColors(definition, null), [definition]);
  const fonts = useMemo(() => effectiveFonts(definition, null), [definition]);
  const translator = useMemo(() => createTranslator(effectiveLanguage), [effectiveLanguage]);
  const theme = useMemo(() => themeStyle(definition.theme, colors, fonts), [definition.theme, colors, fonts]);

  const fitZoom = board ? Math.max(0.1, Math.min((stageSize.w - 64) / board.width, (stageSize.h - 64) / board.height, 2)) : 1;
  const zoom = zoomMode === 'fit' ? fitZoom : zoomMode;
  const stepZoom = (dir: 1 | -1) => {
    const next = dir > 0 ? ZOOM_STEPS.find((z) => z > zoom + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < zoom - 0.001);
    if (next) setZoomMode(next);
  };

  // Ctrl + wheel (and pinch) zooms at the pointer; the page's own scroll pans.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const next = Math.min(4, Math.max(0.1, zoom * Math.exp(-e.deltaY * 0.0025)));
      const k = next / zoom;
      setZoomMode(Math.round(next * 100) / 100);
      requestAnimationFrame(() => {
        el.scrollLeft = (el.scrollLeft + cx) * k - cx;
        el.scrollTop = (el.scrollTop + cy) * k - cy;
      });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [zoom]);

  if (!page || !board) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-stone-100" role="dialog" aria-modal="true" aria-label={t('design.title')}>
        <div className="space-y-3 text-center">
          <p className="text-sm text-stone-600">{t('design.noPages')}</p>
          <Button onClick={() => change((d) => void setCurrent(addPage(d, null)))}>
            <Plus className="size-4" /> {t('design.page.add')}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            <ArrowLeft className="size-4" /> {t('canvas.back')}
          </Button>
        </div>
      </div>
    );
  }

  // Engine drawings: the add panel's previews, the pages strip and the stage.
  const renderThumb = (layer: LayerInput, width: number, height: number): ReactNode => {
    const parsed = ArtboardSchema.safeParse({ width, height, background: { type: 'none' }, layers: [layer] });
    if (!parsed.success) return null;
    return (
      <div className="bulava-template pointer-events-none" style={{ ...theme, width: '100%', height: '100%', background: 'transparent' }}>
        <CanvasArtboard board={parsed.data} ctx={ctx} colors={colors} fonts={fonts} t={translator} language={effectiveLanguage} timeZone={ctx.event.timezone} mode="thumbnail" />
      </div>
    );
  };
  // A scene's illustrated backdrop is drawn behind its board, as the film shows it.
  const renderBoard = (b: Artboard, mode: 'edit' | 'thumbnail' = 'edit', on: Scene | null = scene): ReactNode => (
    <div lang={effectiveLanguage} className="bulava-template" style={{ ...theme, position: 'relative', width: '100%', height: mode === 'edit' ? '100%' : undefined, background: 'transparent' }}>
      {on?.backdrop ? <SceneBackdropStill scene={on} definition={definition} colors={colors} ctx={ctx} width={b.width * (mode === 'edit' ? zoom : 1)} height={b.height * (mode === 'edit' ? zoom : 1)} /> : null}
      <CanvasArtboard board={b} ctx={ctx} colors={colors} fonts={fonts} t={translator} language={effectiveLanguage} timeZone={ctx.event.timezone} mode={mode} />
    </div>
  );

  // Dropping an element from the panel onto the page (or a design file, to import).
  const drop = (e: DragEvent<HTMLDivElement>) => {
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      e.preventDefault();
      setDroppedFile(dropped);
      setPanel('import');
      return;
    }
    const raw = e.dataTransfer.getData(PRESET_MIME);
    const rect = stageRef.current?.getBoundingClientRect();
    if (!raw || !rect) return;
    e.preventDefault();
    try {
      add(JSON.parse(raw) as LayerPreset, { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom });
    } catch {
      /* not one of ours */
    }
  };

  const editing = editingText ? (board.layers.find((l) => l.id === editingText && l.kind === 'text') as TextLayer | undefined) : undefined;
  const bar = (label: string, icon: LucideIcon, onClick: () => void, disabled = false, danger = false) => {
    const Icon = icon;
    return (
      <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={cn('rounded p-1.5 disabled:opacity-40', danger ? 'text-red-600 hover:bg-red-50' : 'text-stone-600 hover:bg-stone-100')}>
        <Icon className="size-4" />
      </button>
    );
  };
  const locked = picked.length > 0 && picked.every((l) => l.locked);
  const grouped = board ? anyGrouped(board, selection) : false;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-100 text-stone-900" role="dialog" aria-modal="true" aria-label={t('design.title')}>
      <header className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-3 py-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="size-4" /> {t('canvas.back')}
        </Button>
        <div className="min-w-0">
          <span className="text-sm font-semibold">{t('design.title')}</span>
          <span className="ml-2 text-xs text-stone-500">{definition.name}</span>
        </div>
        {dirty ? <Badge tone="warning">{t('studio.unsaved')}</Badge> : null}
        <span className="mx-1 h-6 w-px bg-stone-200" aria-hidden />
        {page.kind === 'section' ? (
          <>
            <Button size="icon" variant={side === 'mobile' ? 'primary' : 'ghost'} aria-label={t('canvas.device.mobile')} title={t('canvas.device.mobile')} aria-pressed={side === 'mobile'} onClick={() => setSide('mobile')}>
              <Smartphone className="size-4" />
            </Button>
            <Button size="icon" variant={side === 'desktop' ? 'primary' : 'ghost'} aria-label={t('canvas.device.desktop')} title={canvas?.desktop ? t('canvas.device.desktop') : t('canvas.noDesktop')} aria-pressed={side === 'desktop'} disabled={!canvas?.desktop} onClick={() => setSide('desktop')}>
              <Monitor className="size-4" />
            </Button>
          </>
        ) : null}
        <Button size="icon" variant="ghost" aria-label={t('design.zoomOut')} title={`${t('design.zoomOut')} (Ctrl −)`} onClick={() => stepZoom(-1)}>
          <Minus className="size-4" />
        </Button>
        <Select aria-label={t('canvas.zoom')} className="min-h-8 w-auto py-0 text-xs" value={zoomMode === 'fit' ? 'fit' : String(zoomMode)} onChange={(e) => setZoomMode(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}>
          <option value="fit">{t('canvas.zoom.fit')}</option>
          {zoomMode !== 'fit' && !ZOOM_STEPS.includes(zoomMode) ? <option value={String(zoomMode)}>{Math.round(zoomMode * 100)}%</option> : null}
          {ZOOM_STEPS.map((z) => (
            <option key={z} value={String(z)}>
              {Math.round(z * 100)}%
            </option>
          ))}
        </Select>
        <Button size="icon" variant="ghost" aria-label={t('design.zoomIn')} title={`${t('design.zoomIn')} (Ctrl +)`} onClick={() => stepZoom(1)}>
          <Plus className="size-4" />
        </Button>
        <Button size="icon" variant={snapping ? 'secondary' : 'ghost'} aria-label={t('canvas.snap')} title={t('canvas.snap')} aria-pressed={snapping} onClick={() => setSnapping((s) => !s)}>
          <Magnet className="size-4" />
        </Button>
        <span className="mx-1 h-6 w-px bg-stone-200" aria-hidden />
        <Button size="icon" variant="ghost" aria-label={t('canvas.undo')} title={`${t('canvas.undo')} (Ctrl+Z)`} disabled={!history.canUndo} onClick={undo}>
          <Undo2 className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" aria-label={t('canvas.redo')} title={`${t('canvas.redo')} (Ctrl+Y)`} disabled={!history.canRedo} onClick={redo}>
          <Redo2 className="size-4" />
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select aria-label={t('studio.preview.language')} value={effectiveLanguage} onChange={(e) => setLanguage(e.target.value)} className="min-h-8 w-auto py-0 text-xs">
            {definition.languages.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_LABELS[l] ?? l}
              </option>
            ))}
          </Select>
          <Select aria-label={t('studio.preview.eventType')} value={effectiveType} onChange={(e) => setTypeKey(e.target.value)} className="min-h-8 w-auto py-0 text-xs">
            {typeOptions.map((k) => (
              <option key={k} value={k}>
                {k.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </Select>
          <Checkbox className="min-h-8 text-xs" label={t('studio.preview.longNames')} checked={longNames} onChange={(e) => setLongNames(e.target.checked)} />
          <Checkbox className="min-h-8 text-xs" label={t('studio.preview.noPhotos')} checked={noPhotos} onChange={(e) => setNoPhotos(e.target.checked)} />
          <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
            <Save className="size-4" /> {saving ? t('common.saving') : t('studio.saveDraft')}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* The rail and its panel, after Canva's: elements, photos, layers, imports. */}
        <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-stone-200 bg-stone-50 py-2" aria-label={t('design.panels')}>
          {PANELS.map(({ key, icon: Icon }) => (
            <button key={key} type="button" aria-pressed={panel === key} onClick={() => setPanel(key)} className={cn('flex w-14 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px]', panel === key ? 'bg-white text-brand-800 shadow-sm ring-1 ring-stone-200' : 'text-stone-600 hover:bg-white')}>
              <Icon className="size-5" aria-hidden />
              {t(`design.panel.${key}`)}
            </button>
          ))}
        </nav>
        <aside className="flex w-72 shrink-0 flex-col border-r border-stone-200 bg-white" aria-label={t(`design.panel.${panel}`)}>
          {panel === 'elements' ? <ElementsPanel thumb={renderThumb} onAdd={(preset) => add(preset)} /> : null}
          {panel === 'photos' ? (
            <div className="space-y-3 p-3">
              <p className="text-xs text-stone-600">{t('design.photos.hint')}</p>
              <Button className="w-full" variant="secondary" onClick={() => add({ group: 'image', key: 'library' })}>
                <ImageIcon className="size-4" /> {t('design.photos.library')}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="ghost" className="border border-stone-200" onClick={() => add({ group: 'image', key: 'cover' })}>
                  {t('canvas.add.cover')}
                </Button>
                <Button size="sm" variant="ghost" className="border border-stone-200" onClick={() => add({ group: 'image', key: 'photo' })}>
                  {t('canvas.add.photo')}
                </Button>
              </div>
              <p className="text-[11px] leading-relaxed text-stone-500">{t('design.photos.licence')}</p>
            </div>
          ) : null}
          {panel === 'layers' ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <LayersPanel board={board} selection={selection} onSelect={(id, more) => setSelection((s) => (more ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]))} onChange={commitBoard} />
            </div>
          ) : null}
          {panel === 'import' ? (
            <ImportPanel
              key={droppedFile ? `${droppedFile.name}:${droppedFile.lastModified}` : 'import'}
              file={droppedFile}
              definition={definition}
              page={page}
              board={board}
              onBoard={(next, ids) => {
                if (commitBoard(next)) setSelection(ids);
              }}
              onPages={(mutate) => {
                let first: string | null = null;
                if (change((d) => void (first = mutate(d)))) setCurrent(first);
              }}
              onError={setError}
            />
          ) : null}
        </aside>

        <main
          ref={mainRef}
          className={cn('relative min-w-0 flex-1 overflow-auto bg-[repeating-conic-gradient(#e7e5e4_0%_25%,#f5f5f4_0%_50%)] bg-[length:24px_24px]', panning && 'cursor-grab')}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(PRESET_MIME) || e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={drop}
          onPointerDown={(e) => {
            if (!panning && e.button !== 1) return;
            e.preventDefault();
            pan.current = { x: e.clientX, y: e.clientY, left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const p = pan.current;
            if (!p) return;
            e.currentTarget.scrollLeft = p.left - (e.clientX - p.x);
            e.currentTarget.scrollTop = p.top - (e.clientY - p.y);
          }}
          onPointerUp={() => void (pan.current = null)}
        >
          {selection.length && page.onCanvas ? (
            <div className="sticky top-2 z-30 mx-auto flex w-fit items-center gap-0.5 rounded-xl border border-stone-200 bg-white px-1.5 py-1 shadow-lg" role="toolbar" aria-label={t('design.selection', { count: selection.length })}>
              <span className="px-1.5 text-xs text-stone-500">{t('design.selection', { count: selection.length })}</span>
              <span className="mx-0.5 h-5 w-px bg-stone-200" aria-hidden />
              {bar(t('canvas.align.left'), AlignStartVertical, () => align('left'))}
              {bar(t('canvas.align.center'), AlignCenterVertical, () => align('centre'))}
              {bar(t('canvas.align.right'), AlignEndVertical, () => align('right'))}
              {bar(t('canvas.align.top'), AlignStartHorizontal, () => align('top'))}
              {bar(t('canvas.align.middle'), AlignCenterHorizontal, () => align('middle'))}
              {bar(t('canvas.align.bottom'), AlignEndHorizontal, () => align('bottom'))}
              {bar(t('design.distribute.x'), AlignHorizontalDistributeCenter, () => withBoard((b) => distributeLayers(b, selection, 'x')), selection.length < 3)}
              {bar(t('design.distribute.y'), AlignVerticalDistributeCenter, () => withBoard((b) => distributeLayers(b, selection, 'y')), selection.length < 3)}
              <span className="mx-0.5 h-5 w-px bg-stone-200" aria-hidden />
              {bar(`${t('design.group')} (Ctrl+G)`, Group, () => withBoard((b) => groupLayers(b, selection)), selection.length < 2)}
              {bar(`${t('design.ungroup')} (Ctrl+Shift+G)`, Ungroup, () => withBoard((b) => ungroupLayers(b, selection)), !grouped)}
              {bar(t('canvas.front'), ArrowUpToLine, () => withBoard((b) => reorderLayers(b, selection, 'front')))}
              {bar(t('canvas.backmost'), ArrowDownToLine, () => withBoard((b) => reorderLayers(b, selection, 'back')))}
              {bar(locked ? t('canvas.unlock') : t('canvas.lock'), locked ? LockOpen : Lock, () => withBoard((b) => setLocked(b, selection, !locked)))}
              {bar(`${t('canvas.duplicate')} (Ctrl+D)`, Copy, () => withBoard((b) => duplicateLayers(b, selection)))}
              {bar(t('canvas.delete'), Trash2, remove, false, true)}
            </div>
          ) : null}
          <div className="grid min-h-full min-w-full place-items-center p-8">
            <div ref={stageRef} className="relative" style={{ pointerEvents: panning ? 'none' : undefined }}>
              <Stage
                board={board}
                zoom={zoom}
                selectedId={single?.id ?? null}
                onSelect={(id) => setSelection(id ? [id] : [])}
                selection={selection}
                onSelection={setSelection}
                onCommit={commitBoard}
                snapping={snapping}
                renderBoard={(b) => renderBoard(b)}
                label={page.kind === 'scene' ? t('design.page.scene', { n: page.index + 1, seconds: scene?.durationSec ?? 0 }) : side === 'desktop' ? t('canvas.device.desktop') : t('canvas.device.mobile')}
                selectable={() => page.onCanvas}
                onDoubleClick={(id) => {
                  const layer = board.layers.find((l) => l.id === id);
                  if (layer?.kind === 'text' && inlineEditable(layer) && !layer.locked) setEditingText(id);
                }}
              />
              {editing ? (
                <InlineText
                  key={editing.id}
                  layer={editing}
                  zoom={zoom}
                  onCancel={() => setEditingText(null)}
                  onCommit={(text) => {
                    setEditingText(null);
                    mutateBoard((b) => {
                      const l = b.layers.find((x) => x.id === editing.id);
                      if (l?.kind !== 'text') return;
                      l.content = 'template' in l.content ? { ...l.content, template: text } : { literal: text };
                    });
                  }}
                />
              ) : null}
            </div>
          </div>
          {!page.onCanvas && scene ? (
            <div className="sticky bottom-4 z-30 mx-auto w-[min(560px,90%)]">
              <Alert tone="warning">
                <p>{t('design.scene.elements')}</p>
                <Button size="sm" className="mt-2" onClick={() => change((d) => void Object.assign((d.scenes ?? []).find((s) => s.id === scene.id)!, toCanvasScene(scene, board)))}>
                  {t('design.scene.toCanvas')}
                </Button>
              </Alert>
            </div>
          ) : null}
          {error ? (
            <div className="pointer-events-none sticky bottom-4 z-40 mx-auto w-[min(560px,90%)]">
              <Alert>{error}</Alert>
            </div>
          ) : null}
        </main>

        <aside className="w-80 shrink-0 overflow-auto border-l border-stone-200 bg-white" aria-label={t('canvas.inspector')}>
          {picked.length > 1 ? (
            <div className="space-y-2 p-3 text-xs text-stone-600">
              <p className="font-medium text-stone-800">{t('design.selection', { count: picked.length })}</p>
              <p>{t('design.selectionHint')}</p>
            </div>
          ) : (
            <Inspector
              canvas={canvas ?? undefined}
              device={side}
              board={board}
              layer={single}
              colors={colors}
              textSlots={definition.capabilities.textSlots}
              onLayer={(fn) => single && mutateBoard((b) => void (b.layers.find((l) => l.id === single.id) && fn(b.layers.find((l) => l.id === single.id)!)))}
              onBoard={mutateBoard}
              onCanvas={
                canvas
                  ? (fn) =>
                      change((d) => {
                        const c = sectionOf(d, page);
                        if (c) fn(c);
                        if (c && !c.desktop) setSide('mobile');
                      })
                  : undefined
              }
              scene={scene ?? undefined}
              onScene={
                scene
                  ? (fn) =>
                      change((d) => {
                        const s = (d.scenes ?? []).find((x) => x.id === scene.id);
                        if (s) fn(s);
                      })
                  : undefined
              }
              onPickAsset={(cb) => setPicking(() => cb)}
              onDuplicate={() => withBoard((b) => duplicateLayers(b, selection))}
              onDelete={remove}
              onReorder={(where) => withBoard((b) => reorderLayers(b, selection, where))}
            />
          )}
        </aside>
      </div>

      <PagesStrip
        definition={definition}
        pages={pages}
        current={page.id}
        draw={(b, p) => renderBoard(b, 'thumbnail', sceneOf(definition, p))}
        onPick={setCurrent}
        onAdd={() => {
          let id: string | null = null;
          if (change((d) => void (id = addPage(d, page)))) setCurrent(id);
        }}
        onDuplicate={() => {
          let id: string | null = null;
          if (change((d) => void (id = duplicatePage(d, page)))) setCurrent(id);
        }}
        onMove={(by) => change((d) => movePage(d, page, by))}
        onRemove={() => {
          if (!window.confirm(t('design.page.removeConfirm'))) return;
          const at = pages.indexOf(page);
          if (change((d) => void removePage(d, page))) setCurrent(pages[at - 1]?.id ?? pages[at + 1]?.id ?? null);
        }}
      />

      <datalist id="canvas-bindings">
        {Object.keys(BINDINGS).map((k) => (
          <option key={k} value={k} />
        ))}
        {definition.capabilities.textSlots.map((slot) => (
          <option key={slot.key} value={`custom.${slot.key}`} />
        ))}
      </datalist>
      <datalist id="canvas-t-keys">
        {['template.weddingOf', 'template.engagementOf', 'template.birthdayOf', 'template.celebrateWith', 'template.joinUs', 'template.saveTheDate', 'template.blessings', 'template.schedule.title', 'template.getDirections', 'template.addToCalendar', 'rsvp.title', 'invitation.youAreInvited'].map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>

      <AssetPicker
        open={!!picking}
        onClose={() => setPicking(null)}
        onPick={(asset) => {
          picking?.(asset.id);
          setPicking(null);
        }}
      />
    </div>
  );
}

export { layerId };
