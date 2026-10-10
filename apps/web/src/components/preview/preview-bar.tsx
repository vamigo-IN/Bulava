'use client';

import { Eye, Palette, Rocket } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createTranslator } from '@bulava/localization';
import { cn } from '@/lib/utils';

/** What the signed-in person may do with the event: GET /events/:id answers its members only. */
interface HostRights {
  edit: boolean;
  publish: boolean;
}

/**
 * A small mark over a preview: "Preview · Not published yet", and nothing
 * else for visitors. The host (signed in, allowed to edit or publish the
 * event) also gets the two ways forward: back to the design, and publishing.
 */
export function PreviewBar({ eventId, language, status }: { eventId: string; language: string; status: string }) {
  const t = useMemo(() => createTranslator(language), [language]);
  const [rights, setRights] = useState<HostRights | null>(null);

  useEffect(() => {
    // Everyone else gets 401 or 403 here, and only the mark.
    fetch(`/api/v1/events/${eventId}`, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } })
      .then(async (r) => {
        if (!r.ok) return;
        const body = (await r.json()) as { data?: { permissions?: string[] } };
        const permissions = body.data?.permissions ?? [];
        setRights({ edit: permissions.includes('event.update'), publish: permissions.includes('event.publish') });
      })
      .catch(() => undefined);
  }, [eventId]);

  const base = `/dashboard/events/${eventId}`;
  const edit = !!rights?.edit;
  const publish = !!rights?.publish && status === 'DRAFT';
  const button = 'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors duration-200';

  return (
    <aside aria-label={t('preview.badge')} className="pointer-events-none fixed inset-x-0 bottom-3 z-[60] flex justify-center px-3">
      <div className={cn('pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-night-900/90 py-1.5 pl-3.5 text-ivory shadow-lift ring-1 ring-white/10 backdrop-blur', edit || publish ? 'pr-1.5' : 'pr-3.5 min-h-9')}>
        <Eye aria-hidden className="size-3.5 shrink-0 text-gold-200" />
        <p className="min-w-0 truncate text-xs">
          <span className="font-semibold tracking-[0.14em] text-gold-200 uppercase">{t('preview.badge')}</span>
          {/* Hosts on phones see the buttons instead; the mark says enough. */}
          <span className={cn(edit || publish ? 'hidden sm:inline' : undefined)}>
            <span aria-hidden className="mx-1.5 text-ivory/40">
              ·
            </span>
            {t('preview.note')}
          </span>
        </p>
        {edit ? (
          <Link href={`${base}/design`} className={`${button} bg-white/10 text-ivory hover:bg-white/20`}>
            <Palette aria-hidden className="size-3.5" />
            {t('preview.edit')}
          </Link>
        ) : null}
        {publish ? (
          // The event's publish dialog opens from ?publish=1.
          <Link href={`${base}?publish=1`} className={`${button} bg-gradient-to-b from-gold-200 to-gold-300 text-night-900 hover:from-gold-100 hover:to-gold-200`}>
            <Rocket aria-hidden className="size-3.5" />
            {t('preview.publish')}
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
