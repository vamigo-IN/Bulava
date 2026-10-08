'use client';

import { ArrowRight, Check, Eye, MailOpen, Palette, PartyPopper, UsersRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { TemplateStyles, TemplateThumbnail } from '@bulava/template-engine';
import { useT } from '@/lib/i18n';
import { can } from '@/lib/permissions';
import { useDesign, useEvent, useInvitations, useRsvpSummary } from '@/lib/queries';
import { nextStep, progressOf, type SetupStep } from '@/lib/setup-steps';
import { cn } from '@/lib/utils';
import { CountUp, ProgressRing } from '@/components/dashboard/count-up';
import { PreviewLinkCard } from '@/components/events/preview-link-card';
import { usePublish } from '@/components/events/publish-dialog';
import { ShareCard } from '@/components/events/share-card';
import { useSetupSteps } from '@/components/events/use-setup-steps';
import { Card } from '@/components/ui/primitives';

function Stat({ label, value, icon: Icon, hint }: { label: string; value: number; icon: LucideIcon; hint?: string }) {
  return (
    <div className="clay rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold tracking-[0.14em] text-stone-500 uppercase">{label}</p>
        <span aria-hidden className="icon-3d size-9 shrink-0 rounded-xl">
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
  const event = useEvent(eventId);
  // Each block loads only for members whose role includes it.
  const canInvites = can(event.data, 'invitation.read');
  const canRsvps = can(event.data, 'rsvp.read');
  const canEdit = can(event.data, 'event.update');
  const design = useDesign(eventId);
  const invitations = useInvitations(eventId, canInvites);
  const summary = useRsvpSummary(eventId, canRsvps);
  const steps = useSetupSteps(canEdit ? event.data : undefined);

  if (!event.data) return null;
  const invites = invitations.data ?? [];
  const opened = invites.filter((i) => i.openedAt).length;
  const attending = summary.data?.functions.reduce((s, f) => s + f.headcount, 0) ?? 0;
  const website = design.data?.selections.WEBSITE;
  const draft = event.data.status === 'DRAFT';

  const stats = (
    <div className={cn('grid grid-cols-2 gap-3', canInvites && canRsvps ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
      <Stat label={t('dash.stats.guests')} value={event.data.counts.guests} icon={UsersRound} />
      {canInvites ? <Stat label={t('dash.stats.invited')} value={invites.length} icon={MailOpen} /> : null}
      {canInvites ? (
        <Stat label={t('dash.stats.opened')} value={opened} icon={Eye} hint={invites.length ? t('dash.stats.openRate', { rate: Math.round((opened / invites.length) * 100) }) : undefined} />
      ) : null}
      {canRsvps ? <Stat label={t('dash.stats.attending')} value={attending} icon={PartyPopper} /> : null}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* While a draft, the way to a live invitation comes first; afterwards the numbers do. */}
      {draft ? null : stats}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {steps ? <SetupChecklist eventId={eventId} steps={steps} /> : null}
          {canEdit ? <PreviewLinkCard event={event.data} /> : null}
          {canInvites ? <ShareCard event={event.data} /> : null}
        </div>

        <Card className="self-start rounded-3xl">
          <h2 className="font-display text-xl">{website?.isDefault ? t('design.default') : t('design.current')}</h2>
          {website && design.data ? (
            <Link href={`/dashboard/events/${eventId}/design`} className="group mt-5 block">
              <div className="mx-auto w-fit overflow-hidden rounded-[1.6rem] border-[6px] border-ink shadow-lift transition-[translate,box-shadow] duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_30px_60px_-24px_rgba(47,7,16,0.45)]">
                <TemplateStyles />
                <TemplateThumbnail definition={website.definition} context={design.data.context} customization={website.customization} width={240} height={430} sections={3} />
              </div>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-brand-700">
                <Palette aria-hidden className="size-4" />
                {website.isDefault ? t('dash.step.design.action') : t('design.edit')}
                <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </p>
            </Link>
          ) : null}
        </Card>
      </div>

      {draft ? stats : null}
    </div>
  );
}

/**
 * The way from a new event to a live one, as a timeline: finished steps
 * folded with a tick, the next one open with its explanation and button, the
 * rest waiting below.
 */
function SetupChecklist({ eventId, steps }: { eventId: string; steps: SetupStep[] }) {
  const t = useT();
  const publish = usePublish();
  const base = `/dashboard/events/${eventId}`;
  const { done, total } = progressOf(steps);
  const upNext = nextStep(steps);

  const target = (step: SetupStep, className: string, children: ReactNode) =>
    step.key === 'publish' && !step.done && publish ? (
      <button type="button" onClick={publish} className={className}>
        {children}
      </button>
    ) : (
      <Link href={`${base}${step.section}`} className={className}>
        {children}
      </Link>
    );

  return (
    <Card className="rounded-3xl p-5 sm:p-7">
      <div className="flex items-center gap-5">
        <div className="relative grid place-items-center">
          <ProgressRing done={done} total={total} size={68} />
          <span className="absolute font-display text-lg text-ink">
            {done}/{total}
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-2xl leading-tight">{t('dash.checklist.title')}</h2>
          <p className="mt-1 text-sm text-stone-500">{upNext ? t('dash.checklist.progress', { done, total }) : t('dash.checklist.complete')}</p>
        </div>
      </div>

      <ol className="relative mt-6 space-y-2.5">
        {steps.map((step, i) => {
          const isNext = upNext?.key === step.key;
          return (
            <li key={step.key} className={cn('relative rounded-2xl border transition-[border-color,background-color,box-shadow] duration-300', isNext ? 'border-gold-300 bg-white p-4 shadow-clay-sm sm:p-5' : step.done ? 'border-emerald-200/70 bg-emerald-50/50 px-4 py-3' : 'border-gold-200/70 bg-white/60 px-4 py-3')}>
              <div className="flex items-start gap-3.5">
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                    step.done ? 'bg-emerald-600 text-white' : isNext ? 'bg-gradient-to-br from-brand-600 to-brand-900 text-gold-100 shadow-[0_6px_14px_-6px_rgba(91,14,27,0.8)]' : 'bg-stone-100 text-stone-500 ring-1 ring-stone-200',
                  )}
                >
                  {step.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={cn('font-medium', isNext ? 'font-display text-xl text-ink' : step.done ? 'text-emerald-900' : 'text-ink')}>{t(step.title)}</span>
                    {step.optional && !step.done ? <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-medium text-stone-600">{t('next.optional')}</span> : null}
                    {isNext ? <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-semibold text-gold-700">{t('next.eyebrow.todo')}</span> : null}
                    <span className="sr-only">{step.done ? t('next.state.done') : t('next.state.todo')}</span>
                  </p>
                  {isNext || !step.done ? <p className={cn('mt-1 text-sm leading-relaxed', isNext ? 'text-stone-600' : 'text-stone-500')}>{t(step.body)}</p> : null}
                  {isNext ? (
                    <div className="mt-4">
                      {target(
                        step,
                        'btn-3d min-h-11 rounded-2xl px-5 text-sm',
                        <>
                          {t(step.action)}
                          <ArrowRight aria-hidden className="size-4" />
                        </>,
                      )}
                    </div>
                  ) : null}
                </div>
                {!isNext
                  ? target(
                      step,
                      'grid size-9 shrink-0 place-items-center rounded-full text-stone-400 transition-colors hover:bg-sand hover:text-brand-700',
                      <>
                        <ArrowRight aria-hidden className="size-4" />
                        <span className="sr-only">{t(step.action)}</span>
                      </>,
                    )
                  : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
