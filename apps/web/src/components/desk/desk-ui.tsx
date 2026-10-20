'use client';

import { Clapperboard, Globe2, IdCard, KeyRound, ShieldCheck, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { PreviewKind, PreviewStatus } from '@/lib/previews';
import { cn } from '@/lib/utils';
import { LoadError } from '@/components/dashboard/load-error';

export const KIND_ICON: Record<PreviewKind, LucideIcon> = { WEBSITE: Globe2, CARD: IdCard, FILM: Clapperboard };

const STATUS_TONE: Record<PreviewStatus, string> = {
  NEW: 'bg-sky-50 text-sky-800 ring-sky-200',
  ASSIGNED: 'bg-violet-50 text-violet-800 ring-violet-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-900 ring-amber-200',
  SENT: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  CHANGES_REQUESTED: 'bg-rose-50 text-rose-800 ring-rose-200',
  OWNED: 'bg-gold-100 text-gold-800 ring-gold-300',
  CLOSED: 'bg-stone-100 text-stone-600 ring-stone-200',
  CANCELLED: 'bg-stone-100 text-stone-500 ring-stone-200',
};

export function StatusBadge({ status, className }: { status: PreviewStatus; className?: string }) {
  const t = useT();
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', STATUS_TONE[status], className)}>{t(`desk.status.${status}`)}</span>;
}

/** What the customer asked for, as small icons with their names for screen readers. */
export function Wants({ wants, className }: { wants: PreviewKind[]; className?: string }) {
  const t = useT();
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {wants.map((kind) => {
        const Icon = KIND_ICON[kind];
        return (
          <span key={kind} title={t(`look.kind.${kind}`)} className="grid size-7 place-items-center rounded-lg bg-gold-100/80 text-gold-800 ring-1 ring-gold-200">
            <Icon aria-hidden className="size-3.5" />
            <span className="sr-only">{t(`look.kind.${kind}`)}</span>
          </span>
        );
      })}
    </span>
  );
}

/** The desk's dark header band, like the account's and the events'. */
export function DeskHeader({ eyebrow, title, children, actions }: { eyebrow: ReactNode; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="grain relative isolate overflow-hidden rounded-[2rem] bg-night-900 px-6 py-7 text-ivory shadow-lift sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -right-24 h-[420px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(122,29,39,0.7),transparent)]" />
        <div className="absolute -bottom-40 -left-20 h-[320px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(184,137,43,0.16),transparent)]" />
      </div>
      <Mandala className="pointer-events-none absolute -top-28 -right-20 -z-10 w-80 animate-spin-slow text-gold-300 opacity-[0.1]" />
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-[0.2em] text-gold-200/80 uppercase">{eyebrow}</div>
          <h1 className="mt-2 font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">{title}</h1>
          {children}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export const HEADER_BUTTON = 'inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium text-ivory ring-1 ring-white/20 transition-[background-color,box-shadow] duration-300 hover:bg-white/5 hover:ring-gold-300/40 disabled:opacity-60';
export const GOLD_BUTTON =
  'inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-b from-gold-200 to-gold-300 px-5 text-sm font-semibold text-night-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_24px_-12px_rgba(227,197,133,0.8)] transition-colors duration-300 hover:from-gold-100 hover:to-gold-200 disabled:opacity-60';

/**
 * A desk read that failed: staff tools ask for two-step sign-in in production
 * (MFA_REQUIRED), and say so with the way to turn it on; anything else is a
 * load error with a retry.
 */
export function DeskError({ error, onRetry, retrying }: { error: unknown; onRetry: () => void; retrying: boolean }) {
  const t = useT();
  if (error instanceof ApiError && error.code === 'MFA_REQUIRED') {
    return (
      <div role="alert" className="clay mx-auto mt-6 max-w-lg rounded-[2rem] p-8 text-center">
        <span aria-hidden className="icon-3d mx-auto size-14 rounded-2xl">
          <KeyRound className="size-6" />
        </span>
        <h1 className="mt-5 font-display text-3xl">{t('desk.mfa.title')}</h1>
        <p className="mt-2 leading-relaxed text-stone-600">{t('desk.mfa.body')}</p>
        <Link href="/dashboard/account/security" className="btn-3d mt-7 inline-flex min-h-12 items-center gap-2 rounded-2xl px-6">
          <ShieldCheck aria-hidden className="size-4" />
          {t('desk.mfa.cta')}
        </Link>
      </div>
    );
  }
  return <LoadError error={error} onRetry={onRetry} retrying={retrying} />;
}

/** "12 Dec 2026" from the request's yyyy-mm-dd. */
export function shortDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
