'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Magnet, Monitor, Plus, Redo2, Save, Smartphone, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createTranslator } from '@bulava/localization';
import { CanvasArtboard, CanvasIcon, themeStyle } from '@bulava/template-engine';
import {
  BINDINGS,
  canvasAssetIds,
  effectiveColors,
  effectiveFonts,
  ICONS,
  ORNAMENT_LAYERS,
  sampleRenderContext,
  SAMPLE_PRESETS,
  SHAPES,
  templateAssetIds,
  type Artboard,
  type CanvasSection,
  type Layer,
  type TemplateDefinition,
} from '@bulava/template-schema';
import { apiPost } from '@/lib/api';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { EditorProps } from '../studio/common';
import { Alert, Badge, Button, Checkbox, Modal, Select } from '../ui';
import { AssetPicker } from './asset-picker';
import { useHistory } from './history';
import { Inspector } from './inspector';
import { LayersPanel } from './layers-panel';
import { layerId, newLayer, type LayerPreset } from './presets';
import { Stage } from './stage';

const ROLE = 'canvas';
const LANGUAGE_LABELS: Record<string, string> = { en: 'English', hi: 'हिन्दी', 'hi-Latn': 'Hinglish' };
type Zoom = 'fit' | 0.5 | 0.75 | 1;

/** Keep `definition.assets` listing every image a canvas shows, so publishing checks each licence. */
function syncCanvasAssets(d: TemplateDefinition) {
  const used = new Set<string>();
  d.website?.pages.forEach((p) => p.sections.forEach((s) => s.section === 'canvas' && s.canvas && canvasAssetIds(s.canvas).forEach((id) => used.add(id))));
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

/**
 * Full-screen, drag-and-drop editor for one canvas section of the working
 * draft. It edits the same draft as the Studio (through `edit`, which
 * validates every change), so Save draft, checks and publishing work as usual.
 */
export function CanvasEditor({ definition, sectionId, edit, onClose, onSave, saving, dirty }: EditorProps & { sectionId: string; onClose: () => void; onSave: () => void; saving: boolean; dirty: boolean }) {
  const located = useMemo(() => {
    for (const [pi, page] of (definition.website?.pages ?? []).entries()) {
      const si = page.sections.findIndex((s) => s.id === sectionId);
      if (si !== -1) return { pi, si, section: page.sections[si]! };
    }
    return null;
  }, [definition, sectionId]);
  const canvas = located?.section.canvas ?? null;

  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomMode, setZoomMode] = useState<Zoom>('fit');
  const [snapping, setSnapping] = useState(true);
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState<((assetId: string) => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(definition.languages[0] ?? 'en');
  const [typeKey, setTypeKey] = useState(definition.eventTypes[0] ?? 'WEDDING');
  const [longNames, setLongNames] = useState(false);
  const [noPhotos, setNoPhotos] = useState(false);
  const history = useHistory<CanvasSection>();
  const mainRef = useRef<HTMLDivElement>(null);
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

  const onDesktop = device === 'desktop' && !!canvas?.desktop;
  const board: Artboard | null = canvas ? (onDesktop ? canvas.desktop! : canvas.mobile) : null;
  const selected = board?.layers.find((l) => l.id === selectedId) ?? null;

  const commitCanvas = useCallback(
    (next: CanvasSection, record = true) => {
      if (!canvas) return;
      if (record) history.record(canvas);
      const result = edit((d) => {
        const s = d.website!.pages[located!.pi]!.sections[located!.si]!;
        s.canvas = next;
        syncCanvasAssets(d);
      });
      setError(result);
    },
    [canvas, edit, history, located],
  );
  const commitBoard = useCallback((next: Artboard) => canvas && commitCanvas(onDesktop ? { ...canvas, desktop: next } : { ...canvas, mobile: next }), [canvas, onDesktop, commitCanvas]);
  const mutateBoard = (fn: (b: Artboard) => void) => {
    if (!board) return;
    const next = structuredClone(board);
    fn(next);
    commitBoard(next);
  };
  const mutateLayer = (id: string, fn: (l: Layer) => void) =>
    mutateBoard((b) => {
      const layer = b.layers.find((l) => l.id === id);
      if (layer) fn(layer);
    });
  const removeLayer = (id: string) => {
    mutateBoard((b) => void (b.layers = b.layers.filter((l) => l.id !== id)));
    setSelectedId(null);
  };
  const duplicateLayer = (id: string) => {
    if (!board) return;
    const source = board.layers.find((l) => l.id === id);
    if (!source) return;
    const copy = structuredClone(source);
    copy.id = layerId(source.id.replace(/-\d+$/, ''), new Set(board.layers.map((l) => l.id)));
    copy.frame = { ...copy.frame, x: copy.frame.x + 12, y: copy.frame.y + 12 };
    copy.locked = false;
    const at = board.layers.findIndex((l) => l.id === id);
    const layers = [...board.layers];
    layers.splice(at + 1, 0, copy);
    commitBoard({ ...board, layers });
    setSelectedId(copy.id);
  };
  const reorderLayer = (id: string, where: 'forward' | 'backward' | 'front' | 'back') =>
    mutateBoard((b) => {
      const from = b.layers.findIndex((l) => l.id === id);
      if (from === -1) return;
      const [item] = b.layers.splice(from, 1);
      const to = where === 'front' ? b.layers.length : where === 'back' ? 0 : Math.min(b.layers.length, Math.max(0, from + (where === 'forward' ? 1 : -1)));
      b.layers.splice(to, 0, item!);
    });
  const addLayer = (preset: LayerPreset, assetId?: string) => {
    if (!board) return;
    const layer = newLayer(preset, board, new Set(board.layers.map((l) => l.id)), assetId) as unknown as Layer;
    commitBoard({ ...board, layers: [...board.layers, layer] });
    setSelectedId(layer.id);
    setAdding(false);
  };
  const undo = () => {
    if (!canvas) return;
    const prev = history.undo(canvas);
    if (prev) commitCanvas(prev, false);
  };
  const redo = () => {
    if (!canvas) return;
    const next = history.redo(canvas);
    if (next) commitCanvas(next, false);
  };

  // Keyboard: nudge, delete, duplicate, undo/redo, save; never while typing in a field.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      // Save works from anywhere (and never opens the browser's own save dialog).
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty && !saving) onSave();
        return;
      }
      if (isTyping(e.target)) return;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Escape') {
        if (adding) setAdding(false);
        else if (picking) setPicking(null);
        else setSelectedId(null);
        return;
      }
      if (!selected || selected.locked) return;
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateLayer(selected.id);
        return;
      }
      // A focused select or checkbox keeps its arrows and Delete.
      if (inFormField(e.target)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeLayer(selected.id);
        return;
      }
      if (e.key === ']' || e.key === '[') {
        e.preventDefault();
        reorderLayer(selected.id, e.key === ']' ? 'forward' : 'backward');
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const d = delta[e.key];
      if (d) {
        e.preventDefault();
        mutateLayer(selected.id, (l) => void (l.frame = { ...l.frame, x: l.frame.x + d[0], y: l.frame.y + d[1] }));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Sample data for the artboard, as the Studio preview does; images may be unpublished, so URLs are signed.
  const effectiveLanguage = definition.languages.includes(language) ? language : (definition.languages[0] ?? 'en');
  const typeOptions = useMemo(() => (definition.eventTypes.length ? definition.eventTypes : Object.keys(SAMPLE_PRESETS)).filter((k) => k in SAMPLE_PRESETS), [definition.eventTypes]);
  const effectiveType = typeOptions.includes(typeKey) ? typeKey : (typeOptions[0] ?? 'WEDDING');
  const assetIds = templateAssetIds(definition).sort();
  const assetUrls = useQuery({ queryKey: ['admin', 'asset-urls', assetIds], queryFn: () => apiPost<Record<string, string>>('/admin/assets/urls', { ids: assetIds }), enabled: assetIds.length > 0, staleTime: 30 * 60_000 });
  const ctx = useMemo(
    () => ({ ...sampleRenderContext({ language: effectiveLanguage, longNames, noPhotos, typeKey: effectiveType }), ...(assetUrls.data ? { assets: assetUrls.data } : {}) }),
    [effectiveLanguage, longNames, noPhotos, effectiveType, assetUrls.data],
  );
  const colors = useMemo(() => effectiveColors(definition, null), [definition]);
  const fonts = useMemo(() => effectiveFonts(definition, null), [definition]);
  const translator = useMemo(() => createTranslator(effectiveLanguage), [effectiveLanguage]);
  const theme = useMemo(() => themeStyle(definition.theme, colors, fonts), [definition.theme, colors, fonts]);

  const fitZoom = board ? Math.max(0.1, Math.min((stageSize.w - 64) / board.width, (stageSize.h - 64) / board.height, 2)) : 1;
  const zoom = zoomMode === 'fit' ? fitZoom : zoomMode;

  if (!located || !canvas || !board) return null;

  const renderBoard = (b: Artboard): ReactNode => (
    <div lang={effectiveLanguage} className="bulava-template" style={{ ...theme, width: '100%', height: '100%', background: 'transparent' }}>
      <CanvasArtboard board={b} ctx={ctx} colors={colors} fonts={fonts} t={translator} language={effectiveLanguage} timeZone={ctx.event.timezone} mode="edit" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-100 text-stone-900" role="dialog" aria-modal="true" aria-label={t('canvas.title')}>
      <header className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-3 py-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="size-4" /> {t('canvas.back')}
        </Button>
        <div className="min-w-0">
          <span className="text-sm font-semibold">{t('canvas.title')}</span>
          <span className="ml-2 font-mono text-xs text-stone-500">{t('canvas.section', { id: sectionId })}</span>
        </div>
        {dirty ? <Badge tone="warning">{t('studio.unsaved')}</Badge> : null}
        <span className="mx-1 h-6 w-px bg-stone-200" aria-hidden />
        <Button size="icon" variant={!onDesktop ? 'primary' : 'ghost'} aria-label={t('canvas.device.mobile')} title={t('canvas.device.mobile')} aria-pressed={!onDesktop} onClick={() => setDevice('mobile')}>
          <Smartphone className="size-4" />
        </Button>
        <Button
          size="icon"
          variant={onDesktop ? 'primary' : 'ghost'}
          aria-label={t('canvas.device.desktop')}
          title={canvas.desktop ? t('canvas.device.desktop') : t('canvas.noDesktop')}
          aria-pressed={onDesktop}
          disabled={!canvas.desktop}
          onClick={() => setDevice('desktop')}
        >
          <Monitor className="size-4" />
        </Button>
        <Select aria-label={t('canvas.zoom')} className="min-h-8 w-auto py-0 text-xs" value={String(zoomMode)} onChange={(e) => setZoomMode(e.target.value === 'fit' ? 'fit' : (Number(e.target.value) as Zoom))}>
          <option value="fit">{t('canvas.zoom.fit')}</option>
          <option value="0.5">50%</option>
          <option value="0.75">75%</option>
          <option value="1">100%</option>
        </Select>
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
        <aside className="flex w-60 shrink-0 flex-col border-r border-stone-200 bg-white" aria-label={t('canvas.layers')}>
          <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2">
            <h2 className="text-xs font-semibold tracking-wide text-stone-700 uppercase">{t('canvas.layers')}</h2>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" /> {t('canvas.addLayer')}
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <LayersPanel board={board} selectedId={selectedId} onSelect={setSelectedId} onChange={commitBoard} />
          </div>
        </aside>

        <main ref={mainRef} className="relative min-w-0 flex-1 overflow-auto bg-[repeating-conic-gradient(#e7e5e4_0%_25%,#f5f5f4_0%_50%)] bg-[length:24px_24px]">
          <div className="grid min-h-full min-w-full place-items-center p-8">
            <Stage board={board} zoom={zoom} selectedId={selectedId} onSelect={setSelectedId} onCommit={commitBoard} snapping={snapping} renderBoard={renderBoard} label={onDesktop ? t('canvas.device.desktop') : t('canvas.device.mobile')} />
          </div>
          {error ? (
            <div className="pointer-events-none absolute bottom-4 left-1/2 w-[min(560px,90%)] -translate-x-1/2">
              <Alert>{error}</Alert>
            </div>
          ) : null}
        </main>

        <aside className="w-80 shrink-0 overflow-auto border-l border-stone-200 bg-white" aria-label={t('canvas.inspector')}>
          <Inspector
            canvas={canvas}
            device={onDesktop ? 'desktop' : 'mobile'}
            board={board}
            layer={selected}
            colors={colors}
            textSlots={definition.capabilities.textSlots}
            onLayer={(fn) => selected && mutateLayer(selected.id, fn)}
            onBoard={mutateBoard}
            onCanvas={(fn) => {
              const next = structuredClone(canvas);
              fn(next);
              commitCanvas(next);
              if (!next.desktop) setDevice('mobile');
            }}
            onPickAsset={(cb) => setPicking(() => cb)}
            onDuplicate={() => selected && duplicateLayer(selected.id)}
            onDelete={() => selected && removeLayer(selected.id)}
            onReorder={(where) => selected && reorderLayer(selected.id, where)}
          />
        </aside>
      </div>

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

      <AddLayerModal
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(preset) => {
          if (preset.group === 'image' && preset.key === 'library') {
            setAdding(false);
            setPicking(() => (assetId: string) => addLayer(preset, assetId));
          } else addLayer(preset);
        }}
      />
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

function AddLayerModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (preset: LayerPreset) => void }) {
  const tile = 'flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-2 text-center text-xs text-stone-700 hover:border-brand-400 hover:bg-brand-50 focus:ring-2 focus:ring-brand-200 focus:outline-none';
  const section = (title: string, children: ReactNode) => (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">{title}</h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">{children}</div>
    </section>
  );
  return (
    <Modal open={open} onClose={onClose} title={t('canvas.addLayer')} wide>
      <div className="max-h-[70vh] space-y-5 overflow-auto p-0.5">
        {section(
          t('canvas.add.text'),
          (['heading', 'names', 'eyebrow', 'paragraph', 'date'] as const).map((key) => (
            <button key={key} type="button" className={cn(tile, 'font-serif text-base')} onClick={() => onAdd({ group: 'text', key })}>
              <span aria-hidden className={key === 'names' ? 'italic' : key === 'eyebrow' ? 'text-[10px] tracking-widest uppercase' : key === 'paragraph' ? 'text-xs' : ''}>
                {key === 'names' ? 'Aa & Bb' : key === 'date' ? '14 Dec' : 'Aa'}
              </span>
              <span className="font-sans text-[11px]">{t(`canvas.add.${key}`)}</span>
            </button>
          )),
        )}
        {section(
          t('canvas.add.image'),
          (['library', 'cover', 'photo'] as const).map((key) => (
            <button key={key} type="button" className={tile} onClick={() => onAdd({ group: 'image', key })}>
              <span className="font-sans text-[11px]">{t(`canvas.add.${key}`)}</span>
            </button>
          )),
        )}
        {section(
          t('canvas.add.widget'),
          (['countdown', 'button', 'details'] as const).map((key) => (
            <button key={key} type="button" className={tile} onClick={() => onAdd({ group: 'widget', key })}>
              <span className="font-sans text-[11px]">{t(`canvas.add.${key}`)}</span>
            </button>
          )),
        )}
        {section(
          t('canvas.add.shape'),
          SHAPES.map((key) => (
            <button key={key} type="button" className={tile} onClick={() => onAdd({ group: 'shape', key })}>
              <span className="font-sans text-[11px]">{key}</span>
            </button>
          )),
        )}
        {section(
          t('canvas.add.ornament'),
          ORNAMENT_LAYERS.map((key) => (
            <button key={key} type="button" className={tile} onClick={() => onAdd({ group: 'ornament', key })}>
              <span className="font-sans text-[11px]">{key}</span>
            </button>
          )),
        )}
        {section(
          t('canvas.add.icon'),
          ICONS.map((key) => (
            <button key={key} type="button" className={tile} onClick={() => onAdd({ group: 'icon', key })}>
              <CanvasIcon name={key} style={{ width: 20, height: 20 }} />
              <span className="font-sans text-[11px]">{key}</span>
            </button>
          )),
        )}
      </div>
    </Modal>
  );
}
