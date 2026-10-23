import type { ReactNode } from 'react';
import { getLanguage } from '@bulava/localization';
import { Diya, Toran } from '../art/motifs';
import { CarouselGallery } from '../carousel';
import { CountdownClock } from '../countdown';
import { DepthGallery } from '../depth-gallery';
import { PhotoStack } from '../interactive';
import { Glyph } from '../ornaments-suite';
import type { SectionProps } from '../types';
import { EDGE_HEIGHT, EndFlourish, Fleuron, Hangings, PhotoFrame, Seal, ShapedCard, Skyline, SuiteEdge, SWAG_EDGES, UnitSeparator, type Band, type Dress } from './dress';
import { BloomFooter } from './bloom';
import { Chevron, DECKLE_TEXT, RsvpSeal } from './deckle';
import { RsvpAutoOpen } from './rsvp-open';
import { SealDialog } from './seal-dialog';
import { BAND_CLASS, BAND_FILL, cardClass, cx, dressFor, HEIRLOOM_PILL, initials, PillArrow, SectionShell, shell } from './shared';
import { VistaFooter } from './vista';

/** The month around a date as weeks of days (null before the first), in the event's time zone. */
function monthOf(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((x) => x.type === type)?.value ?? 1);
  const [y, m, day] = [get('year'), get('month'), get('day')];
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: Array<number | null> = [...Array.from({ length: first }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return { y, m, day, cells };
}

/** Month and weekday names in the page's language (Latin digits, as the rest of the page). */
function calendarNames(language: string, y: number, m: number) {
  const locale = language === 'hi-Latn' ? 'en-IN' : `${language}-IN`;
  const fmt = (opts: Intl.DateTimeFormatOptions, date: Date) => {
    try {
      return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { ...opts, timeZone: 'UTC' }).format(date);
    } catch {
      return new Intl.DateTimeFormat('en-IN', { ...opts, timeZone: 'UTC' }).format(date);
    }
  };
  // 2023-01-01 was a Sunday: the week's names from it.
  const weekdays = Array.from({ length: 7 }, (_, i) => fmt({ weekday: 'narrow' }, new Date(Date.UTC(2023, 0, 1 + i))));
  return { month: fmt({ month: 'long', year: 'numeric' }, new Date(Date.UTC(y, m - 1, 15))), weekdays };
}

/** The day's month as a printed calendar on light paper, the day itself ringed and crowned with the suite's glyph. */
function Calendar({ d, iso, language, timeZone }: { d: Dress; iso: string; language: string; timeZone: string }) {
  const { y, m, day, cells } = monthOf(iso, timeZone);
  const names = calendarNames(language, y, m);
  return (
    <div className="bulava-reply-card">
      <ShapedCard d={{ ...d, band: 'plain' }} className="px-5 pt-10 pb-7 @min-[640px]:px-9" fill="var(--rc-bg)">
        <p className="text-center text-2xl text-[var(--t-primary-ink)] [font-family:var(--t-heading)]">{names.month}</p>
        <div className="mt-5 grid grid-cols-7 gap-y-1.5 text-center" role="presentation">
          {names.weekdays.map((w, i) => (
            <span key={`w${i}`} className="pb-2 text-[0.65rem] font-semibold tracking-[0.2em] uppercase text-[var(--t-muted-ink)]">
              {w}
            </span>
          ))}
          {cells.map((n, i) =>
            n === day ? (
              <span key={i} className="relative mx-auto flex size-10 items-center justify-center rounded-full bg-[var(--t-button)] text-base font-semibold text-[var(--t-on-button)] shadow-md">
                <Glyph name={d.suite.glyph} className="absolute -top-2.5 left-1/2 size-4 -translate-x-1/2 text-[var(--t-orn)]" />
                {n}
              </span>
            ) : (
              <span key={i} className="flex h-10 items-center justify-center text-sm tabular-nums text-[var(--t-text)]">
                {n ?? ''}
              </span>
            ),
          )}
        </div>
      </ShapedCard>
    </div>
  );
}

/**
 * countdown: a live timer to the first function. Variants: default (boxes), flip
 * (flip-clock leaves), rings (each number in a double ring of the suite's colour),
 * calendar (the month printed like a calendar page, the day ringed, the time left in a line).
 */
export function Countdown(p: SectionProps) {
  const target = p.ctx.function?.startsAt ?? p.ctx.event.startDate;
  if (!target) return null;
  if (p.mode === 'live' && new Date(target).getTime() < Date.now()) return null;
  const variant = p.instance.variant;
  const flip = variant === 'flip';
  const titled = flip || variant === 'calendar';
  const d = dressFor(p);
  const labels = {
    days: p.t('template.countdown.days'),
    hours: p.t('template.countdown.hours'),
    minutes: p.t('template.countdown.minutes'),
    seconds: p.t('template.countdown.seconds'),
  };
  if (variant === 'shimmer') {
    // Candlelit gold figures with colons between them (the deckle look's countdown).
    return (
      <SectionShell {...shell(p)} dress={d} heading={p.value('heading') ?? p.t('template.countdown.beginsIn')}>
        <div className="bulava-deckle-rise">
          <CountdownClock target={target} static={p.mode === 'thumbnail'} variant="shimmer" labels={labels} />
        </div>
      </SectionShell>
    );
  }
  if (variant === 'ornate') {
    // One row on the band: gold figures, the units' names, drawn separators and a flourish at each end.
    return (
      <SectionShell {...shell(p)} dress={d} heading={p.value('heading') ?? p.t('template.countdown.bigDay')} wide>
        <CountdownClock
          target={target}
          static={p.mode === 'thumbnail'}
          variant="ornate"
          labels={labels}
          ornament={{ separator: <UnitSeparator />, end: <EndFlourish d={d} /> }}
          caps={getLanguage(p.language).script === 'Latn'}
        />
      </SectionShell>
    );
  }
  return (
    <SectionShell {...shell(p)} dress={d} heading={titled ? (p.value('heading') ?? p.t('template.countdown.title')) : undefined} eyebrow={titled ? undefined : (p.value('eyebrow') ?? p.t('template.countdown.title'))}>
      {variant === 'calendar' ? (
        <div className="mx-auto max-w-sm">
          <Calendar d={d} iso={target} language={p.language} timeZone={p.timeZone} />
          <div className="mt-8">
            <CountdownClock target={target} static={p.mode === 'thumbnail'} variant="inline" labels={labels} />
          </div>
        </div>
      ) : (
        <div className={cx('mx-auto', variant === 'rings' ? 'max-w-lg' : 'max-w-md')}>
          <CountdownClock target={target} static={p.mode === 'thumbnail'} variant={flip ? 'flip' : variant === 'rings' ? 'rings' : 'boxes'} labels={labels} />
        </div>
      )}
    </SectionShell>
  );
}

/**
 * gallery: approved photos (else the customer's chosen photos), lazy-loaded; hidden when there are none.
 * Variants: masonry (default), stack (3D swipeable cards), mosaic (a pyramid wall), polaroid (scattered
 * prints), frames (a wall of the suite's frames: arches, niches, ovals…), depth (Signature 3D: a ring of
 * photos receding in 3D that turns by swipe, drag, keys or buttons; the mosaic wall in thumbnails, for
 * fewer than three photos and for reduced motion).
 */
export function Gallery(p: SectionProps) {
  const images = p.ctx.gallery.images.length ? p.ctx.gallery.images : p.ctx.photos;
  if (!images.length) return null;
  const limit = p.mode === 'thumbnail' ? 4 : 24;
  const shown = images.slice(0, limit);
  const heading = p.value('heading') ?? p.t('template.gallery.title');
  const label = (i: number) => p.t('template.gallery.open', { number: i + 1, total: shown.length });
  // Thumbnails are rendered inside card links: no nested anchors.
  const wrap = (i: number, img: (typeof shown)[number], child: ReactNode, className?: string) =>
    p.mode === 'thumbnail' ? (
      <span key={img.url + i} className={cx('block', className)}>
        {child}
      </span>
    ) : (
      <a key={img.url + i} href={img.url} target="_blank" rel="noopener noreferrer" aria-label={label(i)} className={cx('block', className)}>
        {child}
      </a>
    );
  const dims = (img: (typeof shown)[number]) => (img.width && img.height ? { width: img.width, height: img.height } : {});
  const d = dressFor(p);
  const common = { ...shell(p), dress: d, heading };
  const depth = p.instance.variant === 'depth' && p.mode !== 'thumbnail' && shown.length > 2;
  const variant = p.instance.variant === 'depth' && !depth ? 'mosaic' : p.instance.variant;

  // Rows of 1, 3, 5… photos: a pyramid wall like a photo-booth print (the mosaic, and the depth ring's still fallback).
  const mosaic = (photos: typeof shown) => {
    const rows: Array<typeof shown> = [];
    let at = 0;
    for (let size = 1; at < photos.length; size += 2) {
      rows.push(photos.slice(at, at + size));
      at += size;
    }
    return (
      <div className="flex flex-col items-center gap-1.5 @min-[640px]:gap-2">
        {rows.map((row, r) => (
          <div key={r} className="flex w-full justify-center gap-1.5 @min-[640px]:gap-2">
            {row.map((img, k) => {
              const i = rows.slice(0, r).reduce((n, x) => n + x.length, 0) + k;
              return wrap(
                i,
                img,
                <img src={img.thumbUrl} alt="" loading="lazy" decoding="async" className="aspect-[4/5] h-full w-full object-cover shadow-md" {...dims(img)} />,
                r === 0 ? 'w-1/3 @min-[640px]:w-1/4' : 'min-w-0 flex-1 max-w-[33%]',
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  if (variant === 'carousel') {
    const all = images.slice(0, 24);
    const eyebrow = p.value('eyebrow') ?? p.t('template.gallery.eyebrow');
    const title = p.value('heading') ?? p.t('template.gallery.captured');
    const row =
      p.mode === 'thumbnail' ? (
        <div className="flex gap-3.5 overflow-hidden px-6 pt-2 pb-6">
          {all.slice(0, 4).map((img, i) => (
            <span key={img.url + i} className="block h-[220px] shrink-0 overflow-hidden rounded-[6px] shadow-[0_12px_28px_-18px_rgba(0,0,0,0.45)]" style={{ aspectRatio: img.width && img.height ? `${img.width} / ${img.height}` : '4 / 5' }}>
              <img src={img.thumbUrl} alt="" className="h-full w-full object-cover" />
            </span>
          ))}
        </div>
      ) : (
        <CarouselGallery
          photos={all.map((img, i) => ({ url: img.url, thumbUrl: img.thumbUrl, width: img.width, height: img.height, label: p.t('template.gallery.open', { number: i + 1, total: all.length }) }))}
          labels={{ previous: p.t('template.gallery.previous'), next: p.t('template.gallery.next'), goTo: all.map((_, i) => p.t('template.carousel.goTo', { number: i + 1 })) }}
          label={title}
        />
      );
    return (
      <SectionShell {...common} heading={title} eyebrow={eyebrow} wide>
        {/* The row runs to the band's edges, its first photo on the content column. */}
        <div style={{ marginInline: 'calc((100% - 100cqw) / 2)' }}>{row}</div>
        {all.length > 6 && p.mode !== 'thumbnail' ? (
          <details className="bulava-more-list mt-6 text-center">
            <summary className={cx(HEIRLOOM_PILL, 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>
              {p.t('template.gallery.viewAll')}
              <PillArrow />
            </summary>
            <div className="mt-8 grid grid-cols-2 gap-3 @min-[900px]:grid-cols-3 @min-[900px]:gap-4">
              {all.map((img, i) => (
                <a key={img.url + i} href={img.url} target="_blank" rel="noopener noreferrer" aria-label={label(i)} className="block aspect-square overflow-hidden rounded-[6px]">
                  <img src={img.thumbUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          </details>
        ) : null}
      </SectionShell>
    );
  }

  if (depth) {
    const ring = shown.slice(0, 12);
    return (
      <SectionShell {...common} wide>
        <DepthGallery
          photos={ring.map((img, i) => ({ url: img.url, thumbUrl: img.thumbUrl, label: p.t('template.gallery.open', { number: i + 1, total: ring.length }), ...dims(img) }))}
          labels={{ next: p.t('template.gallery.next'), previous: p.t('template.gallery.previous'), hint: p.t('template.gallery.swipe') }}
          label={heading}
          fallback={mosaic(shown)}
        />
      </SectionShell>
    );
  }

  if (variant === 'stack' && p.mode !== 'thumbnail' && shown.length > 1) {
    return (
      <SectionShell {...common}>
        <PhotoStack
          photos={shown.slice(0, 12).map((img, i) => ({ url: img.url, thumbUrl: img.thumbUrl, label: label(i) }))}
          labels={{ next: p.t('template.gallery.next'), previous: p.t('template.gallery.previous'), hint: p.t('template.gallery.swipe') }}
        />
      </SectionShell>
    );
  }

  if (variant === 'frames') {
    return (
      <SectionShell {...common} wide>
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 @min-[640px]:grid-cols-3 @min-[640px]:gap-x-10">
          {shown.slice(0, 6).map((img, i) => wrap(i, img, <PhotoFrame d={d} src={img.thumbUrl} alt="" />, cx('mx-auto w-full max-w-[220px]', i % 2 ? '@min-[640px]:mt-10' : '')))}
        </div>
      </SectionShell>
    );
  }

  if (variant === 'mosaic') {
    return (
      <SectionShell {...common} wide>
        {mosaic(shown)}
      </SectionShell>
    );
  }

  if (variant === 'polaroid') {
    return (
      <SectionShell {...common} wide>
        <div className="grid grid-cols-2 gap-6 @min-[640px]:grid-cols-3 @min-[640px]:gap-10">
          {shown.slice(0, 9).map((img, i) =>
            wrap(
              i,
              img,
              <span className="block bg-white p-2 pb-8 shadow-[0_18px_30px_-16px_rgba(0,0,0,0.5)]">
                <img src={img.thumbUrl} alt="" loading="lazy" decoding="async" className="aspect-square w-full object-cover" {...dims(img)} />
              </span>,
              cx('bulava-tilt transition-transform', ['-rotate-3', 'rotate-2', '-rotate-1', 'rotate-3', '-rotate-2', 'rotate-1'][i % 6]),
            ),
          )}
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell {...common}>
      <div className="columns-2 gap-3 @min-[640px]:columns-3 [&>*]:mb-3">
        {shown.map((img, i) =>
          wrap(i, img, <img src={img.thumbUrl} alt="" loading="lazy" decoding="async" className="w-full rounded-[calc(var(--t-radius)*0.75)] object-cover shadow-sm" {...dims(img)} />, 'break-inside-avoid'),
        )}
      </div>
    </SectionShell>
  );
}

/** The reply options a preview shows in place of the host's form. */
function ReplyPlaceholder({ d, options }: { d: Dress; options: string[] }) {
  return (
    <ul className="mx-auto max-w-sm space-y-3">
      {options.map((label) => (
        <li key={label} className="flex min-h-12 items-center gap-3 rounded-full border border-[var(--t-line)] px-5 text-sm">
          <Glyph name={d.suite.glyph} className="size-4 shrink-0 text-[var(--t-orn)]" />
          {label}
        </li>
      ))}
    </ul>
  );
}

/**
 * rsvp: the host app injects the actual form; previews show a placeholder. The form
 * always sits on a light reply card (its labels are drawn in dark ink), whatever band
 * the section is on. Variants: default (the card), card (the reply card in the suite's
 * frame, its seal pressed onto the top edge).
 */
export function Rsvp(p: SectionProps) {
  if (!p.slots.rsvp && p.mode === 'live') return null;
  const d = dressFor(p, 'surface');
  // The pieces on the reply card take the card's light paper.
  const paper: Dress = { ...d, band: 'plain' };
  const content = p.slots.rsvp ?? <ReplyPlaceholder d={paper} options={[p.t('rsvp.attending'), p.t('rsvp.maybe'), p.t('rsvp.declined')]} />;
  const heading = p.slots.rsvpHeading ?? p.value('heading') ?? p.t('rsvp.title');
  if (p.instance.variant === 'seal') {
    // A wax seal stamped RSVP under a script heading and a line: pressing it (or arriving at the section's address)
    // opens the reply form over the page; a chevron and "Click to open" bob beneath it.
    const title = p.slots.rsvpHeading ?? p.value('heading') ?? p.t('template.rsvp.attendance');
    const line = p.value('text') ?? p.t('template.rsvp.prepare');
    const trigger = (
      <>
        <span className="bulava-deckle-zoom block w-[190px] transition-transform duration-300 group-hover:scale-[1.03] [--dk-delay:0.5s]">
          <RsvpSeal colors={p.colors} label={p.t('template.rsvp.seal')} className="block h-auto w-full" />
        </span>
        <span className="bulava-deckle-bob mt-[16px] block h-[16px] w-[25px] text-[var(--t-orn)]">
          <Chevron up className="block h-full w-full" />
        </span>
        <span className="bulava-deckle-bob block text-[32px] leading-[50px] text-[var(--t-secondary-display)] [font-family:var(--t-heading)]">{p.t('template.rsvp.clickToOpen')}</span>
      </>
    );
    return (
      <SectionShell {...shell(p)} dress={d} heading={title}>
        <p className={cx('bulava-deckle-rise -mx-[8px] text-center', DECKLE_TEXT)}>{line}</p>
        <div className="mt-6 text-center">
          {p.mode === 'thumbnail' ? (
            <span className="mx-auto flex flex-col items-center">{trigger}</span>
          ) : (
            <SealDialog sectionId={p.instance.id} trigger={trigger} label={title} closeLabel={p.t('template.rsvp.closeForm')} title={title}>
              {content}
            </SealDialog>
          )}
        </div>
      </SectionShell>
    );
  }
  if (p.instance.variant === 'invite') {
    // A letter's close: the guest greeted by name, a line, and the reply card that opens where it is.
    const greeting = p.slots.rsvpHeading ?? (p.ctx.guest && p.mode !== 'thumbnail' ? p.t('invitation.dear', { guestName: p.ctx.guest.name }) : p.t('template.rsvp.dearAll'));
    const detailsId = `${p.instance.id}-reply`;
    return (
      <SectionShell {...shell(p)} dress={d}>
        <div className="mx-auto max-w-[560px] text-center">
          <h2 className="text-[24px] leading-[1.25] font-semibold text-balance text-[var(--t-text)] [font-family:var(--t-heading)] @min-[640px]:text-[28px]">{greeting}</h2>
          <p className="mx-auto mt-3 max-w-[520px] text-[15.5px] leading-[1.75] text-[var(--t-text)] @min-[640px]:text-[16.5px]">{p.t('template.rsvp.presence')}</p>
          <details id={detailsId} className="bulava-reply mt-7">
            <summary className={cx(HEIRLOOM_PILL, 'cursor-pointer list-none [&::-webkit-details-marker]:hidden @min-[640px]:min-w-[330px]')}>
              {p.t('template.rsvp.confirm')}
              <PillArrow />
            </summary>
            <div className="bulava-reply-card mx-auto max-w-[520px] text-left" style={{ backgroundColor: 'transparent' }}>
              <ShapedCard d={paper} shape="cusped" fill="var(--rc-bg)" className="px-5 pt-[30cqw] pb-8 @min-[640px]:px-10">
                <Fleuron d={paper} className="absolute top-[17cqw] left-1/2 h-[15px] w-7 -translate-x-1/2" />
                {content}
              </ShapedCard>
            </div>
          </details>
          {p.mode === 'live' ? <RsvpAutoOpen sectionId={p.instance.id} detailsId={detailsId} /> : null}
        </div>
      </SectionShell>
    );
  }
  if (p.instance.variant === 'card') {
    return (
      <SectionShell {...shell(p)} dress={d} heading={heading}>
        <div className="bulava-reply-card relative mx-auto max-w-lg bg-transparent pt-8" style={{ backgroundColor: 'transparent' }}>
          <div className="absolute top-0 left-1/2 z-10 w-16 -translate-x-1/2">
            <div className="rounded-full bg-[var(--rc-bg)] p-1.5 shadow-md">
              <Seal d={paper} quiet />
            </div>
          </div>
          <ShapedCard d={paper} className="px-5 pt-14 pb-8 @min-[640px]:px-10" fill="var(--rc-bg)">
            {content}
          </ShapedCard>
        </div>
      </SectionShell>
    );
  }
  return (
    <SectionShell {...shell(p)} dress={d} heading={heading}>
      <div className={cx('bulava-reply-card mx-auto max-w-lg px-5 py-8 @min-[640px]:px-10', cardClass(p.look), 'bg-[var(--rc-bg)]')}>{content}</div>
    </SectionShell>
  );
}

export function PhotoShare(p: SectionProps) {
  if (!p.slots.photoShare) return null;
  return (
    <SectionShell {...shell(p)} dress={dressFor(p)} heading={p.value('heading') ?? p.t('template.photoShare.title')}>
      {p.slots.photoShare}
    </SectionShell>
  );
}

/**
 * footer: the closing line (with the customer's closing photo when placed), the hashtag,
 * the guest's pass and the watermark, on the closing band. Variants: default, seal (a
 * seal with the couple's initials, the suite's strands hanging either side), skyline
 * (the suite's art along the foot: domes, lamps, diyas, peacocks, roses, balloons…),
 * blessing (strands hanging either side, the closing line large between them, the names).
 */
export function Footer(p: SectionProps) {
  if (p.instance.variant === 'vista') return <VistaFooter {...p} />;
  if (p.instance.variant === 'bloom') return <BloomFooter {...p} />;
  const hashtag = p.value('hashtag');
  const closing = p.value('closing') ?? p.t('template.footer.thanks');
  const photo = p.ctx.photoSlots?.closing?.url;
  const variant = p.instance.variant;
  const band: Band = p.heroTone === 'dark' && p.look !== 'noir' && p.look !== 'heritage' && p.look !== 'celebration' ? 'deep' : 'primary';
  const dress = dressFor(p, 'plain', band);
  const suited = dress.suite.name !== 'none';
  const who = p.ctx.couple ? `${p.ctx.couple.partnerOne} & ${p.ctx.couple.partnerTwo}` : (p.ctx.honoree?.name ?? p.ctx.event.title);
  const mono = initials(who);
  const edgeName = suited ? dress.suite.edge : 'none';
  const edge = edgeName !== 'none' && edgeName !== 'scallop';
  const hang = suited && (variant === 'seal' || variant === 'blessing') && !!dress.suite.hang;
  // Room at the top for what hangs there: a swag's depth, a strand's, or a strip's.
  const top = hang ? 112 : edge ? (SWAG_EDGES.has(edgeName) ? EDGE_HEIGHT[edgeName] + 36 : EDGE_HEIGHT[edgeName] + 52) : 64;

  const portrait = photo ? (
    <div className="mx-auto mb-8 size-40 overflow-hidden rounded-full border-4 border-[var(--t-accent)] shadow-[0_0_40px_rgba(0,0,0,0.35)]">
      <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
    </div>
  ) : null;

  const seal = (size: string) => (
    <Seal d={dress} className={cx('mx-auto', size)}>
      <span className="text-4xl tracking-[0.1em] text-[var(--t-accent-ink)] [font-family:var(--t-heading)]">{mono}</span>
    </Seal>
  );

  let middle: ReactNode;
  if (variant === 'seal') {
    middle = (
      <>
        {portrait ?? <div className="mb-8">{seal('w-36')}</div>}
        <p className="text-3xl [font-family:var(--t-script)] text-[var(--t-accent-ink)] @min-[640px]:text-4xl">{closing}</p>
      </>
    );
  } else if (variant === 'blessing') {
    middle = (
      <>
        {portrait}
        <Glyph name={dress.suite.glyph} className="mx-auto mb-5 size-8 text-[var(--t-orn)]" />
        <p className="text-4xl leading-snug [font-family:var(--t-script)] text-[var(--t-accent-ink)] @min-[640px]:text-5xl">{closing}</p>
        <div className="mx-auto mt-6 h-px w-24 bg-[var(--t-orn)] opacity-60" aria-hidden="true" />
        <p className="mt-6 text-2xl tracking-[0.06em] break-words [font-family:var(--t-heading)]">{who}</p>
      </>
    );
  } else {
    middle = (
      <>
        {portrait ?? (suited && variant !== 'skyline' ? <div className="mb-8">{seal('w-24')}</div> : null)}
        <p className="text-3xl [font-family:var(--t-script)] text-[var(--t-accent-ink)] @min-[640px]:text-4xl">{closing}</p>
      </>
    );
  }

  return (
    <footer className={cx('relative overflow-hidden px-6 pb-14 text-center', BAND_CLASS[band])} style={{ ['--t-band' as string]: BAND_FILL[band], paddingTop: suited ? top : undefined }}>
      {!suited && p.look === 'heritage' ? <Toran className="pointer-events-none absolute inset-x-0 top-0 mx-auto w-full max-w-[760px]" swags={4} /> : null}
      {edge ? <SuiteEdge d={dress} name={edgeName} /> : null}
      {hang ? <Hangings d={dress} /> : null}
      <div className={cx('relative mx-auto max-w-md', !suited && 'pt-16', !suited && p.look === 'heritage' && 'pt-28')}>
        {middle}
        {hashtag ? <p className="mt-4 text-sm tracking-[0.25em] uppercase text-[var(--t-muted-ink)]">{hashtag}</p> : null}
        {!suited && p.look === 'heritage' ? (
          <div className="mt-8 flex justify-center gap-6" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <Diya key={i} className="w-12" />
            ))}
          </div>
        ) : null}
      </div>
      {variant === 'skyline' && suited ? <Skyline d={dress} className="relative mt-10 -mb-14" /> : null}
      {p.slots.guestInfo ? <div className="relative mx-auto mt-8 max-w-md text-left">{p.slots.guestInfo}</div> : null}
      {p.slots.checkIn ? <div className="relative mx-auto mt-8 max-w-xs">{p.slots.checkIn}</div> : null}
      {p.slots.watermark ? <p className="relative mt-8 text-xs text-[var(--t-muted-ink)]">{p.t('template.madeWith')}</p> : null}
    </footer>
  );
}
