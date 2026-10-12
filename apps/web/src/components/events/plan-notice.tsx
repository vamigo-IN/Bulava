'use client';

import { LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import type { MessageKey } from '@bulava/localization';
import { useT } from '@/lib/i18n';
import { useEventPlan } from '@/lib/queries';

/**
 * A feature the event's plan switches off (replies, music), said where it
 * matters rather than found out by guests: with the way to unlock it for the
 * owner, and who to ask for everyone else (plans are the owner's, ADR-062).
 */
export function PlanNotice({ eventId, feature, message, canPay }: { eventId: string; feature: string; message: MessageKey; canPay: boolean }) {
  const t = useT();
  const plan = useEventPlan(eventId);
  const f = plan.data?.features[feature];
  if (!f || f.enabled) return null;
  return (
    <div role="note" className="clay-inset flex items-start gap-3 rounded-2xl p-4 text-sm text-stone-700">
      <LockKeyhole aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-600" />
      <p>
        {t(message)}{' '}
        {canPay ? (
          <Link href={`/dashboard/events/${eventId}/unlock`} className="font-semibold whitespace-nowrap text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
            {t('unlock.cta')}
          </Link>
        ) : (
          t('upgrade.ownerOnly.short')
        )}
      </p>
    </div>
  );
}
