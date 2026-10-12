'use client';

import { LoaderCircle, Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { Translator } from '@bulava/localization';
import { FIELD, PanelSection } from '@/components/cards/editor-ui';
import { errorMessage } from '@/lib/i18n';
import { stockStatus, type StockKind, type StockPage, type StockResult, type StockStatus } from '@/lib/stock';
import { cn } from '@/lib/utils';

/** Where results come from and how one is brought in (an event's design photos, a card's photos). */
export interface StockSource {
  search: (q: string, kind: StockKind, page: number) => Promise<StockPage>;
  /** Brings one in and places it; false when that failed (the panel says why). */
  use: (result: StockResult) => Promise<boolean>;
}

/**
 * Free stock photos and illustrations in the editors' photo panels (ADR-064):
 * a search in licensed libraries (shown only when the Super Admin has set one
 * up), their previews, and the image picked brought in by the server as the
 * host's own photo. The libraries are named and linked, as their terms ask.
 */
export function StockSearch({ source, t }: { source: StockSource; t: Translator }) {
  const [status, setStatus] = useState<StockStatus | null>(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<StockKind>('photo');
  const [page, setPage] = useState<StockPage | null>(null);
  const [results, setResults] = useState<StockResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'done'; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    void stockStatus().then((s) => {
      if (!live) return;
      setStatus(s);
      if (!s.photo && s.illustration) setKind('illustration');
    });
    return () => {
      live = false;
    };
  }, []);

  if (!status || (!status.photo && !status.illustration)) return null;

  const run = async (next: number, k: StockKind = kind) => {
    const words = q.trim();
    if (words.length < 2) return;
    setBusy(true);
    setMessage(null);
    try {
      const found = await source.search(words, k, next);
      setPage(found);
      setResults((r) => (next === 1 ? found.results : [...r, ...found.results.filter((x) => !r.some((y) => y.id === x.id))]));
      if (next === 1 && !found.results.length) setMessage({ tone: 'error', text: t('stock.empty') });
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(t, error) });
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(1);
  };
  const pick = async (result: StockResult) => {
    setAdding(result.id);
    setMessage(null);
    try {
      if (await source.use(result)) setMessage({ tone: 'done', text: t('stock.added') });
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(t, error) });
    } finally {
      setAdding(null);
    }
  };
  const credits = page?.credits.length ? page.credits : status.credits;
  const library = (provider: StockResult['provider']) => credits.find((c) => c.provider === provider)?.name ?? provider;

  return (
    <PanelSection title={t('stock.title')} hint={t('stock.hint')}>
      <form role="search" onSubmit={submit} className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t('stock.search')}</span>
          <input type="search" value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} placeholder={t('stock.placeholder')} className={cn(FIELD, 'min-h-10 px-3')} />
        </label>
        <button type="submit" disabled={busy || q.trim().length < 2} aria-label={t('stock.search')} title={t('stock.search')} className="btn-3d min-h-10 shrink-0 rounded-xl px-3 disabled:opacity-50">
          {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Search aria-hidden className="size-4" />}
        </button>
      </form>
      {status.photo && status.illustration ? (
        <div role="radiogroup" aria-label={t('stock.kind')} className="clay-inset flex gap-1 rounded-xl p-1">
          {(['photo', 'illustration'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                if (k === kind) return;
                setKind(k);
                if (results.length || page) void run(1, k);
              }}
              className={cn('min-h-9 flex-1 rounded-lg text-xs font-medium transition-colors', kind === k ? 'bg-surface text-ink shadow-clay-sm' : 'text-stone-600 hover:text-ink')}
            >
              {t(`stock.kind.${k}`)}
            </button>
          ))}
        </div>
      ) : null}
      {message ? (
        <p role={message.tone === 'error' ? 'alert' : 'status'} className={cn('text-xs', message.tone === 'error' ? 'text-red-700' : 'text-emerald-700')}>
          {message.text}
        </p>
      ) : null}
      {results.length ? (
        <ul className="grid grid-cols-3 gap-2">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                disabled={adding !== null}
                onClick={() => void pick(r)}
                aria-label={t('stock.use', { author: r.author || library(r.provider), library: library(r.provider) })}
                title={`${r.alt ? `${r.alt} · ` : ''}${t('stock.by', { author: r.author || library(r.provider), library: library(r.provider) })}`}
                className="relative block aspect-square w-full overflow-hidden rounded-lg bg-[var(--ed-thumb)] ring-brand-600 transition-shadow hover:ring-2 focus-visible:ring-2 disabled:cursor-wait"
              >
                <img src={r.thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className={cn('size-full object-cover', kind === 'illustration' && 'bg-white object-contain p-1')} />
                {adding === r.id ? (
                  <span className="absolute inset-0 grid place-items-center bg-black/45 text-[0.6875rem] font-semibold text-white">
                    <LoaderCircle aria-hidden className="size-4 animate-spin" />
                    <span className="sr-only">{t('stock.adding')}</span>
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {page?.more ? (
        <button type="button" disabled={busy} onClick={() => void run(page.page + 1)} className="btn-3d btn-3d-light min-h-10 w-full justify-center rounded-xl text-xs disabled:opacity-50">
          {busy ? t('stock.loading') : t('stock.more')}
        </button>
      ) : null}
      <p className="text-[0.6875rem] leading-relaxed text-stone-500">
        {t('stock.credit')}{' '}
        {credits.map((c, i) => (
          <span key={c.provider}>
            {i ? ' · ' : ''}
            <a href={c.url} target="_blank" rel="noreferrer noopener" className="font-semibold underline decoration-stone-300 underline-offset-2 hover:text-ink">
              {c.name}
            </a>
          </span>
        ))}
      </p>
    </PanelSection>
  );
}
