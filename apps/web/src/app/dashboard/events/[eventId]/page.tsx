'use client';

import { ArrowRight, CircleCheckBig, CircleDashed, Eye, MailOpen, Palette, PartyPopper, UsersRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { TemplateStyles, TemplateThumbnail } from '@bulava/template-engine';
import { apiPatch } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { can } from '@/lib/permissions';
import { useDesign, useEvent, useInvalidateEvent, useInvitations, useLanguages, useRsvpSummary, useShareLink } from '@/lib/queries';
import type { AccessMode, EventSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CountUp, ProgressRing } from '@/components/dashboard/count-up';
import { ShareCard } from '@/components/events/share-card';
import { Alert, Button, Card, Field, Input, Select } from '@/components/ui/primitives';

const ACCESS_MODES: AccessMode[] = ['INVITE_ONLY', 'PRIVATE_LINK', 'GROUP_RESTRICTED', 'SECRET_TOKEN', 'PUBLIC'];

function Stat({ label, value, icon: Icon, hint }: { label: string; value: number; icon: LucideIcon; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gold-200/70 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">{label}</p>
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 font-display text-[2.6rem] leading-none text-ink">
        <CountUp value={value} />
      </p>
      <p className="mt-2 min-h-4 text-xs text-stone-500">{hint}</p>
    </div>
  );
}

export default function EventOverviewPage() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const base = `/dashboard/events/${eventId}`;
  const event = useEvent(eventId);
  // Each block loads only for members whose role includes it.
  const canInvites = can(event.data, 'invitation.read');
  const canRsvps = can(event.data, 'rsvp.read');
  const canEdit = can(event.data, 'event.update');
  const design = useDesign(eventId);
  const invitations = useInvitations(eventId, canInvites);
  const summary = useRsvpSummary(eventId, canRsvps);
  const share = useShareLink(eventId, canInvites);
  const languages = useLanguages();
  const invalidate = useInvalidateEvent(eventId);
  const [draft, setDraft] = useState<Partial<EventSummary>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!event.data) return null;
  const current = { ...event.data, ...draft };
  const dirty = Object.keys(draft).length > 0;
  const invites = invitations.data ?? [];
  const opened = invites.filter((i) => i.openedAt).length;
  const attending = summary.data?.functions.reduce((s, f) => s + f.headcount, 0) ?? 0;
  const website = design.data?.selections.WEBSITE;

  // Link-shared events need no guest list: publish, open registration and share the one link.
  const linkShared = share.data?.kind === 'LINK';
  const checklist = linkShared
    ? [
        { done: !!website && !website.isDefault, label: t('dash.checklist.design'), href: `${base}/design` },
        { done: event.data.counts.functions > 0, label: t('dash.checklist.functions'), href: `${base}/functions` },
        { done: event.data.status !== 'DRAFT', label: t('dash.checklist.publish'), href: base },
        { done: !!share.data?.registrationOpen, label: t('dash.checklist.registration'), href: `${base}/registrations` },
        { done: event.data.counts.guests > 0 || invites.some((i) => i.sentAt), label: t('dash.checklist.shareLink'), href: `${base}/invitations` },
      ]
    : [
        { done: !!website && !website.isDefault, label: t('dash.checklist.design'), href: `${base}/design` },
        { done: event.data.counts.functions > 0, label: t('dash.checklist.functions'), href: `${base}/functions` },
        { done: event.data.counts.guests > 0, label: t('dash.checklist.guests'), href: `${base}/guests` },
        { done: invites.length > 0, label: t('dash.checklist.invite'), href: `${base}/invitations` },
        { done: event.data.status !== 'DRAFT', label: t('dash.checklist.publish'), href: base },
        { done: invites.some((i) => i.sentAt), label: t('dash.checklist.share'), href: `${base}/invitations` },
      ];
  const progress = checklist.filter((c) => c.done).length;

  const save = async (patch: Partial<EventSummary>) => {
    setError(null);
    setSaving(true);
    try {
      await apiPatch(`/events/${eventId}`, patch);
      setDraft({});
      await invalidate();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={cn('grid grid-cols-2 gap-3', canInvites && canRsvps ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
        <Stat label={t('dash.stats.guests')} value={event.data.counts.guests} icon={UsersRound} />
        {canInvites ? <Stat label={t('dash.stats.invited')} value={invites.length} icon={MailOpen} /> : null}
        {canInvites ? (
          <Stat label={t('dash.stats.opened')} value={opened} icon={Eye} hint={invites.length ? t('dash.stats.openRate', { rate: Math.round((opened / invites.length) * 100) }) : undefined} />
        ) : null}
        {canRsvps ? <Stat label={t('dash.stats.attending')} value={attending} icon={PartyPopper} /> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {canInvites ? <ShareCard event={event.data} /> : null}

          {canEdit ? (
          <Card className="rounded-3xl">
            <div className="flex items-center gap-5">
              <div className="relative grid place-items-center">
                <ProgressRing done={progress} total={checklist.length} />
                <span className="absolute font-display text-lg text-ink">
                  {progress}/{checklist.length}
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-2xl leading-tight">{t('dash.checklist.title')}</h2>
                <p className="mt-1 text-sm text-stone-500">{progress === checklist.length ? t('dash.checklist.complete') : t('dash.checklist.progress', { done: progress, total: checklist.length })}</p>
              </div>
            </div>
            <ol className="mt-6 grid gap-2 sm:grid-cols-2">
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link
                    href={c.href}
                    className={cn(
                      'group flex min-h-12 items-center gap-3 rounded-2xl border px-3.5 text-sm transition-[border-color,background-color,box-shadow] duration-300',
                      c.done ? 'border-emerald-200/80 bg-emerald-50/70 text-emerald-900' : 'border-gold-200 bg-white hover:border-gold-300 hover:shadow-soft',
                    )}
                  >
                    {c.done ? <CircleCheckBig aria-hidden className="size-5 shrink-0 text-emerald-700" /> : <CircleDashed aria-hidden className="size-5 shrink-0 text-gold-500" />}
                    <span className="flex-1">{c.label}</span>
                    {c.done ? null : <ArrowRight aria-hidden className="size-4 text-stone-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-brand-700" />}
                  </Link>
                </li>
              ))}
            </ol>
            {event.data.status === 'DRAFT' ? (
              <Button className="mt-5 w-full sm:w-auto" disabled={saving} onClick={() => save({ status: 'ACTIVE' })}>
                {t('event.publish')}
              </Button>
            ) : null}
          </Card>
          ) : null}

          {canEdit ? (
          <Card className="space-y-4 rounded-3xl">
            {error ? <Alert>{error}</Alert> : null}
            <Field label={t('event.field.title')}>
              {(p) => <Input {...p} value={current.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />}
            </Field>
            <Field label={t('event.field.language')}>
              {(p) => (
                <Select {...p} value={current.language} onChange={(e) => setDraft({ ...draft, language: e.target.value })}>
                  {languages.data?.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName} ({l.name})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {/* Full width: each mode's label explains it, and the longest needs the room. */}
            <Field label={t('event.field.accessMode')}>
              {(p) => (
                <Select {...p} value={current.accessMode} onChange={(e) => setDraft({ ...draft, accessMode: e.target.value as AccessMode })}>
                  {ACCESS_MODES.map((m) => (
                    <option key={m} value={m}>
                      {t(`access.${m}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button disabled={!dirty || saving} onClick={() => save({ title: current.title, language: current.language, accessMode: current.accessMode })}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </Card>
          ) : null}
        </div>

        <Card className="self-start rounded-3xl">
          <h2 className="font-display text-xl">{website?.isDefault ? t('design.default') : t('design.current')}</h2>
          {website && design.data ? (
            <Link href={`${base}/design`} className="group mt-5 block">
              <div className="mx-auto w-fit overflow-hidden rounded-[1.6rem] border-[6px] border-ink shadow-lift transition-[translate,box-shadow] duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_30px_60px_-24px_rgba(47,7,16,0.45)]">
                <TemplateStyles />
                <TemplateThumbnail definition={website.definition} context={design.data.context} customization={website.customization} width={240} height={430} sections={3} />
              </div>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-brand-700">
                <Palette aria-hidden className="size-4" />
                {t('design.choose')}
                <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </p>
            </Link>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
