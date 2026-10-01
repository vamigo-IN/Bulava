import { formatEventDateWithWeekday, formatEventTime } from '@bulava/localization';
import type { FunctionContext } from '@bulava/template-schema';
import { FunctionMotif } from '../art/function-icons';
import { Diya } from '../art/motifs';
import { FlipCard } from '../interactive';
import type { SectionProps } from '../types';
import { cardClass, cx, SectionShell, shell } from './shared';

function dateParts(iso: string, language: string, timeZone: string) {
  const d = new Date(iso);
  const locale = language === 'hi-Latn' ? 'en-IN' : `${language}-IN`;
  const safe = (opts: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { ...opts, timeZone }).format(d);
    } catch {
      return new Intl.DateTimeFormat('en-IN', { ...opts, timeZone }).format(d);
    }
  };
  return { day: safe({ day: '2-digit' }), month: safe({ month: 'short' }), weekday: safe({ weekday: 'long' }) };
}

function mapHref(fn: FunctionContext): string | null {
  if (fn.venue?.mapUrl) return fn.venue.mapUrl;
  if (!fn.venue) return null;
  const q = [fn.venue.name, fn.venue.address, fn.venue.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * eventTimeline variants:
 *  cards (default) – date block, motif and details per function
 *  timeline        – a vertical line
 *  tiles           – compact grid
 *  tickets         – 3D flip tickets: the front shows the function and date, the back the time, venue and directions
 *  diya            – a timeline lit by flickering diyas
 * Lists only the functions this viewer is authorized to see.
 */
export function EventTimeline(p: SectionProps) {
  const fns = p.ctx.functions;
  if (!fns.length) return null;
  const heading = p.value('heading') ?? p.t('template.schedule.title');
  const fmt = { language: p.language, timeZone: p.timeZone };
  const statusNote = (fn: FunctionContext) =>
    fn.status === 'CANCELLED' ? p.t('invitation.cancelled') : fn.status === 'POSTPONED' ? p.t('template.status.postponed') : null;
  const when = (fn: FunctionContext) => (fn.startsAt ? `${formatEventDateWithWeekday(fn.startsAt, fmt)} · ${formatEventTime(fn.startsAt, fmt)}` : null);
  const status = (fn: FunctionContext) => (statusNote(fn) ? <p className="text-sm font-semibold text-[var(--t-accent-ink)] underline decoration-2">{statusNote(fn)}</p> : null);
  const linkless = p.mode === 'thumbnail';

  if (p.instance.variant === 'timeline' || p.instance.variant === 'diya') {
    const diya = p.instance.variant === 'diya';
    return (
      <SectionShell {...shell(p)} heading={heading}>
        <ol className="relative mx-auto max-w-xl border-l border-[var(--t-line)] pl-10">
          {fns.map((fn) => (
            <li key={fn.id} className="relative mb-12 last:mb-0">
              {diya ? (
                <Diya className="absolute -top-3 -left-[66px] w-12" />
              ) : (
                <span className="absolute top-1.5 -left-[49px] size-4 rounded-full border-2 border-[var(--t-secondary)] bg-[var(--t-card)]" />
              )}
              <div className="flex items-center gap-3">
                <FunctionMotif name={fn.name} className="size-7 shrink-0 text-[var(--t-accent-ink)]" />
                <h3 className="text-2xl [font-family:var(--t-heading)]">{fn.name}</h3>
              </div>
              {status(fn)}
              {when(fn) ? <p className="mt-1 text-[var(--t-muted-ink)]">{when(fn)}</p> : null}
              {fn.venue ? <VenueLine fn={fn} label={p.t('template.getDirections')} linkless={linkless} /> : null}
              {fn.description ? <p className="mt-2 text-sm text-[var(--t-muted-ink)]">{fn.description}</p> : null}
            </li>
          ))}
        </ol>
      </SectionShell>
    );
  }

  if (p.instance.variant === 'tickets') {
    return (
      <SectionShell {...shell(p)} heading={heading} tone="surface" wide>
        <ul className="grid gap-6 sm:grid-cols-2">
          {fns.map((fn) => {
            const parts = fn.startsAt ? dateParts(fn.startsAt, p.language, p.timeZone) : null;
            const href = linkless ? null : mapHref(fn);
            const ticket = 'relative flex h-full flex-col items-center justify-center overflow-hidden px-6 py-8 text-center [mask-image:radial-gradient(circle_at_0_50%,transparent_14px,#000_15px),radial-gradient(circle_at_100%_50%,transparent_14px,#000_15px)] [mask-composite:intersect] [-webkit-mask-composite:source-in]';
            return (
              <li key={fn.id} className="h-64">
                <FlipCard
                  label={p.t('template.schedule.flip', { name: fn.name })}
                  className="h-full"
                  front={
                    <span className={cx(ticket, cardClass(p.look), 'border-dashed')}>
                      <FunctionMotif name={fn.name} className="size-12 text-[var(--t-accent-ink)]" />
                      <span className="mt-3 block text-3xl [font-family:var(--t-heading)]">{fn.name}</span>
                      {parts ? (
                        <span className="mt-2 block text-sm tracking-[0.25em] uppercase text-[var(--t-muted-ink)]">
                          {parts.weekday} · {parts.day} {parts.month}
                        </span>
                      ) : null}
                      <span className="mt-4 block text-[0.65rem] tracking-[0.3em] uppercase text-[var(--t-muted-ink)]">{p.t('template.couple.tapToTurn')}</span>
                    </span>
                  }
                  back={
                    <span className={cx(ticket, cardClass(p.look))}>
                      {statusNote(fn) ? <span className="mb-2 block text-sm font-semibold text-[var(--t-accent-ink)]">{statusNote(fn)}</span> : null}
                      {fn.startsAt ? <span className="block text-4xl [font-family:var(--t-heading)]">{formatEventTime(fn.startsAt, fmt)}</span> : null}
                      {fn.venue ? <span className="mt-3 block">{[fn.venue.name, fn.venue.city].filter(Boolean).join(', ')}</span> : null}
                      {fn.description ? <span className="mt-2 block text-sm text-[var(--t-muted-ink)]">{fn.description}</span> : null}
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[var(--t-button)] px-5 text-sm font-semibold text-[var(--t-on-button)]">
                          {p.t('template.getDirections')}
                        </a>
                      ) : null}
                    </span>
                  }
                />
              </li>
            );
          })}
        </ul>
      </SectionShell>
    );
  }

  return (
    <SectionShell {...shell(p)} heading={heading} tone="surface">
      <ul className={cx('grid gap-5', p.instance.variant === 'tiles' ? 'sm:grid-cols-2' : 'grid-cols-1')}>
        {fns.map((fn) => {
          const parts = fn.startsAt ? dateParts(fn.startsAt, p.language, p.timeZone) : null;
          return (
            <li key={fn.id} className={cx('flex gap-5 p-5', cardClass(p.look))}>
              {parts ? (
                <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-[calc(var(--t-radius)*0.75)] bg-[var(--t-button)] py-3 text-[var(--t-on-button)]">
                  <span className="text-2xl leading-none font-semibold [font-family:var(--t-heading)]">{parts.day}</span>
                  <span className="mt-1 text-[0.65rem] tracking-[0.2em] uppercase">{parts.month}</span>
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl [font-family:var(--t-heading)]">{fn.name}</h3>
                  <FunctionMotif name={fn.name} className="size-7 shrink-0 text-[var(--t-accent-ink)] opacity-80" />
                </div>
                {status(fn)}
                {when(fn) ? <p className="mt-0.5 text-sm text-[var(--t-muted-ink)]">{when(fn)}</p> : null}
                {fn.venue ? <VenueLine fn={fn} label={p.t('template.getDirections')} linkless={linkless} /> : null}
                {fn.description ? <p className="mt-2 text-sm text-[var(--t-muted-ink)]">{fn.description}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}

/** In thumbnails (rendered inside card links) there must be no nested anchors. */
function VenueLine({ fn, label, linkless }: { fn: FunctionContext; label: string; linkless?: boolean }) {
  const href = linkless ? null : mapHref(fn);
  return (
    <p className="mt-1 text-sm">
      {[fn.venue?.name, fn.venue?.city].filter(Boolean).join(', ')}
      {href ? (
        <>
          {' · '}
          <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--t-primary-ink)] underline underline-offset-2">
            {label}
          </a>
        </>
      ) : null}
    </p>
  );
}

/** venue: the main venue with a directions button; a postcard frame in some looks. */
export function Venue(p: SectionProps) {
  const venue = p.ctx.venue;
  if (!venue) return null;
  const q = [venue.name, venue.address, venue.city].filter(Boolean).join(', ');
  const href = venue.mapUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  const button = 'mt-6 inline-flex min-h-11 items-center rounded-full bg-[var(--t-button)] px-6 text-sm font-semibold text-[var(--t-on-button)]';
  return (
    <SectionShell {...shell(p)} heading={p.value('heading') ?? p.t('template.venue.title')}>
      <div className={cx('relative mx-auto max-w-md overflow-hidden p-8 text-center', cardClass(p.look))}>
        <svg viewBox="0 0 48 48" className="mx-auto mb-4 size-10 text-[var(--t-accent-ink)]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M24 44 C24 44 38 30 38 19 A14 14 0 0 0 10 19 C10 30 24 44 24 44Z" />
          <circle cx="24" cy="19" r="5" />
        </svg>
        <p className="text-2xl [font-family:var(--t-heading)]">{venue.name}</p>
        {venue.address || venue.city ? <p className="mt-2 text-[var(--t-muted-ink)]">{[venue.address, venue.city].filter(Boolean).join(', ')}</p> : null}
        {venue.embedUrl && p.mode !== 'thumbnail' ? (
          // Google Maps embed (Integrations > Google Maps). Only the site's origin is sent as the
          // referrer, never the personal invitation path, so referrer-restricted keys still work.
          <iframe
            src={venue.embedUrl}
            title={p.t('template.venue.map', { venue: venue.name })}
            loading="lazy"
            referrerPolicy="origin"
            allowFullScreen
            className="mt-6 aspect-[4/3] w-full rounded-2xl border-0 bg-[var(--t-surface)]"
          />
        ) : null}
        {p.mode === 'thumbnail' ? (
          <span className={button}>{p.t('template.getDirections')}</span>
        ) : (
          <a href={href} target="_blank" rel="noopener noreferrer" className={button}>
            {p.t('template.getDirections')}
          </a>
        )}
      </div>
    </SectionShell>
  );
}
