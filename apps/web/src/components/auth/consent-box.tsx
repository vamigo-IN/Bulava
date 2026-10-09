'use client';

import Link from 'next/link';
import { forwardRef, useId, type ComponentProps } from 'react';
import { useT } from '@/lib/i18n';

/**
 * The Terms and Privacy Policy box every new account ticks itself (never
 * pre-ticked: DPDP Act, e-commerce rules). `via` names what the account is
 * made from, for the notice under it.
 */
export const ConsentBox = forwardRef<HTMLInputElement, Omit<ComponentProps<'input'>, 'type'> & { error?: string; via?: 'email' | 'whatsapp' }>(
  ({ error, via = 'email', ...props }, ref) => {
    const t = useT();
    const noticeId = useId();
    const link = 'font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700';
    return (
      <div className="rounded-2xl bg-[#f8f2ea] p-4 shadow-clay-inset">
        <label className="flex cursor-pointer items-start gap-3 text-[0.9375rem] leading-relaxed text-stone-800">
          <input ref={ref} type="checkbox" className="mt-1 size-5 shrink-0 rounded border-stone-300 accent-brand-700" aria-invalid={error ? true : undefined} aria-describedby={noticeId} {...props} />
          <span>
            {t('auth.consent.before')}{' '}
            <Link href="/terms" target="_blank" className={link}>
              {t('auth.consent.terms')}
            </Link>{' '}
            {t('auth.consent.and')}{' '}
            <Link href="/privacy" target="_blank" className={link}>
              {t('auth.consent.privacy')}
            </Link>
            .
          </span>
        </label>
        {error ? (
          <p role="alert" className="mt-2 pl-8 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <p id={noticeId} className="mt-2.5 pl-8 text-xs leading-relaxed text-stone-600">
          {t(via === 'whatsapp' ? 'auth.consent.noticeWhatsApp' : 'auth.consent.notice')}
        </p>
      </div>
    );
  },
);
ConsentBox.displayName = 'ConsentBox';
