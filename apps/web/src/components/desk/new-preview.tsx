'use client';

import { Check, Heart, LoaderCircle, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useT } from '@/lib/i18n';
import { PREVIEW_KINDS, type PreviewKind } from '@/lib/previews';
import { useTemplateList } from '@/lib/queries';
import { cardPreview, posterPreview } from '@/lib/template-previews';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/primitives';
import { KIND_ICON } from './desk-ui';

/**
 * Starting a preview: what to make (the website, a card, the film) and its
 * design, from the occasion's designs, the one the customer liked first.
 * Cards come from the designs that make cards (a canvas opening).
 */
export function NewPreview({ eventTypeKey, liked, start, busy, onCreate }: { eventTypeKey: string; liked: string | null; start: PreviewKind; busy: boolean; onCreate: (kind: PreviewKind, templateKey: string) => void }) {
  const t = useT();
  const [kind, setKind] = useState<PreviewKind>(start);
  const [chosen, setChosen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const list = useTemplateList(kind === 'FILM' ? 'VIDEO' : 'WEBSITE', eventTypeKey);

  const templates = useMemo(() => {
    const all = (list.data ?? []).filter((tpl) => !tpl.tags.includes('blank') && (kind !== 'CARD' || tpl.preview?.heroSection === 'canvas'));
    const needle = q.trim().toLowerCase();
    const found = needle ? all.filter((tpl) => tpl.name.toLowerCase().includes(needle)) : all;
    // The design the customer liked comes first.
    return [...found.filter((tpl) => tpl.key === liked), ...found.filter((tpl) => tpl.key !== liked)];
  }, [list.data, kind, q, liked]);

  const image = (key: string) => (kind === 'FILM' ? (posterPreview(key) ?? cardPreview(key)) : cardPreview(key));

  return (
    <div className="rounded-2xl border border-gold-200 bg-white/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label={t('desk.add.kind')} className="clay-inset flex rounded-full p-1">
          {PREVIEW_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => {
                  setKind(k);
                  setChosen(null);
                }}
                className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors', kind === k ? 'bg-night-900 text-ivory' : 'text-stone-600 hover:text-ink')}
              >
                <Icon aria-hidden className="size-4" />
                {t(`look.kind.${k}`)}
              </button>
            );
          })}
        </div>
        <label className="relative min-w-[10rem] flex-1">
          <span className="sr-only">{t('desk.add.search')}</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('desk.add.search')} className="pl-10" maxLength={60} />
        </label>
      </div>

      <div className="mt-4 max-h-[26rem] overflow-y-auto pr-1 [scrollbar-width:thin]">
        {list.isPending ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="skeleton aspect-[3/5] rounded-xl" />
            ))}
          </div>
        ) : templates.length ? (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5" role="listbox" aria-label={t('desk.add.design')}>
            {templates.map((tpl) => {
              const src = image(tpl.key);
              const on = chosen === tpl.key;
              return (
                <li key={tpl.key} role="option" aria-selected={on}>
                  <button type="button" onClick={() => setChosen(tpl.key)} className="group block w-full text-left">
                    <span className={cn('relative block aspect-[3/5] overflow-hidden rounded-xl bg-sand ring-2 transition-[box-shadow] duration-200', on ? 'ring-brand-600 shadow-lift' : 'ring-transparent hover:ring-gold-300')}>
                      {src ? <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover object-top" /> : null}
                      {tpl.key === liked ? (
                        <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-brand-700 shadow-sm">
                          <Heart aria-hidden className="size-3" fill="currentColor" />
                          {t('desk.add.liked')}
                        </span>
                      ) : null}
                      {on ? (
                        <span aria-hidden className="absolute right-1.5 bottom-1.5 grid size-6 place-items-center rounded-full bg-brand-700 text-white shadow">
                          <Check className="size-3.5" strokeWidth={3} />
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1.5 block truncate text-xs font-medium text-stone-700 group-hover:text-ink">{tpl.name}</span>
                    <span className="block text-[10px] text-stone-500">{t(`filter.tier.${tpl.tier}`)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-stone-500">{t('desk.add.none')}</p>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" disabled={!chosen || busy} onClick={() => chosen && onCreate(kind, chosen)} className="btn-3d min-h-11 rounded-full px-5 text-sm disabled:opacity-60">
          {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Plus aria-hidden className="size-4" />}
          {busy ? t('desk.add.creating') : t('desk.add.create')}
        </button>
      </div>
    </div>
  );
}
