import { useId, type ReactNode } from 'react';
import { Illustration } from '../art/illustrations';
import { blend, cuspedHead, hex, shade, tint } from '../art/kit';
import { LakePalaceArt, LakePalaceVignette } from '../art/vignettes';
import { SocialIcon, type SocialGlyph } from '../canvas/icons';
import type { SectionProps } from '../types';
import { ArtOrRef, artKey } from './decor';
import { dressOf, FleuronRule } from './dress';
import { cx } from './shared';

/** The closing's peacock, standing on the balcony's ledge (the page defines it once when it recurs: SharedArt). */
export const VISTA_PEACOCK = { art: 'standingPeacock', tint: '#1f5f8b', foil: false } as const;

/** The garden roses' leaves (a natural sage), as the page's rose decor draws them. */
const LEAVES = '#7c8f6a';

/** Instagram's hashtag page for a tag ("#AnanyaWedsVihaan" → its letters, digits and underscores). */
function tagOf(hashtag: string | undefined): string | null {
  const tag = (hashtag ?? '').replace(/^#/, '').replace(/[^\p{L}\p{N}_]/gu, '');
  return tag ? tag : null;
}

/** One niche of the ledge's jaali (a cusped arch 26 wide), as a pattern tile. */
const NICHE = `M5 30 V17 ${cuspedHead(5, 17, 16, 9, false)} V30Z`;

/**
 * footer "vista" (The Royal Heirloom): "See You Soon" from the palace balcony at golden hour: the lake with a
 * long, low palace across the water (right of the words on wide pages, under them on phones), veiled into the
 * paper at the top; carved pillars with jasmine at both sides, the balcony's carved ledge along the foot with a
 * peacock standing on it, its train over the ledge's face, and roses at the pillars' bases; the closing line, the
 * fleuron, the share row and the hashtag. Share links are the event's public address only (slots.shareUrl),
 * never a personal invitation; previews draw the row still. The guest's pass and the mark follow on the paper.
 */
export function VistaFooter(p: SectionProps) {
  const id = `vp${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const colors = p.colors;
  const title = p.value('title') ?? p.t('template.footer.seeYouSoon');
  const closing = p.value('closing') ?? p.t('template.footer.thanks');
  const hashtag = p.value('hashtag');
  const d = dressOf(p.ornament, p.look, colors, 'plain', p.dress);
  const live = p.mode === 'live';
  const shareUrl = p.slots.shareUrl;
  const tag = tagOf(hashtag);
  const share: Array<{ name: SocialGlyph; label: string; href: string | null }> = [
    { name: 'whatsapp', label: p.t('template.share.whatsapp'), href: shareUrl ? `https://wa.me/?text=${encodeURIComponent(`${p.ctx.event.title} ${shareUrl}`)}` : null },
    { name: 'instagram', label: p.t('template.share.instagram', { tag: tag ? `#${tag}` : '' }).trim(), href: tag ? `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/` : null },
    { name: 'facebook', label: p.t('template.share.facebook'), href: shareUrl ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` : null },
  ];
  // Live pages show the links that lead somewhere; previews draw the whole row, still.
  const row = live ? share.filter((s) => s.href) : share;
  const glyph = (name: SocialGlyph) => (
    <span className="block size-[26px]">
      <SocialIcon name={name} weight={1.4} />
    </span>
  );
  // The carved stone of the pillars and the ledge (the pillars' sandstone).
  const stone = blend(hex(colors.accent), hex(colors.secondary), 0.22);
  const pillar = (side: 'left' | 'right') => (
    <div aria-hidden="true" className="pointer-events-none absolute bottom-0 aspect-[90/500] w-7 @min-[900px]:w-[100px]" style={{ [side]: 0, transform: side === 'right' ? 'scaleX(-1)' : undefined }}>
      <Illustration name="palacePillar" color={colors.accent} colors={colors} foil w={90} h={500} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
  const strand = (side: 'left' | 'right', delay: number) => (
    <div aria-hidden="true" className={cx('pointer-events-none absolute top-0 h-[24%] w-3.5 @min-[900px]:h-[46%] @min-[900px]:w-[26px]', side === 'left' ? 'left-7 @min-[900px]:left-[100px]' : 'right-7 @min-[900px]:right-[100px]', live && 'bulava-sway-soft')} style={live ? { animationDelay: `${delay}s` } : undefined}>
      <Illustration name="jasmineStrand" color={colors.secondary} colors={colors} w={26} h={270} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
  const roses = (className: string, flip: 'y' | 'xy') => (
    <div aria-hidden="true" className={cx('pointer-events-none absolute bottom-0 aspect-[320/270]', className)}>
      <div className="h-full w-full" style={{ transform: flip === 'y' ? 'scaleY(-1)' : 'scale(-1, -1)' }}>
        <ArtOrRef art="roseCluster" tint={LEAVES} colors={colors} foil={false} w={320} h={270} refs={p.artRefs} />
      </div>
    </div>
  );
  // The peacock is drawn once (the page's shared drawing, else here): its train is heavy markup.
  const shared = p.artRefs?.[artKey(VISTA_PEACOCK.art, VISTA_PEACOCK.tint, VISTA_PEACOCK.foil)];
  const strip: ReactNode[] = [];
  if (p.slots.guestInfo) strip.push(<div key="info" className="relative mx-auto max-w-md text-left">{p.slots.guestInfo}</div>);
  if (p.slots.checkIn) strip.push(<div key="pass" className="relative mx-auto mt-8 max-w-xs first:mt-0">{p.slots.checkIn}</div>);
  if (p.slots.watermark) strip.push(<p key="mark" className="relative mt-8 text-center text-xs text-[var(--t-muted-ink)] first:mt-0">{p.t('template.madeWith')}</p>);

  return (
    <footer id={p.instance.id} className="relative overflow-hidden bg-[var(--t-bg)]">
      <div className="relative min-h-[660px] @min-[900px]:min-h-[600px]">
        <LakePalaceVignette colors={colors} palace={false} className="absolute inset-0 h-full w-full" />
        {shared ? null : (
          <svg aria-hidden="true" width="0" height="0" className="absolute">
            <defs>
              <symbol id={id} viewBox="0 0 80 100">
                <Illustration name={VISTA_PEACOCK.art} color={VISTA_PEACOCK.tint} colors={colors} foil={VISTA_PEACOCK.foil} w={320} h={400} style={{ width: '100%', height: '100%' }} />
              </symbol>
            </defs>
          </svg>
        )}
        {/* The palace across the water, with its reflection: under the words on phones, clear of them at the right on wide pages. */}
        <LakePalaceArt
          colors={colors}
          className="pointer-events-none absolute bottom-[calc(25%-9cqw)] left-1/2 block h-auto w-[78%] -translate-x-1/2 @min-[900px]:right-[8%] @min-[900px]:bottom-[13.09cqw] @min-[900px]:left-auto @min-[900px]:w-[31%] @min-[900px]:translate-x-0"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, var(--t-bg) 0%, color-mix(in srgb, var(--t-bg) 82%, transparent) 22%, color-mix(in srgb, var(--t-bg) 45%, transparent) 46%, transparent 64%)' }}
        />
        {strand('left', 0)}
        {strand('right', 1.2)}
        {pillar('left')}
        {pillar('right')}
        {/* The balcony's carved ledge along the foot: a coping with its gold line, a row of jaali niches, a plinth. */}
        <svg aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 block h-[40px] w-full @min-[900px]:h-[58px]">
          <defs>
            <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={tint(stone, 0.3)} />
              <stop offset="1" stopColor={shade(stone, 0.06)} />
            </linearGradient>
            <pattern id={`${id}j`} width="26" height="30" patternUnits="userSpaceOnUse" x="0" y="13">
              <path d={NICHE} fill={shade(stone, 0.32)} opacity="0.55" />
              <path d={NICHE} fill="none" stroke={shade(stone, 0.4)} strokeWidth="0.6" opacity="0.6" />
            </pattern>
          </defs>
          <rect x="0" y="9" width="100%" height="100%" fill={stone} />
          <rect x="0" y="13" width="100%" height="100%" fill={`url(#${id}j)`} />
          <rect x="0" y="0" width="100%" height="10" fill={`url(#${id}c)`} />
          <rect x="0" y="10" width="100%" height="2.5" fill={shade(stone, 0.45)} opacity="0.35" />
          <rect x="0" y="9" width="100%" height="1" fill={hex(colors.secondary)} opacity="0.85" />
          <rect x="0" y="0" width="100%" height="1" fill={tint(stone, 0.5)} />
        </svg>
        {/* The peacock stands on the ledge by the right pillar, facing in, its train over the ledge's face. */}
        <svg viewBox="0 0 80 100" aria-hidden="true" className="pointer-events-none absolute right-10 bottom-[-10px] block h-auto w-[88px] @min-[900px]:right-[112px] @min-[900px]:bottom-[-38px] @min-[900px]:w-[176px]">
          <use href={`#${shared ?? id}`} />
        </svg>
        {roses('-left-2 h-[88px] @min-[900px]:-left-[0.5%] @min-[900px]:h-[clamp(130px,13cqw,190px)]', 'y')}
        {roses('-right-2 h-[64px] @min-[900px]:-right-[0.4%] @min-[900px]:h-[clamp(96px,9cqw,130px)]', 'xy')}
        <div className="relative z-[1] mx-auto flex max-w-[560px] flex-col items-center px-10 pt-14 pb-[300px] text-center @min-[900px]:px-6 @min-[900px]:pt-[72px] @min-[900px]:pb-[220px]">
          <h2 className="text-[48px] leading-[1.05] font-medium italic text-balance text-[var(--t-primary-ink)] [font-family:var(--t-heading)] @min-[640px]:text-[72px]">{title}</h2>
          <p className="mt-4 max-w-[520px] text-[15.5px] leading-[1.7] text-balance text-[var(--t-text)] @min-[640px]:text-[16.5px]">{closing}</p>
          <FleuronRule d={d} className="mt-[22px]" />
          {row.length ? (
            <ul className="mt-6 flex items-center justify-center gap-10 text-[var(--t-primary-ink)]">
              {row.map((s) => (
                <li key={s.name}>
                  {live && s.href ? (
                    <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-[color-mix(in_srgb,var(--t-surface)_70%,transparent)]">
                      {glyph(s.name)}
                    </a>
                  ) : (
                    <span className="flex size-11 items-center justify-center" aria-hidden="true">
                      {glyph(s.name)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {hashtag ? <p className="mt-[18px] text-[15px] tracking-[0.04em] text-[var(--t-text)] @min-[640px]:text-base">{hashtag}</p> : null}
        </div>
      </div>
      {strip.length ? <div className="relative bg-[var(--t-bg)] px-6 py-8">{strip}</div> : null}
    </footer>
  );
}
