'use client';

import { Check, FileLock2, KeyRound, Mail, Phone, ReceiptIndianRupee, ShieldCheck, ShieldAlert, UserRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { MessageKey } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { useT } from '@/lib/i18n';
import { useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';

const NAV: Array<{ href: string; label: MessageKey; hint: MessageKey; icon: LucideIcon; exact?: boolean }> = [
  { href: '/dashboard/account', label: 'account.nav.profile', hint: 'account.nav.profile.hint', icon: UserRound, exact: true },
  { href: '/dashboard/account/security', label: 'account.nav.security', hint: 'account.nav.security.hint', icon: ShieldCheck },
  { href: '/dashboard/payments', label: 'account.nav.payments', hint: 'account.nav.payments.hint', icon: ReceiptIndianRupee },
  { href: '/dashboard/account/privacy', label: 'account.nav.privacy', hint: 'account.nav.privacy.hint', icon: FileLock2 },
];

/** One sign-in fact on the account header. */
function Fact({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', ok ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-200')}>
      {ok ? <Check aria-hidden className="size-3" strokeWidth={3} /> : <ShieldAlert aria-hidden className="size-3" />}
      {children}
    </span>
  );
}

/**
 * The account area (profile, sign-in and security, payments, privacy): one
 * header with who is signed in and how well the account is protected, and the
 * sections beside every page, like an event's.
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  const t = useT();
  const me = useMe();
  const pathname = usePathname();
  const user = me.data;

  const link = (item: (typeof NAV)[number], compact: boolean) => {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'group flex items-center gap-3 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-300',
            compact ? 'min-h-10 rounded-full px-4' : 'min-h-14 rounded-2xl px-3',
            active ? 'bg-white text-ink shadow-soft ring-1 ring-gold-200/80' : 'text-stone-600 hover:bg-white/70 hover:text-ink',
          )}
        >
          <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-xl transition-colors', compact ? '' : 'size-9', !compact && (active ? 'icon-3d' : 'bg-white/70 text-stone-500 ring-1 ring-gold-200/70 group-hover:text-gold-600'))}>
            <Icon className={cn('size-4', compact && (active ? 'text-brand-700' : 'text-stone-400'))} />
          </span>
          {compact ? (
            t(item.label)
          ) : (
            <span className="min-w-0">
              <span className="block">{t(item.label)}</span>
              <span className="block truncate text-xs font-normal text-stone-500">{t(item.hint)}</span>
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <header className="grain relative isolate overflow-hidden rounded-[2rem] bg-night-900 px-6 py-7 text-ivory shadow-lift sm:px-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-24 h-[420px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(122,29,39,0.7),transparent)]" />
        </div>
        <Mandala className="pointer-events-none absolute -top-28 -right-20 -z-10 w-80 animate-spin-slow text-gold-300 opacity-[0.1]" />
        <div className="flex flex-wrap items-center gap-5">
          <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-[1.4rem] bg-gradient-to-br from-gold-200 to-gold-300 font-display text-3xl text-night-900 shadow-[inset_0_2px_2px_rgba(255,255,255,0.6),0_14px_30px_-14px_rgba(227,197,133,0.8)]">
            {user?.name?.[0]?.toUpperCase() ?? '·'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gold-200/80 uppercase">{t('account.eyebrow')}</p>
            <h1 className="mt-1 truncate font-display text-3xl leading-tight sm:text-4xl">{user?.name ?? ''}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ivory/70">
              {user?.email ? (
                <span className="inline-flex items-center gap-1.5">
                  <Mail aria-hidden className="size-3.5" />
                  {user.email}
                </span>
              ) : null}
              {user?.phone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone aria-hidden className="size-3.5" />
                  {user.phone}
                </span>
              ) : null}
            </p>
          </div>
          {user ? (
            <div className="flex flex-wrap gap-2">
              {user.provisional ? <Fact ok={false}>{t('account.fact.provisional')}</Fact> : null}
              <Fact ok={user.hasPassword}>{user.hasPassword ? t('account.fact.password') : t('account.fact.noPassword')}</Fact>
              {user.googleLinked ? <Fact ok>{t('account.fact.google')}</Fact> : null}
              {user.phoneVerified ? <Fact ok>{t('account.fact.whatsapp')}</Fact> : null}
              <Fact ok={user.mfaEnabled}>{user.mfaEnabled ? t('account.fact.twoStep') : t('account.fact.noTwoStep')}</Fact>
            </div>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label={t('account.nav.label')} className="relative -mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:hidden">
          <ul className="flex min-w-max gap-1.5 pb-1">{NAV.map((item) => link(item, true))}</ul>
        </nav>
        <nav aria-label={t('account.nav.label')} className="hidden lg:block">
          <div className="sticky top-20 rounded-[1.5rem] border border-gold-200/60 bg-sand/40 p-3">
            <ul className="space-y-1">{NAV.map((item) => link(item, false))}</ul>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/60 px-3 py-2.5 text-xs leading-relaxed text-stone-600 ring-1 ring-gold-200/60">
              <KeyRound aria-hidden className="mt-0.5 size-3.5 shrink-0 text-gold-600" />
              {t('account.nav.note')}
            </div>
          </div>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
