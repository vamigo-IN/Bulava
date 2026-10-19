'use client';

import { FileUp, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { effectiveColors, type Artboard, type TemplateDefinition } from '@bulava/template-schema';
import { EMPTY_LICENSE, LicenseFields, licensePayload, type LicenseForm } from '@/components/license-fields';
import { apiPost, uploadToStorage } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { Asset } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useInvalidate } from '../shell';
import { Alert, Button, Checkbox, Modal } from '../ui';
import { boardOf, importRasters, IMPORT_ACCEPT, placeLayers, readDesign, type ImportResult, type Raster } from './import';
import { addBoardPage, sceneSize, type DesignPage } from './pages';

const UPLOADS_AT_ONCE = 3;

/**
 * The Design Studio's Import tab (docs/template-studio.md#imports): a design
 * made in other software (PDF, SVG, PSD, PPTX, pictures) read in the browser,
 * shown for a check, then placed as new pages or on this page. Its pictures
 * are uploaded as licensed assets with the licence the designer gives once
 * for the whole file; they wait for review in Assets like any other upload.
 */
export function ImportPanel({
  definition,
  page,
  board,
  file: dropped,
  onBoard,
  onPages,
  onError,
}: {
  definition: TemplateDefinition;
  page: DesignPage;
  board: Artboard;
  /** A file dropped on the page, to read straight away. */
  file?: File | null;
  onBoard: (board: Artboard, ids: string[]) => void;
  /** Adds pages to the draft; the mutation returns the first new page's id. */
  onPages: (mutate: (draft: TemplateDefinition) => string | null) => void;
  onError: (message: string) => void;
}) {
  const invalidate = useInvalidate();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(dropped ?? null);
  const [editableText, setEditableText] = useState(true);
  const [matchPalette, setMatchPalette] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [where, setWhere] = useState<'pages' | 'here'>('pages');
  const [licensing, setLicensing] = useState(false);
  const [license, setLicense] = useState<LicenseForm>(EMPTY_LICENSE);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const options = useMemo(
    () => ({
      palette: matchPalette ? effectiveColors(definition, null) : null,
      fonts: { heading: definition.fonts.heading.family, body: definition.fonts.body.family, script: definition.fonts.script?.family ?? '' },
      editableText,
    }),
    [definition, matchPalette, editableText],
  );

  // Read (again) when the file or how it is read changes.
  useEffect(() => {
    if (!file) return;
    let live = true;
    setReading(true);
    setProblem(null);
    setResult(null);
    setDone(null);
    readDesign(file, options)
      .then((r) => {
        if (!live) return;
        if (!r.pages.length) setProblem(t('design.import.error.empty'));
        else setResult(r);
      })
      .catch((e: unknown) => live && setProblem(e instanceof Error && e.message ? e.message : t('design.import.error.unreadable')))
      .finally(() => live && setReading(false));
    return () => {
      live = false;
    };
    // The palette and fonts are read once per file; only the switches re-read it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, editableText, matchPalette]);

  const pages = result ? (where === 'here' ? result.pages.slice(0, 1) : result.pages) : [];
  const rasters = importRasters(pages);

  /** Uploads the pictures (a few at a time) and returns their asset ids. */
  const upload = async (list: Raster[]): Promise<Map<Raster, string>> => {
    const names = new Map<Raster, string>();
    for (const p of pages) for (const l of p.layers) if (l.type === 'raster' && !names.has(l.raster)) names.set(l.raster, `${p.name} · ${l.name}`.slice(0, 120));
    const assets = new Map<Raster, string>();
    let next = 0;
    setProgress({ done: 0, total: list.length });
    const worker = async () => {
      while (next < list.length) {
        const raster = list[next++]!;
        const ext = raster.blob.type === 'image/png' ? 'png' : raster.blob.type === 'image/jpeg' ? 'jpg' : 'webp';
        const name = names.get(raster) ?? file?.name ?? 'import';
        const storageKey = await uploadToStorage('asset', new File([raster.blob], `${name.replace(/[^\w-]+/g, '-').slice(0, 60)}.${ext}`, { type: raster.blob.type }));
        const asset = await apiPost<Asset>('/admin/assets', { storageKey, name, type: 'IMAGE', category: 'canvas', tags: ['imported', result!.format], width: raster.width, height: raster.height, license: licensePayload(license) });
        assets.set(raster, asset.id);
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    };
    await Promise.all(Array.from({ length: Math.min(UPLOADS_AT_ONCE, list.length) }, worker));
    return assets;
  };

  const place = async () => {
    if (!result) return;
    setLicensing(false);
    try {
      const assets = rasters.length ? await upload(rasters) : new Map<Raster, string>();
      if (rasters.length) await invalidate(['admin', 'assets']);
      let dropped = 0;
      if (where === 'here') {
        const { layers, dropped: d } = placeLayers(pages[0]!, { width: board.width, height: board.height, mode: 'contain' }, assets, new Set(board.layers.map((l) => l.id)), 120 - board.layers.length);
        dropped = d;
        onBoard({ ...board, layers: [...board.layers, ...layers] }, layers.map((l) => l.id));
      } else {
        // Websites: phone boards as wide as a phone (as tall as the page is); films and cards: their frame.
        const fit = definition.type === 'WEBSITE' ? { width: 390, height: 0, mode: 'width' as const } : { ...sceneSize(definition), mode: 'contain' as const };
        const boards = pages.map((p) => boardOf(p, fit, assets));
        dropped = boards.reduce((n, b) => n + b.dropped, 0);
        onPages((d) => {
          let after: DesignPage | null = page;
          let first: string | null = null;
          for (const { board: b } of boards) {
            after = addBoardPage(d, after, b);
            first ??= after.id;
          }
          return first;
        });
      }
      setDone(dropped ? t('design.import.doneDropped', { count: pages.length, dropped }) : t('design.import.done', { count: pages.length }));
    } catch (e) {
      onError(e instanceof Error && e.message ? e.message : t('common.error'));
    } finally {
      setProgress(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void place();
  };

  const counts = (p: ImportResult['pages'][number]) => {
    const text = p.layers.filter((l) => l.type === 'layer' && l.layer.kind === 'text').length;
    const shapes = p.layers.filter((l) => l.type === 'layer' && l.layer.kind !== 'text').length;
    const pictures = p.layers.filter((l) => l.type === 'raster').length;
    return t('design.import.counts', { text, shapes, pictures });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 text-xs">
      <p className="text-stone-600">{t('design.import.intro')}</p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) setFile(f);
        }}
        className={cn('flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-5 text-center text-stone-600', over ? 'border-brand-500 bg-brand-50' : 'border-stone-300 hover:border-brand-400 hover:bg-stone-50')}
      >
        <FileUp className="size-6 text-stone-400" aria-hidden />
        <span className="font-medium text-stone-800">{t('design.import.choose')}</span>
        <span className="text-[11px] text-stone-500">{t('design.import.formats')}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept={IMPORT_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setFile(f);
          e.target.value = '';
        }}
      />
      <div>
        <Checkbox className="min-h-7 text-xs" label={t('design.import.editableText')} checked={editableText} onChange={(e) => setEditableText(e.target.checked)} />
        <Checkbox className="min-h-7 text-xs" label={t('design.import.matchPalette')} checked={matchPalette} onChange={(e) => setMatchPalette(e.target.checked)} />
      </div>

      {reading ? (
        <p className="flex items-center gap-2 text-stone-600">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t('design.import.reading', { name: file?.name ?? '' })}
        </p>
      ) : null}
      {problem ? <Alert>{problem}</Alert> : null}

      {result && !reading ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-2.5">
            <p className="font-medium text-stone-800">{t('design.import.found', { name: file?.name ?? '', count: result.pages.length })}</p>
            <ul className="mt-1 space-y-0.5 text-stone-600">
              {result.pages.slice(0, 8).map((p, i) => (
                <li key={i}>
                  <span className="font-medium">{p.name}</span>: {counts(p)}
                </li>
              ))}
              {result.pages.length > 8 ? <li>{t('design.import.more', { count: result.pages.length - 8 })}</li> : null}
            </ul>
          </div>
          {result.warnings.length ? (
            <Alert tone="warning">
              <ul className="list-disc space-y-0.5 pl-4">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
          <fieldset className="space-y-1">
            <legend className="mb-1 font-medium text-stone-800">{t('design.import.where')}</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="import-where" checked={where === 'pages'} onChange={() => setWhere('pages')} className="accent-brand-700" />
              {t('design.import.asPages', { count: result.pages.length })}
            </label>
            <label className={cn('flex items-center gap-2', !page.onCanvas && 'opacity-50')}>
              <input type="radio" name="import-where" checked={where === 'here'} disabled={!page.onCanvas} onChange={() => setWhere('here')} className="accent-brand-700" />
              {t('design.import.here')}
            </label>
          </fieldset>
          {progress ? (
            <p className="flex items-center gap-2 text-stone-600">
              <Loader2 className="size-4 animate-spin" aria-hidden /> {t('design.import.uploading', { done: progress.done, total: progress.total })}
            </p>
          ) : (
            <Button className="w-full" onClick={() => (rasters.length ? setLicensing(true) : void place())}>
              {t('design.import.place', { count: pages.length })}
            </Button>
          )}
          {rasters.length ? <p className="text-[11px] text-stone-500">{t('design.import.pictures', { count: rasters.length })}</p> : null}
        </div>
      ) : null}
      {done ? <Alert tone="success">{done}</Alert> : null}

      <Modal open={licensing} onClose={() => setLicensing(false)} title={t('design.import.licenseTitle')}>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-stone-600">{t('design.import.licenseHint', { count: rasters.length })}</p>
          <LicenseFields value={license} onChange={setLicense} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLicensing(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('design.import.upload', { count: rasters.length })}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
