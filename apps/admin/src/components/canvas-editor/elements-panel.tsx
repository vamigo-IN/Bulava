'use client';

import { Search, X } from 'lucide-react';
import { useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { CanvasIcon } from '@bulava/template-engine';
import { CANVAS_SCENES, ICONS, ILLUSTRATIONS, ORNAMENT_LAYERS, SHAPES, type LayerInput } from '@bulava/template-schema';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { illustrationTint, isIllustration, type LayerPreset } from './presets';

/** The drag payload's type: a preset dropped on the board lands where it is dropped. */
export const PRESET_MIME = 'application/x-bulava-preset';

type Category = 'text' | 'photos' | 'shapes' | 'illustrations' | 'ornaments' | 'icons' | 'scenes' | 'widgets';
const CATEGORIES: Category[] = ['text', 'photos', 'shapes', 'illustrations', 'ornaments', 'icons', 'scenes', 'widgets'];

/** Words an element is found by, beyond its own name: its family and what it is used for. */
const KEYWORDS: Record<string, string> = {
  zipper: 'atelier zip tactile fabric linen pouch',
  zipperPull: 'atelier zip slider charm tag hardware',
  scallopTag: 'atelier tag label monogram scalloped vintage',
  satinRibbon: 'atelier ribbon band satin silk wrap',
  satinBow: 'atelier ribbon bow satin gift tie',
  waxSeal: 'atelier seal wax stamp monogram envelope',
  hairlineFrame: 'frame border gold foil stationery',
  decoFrame: 'frame border art deco gold',
  ornateFrame: 'frame border',
  botanicalWreath: 'wreath leaves gold',
  sparkles: 'sparkle stars glitter',
  goldVine: 'vine leaves border gold',
  rings: 'wedding rings engagement',
  ganesha: 'faith hindu emblem',
  crescentStar: 'faith muslim emblem',
  khanda: 'faith sikh emblem',
  cross: 'faith christian emblem',
  chandelier: 'stage 3d light lamp crystal ballroom palace candles hanging',
  candelabra: 'stage 3d light lamp candles candle stand brass church',
  lampPost: 'stage 3d light lamp street lantern post garden',
  hangingLantern: 'stage 3d light lamp lantern brass hanging moroccan',
  carvedPillar: 'stage 3d pillar column temple stone granite carved architecture',
  fountain: 'stage 3d fountain water garden marble courtyard',
  pottedPalm: 'stage 3d plant palm pot planter leaves brass urn',
  bananaPlant: 'stage 3d plant banana tree leaves south indian wedding',
  sacredFire: 'stage 3d fire havan agni hindu wedding pheras flame',
  stall: 'stage 3d stall shop sweets mithai mela bazaar fair',
  ferrisWheel: 'stage 3d ferris wheel giant wheel mela fair carnival lights ride',
  hotAirBalloon: 'stage 3d hot air balloon sky baby shower travel adventure',
  lampTower: 'stage 3d lamp tower deepastambha deepmala diya stambh temple diwali aarti flame',
};

/** "royalPeacock" → "royal peacock". */
const spaced = (name: string) => name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
/** Its name and the words it is found by, for searching. */
const words = (name: string) => `${spaced(name)} ${KEYWORDS[name] ?? ''}`.trim();

interface Item {
  key: string;
  label: string;
  preset: LayerPreset;
  search: string;
  /** What the tile shows. */
  render: (thumb: Thumb) => ReactNode;
}

type Thumb = (layer: LayerInput, width: number, height: number) => ReactNode;

const TEXT_KEYS = ['heading', 'names', 'eyebrow', 'paragraph', 'date'] as const;
const PHOTO_KEYS = ['library', 'cover', 'photo'] as const;
const WIDGET_KEYS = ['countdown', 'button', 'details'] as const;

function itemsOf(category: Category): Item[] {
  switch (category) {
    case 'text':
      return TEXT_KEYS.map((key) => ({
        key,
        label: t(`canvas.add.${key}`),
        preset: { group: 'text', key },
        search: `text ${key} ${t(`canvas.add.${key}`)}`.toLowerCase(),
        render: () => (
          <span aria-hidden className={cn('font-serif text-stone-800', key === 'names' ? 'text-xl italic' : key === 'eyebrow' ? 'text-[10px] tracking-widest uppercase' : key === 'paragraph' ? 'text-xs' : key === 'date' ? 'text-sm tracking-wide uppercase' : 'text-lg font-semibold')}>
            {key === 'names' ? 'Aa & Bb' : key === 'date' ? '14 Dec' : key === 'paragraph' ? 'Lorem ipsum' : 'Aa'}
          </span>
        ),
      }));
    case 'photos':
      return PHOTO_KEYS.map((key) => ({ key, label: t(`canvas.add.${key}`), preset: { group: 'image', key }, search: `photo image picture ${key} ${t(`canvas.add.${key}`)}`.toLowerCase(), render: () => <span className="text-xs text-stone-600">{t(`canvas.add.${key}`)}</span> }));
    case 'shapes':
      return SHAPES.map((key) => ({
        key,
        label: key,
        preset: { group: 'shape', key },
        search: `shape ${key}`,
        render: (thumb) => (
          <span aria-hidden className="block size-12">
            {thumb({ id: 'preview', kind: 'shape', shape: key, frame: key === 'line' ? { x: 20, y: 118, w: 200, h: 4 } : { x: 30, y: 30, w: 180, h: 180 }, fill: { type: 'color', color: 'accent' }, stroke: key === 'line' ? { width: 4, color: 'secondary' } : undefined }, 240, 240)}
          </span>
        ),
      }));
    case 'illustrations':
      return ILLUSTRATIONS.map((key) => ({
        key,
        label: spaced(key),
        preset: { group: 'ornament', key },
        search: `illustration art ${words(key)}`,
        render: (thumb) => <span aria-hidden className="block size-14">{thumb({ id: 'preview', kind: 'ornament', ornament: key, frame: { x: 8, y: 8, w: 224, h: 224 }, color: illustrationTint(key) }, 240, 240)}</span>,
      }));
    case 'ornaments':
      return ORNAMENT_LAYERS.filter((key) => !isIllustration(key)).map((key) => ({
        key,
        label: spaced(key),
        preset: { group: 'ornament', key },
        search: `ornament motif ${words(key)}`,
        render: (thumb) => <span aria-hidden className="block size-10">{thumb({ id: 'preview', kind: 'ornament', ornament: key, frame: { x: 12, y: 12, w: 216, h: 216 }, color: 'secondary' }, 240, 240)}</span>,
      }));
    case 'icons':
      return ICONS.map((key) => ({ key, label: key, preset: { group: 'icon', key }, search: `icon ${key}`, render: () => <CanvasIcon name={key} style={{ width: 22, height: 22 }} /> }));
    case 'scenes':
      return CANVAS_SCENES.map((key) => ({
        key,
        label: key,
        preset: { group: 'scene', key },
        search: `scene illustration background ${key}`,
        render: (thumb) => <span aria-hidden className="block h-12 w-[72px] overflow-hidden rounded">{thumb({ id: 'preview', kind: 'scene', scene: key, frame: { x: 0, y: 0, w: 300, h: 200 } }, 300, 200)}</span>,
      }));
    case 'widgets':
      return WIDGET_KEYS.map((key) => ({ key, label: t(`canvas.add.${key}`), preset: { group: 'widget', key }, search: `widget ${key} ${t(`canvas.add.${key}`)}`.toLowerCase(), render: () => <span className="text-xs text-stone-600">{t(`canvas.add.${key}`)}</span> }));
  }
}

/** A short taste of each category on the first screen; a category or a search shows them all. */
const PREVIEW_COUNT = 8;

/**
 * The left panel's Elements tab, after Canva's: search everything the engine
 * draws, or browse by kind. Click an element to add it in the middle of the
 * page, or drag it onto the page to drop it where it should go.
 */
export function ElementsPanel({ thumb, onAdd }: { thumb: Thumb; onAdd: (preset: LayerPreset) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return null;
    const terms = q.split(/\s+/);
    return CATEGORIES.flatMap((c) => itemsOf(c).map((item) => ({ item, c }))).filter(({ item }) => terms.every((term) => item.search.includes(term)));
  }, [q]);

  const tile = 'flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white px-1.5 py-2 text-center text-[11px] text-stone-700 hover:border-brand-400 hover:bg-brand-50 focus:ring-2 focus:ring-brand-200 focus:outline-none';
  const drag = (preset: LayerPreset) => (e: DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(PRESET_MIME, JSON.stringify(preset));
    e.dataTransfer.effectAllowed = 'copy';
  };
  const grid = (items: Item[]) => (
    <div className="grid grid-cols-3 gap-1.5">
      {items.map((item) => (
        <button key={`${item.preset.group}:${item.key}`} type="button" draggable onDragStart={drag(item.preset)} className={tile} title={item.label} onClick={() => onAdd(item.preset)} style={{ contentVisibility: 'auto' }}>
          {item.render(thumb)}
          <span className="line-clamp-1 w-full font-sans capitalize">{item.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-stone-200 p-3">
        <label className="relative block">
          <span className="sr-only">{t('design.elements.search')}</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('design.elements.search')}
            className="min-h-9 w-full rounded-lg border border-stone-300 bg-white pr-8 pl-8 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 focus:outline-none"
          />
          {query ? (
            <button type="button" className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-stone-400 hover:text-stone-700" aria-label={t('design.elements.clear')} onClick={() => setQuery('')}>
              <X className="size-3.5" />
            </button>
          ) : null}
        </label>
        {!q ? (
          <div className="flex flex-wrap gap-1">
            <button type="button" aria-pressed={!category} onClick={() => setCategory(null)} className={cn('rounded-full border px-2.5 py-0.5 text-[11px]', !category ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-stone-200 text-stone-600 hover:border-stone-300')}>
              {t('design.elements.all')}
            </button>
            {CATEGORIES.map((c) => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={cn('rounded-full border px-2.5 py-0.5 text-[11px]', category === c ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-stone-200 text-stone-600 hover:border-stone-300')}>
                {t(`design.elements.${c}`)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
        {results ? (
          results.length ? (
            grid(results.map((r) => r.item))
          ) : (
            <p className="py-8 text-center text-xs text-stone-500">{t('design.elements.none', { query })}</p>
          )
        ) : category ? (
          grid(itemsOf(category))
        ) : (
          CATEGORIES.map((c) => {
            const items = itemsOf(c);
            return (
              <section key={c}>
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold tracking-wide text-stone-500 uppercase">{t(`design.elements.${c}`)}</h3>
                  {items.length > PREVIEW_COUNT ? (
                    <button type="button" className="text-[11px] font-medium text-brand-700 hover:underline" onClick={() => setCategory(c)}>
                      {t('design.elements.seeAll', { count: items.length })}
                    </button>
                  ) : null}
                </div>
                {grid(items.slice(0, PREVIEW_COUNT))}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
