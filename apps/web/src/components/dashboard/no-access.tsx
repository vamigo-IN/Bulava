'use client';

import { ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { MessageKey } from '@bulava/localization';
import { useT } from '@/lib/i18n';

/**
 * Shown instead of a section the member's role does not include (rather than
 * a failed request), with a way to the first section they can use.
 */
export function NoAccess({ role, next }: { role: string | undefined; next: { href: string; label: string } | null }) {
  const t = useT();
  const roleName = role ? t(`team.role.${role}` as MessageKey) : '';
  return (
    <div role="status" className="mx-auto max-w-lg rounded-[2rem] border border-gold-200/80 bg-white p-8 text-center shadow-soft">
      <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-full bg-gold-100 text-gold-700 ring-1 ring-gold-200">
        <ShieldCheck className="size-6" />
      </span>
      <h2 className="mt-5 font-display text-3xl leading-tight">{t('dash.noAccess.title')}</h2>
      <p className="mt-2 text-stone-600">{t('dash.noAccess.body', { role: roleName })}</p>
      {next ? (
        <Link
          href={next.href}
          className="group/cta mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-700 px-5 text-sm font-semibold text-ivory transition-colors hover:bg-brand-800"
        >
          {t('dash.noAccess.go', { section: next.label })}
          <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}
