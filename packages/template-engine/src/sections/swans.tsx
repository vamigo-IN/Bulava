import type { ReactNode } from 'react';
import { ILLUSTRATION_ASPECT, Illustration } from '../art/illustrations';
import { emblemMetal } from '../art/illustrations-faith';
import { r2, rand } from '../art/motifs';
import type { IllustrationName } from '@bulava/template-schema';
import type { SectionProps } from '../types';
import { Chevron, PaperFoot } from './deckle';
import { HeroEntrance } from './entrance';

/** Arabic script (the Bismillah): the invocation is marked as Arabic so it is read and shaped as such. */
const ARABIC = /[\u0600-\u06ff]/;
/** The arch's sandstone, and the bouquets' leaves: the garden's own colours. */
const STONE = '#d9c09e';
const LEAVES = '#8a9a6b';
/** Blossoms drifting through the arch: left %, top px, drift, a turn, the time they take and when they start. */
const BLOSSOMS = [
  { x: 30, y: 150, dx: 46, dy: 300, r: 220, t: 13, d: 0 },
  { x: 62, y: 120, dx: -40, dy: 330, r: -260, t: 15, d: 3.5 },
  { x: 44, y: 220, dx: 30, dy: 260, r: 180, t: 12, d: 7 },
  { x: 72, y: 260, dx: -28, dy: 250, r: -200, t: 14, d: 1.8 },
  { x: 25, y: 330, dx: 36, dy: 200, r: 240, t: 11, d: 5.2 },
  { x: 58, y: 380, dx: -22, dy: 170, r: -180, t: 10, d: 9 },
] as const;

/**
 * hero "swans" (The Sacred Garden): the couple's names in a carved garden arch over a misty lake where two swans
 * meet, set on the design's own 450 × 800 page at every width (narrow phones crop its outer margins, as the design
 * does; wide pages show it centred on cream). The faith emblem crowns the arch's sky, then "Wedding Day", the date,
 * the names in a flowing script and "Scroll down" over a bobbing chevron; blossoms drift through the arch, bouquets
 * breathe at its foot, and a torn sheet of paper rises over the water carrying the invocation (the Bismillah).
 * The words come in as the opening lifts. Props: eyebrow, title, date, invocation, cta, emblem (withFaith).
 */
export function SwansHero({ p, title, emblem }: { p: SectionProps; title: string; emblem?: IllustrationName }) {
  const v = p.value;
  const eyebrow = v('eyebrow');
  const date = v('date');
  const invocation = v('invocation');
  const cue = v('cta');
  const live = p.mode === 'live';
  const lines = title.split(/\s+&\s+/);
  const longest = Math.max(...lines.map((l) => Array.from(l).length));
  const scale = longest > 22 ? 0.5 : longest > 16 ? 0.62 : longest > 11 ? 0.78 : 1;
  const words = `${p.instance.id}-words`;
  const nextId = p.nextSectionId;
  const aspect = emblem ? ILLUSTRATION_ASPECT[emblem] : 1;
  const bouquet = (side: 'left' | 'right'): ReactNode => (
    <div
      aria-hidden="true"
      className={`bulava-deckle-breathe pointer-events-none absolute ${side === 'left' ? 'top-[473px] -left-[12px] h-[327px] w-[218px] [--dk-origin:bottom_left]' : 'top-[485px] left-[252px] h-[315px] w-[210px] [--dk-origin:bottom_right] [animation-delay:-1.6s]'}`}
    >
      {/* The blooms rest at the arch's foot just above the paper's torn edge, the sprays rising beside the columns. */}
      <Illustration name="peonyCorner" color={LEAVES} colors={p.colors} w={220} h={330} style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible', transform: side === 'right' ? 'scaleX(-1)' : undefined }} />
    </div>
  );
  const cueNode = cue ? (
    <>
      <span className="block text-[32px] leading-[35px] text-[var(--t-secondary-display)] [font-family:var(--t-heading)]">{cue}</span>
      <span className="bulava-deckle-bob mx-auto mt-[5px] block h-[16px] w-[25px] text-[var(--t-orn)]">
        <Chevron className="block h-full w-full" />
      </span>
    </>
  ) : null;
  return (
    <header id={p.instance.id} className="bulava-swans bulava-deckle-paper relative overflow-hidden bg-[var(--t-bg)]">
      <div className="relative left-1/2 h-[800px] w-[450px] -translate-x-1/2">
        <Illustration name="gardenArch" color={STONE} colors={p.colors} w={450} h={800} style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%' }} />
        {/* A soft light behind the words, so they read on the sky. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[676px] opacity-50" style={{ background: 'radial-gradient(circle at center, rgba(255, 249, 235, 1) 0%, rgba(255, 231, 192, 0) 85%)' }} />
        {live
          ? BLOSSOMS.map((b, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="bulava-swans-blossom pointer-events-none absolute block w-[13px]"
                style={{ left: `${b.x}%`, top: b.y, ['--dk-dx' as string]: `${b.dx}px`, ['--dk-dy' as string]: `${b.dy}px`, ['--dk-rot' as string]: `${b.r}deg`, ['--dk-dur' as string]: `${b.t}s`, ['--dk-delay' as string]: `${b.d}s` }}
              >
                <svg viewBox="-7 -7 14 14" className="block h-auto w-full">
                  {[0, 72, 144, 216, 288].map((a) => (
                    <ellipse key={a} cx="0" cy={r2(-3.4 - rand(i, a) * 0.6)} rx="2.3" ry="3.6" fill="#fffdf7" stroke="#eadfcb" strokeWidth="0.3" transform={`rotate(${a})`} />
                  ))}
                  <circle r="1.2" fill="#e8c56c" />
                </svg>
              </span>
            ))
          : null}
        {live ? <HeroEntrance targetId={words} /> : null}
        <div id={words} data-effect-shelter="" className="bulava-swans-words absolute inset-0 text-center">
          {emblem ? (
            <div data-emblem={emblem} aria-hidden="true" className="absolute top-[92px] left-1/2 h-[48px] -translate-x-1/2" style={{ width: Math.round(48 * aspect) }}>
              <Illustration name={emblem} color={emblemMetal(p.colors, false)} colors={p.colors} foil w={Math.round(48 * aspect)} h={48} style={{ display: 'block', width: '100%', height: '100%' }} />
            </div>
          ) : null}
          {eyebrow ? <p className="absolute inset-x-0 top-[154px] text-[40px] leading-[37px] text-[var(--t-secondary-display)] [font-family:var(--t-heading)]">{eyebrow}</p> : null}
          {date ? <p className="absolute inset-x-0 top-[196px] text-[25px] leading-[37px] text-[var(--t-secondary-display)] [font-family:var(--font-ovo),Ovo,serif]">{date}</p> : null}
          <h1 className="absolute inset-x-0 top-[294px] px-4 text-[length:calc(80px*var(--k))] leading-[0.7] font-normal break-words text-[var(--t-secondary-display)] [font-family:var(--t-script)]" style={{ ['--k' as string]: scale }}>
            {lines.length === 2 ? (
              <>
                <span className="block pb-[0.7em]" data-line="">
                  {lines[0]}
                </span>
                <span className="absolute inset-x-0 top-[calc(62px*var(--k))] block text-[length:calc(40px*var(--k))] leading-[1.1] [font-family:var(--t-heading)]" data-line="">
                  &amp;
                </span>
                <span className="block" data-line="">
                  {lines[1]}
                </span>
              </>
            ) : (
              <span className="block leading-[1]" data-line="">
                {title}
              </span>
            )}
          </h1>
          {cueNode ? (
            <div className="absolute inset-x-0 top-[518px]">
              {nextId && p.mode !== 'thumbnail' ? (
                <a href={`#${nextId}`} className="inline-block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--t-orn)]">
                  {cueNode}
                </a>
              ) : (
                cueNode
              )}
            </div>
          ) : null}
        </div>
      </div>
      {/* The paper rises over the water's edge, under the bouquets, and carries the invocation. */}
      <PaperFoot colors={p.colors} seed={7} className="-mt-[47px] pt-[60px] pb-[8px]">
        {invocation ? (
          <p {...(ARABIC.test(invocation) ? { lang: 'ar', dir: 'rtl' } : {})} className="bulava-deckle-fade relative text-center text-[27px] leading-[1.9] font-bold text-[var(--t-secondary-display)] [font-family:var(--font-amiri),Amiri,serif]">
            {invocation}
          </p>
        ) : (
          <div className="h-[30px]" />
        )}
      </PaperFoot>
      {/* The bouquets stand over both the arch's foot and the paper's torn edge. */}
      <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 z-[2] h-[920px] w-[450px] -translate-x-1/2">
        {bouquet('left')}
        {bouquet('right')}
      </div>
    </header>
  );
}
