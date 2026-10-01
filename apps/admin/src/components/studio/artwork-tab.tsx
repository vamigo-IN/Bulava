'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Artwork, TemplateDefinition } from '@bulava/template-schema';
import { apiGet } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { Asset } from '@/lib/types';
import { Alert, Badge, Button, Card, CardTitle, Checkbox, EmptyState, Field, Input, Select } from '../ui';
import { EditError, type EditorProps } from './common';

/** Painted layers share the scene canvas: 3:2 (see docs/illustration-brief.md). */
const CANVAS_RATIO = 1.5;
const ROLE = 'artwork';

function keyFrom(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'artwork';
  let key = base;
  for (let i = 2; taken.has(key); i++) key = `${base}-${i}`;
  return key;
}

/** Keep `assets` in step with the artwork, so publishing checks every layer's licence. */
function syncAssets(d: TemplateDefinition) {
  const used = new Set(Object.values(d.artworks ?? {}).flatMap((a) => a.layers.map((l) => l.assetId)));
  d.assets = [...d.assets.filter((a) => a.role !== ROLE && !used.has(a.assetId)), ...[...used].map((assetId) => ({ assetId, role: ROLE }))];
}

export function ArtworkTab({ definition, edit }: EditorProps) {
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const images = useQuery({ queryKey: ['admin', 'assets', 'type=IMAGE'], queryFn: () => apiGet<Asset[]>('/admin/assets') });
  const library = (images.data ?? []).filter((a) => a.type === 'IMAGE' && a.status !== 'REJECTED' && a.status !== 'ARCHIVED');
  const byId = new Map(library.map((a) => [a.id, a]));
  const artworks = definition.artworks ?? {};
  const isWebsite = definition.type === 'WEBSITE';
  const run = (fn: (d: TemplateDefinition) => void) =>
    setError(
      edit((d) => {
        fn(d);
        syncAssets(d);
      }),
    );
  const update = (key: string, fn: (a: Artwork) => void) => run((d) => fn(d.artworks![key]!));

  const add = () => {
    const name = newName.trim();
    const first = library.find((a) => a.status === 'APPROVED') ?? library[0];
    if (!name || !first) return;
    run((d) => {
      const key = keyFrom(name, new Set(Object.keys(d.artworks ?? {})));
      d.artworks = { ...d.artworks, [key]: { name, dark: false, textTop: 0.06, layers: [{ assetId: first.id, depth: 0.1, label: 'sky' }] } };
    });
    setNewName('');
  };

  const remove = (key: string) =>
    run((d) => {
      const { [key]: _gone, ...rest } = d.artworks ?? {};
      d.artworks = Object.keys(rest).length ? rest : undefined;
      // Nothing may point at the removed artwork.
      d.website?.pages.forEach((p) =>
        p.sections.forEach((s) => {
          const ref = s.props.artwork;
          if (s.section === 'hero' && s.variant === 'artwork' && ref && 'literal' in ref && ref.literal === key) {
            s.variant = 'classic';
            delete s.props.artwork;
          }
        }),
      );
      d.scenes?.forEach((s) => {
        if (s.backdrop?.artwork === key) delete s.backdrop;
      });
    });

  const applyToHero = (key: string) =>
    run((d) => {
      const hero = d.website?.pages[0]?.sections.find((s) => s.section === 'hero');
      if (!hero) return;
      hero.variant = 'artwork';
      hero.props = { ...hero.props, artwork: { literal: key } };
    });

  const applyToScenes = (key: string) =>
    run((d) => {
      d.scenes?.forEach((s) => {
        const { scene: _scene, artwork: _artwork, ...rest } = s.backdrop ?? { camera: 'push' as const, intensity: 1, veil: 0 };
        s.backdrop = { ...rest, artwork: key };
      });
    });

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>{t('artwork.title')}</CardTitle>
        <p className="text-sm text-stone-600">{t('artwork.intro')}</p>
        {images.isSuccess && !library.length ? <Alert tone="info" className="mt-3">{t('artwork.noAssets')}</Alert> : null}
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <Field label={t('artwork.name')} className="min-w-56 flex-1">
            {(p) => <Input {...p} value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} placeholder="Vrindavan night" />}
          </Field>
          <Button variant="secondary" onClick={add} disabled={!newName.trim() || !library.length}>
            <Plus className="size-3.5" /> {t('artwork.add')}
          </Button>
        </div>
        <EditError message={error} />
      </Card>

      {!Object.keys(artworks).length ? <EmptyState>{t('artwork.empty')}</EmptyState> : null}

      {Object.entries(artworks).map(([key, artwork]) => (
        <Card key={key}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">{artwork.name}</h2>
              <code className="text-xs text-stone-500">{key}</code>
            </div>
            <div className="flex flex-wrap gap-2">
              {isWebsite ? (
                <Button size="sm" variant="secondary" onClick={() => applyToHero(key)}>
                  {t('artwork.useHero')}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => applyToScenes(key)}>
                  {t('artwork.useScenes')}
                </Button>
              )}
              <Button size="icon" variant="ghost" className="text-red-700 hover:bg-red-50" aria-label={t('artwork.remove')} onClick={() => remove(key)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={t('artwork.name')} className="sm:col-span-2">
              {(p) => <Input {...p} key={artwork.name} defaultValue={artwork.name} maxLength={80} onBlur={(e) => e.target.value.trim() && update(key, (a) => void (a.name = e.target.value.trim()))} />}
            </Field>
            <Field label={t('artwork.background')} hint={t('artwork.backgroundHint')}>
              {(p) => <Input {...p} type="color" className="h-10 p-1" value={artwork.background ?? '#1b1f3b'} onChange={(e) => update(key, (a) => void (a.background = e.target.value))} />}
            </Field>
            <Field label={t('artwork.textTop')} hint={t('artwork.textTopHint')}>
              {(p) => (
                <Input
                  {...p}
                  key={artwork.textTop}
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  defaultValue={Math.round(artwork.textTop * 100)}
                  onBlur={(e) => update(key, (a) => void (a.textTop = Math.min(0.5, Math.max(0, Number(e.target.value) / 100))))}
                />
              )}
            </Field>
          </div>
          <Checkbox className="mt-2" label={t('artwork.dark')} checked={artwork.dark} onChange={(e) => update(key, (a) => void (a.dark = e.target.checked))} />

          <h3 className="mt-4 mb-2 text-sm font-semibold">{t('artwork.layers')}</h3>
          <p className="mb-2 text-xs text-stone-500">{t('artwork.layersHint')}</p>
          <ol className="space-y-2">
            {artwork.layers.map((layer, i) => {
              const asset = byId.get(layer.assetId);
              const ratio = asset?.width && asset.height ? asset.width / asset.height : null;
              const offCanvas = ratio !== null && Math.abs(ratio - CANVAS_RATIO) > 0.03;
              return (
                <li key={`${layer.assetId}-${i}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 p-2">
                  <div className="h-12 w-18 shrink-0 overflow-hidden rounded bg-[repeating-conic-gradient(#e7e5e4_0%_25%,#fafaf9_0%_50%)] bg-[length:10px_10px]">
                    {asset ? <img src={asset.previewUrl} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <Field label={t('artwork.layerAsset')} className="min-w-48 flex-1">
                    {(p) => (
                      <Select {...p} value={layer.assetId} onChange={(e) => update(key, (a) => void (a.layers[i]!.assetId = e.target.value))}>
                        {!asset ? <option value={layer.assetId}>{t('artwork.unknownAsset')}</option> : null}
                        {library.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                            {a.status === 'APPROVED' ? '' : ` (${a.status.toLowerCase().replace('_', ' ')})`}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label={t('artwork.layerLabel')} className="w-32">
                    {(p) => <Input {...p} key={layer.label} defaultValue={layer.label ?? ''} maxLength={40} onBlur={(e) => update(key, (a) => void (a.layers[i]!.label = e.target.value.trim() || undefined))} />}
                  </Field>
                  <Field label={t('artwork.depth')} className="w-24">
                    {(p) => (
                      <Input
                        {...p}
                        key={layer.depth}
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        defaultValue={layer.depth}
                        onBlur={(e) => update(key, (a) => void (a.layers[i]!.depth = Math.min(1, Math.max(0, Number(e.target.value)))))}
                      />
                    )}
                  </Field>
                  <div className="flex items-center gap-1 self-end">
                    {asset && asset.status !== 'APPROVED' ? <Badge tone="warning">{t('artwork.notApproved')}</Badge> : null}
                    {offCanvas ? <Badge tone="warning">{t('artwork.notThreeByTwo')}</Badge> : null}
                    <Button size="icon" variant="ghost" aria-label={t('sections.moveUp')} disabled={i === 0} onClick={() => update(key, (a) => move(a.layers, i, -1))}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={t('sections.moveDown')} disabled={i === artwork.layers.length - 1} onClick={() => update(key, (a) => move(a.layers, i, 1))}>
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-700 hover:bg-red-50"
                      aria-label={t('artwork.removeLayer')}
                      disabled={artwork.layers.length === 1}
                      onClick={() => update(key, (a) => void a.layers.splice(i, 1))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            disabled={artwork.layers.length >= 8 || !library.length}
            onClick={() =>
              update(key, (a) => {
                const last = a.layers[a.layers.length - 1];
                a.layers.push({ assetId: last?.assetId ?? library[0]!.id, depth: Math.min(1, Math.round(((last?.depth ?? 0) + 0.2) * 100) / 100) });
              })
            }
          >
            <ImagePlus className="size-3.5" /> {t('artwork.addLayer')}
          </Button>
        </Card>
      ))}
    </div>
  );
}

function move<T>(list: T[], index: number, delta: number): void {
  const target = index + delta;
  if (target < 0 || target >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(target, 0, item!);
}
