import { formatEventDateWithWeekday, formatEventTime } from '@bulava/localization';
import type { FunctionContext } from '@bulava/template-schema';
import { FunctionMotif } from '../art/function-icons';
import { Diya } from '../art/motifs';
import { Icon } from '../canvas/icons';
import { FlipCard } from '../interactive';
import { Glyph } from '../ornaments-suite';
import type { SectionProps } from '../types';
import { Seal, ShapedCard, Skyline, type Dress } from './dress';
import { cardClass, cx, dressFor, SectionShell, shell } from './shared';

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
  return { day: safe({ day: '2-digit' }), month: safe({ month: 'short' }), weekday: safe({ weekday: 'long' }), year: safe({ year: 'numeric' }) };
}

function mapHref(fn: FunctionContext): string | null {
  if (fn.venue?.mapUrl) return fn.venue.mapUrl;
  if (!fn.venue) return null;
  const q = [fn.venue.name, fn.venue.address, fn.venue.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** The node on a timeline: the suite's glyph (or a plain ring for templates without one). */
function Node({ d, suited }: { d: Dress; suited: boolean }) {
  return suited ? (
    <span className="absolute top-0.5 -left-[53px] flex size-6 items-center justify-center rounded-full bg-[var(--t-band,var(--t-bg))] text-[var(--t-orn)]">
      <Glyph name={d.suite.glyph} className="size-5" />
    </span>
  ) : (
    <span className="absolute top-1.5 -left-[49px] size-4 rounded-full border-2 border-[var(--t-secondary)] bg-[var(--t-card)]" />
  );
}

/**
 * eventTimeline variants:
 *  cards (default) – date block, motif and details per function
 *  timeline        – a vertical line, the suite's glyph at every function
 *  tiles           – compact grid
 *  tickets         – 3D flip tickets: the front shows the function and date, the back the time, venue and directions
 *  diya            – a timeline lit by flickering diyas
 *  frames          – each function in a card of the suite's shape (an arch, a niche, a deco frame…)
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
  const suited = p.ornament !== 'none';
  const tone = p.instance.variant === 'timeline' || p.instance.variant === 'diya' ? 'plain' : 'surface';
  const d = dressFor(p, tone);

  if (p.instance.variant === 'timeline' || p.instance.variant === 'diya') {
    const diya = p.instance.variant === 'diya';
    return (
      <SectionShell {...shell(p)} dress={d} heading={heading}>
        <ol className="relative mx-auto max-w-xl border-l border-[var(--t-line)] pl-10">
          {fns.map((fn) => (
            <li key={fn.id} className="relative mb-12 last:mb-0">
              {diya ? <Diya className="absolute -top-3 -left-[66px] w-12" /> : <Node d={d} suited={suited} />}
              <div className="flex items-center gap-3">
                <FunctionMotif name={fn.name} className="size-7 shrink-0 text-[var(--t-accent-ink)]" />
                <h3 className="text-2xl break-words [font-family:var(--t-heading)]">{fn.name}</h3>
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

  if (p.instance.variant === 'frames') {
    return (
      <SectionShell {...shell(p)} dress={d} heading={heading} wide>
        <ul className={cx('mx-auto grid gap-x-6 gap-y-10', fns.length > 1 ? '@min-[640px]:grid-cols-2' : 'max-w-md')}>
          {fns.map((fn) => {
            const parts = fn.startsAt ? dateParts(fn.startsAt, p.language, p.timeZone) : null;
            const href = linkless ? null : mapHref(fn);
            return (
              <li key={fn.id}>
                <ShapedCard d={d} className="px-6 pt-12 pb-8 text-center">
                  <FunctionMotif name={fn.name} className="mx-auto size-10 text-[var(--t-accent-ink)]" />
                  <h3 className="mt-3 text-4xl leading-tight break-words text-[var(--t-primary-ink)] [font-family:var(--t-script)]">{fn.name}</h3>
                  {status(fn)}
                  {parts ? (
                    <p className="mt-4 text-[0.72rem] font-semibold tracking-[0.3em] uppercase text-[var(--t-secondary-ink)]">
                      {parts.weekday} · {parts.day} {parts.month}
                    </p>
                  ) : null}
                  {fn.startsAt ? <p className="mt-1 text-2xl [font-family:var(--t-heading)]">{formatEventTime(fn.startsAt, fmt)}</p> : null}
                  {fn.venue ? <p className="mt-3 text-sm text-[var(--t-muted-ink)]">{[fn.venue.name, fn.venue.city].filter(Boolean).join(', ')}</p> : null}
                  {fn.description ? <p className="mt-2 text-sm text-[var(--t-muted-ink)] italic">{fn.description}</p> : null}
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--t-line)] px-5 text-sm font-semibold text-[var(--t-primary-ink)]">
                      <span className="size-4" aria-hidden="true">
                        <Icon name="navigation" />
                      </span>
                      {p.t('template.getDirections')}
                    </a>
                  ) : null}
                </ShapedCard>
              </li>
            );
          })}
        </ul>
      </SectionShell>
    );
  }

  if (p.instance.variant === 'tickets') {
    return (
      <SectionShell {...shell(p)} dress={d} heading={heading} wide>
        <ul className="grid gap-6 @min-[640px]:grid-cols-2">
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
                      <span className="mt-3 block text-3xl break-words [font-family:var(--t-heading)]">{fn.name}</span>
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
    <SectionShell {...shell(p)} dress={d} heading={heading}>
      <ul className={cx('grid gap-5', p.instance.variant === 'tiles' ? '@min-[640px]:grid-cols-2' : 'grid-cols-1')}>
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
                  <h3 className="text-xl break-words [font-family:var(--t-heading)]">{fn.name}</h3>
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

/**
 * venue: the main venue with a directions button. Variants: default (a card under
 * the suite's seal), postcard (an address card with a stamp of the suite's glyph and a
 * postmark of the date), illustrated (a card in the suite's frame with its foot art,
 * lamps, domes, elephants…, standing on the card's top edge).
 */
export function Venue(p: SectionProps) {
  const venue = p.ctx.venue;
  if (!venue) return null;
  const q = [venue.name, venue.address, venue.city].filter(Boolean).join(', ');
  const href = venue.mapUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  const button = 'mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--t-button)] px-6 text-sm font-semibold text-[var(--t-on-button)]';
  const directions =
    p.mode === 'thumbnail' ? (
      <span className={button}>{p.t('template.getDirections')}</span>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" className={button}>
        <span className="size-4" aria-hidden="true">
          <Icon name="navigation" />
        </span>
        {p.t('template.getDirections')}
      </a>
    );
  const map =
    venue.embedUrl && p.mode !== 'thumbnail' ? (
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
    ) : null;
  const heading = p.value('heading') ?? p.t('template.venue.title');
  const d = dressFor(p);

  if (p.instance.variant === 'illustrated') {
    return (
      <SectionShell {...shell(p)} dress={d} heading={heading}>
        <div className="relative mx-auto max-w-md">
          <Skyline d={d} className="relative z-[1] -mb-4 px-6" />
          <ShapedCard d={d} className="px-8 pt-11 pb-9 text-center">
            {venue.city ? <p className="text-[0.66rem] font-semibold tracking-[0.3em] uppercase text-[var(--t-secondary-ink)]">{venue.city}</p> : null}
            <p className="mt-2 text-3xl leading-tight break-words [font-family:var(--t-heading)]">{venue.name}</p>
            {venue.address ? <p className="mt-2 text-[var(--t-muted-ink)]">{venue.address}</p> : null}
            {map}
            {directions}
          </ShapedCard>
        </div>
      </SectionShell>
    );
  }

  if (p.instance.variant === 'postcard') {
    const date = p.ctx.event.startDate ? dateParts(p.ctx.event.startDate, p.language, p.timeZone) : null;
    // The postcard is light paper on any band: its pieces take the paper's colours.
    const paper: Dress = { ...d, band: 'plain' };
    return (
      <SectionShell {...shell(p)} dress={d} heading={heading} wide>
        <div className="bulava-reply-card relative mx-auto max-w-3xl p-6 shadow-[0_34px_60px_-38px_rgba(0,0,0,0.65)] @min-[640px]:p-10">
          <div className="pointer-events-none absolute inset-2 border border-[var(--t-line)]" aria-hidden="true" />
          <div className="relative grid gap-8 @min-[640px]:grid-cols-[1fr_1px_1fr] @min-[640px]:gap-10">
            <div className="flex flex-col items-center justify-center text-center">
              <Seal d={paper} className="w-28 @min-[640px]:w-36">
                <span className="block size-8 text-[var(--t-heading-ink)]">
                  <Icon name="pin" />
                </span>
              </Seal>
              {venue.city ? <p className="mt-4 text-3xl text-[var(--t-primary-ink)] [font-family:var(--t-script)]">{venue.city}</p> : null}
            </div>
            <span className="hidden bg-[var(--t-line)] @min-[640px]:block" aria-hidden="true" />
            <div className="relative">
              <Stamp d={paper} city={venue.city} />
              {date ? (
                <div className="absolute top-14 right-14 flex size-20 rotate-[-14deg] flex-col items-center justify-center rounded-full border border-dashed border-[var(--t-line)] text-[0.6rem] leading-tight tracking-[0.2em] uppercase text-[var(--t-muted-ink)]" aria-hidden="true">
                  <span>{date.day}</span>
                  <span>{date.month}</span>
                  <span>{date.year}</span>
                </div>
              ) : null}
              <div className="pt-28 @min-[640px]:pt-24">
                <p className="border-b border-[var(--t-line)] pb-2 text-2xl break-words [font-family:var(--t-heading)]">{venue.name}</p>
                {venue.address ? <p className="border-b border-[var(--t-line)] py-2 text-[var(--t-muted-ink)]">{venue.address}</p> : null}
                {venue.city ? <p className="border-b border-[var(--t-line)] py-2 tracking-[0.2em] uppercase text-[var(--t-muted-ink)]">{venue.city}</p> : null}
                {directions}
              </div>
            </div>
          </div>
          {map}
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell {...shell(p)} dress={d} heading={heading}>
      <div className={cx('relative mx-auto max-w-md overflow-hidden px-8 pt-8 pb-8 text-center', cardClass(p.look))}>
        <Seal d={d} className="mx-auto mb-4 w-20">
          <span className="block size-7 text-[var(--t-heading-ink)]">
            <Icon name="pin" />
          </span>
        </Seal>
        <p className="text-2xl break-words [font-family:var(--t-heading)]">{venue.name}</p>
        {venue.address || venue.city ? <p className="mt-2 text-[var(--t-muted-ink)]">{[venue.address, venue.city].filter(Boolean).join(', ')}</p> : null}
        {map}
        {directions}
      </div>
    </SectionShell>
  );
}

/** A postage stamp: a perforated square with the suite's glyph and the city. */
function Stamp({ d, city }: { d: Dress; city?: string | null }) {
  // Perforations: holes all over, filled back in everywhere but a 4 px ring (the content box).
  const mask = 'linear-gradient(#000 0 0) content-box, radial-gradient(circle at center, transparent 2.2px, #000 2.7px) -4px -4px / 8px 8px';
  return (
    <div
      aria-hidden="true"
      className="absolute top-0 right-0 flex h-24 w-20 flex-col items-center justify-center bg-[var(--t-primary)] p-1 text-[var(--t-accent)]"
      style={{ WebkitMask: mask, mask }}
    >
      <span className="flex h-full w-full flex-col items-center justify-center border border-current/50">
        <Glyph name={d.suite.glyph} className="size-9" />
        {city ? <span className="mt-1 max-w-full truncate px-1 text-[0.5rem] tracking-[0.18em] uppercase">{city}</span> : null}
      </span>
    </div>
  );
}
