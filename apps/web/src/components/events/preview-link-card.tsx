'use client';

import { Check, Copy, ExternalLink, Eye, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createTranslator } from '@bulava/localization';
import { apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useInvalidateEvent } from '@/lib/queries';
import type { EventSummary } from '@/lib/types';
import { whatsappLink } from '@/lib/utils';
import { Alert, Button, Card } from '@/components/ui/primitives';

/**
 * The host's preview link: the invitation with a "Preview" mark, open to anyone
 * with the link before publishing and whatever the access mode. For choosing
 * the design together on WhatsApp; replaceable when it has been shared too widely.
 */
export function PreviewLinkCard({ event }: { event: EventSummary }) {
  const t = useT();
  const invalidate = useInvalidateEvent(event.id);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/preview/${event.previewToken}`;
  const guestT = createTranslator(event.language);

  const replace = async () => {
    if (!window.confirm(t('share.preview.replaced'))) return;
    setBusy(true);
    setNotice(null);
    try {
      await apiPost(`/events/${event.id}/preview-token`);
      await invalidate();
      setNotice({ tone: 'success', text: t('share.preview.replaced') });
    } catch (err) {
      setNotice({ tone: 'danger', text: errorMessage(t, err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="min-w-0 rounded-3xl">
      <div className="flex items-start gap-4">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold-100 text-gold-700 ring-1 ring-gold-200">
          <Eye className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight">{t('share.preview.title')}</h2>
          <p className="mt-1 text-sm text-stone-600">{t('share.preview.body')}</p>
          {notice ? (
            <div className="mt-3">
              <Alert tone={notice.tone}>{notice.text}</Alert>
            </div>
          ) : null}
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-gold-200 bg-ivory/70 py-2 pr-2 pl-4">
            <p className="min-w-0 flex-1 truncate font-mono text-sm text-ink" title={url}>
              {origin ? url : '…'}
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={!origin}
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
              {copied ? t('common.copied') : t('share.preview.copy')}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="whatsapp" disabled={!origin} onClick={() => window.open(whatsappLink(null, guestT('preview.shareText', { url })), '_blank', 'noopener,noreferrer')}>
              {t('share.whatsapp')}
            </Button>
            <a href={`/preview/${event.previewToken}`} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-stone-700 transition-colors hover:bg-sand/80 hover:text-ink">
              <ExternalLink aria-hidden className="size-4" />
              {t('share.preview.open')}
            </a>
            <Button size="sm" variant="ghost" disabled={busy} onClick={replace}>
              <RefreshCw aria-hidden className="size-4" />
              {t('share.preview.replace')}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
