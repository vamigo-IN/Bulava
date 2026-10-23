import type { ReactNode } from 'react';
import type { ThemeColors } from '@bulava/template-schema';
import { shade, tint, useSafeId } from '../art/kit';
import { r2, rand } from '../art/motifs';
import { textureStyle } from '../canvas/colors';
import type { Dress } from './dress';

/**
 * The deckle look (The Sacred Garden, ADR-081): the page is one phone-wide column on cream at every width; the
 * template's paper sections (`band: 'surface'`) are printed on sheets of deckle-edged paper a little wider than the
 * column, and consecutive ones join into one panel that tears open only at its ends (styles.tsx, by CSS, so a
 * section that hides itself never leaves a tear behind). Headings are gold script; reading text a light serif.
 */

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/** The paper sheet's width: wider than the 450 px column, so on phones it runs off both edges. */
const SHEET = 574;
const EDGE = 30;

/** A torn paper edge: a slow wave with fine tears along it, a darker rim of fibres inside and a faint shadow outside. */
function TornEdge({ seed, flip, fill, rim }: { seed: number; flip?: boolean; fill: string; rim: string }) {
  const knots = 9;
  const heights = Array.from({ length: knots + 1 }, (_, k) => 5 + rand(k, seed) * 17);
  const pts: string[] = [];
  for (let x = 0; x <= SHEET; x += 4) {
    const u = (x / SHEET) * knots;
    const k = Math.min(knots - 1, Math.floor(u));
    const f = u - k;
    // A slow wave, fine tears along it, and now and then a deeper bite where a fibre pulled away.
    const bite = rand(x, seed + 5) > 0.93 ? 3 + rand(x, seed + 6) * 3 : 0;
    const y = heights[k]! + (heights[k + 1]! - heights[k]!) * f * f * (3 - 2 * f) + (rand(x, seed + 3) - 0.5) * 3.2 + bite;
    pts.push(`${x} ${r2(Math.min(EDGE - 2, y))}`);
  }
  const line = `M${pts.join(' L')}`;
  return (
    <svg viewBox={`0 0 ${SHEET} ${EDGE}`} preserveAspectRatio="none" aria-hidden="true" className="block h-full w-full" style={flip ? { transform: 'scaleY(-1)' } : undefined}>
      <path d={line} transform="translate(0 -1.6)" fill="none" stroke="#5a4630" strokeOpacity="0.1" strokeWidth="3.2" vectorEffect="non-scaling-stroke" />
      <path d={`M0 ${EDGE + 1} L${pts.join(' L')} L${SHEET} ${EDGE + 1}Z`} fill={fill} />
      <path d={line} transform="translate(0 0.8)" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      <path d={line} transform="translate(0 3)" fill="none" stroke={rim} strokeOpacity="0.55" strokeWidth="2.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** The sheet behind a paper section: textured paper with a torn edge at the top and the foot (hidden where sheets join). */
function PaperSheet({ colors, seed }: { colors: ThemeColors; seed: number }) {
  const paper = colors.surface;
  const rim = shade(paper, 0.08);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 w-[min(100%,574px)] -translate-x-1/2">
      <div className="bulava-deckle-body absolute inset-x-0 top-[28px] bottom-[28px]" style={{ backgroundColor: paper }}>
        <div className="absolute inset-0" style={textureStyle('paper', 0.7, [paper])} />
      </div>
      <div className="bulava-deckle-top absolute inset-x-0 top-0 h-[30px]">
        <TornEdge seed={seed} fill={paper} rim={rim} />
      </div>
      <div className="bulava-deckle-bottom absolute inset-x-0 bottom-0 h-[30px]">
        <TornEdge seed={seed + 7} flip fill={paper} rim={rim} />
      </div>
    </div>
  );
}

/**
 * A torn sheet for a piece that prints the start of a paper panel itself (the hero's foot): its top edge, its body and
 * a bottom edge that goes, with the body meeting the next sheet (over its section's joining padding), when the section
 * after it is paper too.
 */
export function PaperFoot({ colors, seed, className, children }: { colors: ThemeColors; seed: number; className?: string; children?: ReactNode }) {
  const paper = colors.surface;
  return (
    <div className={cx('relative', className)}>
      <div aria-hidden="true" className="bulava-deckle-foot pointer-events-none absolute inset-y-0 left-1/2 w-[min(100%,574px)] -translate-x-1/2">
        <div className="bulava-deckle-body absolute inset-x-0 top-[28px] bottom-[28px]" style={{ backgroundColor: paper }}>
          <div className="absolute inset-0" style={textureStyle('paper', 0.7, [paper])} />
        </div>
        <div className="absolute inset-x-0 top-0 h-[30px]">
          <TornEdge seed={seed} fill={paper} rim={shade(paper, 0.08)} />
        </div>
        <div className="bulava-deckle-bottom absolute inset-x-0 bottom-0 h-[30px]">
          <TornEdge seed={seed + 7} flip fill={paper} rim={shade(paper, 0.08)} />
        </div>
      </div>
      {children}
    </div>
  );
}

/** A gold swash beside a heading: a long stroke ending in a curl, two leaves and a seed (the right one mirrors it). */
export function GoldFlourish({ className, mirror }: { className?: string; mirror?: boolean }) {
  return (
    <svg viewBox="0 0 80 40" aria-hidden="true" className={className} style={mirror ? { transform: 'scaleX(-1)' } : undefined} fill="none" stroke="currentColor" strokeLinecap="round">
      <path d="M3 22 C14 26 22 16 32 18 C42 20 46 28 56 24 C64 21 66 13 60 11 C55 9 52 15 56 18 C60 21 68 18 74 19" strokeWidth="1.4" />
      <path d="M18 21 C14 14 20 10 25 12 C22 15 21 18 18 21Z M36 19 C38 12 45 11 48 15 C43 16 40 18 36 19Z" fill="currentColor" stroke="none" opacity="0.8" />
      <path d="M8 23 C6 20 6 17 9 16" strokeWidth="1" />
      <circle cx="77.5" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="44" cy="27.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A small fleuron rule under a heading: a hairline either side of a three-petal flower with two scrolls. */
export function Fleuron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 30" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round">
      <path d="M2 10 H94" strokeWidth="0.7" opacity="0.75" />
      <path d="M48 26 C45 21 45 16 48 12 C51 16 51 21 48 26Z" fill="currentColor" stroke="none" />
      <path d="M48 22 C42 22 38 18 39 14 C43 15 46 18 48 22Z M48 22 C54 22 58 18 57 14 C53 15 50 18 48 22Z" fill="currentColor" stroke="none" opacity="0.8" />
      <path d="M40 16 C34 20 26 20 22 15 C20 12 23 10 25 12 C26 14 24 15 23 14" strokeWidth="0.9" />
      <path d="M56 16 C62 20 70 20 74 15 C76 12 73 10 71 12 C70 14 72 15 73 14" strokeWidth="0.9" />
    </svg>
  );
}

/** A fine chevron that bobs (down under "Scroll down", up over "Click to open"). */
export function Chevron({ up, className }: { up?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 25 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" style={up ? { transform: 'scaleY(-1)' } : undefined}>
      <path d="M1 1 C4.4 5.4 9.1 9.6 12.5 14 C16.8 9.6 19.7 5.4 24 1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A filigree crest over (or, turned, under) a gold frame: scrolls either side of a fan of leaves. */
export function Crest({ className, under }: { className?: string; under?: boolean }) {
  return (
    <svg viewBox="0 0 190 42" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" style={under ? { transform: 'scaleY(-1)' } : undefined}>
      <path d="M95 30 C88 20 88 10 95 4 C102 10 102 20 95 30Z" fill="currentColor" stroke="none" />
      <path d="M95 30 C84 28 77 20 78 12 C86 14 92 21 95 30Z M95 30 C106 28 113 20 112 12 C104 14 98 21 95 30Z" fill="currentColor" stroke="none" opacity="0.75" />
      <path d="M86 32 C70 36 58 30 52 22 C48 16 54 12 58 16 C61 20 57 23 55 21" strokeWidth="1.3" />
      <path d="M104 32 C120 36 132 30 138 22 C142 16 136 12 132 16 C129 20 133 23 135 21" strokeWidth="1.3" />
      <path d="M52 30 C40 34 26 34 14 30 M138 30 C150 34 164 34 176 30" strokeWidth="1" opacity="0.8" />
      <circle cx="10" cy="29" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="180" cy="29" r="1.8" fill="currentColor" stroke="none" />
      <path d="M40 38 H150" strokeWidth="0.8" opacity="0.6" />
    </svg>
  );
}

/**
 * The section heading: gold script, large and centred; with `flourish` a gold swash at either side of the column,
 * with `fleuron` a small rule beneath.
 */
export function DeckleHeading({ heading, flourish, fleuron, className }: { heading: string; flourish?: boolean; fleuron?: boolean; className?: string }) {
  return (
    <div className={cx('relative mb-6 text-center', className)}>
      {flourish ? (
        <>
          <GoldFlourish className="bulava-deckle-from-left absolute top-1/2 -left-[22px] h-[40px] w-[80px] -translate-y-1/2 text-[var(--t-orn)]" />
          <GoldFlourish mirror className="bulava-deckle-from-right absolute top-1/2 -right-[22px] h-[40px] w-[80px] -translate-y-1/2 text-[var(--t-orn)]" />
        </>
      ) : null}
      <h2 className={cx('relative text-[41px] leading-[1.3] font-normal text-balance text-[var(--t-secondary-display)] [font-family:var(--t-heading)]', flourish && 'px-[46px]')}>{heading}</h2>
      {fleuron ? <Fleuron className="bulava-deckle-zoom mx-auto mt-1 h-[24px] w-[78px] text-[var(--t-orn)]" /> : null}
    </div>
  );
}

/**
 * The deckle shell: a section on the cream page, or (band surface) on a torn paper sheet that joins the paper
 * sections next to it. The words keep to the 450 px column (390-wide phones show it whole, narrower ones crop its
 * margins as the design does).
 */
export function DeckleShell({
  id,
  dress,
  heading,
  flourish,
  fleuron,
  className,
  bleed,
  art,
  seed = 1,
  children,
}: {
  id: string;
  dress: Dress;
  heading?: string;
  flourish?: boolean;
  fleuron?: boolean;
  className?: string;
  /** No side padding in the column (pieces laid out to its edges). */
  bleed?: boolean;
  /** Art placed in the column, behind the words (corner sprays). */
  art?: ReactNode;
  /** Varies the paper's tears from section to section. */
  seed?: number;
  children: ReactNode;
}) {
  const paper = dress.band === 'surface';
  return (
    <section
      id={id}
      className={cx('bulava-reveal bulava-deckle relative', paper ? 'bulava-deckle-paper pt-[64px] pb-[62px]' : 'pt-[42px] pb-[42px]', className)}
      style={{ ['--t-band' as string]: paper ? 'var(--t-surface)' : 'var(--t-bg)' }}
    >
      {paper ? <PaperSheet colors={dress.colors} seed={seed} /> : null}
      <div className={cx('relative mx-auto w-full max-w-[450px]', !bleed && 'px-[26px]')}>
        {art}
        {heading ? <DeckleHeading heading={heading} flourish={flourish} fleuron={fleuron} /> : null}
        {children}
      </div>
    </section>
  );
}

/** Reading text in the deckle look: the light display serif, warm brown, centred. */
export const DECKLE_TEXT = 'text-[21px] leading-[26px] font-light text-[var(--t-text)] [font-family:var(--t-body)]';

/** Twelve directions round a circle (30° steps), for the wax's lobes without runtime trigonometry. */
const DIAL: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0.866, 0.5],
  [0.5, 0.866],
  [0, 1],
  [-0.5, 0.866],
  [-0.866, 0.5],
  [-1, 0],
  [-0.866, -0.5],
  [-0.5, -0.866],
  [0, -1],
  [0.5, -0.866],
  [0.866, -0.5],
];

/** The wax seal stamped RSVP: a maroon pool of wax with a pressed ring, the word in gold capitals and a fleuron. */
export function RsvpSeal({ colors, label, className }: { colors: ThemeColors; label: string; className?: string }) {
  const id = useSafeId();
  const wax = colors.primary;
  const gold = colors.secondary;
  // The wax's wavy rim: twelve points round the seal, each joined to the next by a bulge outward.
  const at = (i: number, r: number) => [95 + DIAL[i % 12]![0] * r, 71 + DIAL[i % 12]![1] * r * 0.94] as const;
  const radius = (i: number) => 62 + rand(i % 12, 5) * 4;
  let d = `M${at(0, radius(0)).map(r2).join(' ')}`;
  for (let i = 0; i < 12; i++) {
    const [ax, ay] = at(i, 1);
    const [bx, by] = at(i + 1, 1);
    const mid = [(ax + bx) / 2 - 95, (ay + by) / 2 - 71] as const;
    const len = Math.sqrt(mid[0] * mid[0] + mid[1] * mid[1]) || 1;
    const bulge = 76 + rand(i, 9) * 4;
    const end = at(i + 1, radius(i + 1));
    d += ` Q${r2(95 + (mid[0] / len) * bulge)} ${r2(71 + (mid[1] / len) * bulge * 0.94)} ${r2(end[0])} ${r2(end[1])}`;
  }
  return (
    <svg viewBox="0 0 190 142" aria-hidden="true" className={className}>
      <defs>
        <radialGradient id={`${id}w`} cx="40%" cy="34%" r="72%">
          <stop offset="0" stopColor={tint(wax, 0.28)} />
          <stop offset="0.5" stopColor={wax} />
          <stop offset="1" stopColor={shade(wax, 0.38)} />
        </radialGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tint(gold, 0.35)} />
          <stop offset="0.5" stopColor={gold} />
          <stop offset="1" stopColor={shade(gold, 0.2)} />
        </linearGradient>
      </defs>
      <path d={`${d}Z`} fill={shade(wax, 0.45)} transform="translate(1.5 2.5)" opacity="0.35" />
      <path d={`${d}Z`} fill={`url(#${id}w)`} />
      <ellipse cx="95" cy="71" rx="50" ry="47" fill={shade(wax, 0.1)} />
      <ellipse cx="95" cy="71" rx="50" ry="47" fill="none" stroke={shade(wax, 0.42)} strokeWidth="2.2" />
      <ellipse cx="95.6" cy="71.8" rx="45" ry="42.4" fill="none" stroke={tint(wax, 0.3)} strokeWidth="0.8" opacity="0.55" />
      <ellipse cx="76" cy="40" rx="22" ry="8" fill="#ffffff" opacity="0.13" transform="rotate(-26 76 40)" />
      <text x="95" y="80" textAnchor="middle" fontSize="27" fill={`url(#${id}g)`} style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif', letterSpacing: '0.04em' }}>
        {label}
      </text>
      <path d="M70 90 C80 86 88 92 95 88 C102 92 110 86 120 90" fill="none" stroke={`url(#${id}g)`} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M95 86 C93 89 93 92 95 95 C97 92 97 89 95 86Z" fill={`url(#${id}g)`} />
    </svg>
  );
}
