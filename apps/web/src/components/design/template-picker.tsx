'use client';

import { Check, Crown, Lock, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TemplateRenderer } from '@bulava/template-engine';
import type { Customization, RenderContext } from '@bulava/template-schema';
import { useT } from '@/lib/i18n';
import { useTemplateDefinition } from '@/lib/queries';
import { cardPreview } from '@/lib/template-previews';
import type { TemplateSummaryLite } from '@/lib/types';
import { cn } from '@/lib/utils';

export const TIER_RANK = { FREE: 0, STANDARD: 1, PREMIUM: 2 } as const;
const TIERS = ['ALL', 'FREE', 'STANDARD', 'PREMIUM'] as const;
type TierFilter = (typeof TIERS)[number];

/** Wide screens show a live preview beside the grid; narrower ones choose with a single tap. */
function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}

/**
 * Every design for this occasion in one roomy dialog: filters by plan and a
 * search, cards with the pre-rendered previews of the gallery, and (on wide
 * screens) the focused design live with the host's own names before they
 * pick it. Mounted only while open.
 */
export function TemplatePicker({
  templates,
  currentKey,
  selectedKey,
  maxTier,
  context,
  customization,
  language,
  watermark,
  onChoose,
  onClose,
}: {
  templates: TemplateSummaryLite[];
  /** The saved design (marked "In use"). */
  currentKey: string | null;
  /** The design being edited on the page (focused first). */
  selectedKey: string | null;
  maxTier: number;
  context: RenderContext;
  /** The host's words and photos, kept across designs. */
  customization: Customization;
  language: string;
  watermark: boolean;
  onChoose: (key: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const wide = useWide();
  const [tier, setTier] = useState<TierFilter>('ALL');
  const [inPlan, setInPlan] = useState(false);
  const [query, setQuery] = useState('');
  const [focusKey, setFocusKey] = useState<string | null>(selectedKey ?? templates[0]?.key ?? null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter(
      (tpl) =>
        (tier === 'ALL' || tpl.tier === tier) &&
        (!inPlan || TIER_RANK[tpl.tier] <= maxTier) &&
        (!q || tpl.name.toLowerCase().includes(q) || tpl.tags.some((tag) => tag.toLowerCase().includes(q)) || (tpl.description ?? '').toLowerCase().includes(q)),
    );
  }, [templates, tier, inPlan, query, maxTier]);
  const focused = templates.find((tpl) => tpl.key === focusKey) ?? null;
  // Only the focused design is drawn live (wide screens), so only its definition is fetched.
  const focusedDefinition = useTemplateDefinition(wide ? focusKey : null).data?.definition;

  const choose = (key: string) => {
    onChoose(key);
    ref.current?.close();
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="picker-title"
      className="m-auto h-[calc(100dvh-1.5rem)] max-h-none w-[min(84rem,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-[2rem] bg-transparent p-0 backdrop:bg-night-950/55 backdrop:backdrop-blur-sm"
    >
      <div className="flex h-full flex-col overflow-hidden rounded-[2rem] bg-ivory">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-gold-200/70 px-5 py-4 sm:px-7">
          <div className="min-w-0 flex-1">
            <h2 id="picker-title" className="font-display text-2xl leading-tight sm:text-3xl">
              {t('picker.title')}
            </h2>
            <p className="text-sm text-stone-500">{t('picker.count', { count: shown.length })}</p>
          </div>
          <label className="relative order-3 w-full sm:order-none sm:w-64">
            <span className="sr-only">{t('picker.search')}</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('picker.search')}
              className="block min-h-11 w-full rounded-full border border-[#e2d2c0] bg-[#f8f2ea] pr-4 pl-10 text-sm shadow-clay-inset placeholder:text-stone-500 focus:border-brand-600 focus:bg-white focus:ring-4 focus:ring-brand-100 focus:outline-none"
            />
          </label>
          <button type="button" onClick={() => ref.current?.close()} aria-label={t('common.close')} className="grid size-11 place-items-center rounded-full text-stone-500 transition-colors hover:bg-sand hover:text-ink">
            <X aria-hidden className="size-5" />
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-gold-100 px-5 py-3 sm:px-7">
          {TIERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={tier === value}
              onClick={() => setTier(value)}
              className={cn('btn-3d min-h-9 rounded-full px-4 text-xs', tier !== value && 'btn-3d-light')}
            >
              {value === 'ALL' ? t('picker.all') : t(`filter.tier.${value}`)}
            </button>
          ))}
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-gold-200 sm:block" />
          <button type="button" aria-pressed={inPlan} onClick={() => setInPlan((v) => !v)} className={cn('btn-3d min-h-9 rounded-full px-4 text-xs', !inPlan && 'btn-3d-light')}>
            {inPlan ? <Check aria-hidden className="size-3.5" /> : null}
            {t('picker.inPlan')}
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
            {shown.length ? (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
                {shown.map((tpl) => {
                  const locked = TIER_RANK[tpl.tier] > maxTier;
                  const isFocused = wide && tpl.key === focusKey;
                  const preview = cardPreview(tpl.key);
                  return (
                    <li key={tpl.key}>
                      <button
                        type="button"
                        onClick={() => (wide ? setFocusKey(tpl.key) : choose(tpl.key))}
                        onDoubleClick={() => choose(tpl.key)}
                        aria-pressed={wide ? isFocused : undefined}
                        className={cn(
                          'group block w-full rounded-[1.4rem] p-2 text-left transition-[box-shadow,background-color] duration-300',
                          isFocused ? 'bg-white shadow-clay ring-2 ring-brand-600' : 'hover:bg-white hover:shadow-clay-sm',
                        )}
                      >
                        <div className="relative aspect-[3/5] overflow-hidden rounded-2xl bg-sand ring-1 ring-gold-200/70">
                          {preview ? (
                            // The gallery's pre-rendered preview (a plain image, as on the marketing cards).
                            <img src={preview} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
                          ) : (
                            // Not photographed yet: the design's own colours stand in.
                            <div
                              className="absolute inset-0"
                              style={{ background: tpl.preview?.colors ? `linear-gradient(160deg, ${tpl.preview.colors.background}, ${tpl.preview.colors.accent})` : undefined }}
                            />
                          )}
                          <span className="absolute top-2 left-2 flex flex-wrap gap-1">
                            {tpl.key === currentKey ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
                                <Check aria-hidden className="size-3" strokeWidth={3} />
                                {t('design.chosen')}
                              </span>
                            ) : null}
                          </span>
                          {locked ? (
                            <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-night-900/80 text-gold-200 shadow" title={t('design.locked')}>
                              <Lock aria-hidden className="size-3.5" />
                              <span className="sr-only">{t('design.locked')}</span>
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-start justify-between gap-2 px-1.5 pt-3 pb-1">
                          <span className="line-clamp-2 font-display text-[1.05rem] leading-snug text-ink">{tpl.name}</span>
                          <TierTag tier={tpl.tier} />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="clay-inset mx-auto mt-10 max-w-md rounded-3xl px-6 py-12 text-center">
                <p className="font-display text-2xl text-ink">{t('picker.none')}</p>
                <button
                  type="button"
                  onClick={() => {
                    setTier('ALL');
                    setInPlan(false);
                    setQuery('');
                  }}
                  className="btn-3d btn-3d-light mt-5 min-h-10 rounded-full px-5 text-sm"
                >
                  {t('picker.reset')}
                </button>
              </div>
            )}
          </div>

          {wide && focused && focusedDefinition ? (
            <aside className="flex w-[400px] shrink-0 flex-col border-l border-gold-200/70 bg-sand/40 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-stone-500 uppercase">{t('picker.preview')}</p>
                  <h3 className="mt-1 truncate font-display text-2xl leading-tight">{focused.name}</h3>
                </div>
                <TierTag tier={focused.tier} />
              </div>
              <div className="relative mx-auto mt-4 min-h-0 w-full max-w-[330px] flex-1 overflow-hidden rounded-[2rem] border-[7px] border-ink bg-white shadow-xl">
                <div className="absolute inset-0 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brand-600" tabIndex={0} role="region" aria-label={t('picker.preview')}>
                  <TemplateRenderer definition={focusedDefinition} context={context} customization={customization} mode="preview" language={language} slots={{ watermark: watermark || TIER_RANK[focused.tier] > maxTier }} />
                </div>
              </div>
              {TIER_RANK[focused.tier] > maxTier ? (
                <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-stone-600">
                  <Crown aria-hidden className="mt-0.5 size-3.5 shrink-0 text-gold-600" />
                  {t('picker.beyondPlan')}
                </p>
              ) : null}
              <button type="button" onClick={() => choose(focused.key)} className="btn-3d mt-4 min-h-12 w-full rounded-2xl text-sm">
                <Sparkles aria-hidden className="size-4" />
                {focused.key === selectedKey ? t('picker.keep') : t('picker.use')}
              </button>
            </aside>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}

function TierTag({ tier }: { tier: TemplateSummaryLite['tier'] }) {
  const t = useT();
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        tier === 'FREE' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : tier === 'PREMIUM' ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-amber-50 text-amber-900 ring-amber-200',
      )}
    >
      {t(`filter.tier.${tier}`)}
    </span>
  );
}
