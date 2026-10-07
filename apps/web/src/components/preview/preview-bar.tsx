'use client';

import { Eye, Palette, Rocket, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createTranslator } from '@bulava/localization';
import { whatsappLink } from '@/lib/utils';

/**
 * Floats over a preview: the "Preview" mark with its explanation, sharing on
 * WhatsApp, and (for the host, who is signed in and a member of the event)
 * the way back to the design and to publishing. Others see how to make their own.
 */
export function PreviewBar({ eventId, language, status, templateName }: { eventId: string; language: string; status: string; templateName: string }) {
  const t = useMemo(() => createTranslator(language), [language]);
  const [host, setHost] = useState<boolean | null>(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(window.location.href);
    // Members of the event may read it; everyone else gets 401/403 and the visitor's bar.
    fetch(`/api/v1/events/${eventId}`, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } })
      .then((r) => setHost(r.ok))
      .catch(() => setHost(false));
  }, [eventId]);

  const base = `/dashboard/events/${eventId}`;
  const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors';

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 pt-6 bg-gradient-to-t from-black/25 to-transparent">
      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-2 rounded-3xl border border-gold-200 bg-ivory/95 p-3 shadow-lift backdrop-blur">
        <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-night-900 px-3 text-xs font-semibold tracking-[0.14em] text-gold-200 uppercase">
          <Eye aria-hidden className="size-3.5" />
          {t('preview.badge')}
        </span>
        <p className="min-w-0 flex-1 basis-40 text-xs leading-snug text-stone-600">
          <span className="font-medium text-ink">{templateName}</span> · {t('preview.note')}
        </p>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {/* WhatsApp's dark teal: white text reads on it (AA), unlike the bright green. */}
          <a href={url ? whatsappLink(null, t('preview.shareText', { url })) : '#'} target="_blank" rel="noopener noreferrer" className={`${button} bg-[#075E54] text-white hover:bg-[#064e46]`}>
            {t('preview.share')}
          </a>
          {host ? (
            <>
              <Link href={`${base}/design`} className={`${button} border border-gold-300 bg-white text-brand-700 hover:bg-gold-100/60`}>
                <Palette aria-hidden className="size-4" />
                {t('preview.edit')}
              </Link>
              {status === 'DRAFT' ? (
                <Link href={base} className={`${button} bg-brand-700 text-ivory hover:bg-brand-800`}>
                  <Rocket aria-hidden className="size-4" />
                  {t('preview.publish')}
                </Link>
              ) : null}
            </>
          ) : host === false ? (
            <Link href="/templates" className={`${button} border border-gold-300 bg-white text-brand-700 hover:bg-gold-100/60`}>
              <Sparkles aria-hidden className="size-4" />
              {t('preview.makeYourOwn')}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
