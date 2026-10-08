'use client';

import { ArrowLeft, ArrowRight, Check, PartyPopper } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n';
import { nextStep, progressOf, type SetupStep } from '@/lib/setup-steps';
import type { EventSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ProgressRing } from '@/components/dashboard/count-up';
import { usePublish } from './publish-dialog';
import { useSetupSteps } from './use-setup-steps';

/**
 * The guide under every event page: where this page sits in the setup, what
 * comes next (with the button that goes there) and every step as a rail the
 * host can jump along. On a page that is not a step (photos, settings) it
 * points at the first thing still to do.
 */
export function NextStepBar({ event, section }: { event: EventSummary; section: string }) {
  const t = useT();
  const steps = useSetupSteps(event);
  const publish = usePublish();
  if (!steps) return null;

  const base = `/dashboard/events/${event.id}`;
  // Publishing is done from the dialog, so no page "is" that step.
  const here = steps.findIndex((s) => s.key !== 'publish' && s.section === section);
  const prev = here > 0 ? steps[here - 1]! : null;
  // The first unfinished step after this page, else the first unfinished anywhere; null once all are done.
  const heading = (here >= 0 ? steps.slice(here + 1).find((s) => !s.done && !s.optional) : undefined) ?? nextStep(steps);
  const { done, total } = progressOf(steps);

  /** A step as a link to its page, or as the button that opens the publish dialog. */
  const stepTarget = (step: SetupStep, className: string, children: ReactNode, label?: string) =>
    step.key === 'publish' && !step.done && publish ? (
      <button type="button" onClick={publish} className={className} aria-label={label}>
        {children}
      </button>
    ) : (
      <Link href={`${base}${step.section}`} className={className} aria-label={label}>
        {children}
      </Link>
    );

  return (
    <section aria-labelledby="next-step-title" className="clay mt-10 rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="relative grid shrink-0 place-items-center">
            <ProgressRing done={done} total={total} size={60} />
            <span className="absolute font-display text-sm text-ink">
              {done}/{total}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-gold-700 uppercase">
              {heading ? (here >= 0 ? t('next.eyebrow.step', { n: steps.indexOf(heading) + 1, total }) : t('next.eyebrow.todo')) : t('next.eyebrow.done')}
            </p>
            <h2 id="next-step-title" className="mt-1 font-display text-2xl leading-tight text-ink">
              {heading ? t(heading.title) : t('next.done.title')}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">{heading ? t(heading.body) : t('next.done.body')}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {prev ? (
            <Link href={`${base}${prev.section}`} className="btn-3d btn-3d-light min-h-11 rounded-2xl px-4 text-sm" title={t(prev.title)}>
              <ArrowLeft aria-hidden className="size-4" />
              {t('next.back')}
            </Link>
          ) : null}
          {heading
            ? stepTarget(
                heading,
                'btn-3d min-h-11 rounded-2xl px-5 text-sm',
                <>
                  {t(heading.action)}
                  <ArrowRight aria-hidden className="size-4" />
                </>,
              )
            : section !== '/rsvps' ? (
                <Link href={`${base}/rsvps`} className="btn-3d min-h-11 rounded-2xl px-5 text-sm">
                  <PartyPopper aria-hidden className="size-4" />
                  {t('dash.step.rsvps.action')}
                </Link>
              ) : null}
        </div>
      </div>

      <ol aria-label={t('next.rail')} className="relative -mx-1 mt-5 flex gap-1.5 overflow-x-auto border-t border-gold-100 px-1 pt-4 [scrollbar-width:none]">
        {steps.map((step, i) => {
          const isHere = i === here;
          return (
            <li key={step.key} className="shrink-0">
              {stepTarget(
                step,
                cn(
                  'flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-medium whitespace-nowrap transition-colors duration-200',
                  isHere ? 'bg-white text-ink shadow-clay-sm ring-1 ring-gold-300' : 'text-stone-600 hover:bg-white/70 hover:text-ink',
                ),
                <>
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-5 place-items-center rounded-full text-[10px] font-bold',
                      step.done ? 'bg-emerald-600 text-white' : isHere ? 'bg-brand-700 text-white' : 'bg-stone-200 text-stone-600',
                    )}
                  >
                    {step.done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  {t(step.short)}
                  {step.optional && !step.done ? <span className="text-stone-500">· {t('next.optional')}</span> : null}
                </>,
                `${t(step.title)}: ${step.done ? t('next.state.done') : t('next.state.todo')}`,
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
