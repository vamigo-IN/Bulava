import type { ReactNode } from 'react';
import { Diya, Toran } from '../art/motifs';
import { CountdownClock } from '../countdown';
import { PhotoStack } from '../interactive';
import type { SectionProps } from '../types';
import { cardClass, cx, SectionShell, shell } from './shared';

export function Countdown(p: SectionProps) {
  const target = p.ctx.function?.startsAt ?? p.ctx.event.startDate;
  if (!target) return null;
  if (p.mode === 'live' && new Date(target).getTime() < Date.now()) return null;
  const flip = p.instance.variant === 'flip';
  return (
    <SectionShell {...shell(p)} heading={flip ? (p.value('heading') ?? p.t('template.countdown.title')) : undefined} eyebrow={flip ? undefined : (p.value('eyebrow') ?? p.t('template.countdown.title'))}>
      <div className="mx-auto max-w-md">
        <CountdownClock
          target={target}
          static={p.mode === 'thumbnail'}
          variant={flip ? 'flip' : 'boxes'}
          labels={{
            days: p.t('template.countdown.days'),
            hours: p.t('template.countdown.hours'),
            minutes: p.t('template.countdown.minutes'),
            seconds: p.t('template.countdown.seconds'),
          }}
        />
      </div>
    </SectionShell>
  );
}

/**
 * gallery: approved photos (else the customer's chosen photos), lazy-loaded; hidden when there are none.
 * Variants: masonry (default), stack (3D swipeable cards), mosaic (a pyramid wall), polaroid (scattered prints).
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

  if (p.instance.variant === 'stack' && p.mode !== 'thumbnail' && shown.length > 1) {
    return (
      <SectionShell {...shell(p)} heading={heading}>
        <PhotoStack
          photos={shown.slice(0, 12).map((img, i) => ({ url: img.url, thumbUrl: img.thumbUrl, label: label(i) }))}
          labels={{ next: p.t('template.gallery.next'), previous: p.t('template.gallery.previous'), hint: p.t('template.gallery.swipe') }}
        />
      </SectionShell>
    );
  }

  if (p.instance.variant === 'mosaic') {
    // Rows of 1, 3, 5… photos: a pyramid wall like a photo-booth print.
    const rows: Array<typeof shown> = [];
    let at = 0;
    for (let size = 1; at < shown.length; size += 2) {
      rows.push(shown.slice(at, at + size));
      at += size;
    }
    return (
      <SectionShell {...shell(p)} heading={heading} wide>
        <div className="flex flex-col items-center gap-1.5 sm:gap-2">
          {rows.map((row, r) => (
            <div key={r} className="flex w-full justify-center gap-1.5 sm:gap-2">
              {row.map((img, k) => {
                const i = rows.slice(0, r).reduce((n, x) => n + x.length, 0) + k;
                return wrap(
                  i,
                  img,
                  <img src={img.thumbUrl} alt="" loading="lazy" decoding="async" className="aspect-[4/5] h-full w-full object-cover shadow-md" {...dims(img)} />,
                  r === 0 ? 'w-1/3 sm:w-1/4' : 'min-w-0 flex-1 max-w-[33%]',
                );
              })}
            </div>
          ))}
        </div>
      </SectionShell>
    );
  }

  if (p.instance.variant === 'polaroid') {
    return (
      <SectionShell {...shell(p)} heading={heading} wide>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 sm:gap-10">
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
    <SectionShell {...shell(p)} heading={heading}>
      <div className="columns-2 gap-3 sm:columns-3 [&>*]:mb-3">
        {shown.map((img, i) =>
          wrap(i, img, <img src={img.thumbUrl} alt="" loading="lazy" decoding="async" className="w-full rounded-[calc(var(--t-radius)*0.75)] object-cover shadow-sm" {...dims(img)} />, 'break-inside-avoid'),
        )}
      </div>
    </SectionShell>
  );
}

/** rsvp: the host app injects the actual form; previews show a placeholder. */
export function Rsvp(p: SectionProps) {
  if (!p.slots.rsvp && p.mode === 'live') return null;
  return (
    <SectionShell {...shell(p)} heading={p.slots.rsvpHeading ?? p.value('heading') ?? p.t('rsvp.title')} tone="surface">
      {p.slots.rsvp ?? (
        <div className="mx-auto max-w-sm space-y-3">
          {[p.t('rsvp.attending'), p.t('rsvp.maybe'), p.t('rsvp.declined')].map((label) => (
            <div key={label} className={cx('px-4 py-3 text-sm', cardClass(p.look))}>
              {label}
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

export function PhotoShare(p: SectionProps) {
  if (!p.slots.photoShare) return null;
  return (
    <SectionShell {...shell(p)} heading={p.value('heading') ?? p.t('template.photoShare.title')}>
      {p.slots.photoShare}
    </SectionShell>
  );
}

/** footer: the closing line (with the customer's closing photo when placed), guest pass and watermark. */
export function Footer(p: SectionProps) {
  const hashtag = p.value('hashtag');
  const closing = p.value('closing') ?? p.t('template.footer.thanks');
  const photo = p.ctx.photoSlots?.closing?.url;
  return (
    <footer className="bulava-band-primary relative overflow-hidden px-6 pt-16 pb-14 text-center">
      {p.look === 'heritage' ? <Toran className="pointer-events-none absolute inset-x-0 top-0 mx-auto w-full max-w-[760px]" swags={4} /> : null}
      <div className={cx('relative mx-auto max-w-md', p.look === 'heritage' && 'pt-16')}>
        {photo ? (
          <div className="mx-auto mb-8 size-40 overflow-hidden rounded-full border-4 border-[var(--t-accent)] shadow-[0_0_40px_rgba(0,0,0,0.35)]">
            <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        ) : null}
        <p className="text-3xl [font-family:var(--t-script)] text-[var(--t-accent-ink)] sm:text-4xl">{closing}</p>
        {hashtag ? <p className="mt-4 text-sm tracking-[0.25em] uppercase text-[var(--t-muted-ink)]">{hashtag}</p> : null}
        {p.look === 'heritage' ? (
          <div className="mt-8 flex justify-center gap-6" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <Diya key={i} className="w-12" />
            ))}
          </div>
        ) : null}
      </div>
      {p.slots.guestInfo ? <div className="relative mx-auto mt-8 max-w-md text-left">{p.slots.guestInfo}</div> : null}
      {p.slots.checkIn ? <div className="relative mx-auto mt-8 max-w-xs">{p.slots.checkIn}</div> : null}
      {p.slots.watermark ? <p className="relative mt-8 text-xs text-[var(--t-muted-ink)]">{p.t('template.madeWith')}</p> : null}
    </footer>
  );
}
