'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Cloud,
  CloudOff,
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  LoaderCircle,
  Maximize,
  NotebookPen,
  Palette,
  Redo2,
  RotateCcw,
  Ruler,
  Shapes,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createTranslator } from '@bulava/localization';
import { CardView, Stage, TemplateStyles, useHistory } from '@bulava/template-engine';
import {
  CardDesignSchema,
  cardFromTemplate,
  cardRenderContext,
  stableStringify,
  withCardFormat,
  type CardDesign,
  type CardFormat,
  type Layer,
} from '@bulava/template-schema';
import { errorMessage, useOptionalT } from '@/lib/i18n';
import { cardApi, isSessionGone, loadStoredCard, saveStoredCard, type CardSessionOrder } from '@/lib/cards';
import { cn } from '@/lib/utils';
import { DownloadDialog } from './download-dialog';
import { LayerInspector } from './editor-inspector';
import { newLayerId, PHOTO_PLACEHOLDER } from './editor-model';
import { ColorsPanel, DetailsPanel, ElementsPanel, PhotosPanel, SizePanel, TextPanel, type PanelKey } from './editor-panels';
import type { CardEditorApi, CardTemplateInfo } from './editor-types';
import { IconButton } from './editor-ui';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

interface Start {
  design: CardDesign;
  token: string | null;
  savedAt: number;
}

/**
 * The digital card editor (docs/cards.md#editor), full screen and without an
 * account. The design starts from the template (or from this device's saved
 * copy), every change is kept on the device at once and on the server shortly
 * after (only once it differs from the template), and the download dialog
 * works from the saved card, so what is downloaded is what is on screen.
 */
export function CardEditor({ template, occasions, initialEvent, siteName }: { template: CardTemplateInfo; occasions: Array<{ key: string; name: string }>; initialEvent?: string; siteName: string }) {
  const [start, setStart] = useState<Start | null>(null);
  useEffect(() => {
    const stored = loadStoredCard(template.key);
    const eventType = initialEvent && template.eventTypes.includes(initialEvent) ? initialEvent : undefined;
    // A card opened for another occasion than the saved one starts fresh for that occasion.
    const resume = stored && (!eventType || stored.design.eventType === eventType) ? stored : null;
    setStart(
      resume
        ? { design: resume.design, token: resume.token, savedAt: resume.savedAt }
        : { design: cardFromTemplate(template.definition, { format: 'phone', eventType, tags: template.tags }), token: stored?.token ?? null, savedAt: 0 },
    );
    void cardApi.event({ type: 'EDITOR_OPENED', templateKey: template.key, ...(stored?.token ? { session: stored.token } : {}) });
  }, [template, initialEvent]);

  if (!start) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas" role="status">
        <LoaderCircle aria-hidden className="size-8 animate-spin text-brand-700" />
      </div>
    );
  }
  return <Editor template={template} occasions={occasions} start={start} siteName={siteName} />;
}

function Editor({ template, occasions, start, siteName }: { template: CardTemplateInfo; occasions: Array<{ key: string; name: string }>; start: Start; siteName: string }) {
  const t = useOptionalT();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const config = useQuery({ queryKey: ['card-config'], queryFn: cardApi.config, staleTime: 60_000 });

  // ── The design and its history ──
  const [design, setDesign] = useState<CardDesign>(start.design);
  const designRef = useRef(design);
  const history = useHistory<CardDesign>(80);
  const lastMerge = useRef<{ key: string; at: number } | null>(null);
  const apply = useCallback((next: CardDesign) => {
    designRef.current = next;
    setDesign(next);
  }, []);
  const change = useCallback(
    (fn: (d: CardDesign) => CardDesign, merge?: string) => {
      const current = designRef.current;
      const next = fn(current);
      if (next === current) return;
      const now = Date.now();
      const sameBurst = merge !== undefined && lastMerge.current?.key === merge && now - lastMerge.current.at < 1200;
      if (!sameBurst) history.record(current);
      lastMerge.current = merge ? { key: merge, at: now } : null;
      apply(next);
    },
    [apply, history],
  );
  const undo = useCallback(() => {
    const previous = history.undo(designRef.current);
    lastMerge.current = null;
    if (previous) apply(previous);
  }, [apply, history]);
  const redo = useCallback(() => {
    const next = history.redo(designRef.current);
    lastMerge.current = null;
    if (next) apply(next);
  }, [apply, history]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedId && !design.board.layers.some((l) => l.id === selectedId)) setSelectedId(null);
  }, [design.board.layers, selectedId]);

  const changeLayer = useCallback(
    (id: string, fn: (l: Layer) => Layer, merge?: string) => change((d) => ({ ...d, board: { ...d.board, layers: d.board.layers.map((l) => (l.id === id ? fn(l) : l)) } }), merge),
    [change],
  );
  const addLayer = useCallback(
    (layer: Layer) => {
      const added = { ...layer, id: newLayerId(layer.kind) } as Layer;
      change((d) => (d.board.layers.length >= 120 ? d : { ...d, board: { ...d.board, layers: [...d.board.layers, added] } }));
      setSelectedId(added.id);
    },
    [change],
  );
  const removeLayer = useCallback(
    (id: string) => {
      change((d) => {
        const layer = d.board.layers.find((l) => l.id === id);
        const photos = { ...d.photos };
        // A photo spot removed takes its photo out of the card too.
        if (layer?.kind === 'image' && layer.source.type === 'binding') delete photos[layer.source.binding as keyof CardDesign['photos']];
        return { ...d, photos, board: { ...d.board, layers: d.board.layers.filter((l) => l.id !== id) } };
      });
      setSelectedId(null);
    },
    [change],
  );

  // ── Saving: on this device at once, on the server shortly after ──
  const tokenRef = useRef<string | null>(start.token);
  const [token, setToken] = useState<string | null>(start.token);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'local' | 'error'>(start.token ? 'saved' : 'idle');
  const [savedHash, setSavedHash] = useState<string | null>(null);
  const [orders, setOrders] = useState<CardSessionOrder[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const lastSynced = useRef<string | null>(null);
  const pending = useRef<Promise<string | null> | null>(null);
  const freshJson = useMemo(
    () => stableStringify(cardFromTemplate(template.definition, { format: design.format, eventType: design.eventType, language: design.language, tags: template.tags })),
    [template, design.format, design.eventType, design.language],
  );

  const forget = useCallback(() => {
    tokenRef.current = null;
    setToken(null);
    lastSynced.current = null;
  }, []);

  useEffect(() => {
    if (!start.token) return;
    cardApi
      .openSession(start.token)
      .then((s) => {
        setOrders(s.orders);
        setSavedHash(s.designHash);
        setPhotoUrls(Object.fromEntries(s.uploads.flatMap((u) => (u.url ? [[u.id, u.url]] : []))));
        const server = CardDesignSchema.safeParse(s.design);
        // The server's copy is newer (edited in another tab or on another visit): it wins.
        if (server.success && new Date(s.updatedAt).getTime() > start.savedAt + 1000) apply(server.data);
        lastSynced.current = server.success ? stableStringify(server.data) : null;
      })
      .catch((error: unknown) => {
        if (isSessionGone(error)) forget();
      });
  }, [start, apply, forget]);

  useEffect(() => {
    const id = setTimeout(() => saveStoredCard({ templateKey: template.key, templateName: template.name, design, token, savedAt: Date.now() }), 300);
    return () => clearTimeout(id);
  }, [design, token, template]);

  const sync = useCallback(
    async (force: boolean): Promise<string | null> => {
      let d = designRef.current;
      const json = stableStringify(d);
      if (!tokenRef.current) {
        if (!force && json === freshJson) return null;
        if (Object.keys(d.photos).length) {
          // The saved card was cleaned up with its photos: start the server copy again without them.
          d = { ...d, photos: {} };
          apply(d);
        }
        const created = await cardApi.createSession(d);
        tokenRef.current = created.token;
        setToken(created.token);
        setSavedHash(created.designHash);
        lastSynced.current = stableStringify(d);
        return created.token;
      }
      if (lastSynced.current === json) return tokenRef.current;
      const saved = await cardApi.saveDesign(tokenRef.current, d);
      lastSynced.current = json;
      setSavedHash(saved.designHash);
      return tokenRef.current;
    },
    [freshJson, apply],
  );

  const save = useCallback(
    (force = false): Promise<string | null> => {
      const run = async (): Promise<string | null> => {
        setSaveState('saving');
        try {
          const saved = await sync(force);
          setSaveState(saved ? 'saved' : 'local');
          return saved;
        } catch (error) {
          if (isSessionGone(error)) {
            forget();
            const again = await sync(force);
            setSaveState(again ? 'saved' : 'local');
            return again;
          }
          setSaveState('error');
          throw error;
        }
      };
      const next = (pending.current ?? Promise.resolve(null)).catch(() => null).then(run);
      pending.current = next;
      return next;
    },
    [sync, forget],
  );

  useEffect(() => {
    const id = setTimeout(() => void save().catch(() => undefined), 1500);
    return () => clearTimeout(id);
  }, [design, save]);

  const ensureSession = useCallback(async () => {
    const saved = await save(true);
    if (!saved) throw new Error(t('cards.editor.notSaved'));
    return saved;
  }, [save, t]);

  // ── Photos ──
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  const uploadPhoto = useCallback(
    async (file: File): Promise<string | null> => {
      if (!PHOTO_TYPES.includes(file.type)) {
        setToast(t('cards.photos.type'));
        return null;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setToast(t('cards.photos.size'));
        return null;
      }
      setUploading(true);
      try {
        const session = await ensureSession();
        const { uploadId, uploadUrl, headers } = await cardApi.createUpload(session, file.type, file.size);
        const put = await fetch(uploadUrl, { method: 'PUT', headers, body: file });
        if (!put.ok) throw new Error(t('cards.photos.failed'));
        let upload = await cardApi.completeUpload(session, uploadId);
        const started = Date.now();
        while ((upload.status === 'PROCESSING' || upload.status === 'UPLOADING') && Date.now() - started < 60_000) {
          await sleep(1000);
          upload = await cardApi.upload(session, uploadId);
        }
        if (upload.status !== 'READY' || !upload.url) {
          setToast(upload.error ?? t('cards.photos.failed'));
          return null;
        }
        const url = upload.url;
        setPhotoUrls((m) => ({ ...m, [upload.id]: url }));
        return upload.id;
      } catch (error) {
        setToast(errorMessage(t, error));
        return null;
      } finally {
        setUploading(false);
      }
    },
    [ensureSession, t],
  );

  // ── What the card draws ──
  const cardT = useMemo(() => createTranslator(design.language), [design.language]);
  const photoByBinding = useMemo(() => Object.fromEntries(Object.entries(design.photos).flatMap(([binding, id]) => (id && photoUrls[id] ? [[binding, photoUrls[id]]] : []))), [design.photos, photoUrls]);
  const ctx = useMemo(() => cardRenderContext(design, photoByBinding), [design, photoByBinding]);
  const editCtx = useMemo(() => {
    const empty = design.board.layers.flatMap((l) => (l.kind === 'image' && l.source.type === 'binding' && !l.hidden && !photoByBinding[l.source.binding] ? [l.source.binding] : []));
    return empty.length ? cardRenderContext(design, { ...Object.fromEntries(empty.map((b) => [b, PHOTO_PLACEHOLDER])), ...photoByBinding }) : ctx;
  }, [design, photoByBinding, ctx]);

  // ── Layout ──
  const [panel, setPanel] = useState<PanelKey>('details');
  const [sheet, setSheet] = useState<'panel' | 'inspector' | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [watermarkPreview, setWatermarkPreview] = useState(true);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const stageBox = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = stageBox.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => entry && setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const W = design.board.width;
  const H = design.board.height;
  const fit = Math.max(0.1, Math.min((box.w - (desktop ? 64 : 24)) / W, (box.h - (desktop ? 72 : 40)) / H, 2.5));
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const zoom = zoomMode === 'fit' ? fit : zoomMode;
  const zoomBy = (factor: number) => setZoomMode(Math.min(3, Math.max(0.15, Math.round(zoom * factor * 100) / 100)));
  const pixels = config.data?.formats[design.format]?.pixels;

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

  // A new size takes the template's own layout for it, keeping the customer's changes (as starting over at that size would, without losing them).
  const setFormat = useCallback((format: CardFormat) => change((d) => withCardFormat(d, format, template.definition, { tags: template.tags })), [change, template]);
  const restart = useCallback(
    (eventType?: string) =>
      change((d) => {
        const fresh = cardFromTemplate(template.definition, { format: d.format, eventType: eventType ?? d.eventType, language: d.language, tags: template.tags });
        const spots = new Set(fresh.board.layers.flatMap((l) => (l.kind === 'image' && l.source.type === 'binding' ? [l.source.binding] : [])));
        const photos = Object.fromEntries(Object.entries(d.photos).filter(([binding]) => spots.has(binding)));
        return { ...fresh, details: d.details, photos };
      }),
    [change, template],
  );

  // Keyboard: undo/redo, delete, nudge, deselect (never while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (downloadOpen) return;
      const typing = (e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        redo();
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
  }, [downloadOpen, selectedId, undo, redo, removeLayer, changeLayer, select]);

  const editor: CardEditorApi = {
    design,
    template,
    config: config.data ?? null,
    t,
    cardT,
    ctx,
    selectedId,
    select,
    change,
    changeLayer,
    addLayer,
    removeLayer,
    uploadPhoto,
    uploading,
    photoUrls,
    setFormat,
    restart,
    focusText,
  };

  const openDownload = async () => {
    setOpening(true);
    setSelectedId(null);
    try {
      const saved = await ensureSession();
      const session = await cardApi.openSession(saved);
      setOrders(session.orders);
      setSavedHash(session.designHash);
    } catch {
      // Offline or the save failed: the dialog explains when something is asked of it.
    } finally {
      setOpening(false);
      setPreviewing(false);
      setDownloadOpen(true);
    }
  };
  const paidOrder = orders.find((o) => o.status === 'PAID' && o.designHash === savedHash) ?? null;

  const panels: Array<{ key: PanelKey; label: string; icon: ReactNode }> = [
    { key: 'details', label: t('cards.panel.details'), icon: <NotebookPen aria-hidden className="size-5" /> },
    { key: 'text', label: t('cards.panel.text'), icon: <Type aria-hidden className="size-5" /> },
    { key: 'colors', label: t('cards.panel.colors'), icon: <Palette aria-hidden className="size-5" /> },
    { key: 'photos', label: t('cards.panel.photos'), icon: <ImageIcon aria-hidden className="size-5" /> },
    { key: 'elements', label: t('cards.panel.elements'), icon: <Shapes aria-hidden className="size-5" /> },
    { key: 'size', label: t('cards.panel.size'), icon: <Ruler aria-hidden className="size-5" /> },
  ];
  const panelBody = (key: PanelKey) =>
    key === 'details' ? (
      <DetailsPanel editor={editor} occasions={occasions} />
    ) : key === 'text' ? (
      <TextPanel editor={editor} />
    ) : key === 'colors' ? (
      <ColorsPanel editor={editor} />
    ) : key === 'photos' ? (
      <PhotosPanel editor={editor} />
    ) : key === 'elements' ? (
      <ElementsPanel editor={editor} />
    ) : (
      <SizePanel editor={editor} />
    );

  const saveLabel =
    saveState === 'saving' ? t('cards.editor.saving') : saveState === 'saved' ? t('cards.editor.saved') : saveState === 'error' ? t('cards.editor.saveFailed') : t('cards.editor.savedDevice');

  return (
    <div className="fixed inset-0 flex flex-col bg-canvas text-ink">
      <TemplateStyles />
      {/* ── Top bar ── */}
      <header className="relative z-20 flex min-h-16 items-center gap-2 border-b border-[#eadfcf] bg-surface/95 px-2 shadow-clay-sm backdrop-blur sm:gap-3 sm:px-4">
        <Link href="/cards" className="btn-3d btn-3d-light size-10 shrink-0 rounded-xl" aria-label={t('cards.editor.back')} title={t('cards.editor.back')}>
          <ArrowLeft aria-hidden className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold sm:text-base">{template.name}</h1>
          <p className="flex items-center gap-1.5 truncate text-xs text-stone-500">
            <span>
              {t(`cards.format.${design.format}`)}
              {pixels ? ` · ${pixels.width} × ${pixels.height} px` : ''}
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1" aria-live="polite">
              {saveState === 'saving' ? <LoaderCircle aria-hidden className="size-3 animate-spin" /> : saveState === 'error' ? <CloudOff aria-hidden className="size-3" /> : <Cloud aria-hidden className="size-3" />}
              {saveLabel}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label={t('cards.editor.undo')} onClick={undo} disabled={!history.canUndo} tone="plain">
            <Undo2 aria-hidden className="size-5" />
          </IconButton>
          <IconButton label={t('cards.editor.redo')} onClick={redo} disabled={!history.canRedo} tone="plain">
            <Redo2 aria-hidden className="size-5" />
          </IconButton>
          {desktop ? (
            <>
              <IconButton
                label={t('cards.editor.reset')}
                tone="plain"
                onClick={() => {
                  if (window.confirm(t('cards.size.resetConfirm'))) restart();
                }}
              >
                <RotateCcw aria-hidden className="size-5" />
              </IconButton>
              <span className="mx-1 h-6 w-px bg-stone-200" aria-hidden />
              <IconButton label={t('cards.editor.zoomOut')} onClick={() => zoomBy(1 / 1.2)} tone="plain">
                <ZoomOut aria-hidden className="size-5" />
              </IconButton>
              <button type="button" onClick={() => setZoomMode('fit')} className="min-w-14 rounded-lg px-1 text-xs font-semibold text-stone-600 tabular-nums hover:bg-sand/80" title={t('cards.editor.fit')}>
                {Math.round(zoom * 100)}%
              </button>
              <IconButton label={t('cards.editor.zoomIn')} onClick={() => zoomBy(1.2)} tone="plain">
                <ZoomIn aria-hidden className="size-5" />
              </IconButton>
              <IconButton label={t('cards.editor.fit')} onClick={() => setZoomMode('fit')} tone="plain" active={zoomMode === 'fit'}>
                <Maximize aria-hidden className="size-5" />
              </IconButton>
            </>
          ) : null}
          <IconButton label={previewing ? t('cards.editor.edit') : t('cards.editor.preview')} onClick={() => setPreviewing((v) => !v)} active={previewing} tone="plain">
            {previewing ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
          </IconButton>
        </div>
        <button type="button" onClick={() => void openDownload()} disabled={opening} className="btn-3d min-h-11 shrink-0 gap-2 rounded-xl px-3 text-sm sm:px-5">
          {opening ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Download aria-hidden className="size-4" />}
          <span className="hidden sm:inline">{t('cards.editor.download')}</span>
          <span className="sr-only sm:hidden">{t('cards.editor.download')}</span>
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* ── Panels (desktop) ── */}
        {desktop ? (
          <aside className="flex w-[22rem] shrink-0 border-r border-[#eadfcf] bg-[#fbf6ee]" aria-label={t('cards.editor.tools')}>
            <nav className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1 border-r border-[#eadfcf] py-3" aria-label={t('cards.editor.tools')}>
              {panels.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={panel === p.key}
                  onClick={() => setPanel(p.key)}
                  className={cn('flex w-16 flex-col items-center gap-1 rounded-xl py-2 text-[0.6875rem] font-semibold transition-colors', panel === p.key ? 'bg-surface text-brand-700 shadow-clay-sm' : 'text-stone-600 hover:bg-white/70 hover:text-ink')}
                >
                  {p.icon}
                  {p.label}
                </button>
              ))}
            </nav>
            <div className="min-w-0 flex-1 overflow-y-auto p-4 [scrollbar-width:thin]">
              <h2 className="mb-4 font-display text-xl">{panels.find((p) => p.key === panel)?.label}</h2>
              {panelBody(panel)}
            </div>
          </aside>
        ) : null}

        {/* ── The canvas ── */}
        <main
          ref={stageBox}
          className="relative min-w-0 flex-1 overflow-auto bg-[radial-gradient(circle,#e3d6c4_1px,transparent_1.2px)] [background-size:18px_18px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
          aria-label={t('cards.editor.canvas')}
          // Zoomed in, the canvas scrolls: keyboards reach it too.
          tabIndex={0}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) select(null);
          }}
        >
          <div className="flex min-h-full min-w-full items-center justify-center p-4 sm:p-8" onPointerDown={(e) => e.target === e.currentTarget && select(null)}>
            {previewing ? (
              <div className="flex flex-col items-center gap-3">
                <div style={{ width: W * zoom }} className="overflow-hidden rounded-sm shadow-2xl">
                  <CardView design={design} ctx={ctx} t={cardT} watermark={watermarkPreview ? (config.data?.watermark ?? null) : null} />
                </div>
                <label className="mx-auto flex w-fit items-center gap-2 rounded-full bg-surface px-4 py-2 text-xs font-medium text-stone-700 shadow-clay-sm">
                  <input type="checkbox" checked={watermarkPreview} onChange={(e) => setWatermarkPreview(e.target.checked)} className="size-4 accent-brand-700" />
                  {t('cards.editor.watermarkPreview')}
                </label>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Stage
                  board={design.board}
                  zoom={zoom}
                  selectedId={selectedId}
                  onSelect={select}
                  onCommit={(board) => change((d) => ({ ...d, board }))}
                  snapping
                  renderBoard={(board) => <CardView design={design} board={board} ctx={editCtx} t={cardT} />}
                  label={t('cards.editor.canvas')}
                  handleSize={desktop ? 10 : 18}
                  onDoubleClick={(id) => {
                    const layer = design.board.layers.find((l) => l.id === id);
                    if (layer?.kind === 'text') focusText(id);
                  }}
                />
                <p className="text-center text-xs text-stone-500" style={{ maxWidth: Math.max(280, W * zoom) }}>
                  {t('cards.editor.canvasHint')}
                </p>
              </div>
            )}
          </div>
        </main>

        {/* ── Inspector (desktop) ── */}
        {desktop ? (
          <aside className="w-[20rem] shrink-0 overflow-y-auto border-l border-[#eadfcf] bg-[#fbf6ee] p-4 [scrollbar-width:thin]" aria-label={t('cards.editor.inspector')}>
            <LayerInspector editor={editor} />
          </aside>
        ) : null}

        {/* ── Bottom sheet (phones) ── */}
        {!desktop && sheet ? (
          <div className="absolute inset-x-0 bottom-0 z-30 max-h-[58%] overflow-y-auto rounded-t-[1.75rem] bg-[#fbf6ee] p-4 pb-6 shadow-[0_-12px_40px_rgba(70,40,26,0.18)]" role="dialog" aria-label={sheet === 'panel' ? panels.find((p) => p.key === panel)?.label : t('cards.editor.inspector')}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg">{sheet === 'panel' ? panels.find((p) => p.key === panel)?.label : t('cards.editor.inspector')}</h2>
              <button type="button" onClick={() => setSheet(null)} className="btn-3d btn-3d-light size-9 rounded-full" aria-label={t('cards.editor.closeSheet')}>
                <X aria-hidden className="size-4" />
              </button>
            </div>
            {sheet === 'panel' ? panelBody(panel) : <LayerInspector editor={editor} onClose={() => select(null)} />}
          </div>
        ) : null}
      </div>

      {!desktop ? (
        <nav className="relative z-30 flex border-t border-[#eadfcf] bg-surface px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]" aria-label={t('cards.editor.tools')}>
          {panels.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={sheet === 'panel' && panel === p.key}
              onClick={() => {
                if (sheet === 'panel' && panel === p.key) setSheet(null);
                else {
                  setPanel(p.key);
                  setSheet('panel');
                }
              }}
              className={cn('flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.625rem] font-semibold', sheet === 'panel' && panel === p.key ? 'text-brand-700' : 'text-stone-600')}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </nav>
      ) : null}

      {toast ? (
        <p role="alert" className="fixed bottom-24 left-1/2 z-[80] w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl bg-stone-900 px-4 py-3 text-center text-sm text-white shadow-xl lg:bottom-8">
          {toast}
        </p>
      ) : null}

      {downloadOpen ? (
        <DownloadDialog editor={editor} ensureSession={ensureSession} sessionToken={token} paidOrder={paidOrder} siteName={siteName} onClose={() => setDownloadOpen(false)} />
      ) : null}
    </div>
  );
}
