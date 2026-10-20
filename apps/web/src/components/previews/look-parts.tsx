'use client';

import { ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect } from 'react';
import { createTranslator } from '@bulava/localization';
import type { Customization, RenderContext, TemplateDefinition } from '@bulava/template-schema';
import { lookApi, type LookView } from '@/lib/previews';
import { LookHeader } from './look-page';
import { OwnBar } from './own-bar';

const t = createTranslator('en');
const CardThumb = dynamic(() => import('./card-thumb').then((m) => m.CardThumb), { ssr: false, loading: () => <div className="skeleton aspect-[9/16] w-full" /> });
const FilmPlayer = dynamic(() => import('./look-film').then((m) => m.LookFilmPlayer), { ssr: false, loading: () => <div className="skeleton aspect-[9/16] w-full rounded-[1.5rem]" /> });

function Back({ token }: { token: string }) {
  return (
    <Link href={`/look/${token}`} className="group inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-brand-700">
      <ArrowLeft aria-hidden className="size-4 transition-transform group-hover:-translate-x-0.5" />
      {t('look.back')}
    </Link>
  );
}

export interface LookCardData {
  design: unknown;
  photos: Record<string, string>;
  watermark: string | null;
  templateName: string;
}

/** One card of a preview, large, with its watermark, and the bar to make it yours. */
export function LookCard({ token, view, card }: { token: string; view: LookView; card: LookCardData }) {
  useEffect(() => void lookApi.view(token), [token]);
  return (
    <div className="min-h-dvh bg-ivory">
      <LookHeader view={view} compact />
      <main className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
        <Back token={token} />
        <h2 className="mt-2 text-center font-display text-3xl">{t('look.card.title')}</h2>
        <p className="text-center text-sm text-stone-500">{card.templateName}</p>
        <div className="mx-auto mt-6 w-full max-w-[26rem] overflow-hidden rounded-xl shadow-[0_40px_80px_-40px_rgba(28,25,23,0.6)] ring-1 ring-black/5">
          {/* A long press or a right-click saves nothing better than this: the watermark is part of the card. */}
          <div onContextMenu={(e) => e.preventDefault()}>
            <CardThumb design={card.design} photos={card.photos} watermark={card.watermark} />
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-stone-500">{t('look.sample')}</p>
      </main>
      <OwnBar token={token} view={view} />
    </div>
  );
}

export interface LookFilmData {
  language: string;
  templateKey: string;
  definition: TemplateDefinition;
  customization: Customization | null;
  context: RenderContext;
}

/** One film of a preview, played in the browser with its watermark. */
export function LookFilm({ token, view, film }: { token: string; view: LookView; film: LookFilmData }) {
  useEffect(() => void lookApi.view(token), [token]);
  return (
    <div className="min-h-dvh bg-ivory">
      <LookHeader view={view} compact />
      <main className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
        <Back token={token} />
        <h2 className="mt-2 text-center font-display text-3xl">{t('look.film.title')}</h2>
        <p className="text-center text-sm text-stone-500">{t('look.film.sound')}</p>
        <div className="mx-auto mt-6 w-full max-w-[24rem]">
          <FilmPlayer film={film} />
        </div>
        <p className="mt-4 text-center text-sm text-stone-500">{t('look.sample')}</p>
      </main>
      <OwnBar token={token} view={view} />
    </div>
  );
}
