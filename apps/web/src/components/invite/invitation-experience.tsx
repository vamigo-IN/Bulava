'use client';

import { useState } from 'react';
import { formatEventDateWithWeekday, formatEventTime } from '@bulava/localization';
import { I18nProvider, useI18n } from '@/lib/i18n';
import type { GuestInvitationView } from '@/lib/types';
import { hasGuestLogistics } from '@/lib/guest-view';
import { GuestLogisticsInner } from './guest-logistics';
import { RsvpForm } from './rsvp-form';

function Ornament() {
  return (
    <div aria-hidden className="flex items-center justify-center gap-3 text-gold-500">
      <span className="h-px w-12 bg-gold-500/60" />
      <span className="text-lg">✦</span>
      <span className="h-px w-12 bg-gold-500/60" />
    </div>
  );
}

function hostsLine(view: GuestInvitationView): string | null {
  const d = view.event.details ?? {};
  if (d.partnerOne && d.partnerTwo) return `${d.partnerOne} & ${d.partnerTwo}`;
  if (d.name) return d.name;
  return null;
}

function Experience({ token, initialView }: { token: string; initialView: GuestInvitationView }) {
  const { t, language } = useI18n();
  const [view, setView] = useState(initialView);
  const fmt = { language, timeZone: view.event.timezone };
  const hosts = hostsLine(view);

  return (
    <main className="min-h-dvh bg-cream pb-16">
      <header className="bg-gradient-to-b from-brand-900 to-brand-700 px-6 pb-12 pt-14 text-center text-cream">
        <p className="text-sm tracking-widest text-gold-300 uppercase">{t('invitation.dear', { guestName: view.guest.name })}</p>
        <p className="mt-3 text-base text-cream/90">{t('invitation.youAreInvited')}</p>
        {hosts ? <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">{hosts}</h1> : null}
        <p className={hosts ? 'mt-2 text-lg text-gold-300' : 'mt-4 font-display text-4xl'}>{view.event.title}</p>
      </header>

      <div className="mx-auto -mt-6 max-w-lg space-y-4 px-4">
        {view.event.description ? (
          <section className="rounded-2xl bg-white p-5 text-center text-stone-700 shadow-sm">{view.event.description}</section>
        ) : null}

        <section aria-labelledby="functions-heading" className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 id="functions-heading" className="text-center font-display text-xl text-brand-700">
            {t('invitation.yourFunctions')}
          </h2>
          <div className="my-3">
            <Ornament />
          </div>
          {view.functions.length === 0 ? (
            <p className="text-center text-stone-600">{t('invitation.noFunctions')}</p>
          ) : (
            <ol className="space-y-5">
              {view.functions.map((fn) => (
                <li key={fn.id} className="border-b border-stone-100 pb-5 last:border-0 last:pb-0">
                  <h3 className="font-display text-2xl text-stone-900">{fn.name}</h3>
                  {fn.status === 'CANCELLED' ? (
                    <p className="mt-1 text-sm font-medium text-red-700">{t('invitation.cancelled')}</p>
                  ) : null}
                  {fn.startsAt ? (
                    <p className="mt-1 text-stone-700">
                      <span className="sr-only">{t('invitation.when')}: </span>
                      {formatEventDateWithWeekday(fn.startsAt, fmt)} · {formatEventTime(fn.startsAt, fmt)}
                    </p>
                  ) : null}
                  {fn.venue ? (
                    <p className="mt-1 text-stone-600">
                      <span className="sr-only">{t('invitation.venue')}: </span>
                      {[fn.venue.name, fn.venue.address, fn.venue.city].filter(Boolean).join(', ')}
                      {fn.venue.mapUrl ? (
                        <>
                          {' '}
                          <a
                            href={fn.venue.mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-brand-700 underline"
                          >
                            {t('invitation.viewMap')}
                          </a>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {fn.seat ? <p className="mt-1 text-sm font-medium text-brand-700">🪑 {t('invite.seat', { table: fn.seat.seatLabel ? `${fn.seat.tableLabel} · ${fn.seat.seatLabel}` : fn.seat.tableLabel })}</p> : null}
                  {fn.description ? <p className="mt-2 text-sm text-stone-600">{fn.description}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <RsvpForm token={token} view={view} onSaved={setView} />

        {hasGuestLogistics(view) ? <GuestLogisticsInner token={token} initialView={view} /> : null}
      </div>
    </main>
  );
}

export function InvitationExperience({
  token,
  initialView,
  language,
}: {
  token: string;
  initialView: GuestInvitationView;
  language: string;
}) {
  return (
    <I18nProvider language={language}>
      <Experience token={token} initialView={initialView} />
    </I18nProvider>
  );
}
