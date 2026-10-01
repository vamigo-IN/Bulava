'use client';

import { Mail } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { createTranslator } from '@bulava/localization';
import { apiGet, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useEvent, useGuests, useInvalidateEvent, useInvitations } from '@/lib/queries';
import type { Invitation } from '@/lib/types';
import { whatsappLink } from '@/lib/utils';
import { Alert, Badge, Button, Card, EmptyState, Spinner } from '@/components/ui/primitives';
import { ShareCard } from '@/components/events/share-card';

/** Ways the platform can deliver invitations for this event (GET /invitations/channels). */
interface Channels {
  email: boolean;
  whatsapp: boolean;
  /** 0 = not in this event's plan, null = unlimited. */
  whatsappLimit: number | null;
  whatsappUsed: number;
}

interface WhatsAppResult {
  queued: number;
  skippedNoPhone: number;
  skippedRecent: number;
  skippedLimit: number;
  remaining: number | null;
}

const STATUS_TONE: Record<Invitation['status'], 'neutral' | 'success' | 'warning' | 'danger' | 'brand'> = {
  ACTIVE: 'neutral',
  SENT: 'brand',
  OPENED: 'warning',
  RESPONDED: 'success',
  REVOKED: 'danger',
  EXPIRED: 'danger',
};

export default function InvitationsPage() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const invitations = useInvitations(eventId);
  const guests = useGuests(eventId, '');
  const invalidate = useInvalidateEvent(eventId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [whatsappResult, setWhatsappResult] = useState<string[] | null>(null);
  const channels = useQuery({ queryKey: ['events', eventId, 'invitation-channels'], queryFn: () => apiGet<Channels>(`/events/${eventId}/invitations/channels`) });

  if (invitations.isPending || guests.isPending || !event.data) return <Spinner label={t('common.loading')} />;

  const allGuests = guests.data?.pages.flatMap((p) => p.items) ?? [];
  const invitedGuestIds = new Set(
    invitations.data?.filter((i) => i.status !== 'REVOKED' && !i.function).map((i) => i.guest.id),
  );
  const uninvited = allGuests.filter((g) => !invitedGuestIds.has(g.id));

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await invalidate();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (inv: Invitation) => {
    if (!inv.url) return;
    await navigator.clipboard.writeText(inv.url);
    setCopied(inv.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const share = (inv: Invitation) => {
    if (!inv.url || !event.data) return;
    // The WhatsApp message is written in the guest's (or event's) language.
    const guestT = createTranslator(inv.guest.preferredLanguage ?? event.data.language);
    const text = guestT('invitation.whatsappMessage', {
      guestName: inv.guest.name,
      eventTitle: event.data.title,
      url: inv.url,
    });
    window.open(whatsappLink(inv.guest.phone, text), '_blank', 'noopener,noreferrer');
    void apiPost(`/events/${eventId}/invitations/${inv.id}/shared`, { channel: 'WHATSAPP_LINK' }).then(invalidate);
  };

  return (
    <div className="space-y-4">
      {/* Link-shared events: the one link first (personal invitations below stay optional).
          Invite-only events with no guests yet: how to start. */}
      <ShareCard event={event.data} linkOnly={allGuests.length > 0} />
      {error ? <Alert>{error}</Alert> : null}
      {event.data.status === 'DRAFT' ? <Alert tone="info">{t('invitation.draftNotice')}</Alert> : null}
      {uninvited.length > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">{t(uninvited.length === 1 ? 'invitation.uninvitedCountOne' : 'invitation.uninvitedCount', { count: uninvited.length })}</p>
          <Button
            disabled={busy}
            onClick={() => run(() => apiPost(`/events/${eventId}/invitations/bulk`, { guestIds: uninvited.map((g) => g.id) }))}
          >
            {t('invitation.generate')}
          </Button>
        </Card>
      ) : null}

      {invitations.data?.length && event.data.status !== 'DRAFT' ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-600">{t('invitation.email.hint')}</p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await apiPost<{ queued: number; skippedNoEmail: number; skippedRecent: number }>(`/events/${eventId}/invitations/email`, {});
                setEmailResult(r.queued ? t('invitation.email.queued', { count: r.queued }) : t('invitation.email.none'));
              })
            }
          >
            <Mail aria-hidden className="size-4" />
            {t('invitation.email.send')}
          </Button>
          {emailResult ? <p className="w-full text-sm text-green-800">{emailResult}</p> : null}
        </Card>
      ) : null}

      {invitations.data?.length && event.data.status !== 'DRAFT' && channels.data?.whatsapp ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          {channels.data.whatsappLimit === 0 ? (
            <>
              <p className="text-sm text-stone-600">{t('invitation.whatsapp.upgrade')}</p>
              <Link href={`/dashboard/events/${eventId}/upgrade`} className="text-sm font-semibold text-brand-800 underline underline-offset-2">
                {t('invitation.whatsapp.upgradeCta')}
              </Link>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm text-stone-600">{t('invitation.whatsapp.hint')}</p>
                <p className="text-xs text-stone-500">
                  {channels.data.whatsappLimit === null
                    ? t('invitation.whatsapp.unlimited', { used: channels.data.whatsappUsed })
                    : t('invitation.whatsapp.allowance', { used: channels.data.whatsappUsed, limit: channels.data.whatsappLimit })}
                </p>
              </div>
              <Button
                variant="whatsapp"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await apiPost<WhatsAppResult>(`/events/${eventId}/invitations/whatsapp`, {});
                    setWhatsappResult([
                      r.queued ? t('invitation.whatsapp.queued', { count: r.queued }) : t('invitation.whatsapp.none'),
                      ...(r.skippedLimit ? [t('invitation.whatsapp.skippedLimit', { count: r.skippedLimit })] : []),
                    ]);
                    await channels.refetch();
                  })
                }
              >
                {t('invitation.whatsapp.send')}
              </Button>
              {whatsappResult ? (
                <div className="w-full space-y-1 text-sm text-green-800">
                  {whatsappResult.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </Card>
      ) : null}

      {invitations.data?.length ? (
        <ul className="space-y-2">
          {invitations.data.map((inv) => (
            <li key={inv.id}>
              <Card className="p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{inv.guest.name}</p>
                    <p className="text-xs text-stone-500">{inv.function ? inv.function.name : t('invitation.scope.event')}</p>
                  </div>
                  <Badge tone={STATUS_TONE[inv.status]}>{t(`invitation.status.${inv.status}`)}</Badge>
                </div>
                {inv.status !== 'REVOKED' && inv.url ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="whatsapp" onClick={() => share(inv)}>
                      {t('invitation.shareWhatsApp')}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => copy(inv)}>
                      {copied === inv.id ? t('common.copied') : t('invitation.copyLink')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => run(() => apiPost(`/events/${eventId}/invitations/${inv.id}/regenerate`))}
                    >
                      {t('invitation.regenerate')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => run(() => apiPost(`/events/${eventId}/invitations/${inv.id}/revoke`))}
                    >
                      {t('invitation.revoke')}
                    </Button>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>{t('invitation.noInvitation')}</EmptyState>
      )}
    </div>
  );
}
