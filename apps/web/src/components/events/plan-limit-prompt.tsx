'use client';

import { LockOpen, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { PLAN_LIMIT_EVENT, type PlanLimitDetail } from '@/lib/plan-limits';

/**
 * When a request inside an event meets a plan limit (more guests, photos,
 * functions, films or WhatsApp messages than its plan allows), the page says
 * which limit, and this offers the way to unlock more: the event's plans, or the
 * plans page for the number of events. It stays until dismissed or the page changes.
 */
export function PlanLimitPrompt({ eventId, canPay }: { eventId: string; canPay: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const [detail, setDetail] = useState<PlanLimitDetail | null>(null);

  useEffect(() => {
    const onLimit = (e: Event) => setDetail((e as CustomEvent<PlanLimitDetail>).detail);
    window.addEventListener(PLAN_LIMIT_EVENT, onLimit);
    return () => window.removeEventListener(PLAN_LIMIT_EVENT, onLimit);
  }, []);
  useEffect(() => setDetail(null), [pathname]);

  if (!detail || !canPay) return null;
  const href = detail.feature === 'events.max' ? '/pricing' : `/dashboard/events/${eventId}/unlock`;
  return (
    <div
      role="status"
      className="clay fixed inset-x-4 bottom-4 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 animate-scale-in sm:bottom-6"
    >
      <span className="icon-3d size-9 shrink-0 rounded-xl">
        <LockOpen aria-hidden className="size-4.5" />
      </span>
      <p className="min-w-0 flex-1 text-sm text-stone-700">
        {t('unlock.prompt')}{' '}
        <Link href={href} className="font-semibold whitespace-nowrap text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
          {t('unlock.cta')}
        </Link>
      </p>
      <button
        type="button"
        onClick={() => setDetail(null)}
        aria-label={t('unlock.close')}
        className="grid size-9 shrink-0 place-items-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-ink"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
