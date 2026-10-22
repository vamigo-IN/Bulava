import type { CSSProperties, ReactNode } from 'react';
import { getLanguage } from '@bulava/localization';
import type { LookName, SectionDecor, ThemeColors, ThemeDress } from '@bulava/template-schema';
import { Marigold, Toran } from '../art/motifs';
import { Divider, FloralCorner, patternStyle, type OrnamentName } from '../ornaments';
import { StarField } from '../ornaments-signature';
import { textureStyle } from '../canvas/colors';
import { deepOf } from '../theme';
import type { RenderMode, SectionProps } from '../types';
import { decorOf } from './decor';
import { dressOf, EDGE_HEIGHT, onDark, SuiteCorners, SuiteDivider, SuiteEdge, SWAG_EDGES, type Band, type Dress } from './dress';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export type { Band, Dress };

/** Looks whose sections follow a dark hero onto the dark stock (heritage and celebration keep their colour bands; noir pages are dark already). */
const DARK_STOCK_LOOKS = new Set<LookName>(['royal', 'classic', 'garden', 'modern', 'heirloom']);

/**
 * Which band a section sits on. Looks alternate bands by position, so a page
 * reads as a sequence of distinct panels (heritage: crimson, saffron, ivory…);
 * the classic look keeps each section's own preference. A design on dark
 * stock (heroTone "dark") alternates the primary band with a deeper one.
 */
export function bandFor(look: LookName, index: number, tone: 'plain' | 'surface' | 'inverse', dark = false): Band {
  if (dark && DARK_STOCK_LOOKS.has(look)) return index % 2 ? 'deep' : 'primary';
  switch (look) {
    case 'heritage':
      return (['surface', 'primary', 'accent'] as const)[index % 3]!;
    case 'celebration':
      return (['surface', 'primary', 'plain', 'accent'] as const)[index % 4]!;
    case 'royal':
    case 'garden':
    case 'modern':
      return index % 2 ? 'plain' : 'surface';
    case 'noir':
      return 'plain';
    // Paper by default; the template chooses each section's band (`band`), dark bands are the deep colour.
    case 'heirloom':
      return tone === 'surface' ? 'surface' : tone === 'inverse' ? 'deep' : 'plain';
    default:
      return tone === 'surface' ? 'surface' : tone === 'inverse' ? 'primary' : 'plain';
  }
}

export const BAND_CLASS: Record<Band, string> = {
  plain: '',
  surface: 'bg-[var(--t-surface)]',
  primary: 'bulava-band-primary',
  accent: 'bulava-band-accent',
  deep: 'bulava-band-deep',
};

/** The colour a band's own background is, for scalloped edges rising into the band above. */
export const BAND_FILL: Record<Band, string> = {
  plain: 'var(--t-bg)',
  surface: 'var(--t-surface)',
  primary: 'var(--t-primary)',
  accent: 'var(--t-accent)',
  deep: 'var(--t-deep)',
};

/** Common shell props from a section's props. */
export function shell(p: SectionProps) {
  return {
    id: p.instance.id,
    ornament: p.ornament,
    look: p.look,
    index: p.index,
    colors: p.colors,
    dark: p.heroTone === 'dark',
    pattern: p.pattern,
    themeDress: p.dress,
    ...(p.instance.band ? { band: p.instance.band } : {}),
    ...(p.instance.decor?.length ? { decor: p.instance.decor } : {}),
    mode: p.mode,
    script: getLanguage(p.language).script,
    ...(p.artRefs ? { artRefs: p.artRefs } : {}),
  };
}

/**
 * The dress a section's pieces are drawn in: its band (from the look and its place
 * on the page, or the band it always takes), the look, the palette and the suite
 * with the theme's own pieces. Sections render on the server, so they hand it to
 * the shell and to every piece.
 */
export function dressFor(p: SectionProps, tone: 'plain' | 'surface' | 'inverse' = 'plain', band?: Band): Dress {
  return dressOf(p.ornament, p.look, p.colors, band ?? p.instance.band ?? bandFor(p.look, p.index, tone, p.heroTone === 'dark'), p.dress);
}

/** Heading faces loaded with a true italic (the others would be slanted by the browser). */
const TRUE_ITALIC = new Set<string>(['Cormorant Garamond', 'Lora']);
/** Heading faces that read well in a paragraph (the rest are display faces: Cinzel's capitals, Yeseva, Rozha…). */
const BOOK_FACES = new Set<string>(['Cormorant Garamond', 'Playfair Display', 'Marcellus', 'Noto Serif', 'Lora']);

/**
 * The faces printed lines take: `name` for short lines (the parents' names, a
 * name in a profile), `prose` for paragraphs set like print (a letter, the
 * blessings, a verse). Both use the heading face where it is a book face, in
 * italic only where it has a true italic; under a display heading (Cinzel's
 * capitals, Yeseva, Rozha, a rounded face) they take the body face, which
 * keeps two names on two lines in a narrow column.
 */
export function faces(p: Pick<SectionProps, 'fonts'>): { name: string; prose: string } {
  const heading = p.fonts?.heading?.family ?? '';
  const italic = TRUE_ITALIC.has(heading) ? ' italic' : '';
  const face = BOOK_FACES.has(heading) ? `[font-family:var(--t-heading)]${italic}` : '[font-family:var(--t-body)]';
  return { name: face, prose: face };
}

/**
 * A small label over a line of names ("Daughter of", "Ananya's family"): spaced
 * capitals in Latin script; Devanagari and the other Indic scripts have no
 * capitals and lose their joins when spaced, so they are set a little larger, unspaced.
 */
export function labelClass(language: string): string {
  return getLanguage(language).script === 'Latn' ? 'text-[0.62rem] font-semibold tracking-[0.3em] uppercase' : 'text-[0.8rem] font-semibold';
}

/** Ornamental rule under headings, in the look's own vocabulary (templates without a suite). */
export function LookDivider({ look, ornament }: { look: LookName; ornament: OrnamentName }) {
  switch (look) {
    case 'heritage':
      return (
        <svg viewBox="0 0 160 24" className="mx-auto h-6 w-40" aria-hidden="true">
          <path d="M4 12 H56 M104 12 H156" stroke="currentColor" strokeWidth="1.2" className="text-[var(--t-accent-ink)]" opacity="0.7" />
          <Marigold x={66} y={12} r={6} tone={1} />
          <Marigold x={80} y={12} r={8} tone={0} />
          <Marigold x={94} y={12} r={6} tone={2} />
        </svg>
      );
    case 'noir':
      return (
        <div className="flex items-center justify-center gap-3 text-[var(--t-accent-ink)]" aria-hidden="true">
          <span className="h-px w-14 bg-current opacity-60" />
          <span className="text-xs">◆</span>
          <span className="h-px w-14 bg-current opacity-60" />
        </div>
      );
    case 'garden':
      return (
        <svg viewBox="0 0 120 24" className="mx-auto h-6 w-32 text-[var(--t-secondary-ink)]" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
          <path d="M8 14 C40 6 80 6 112 14" />
          {[24, 44, 64, 84, 100].map((x, i) => (
            <path key={x} d={`M${x} ${11 - (i % 2)} q${i % 2 ? 6 : -6} -8 ${i % 2 ? 12 : 2} -8 q-2 6 -12 8`} fill="currentColor" opacity="0.55" />
          ))}
        </svg>
      );
    case 'celebration':
      return (
        <div className="flex items-center justify-center gap-2" aria-hidden="true">
          {['var(--t-primary)', 'var(--t-accent)', 'var(--t-secondary)', 'var(--t-accent)', 'var(--t-primary)'].map((c, i) => (
            <span key={i} className="block size-2 rounded-full" style={{ background: c, transform: `translateY(${i % 2 ? -3 : 3}px)` }} />
          ))}
        </div>
      );
    case 'modern':
      return <span className="block h-1 w-12 bg-[var(--t-accent)]" aria-hidden="true" />;
    default:
      return <Divider ornament={ornament} />;
  }
}

/** Gold filigree corner for royal frames. */
function Filigree({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 60 60" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M2 58 V14 C2 7 7 2 14 2 H58" />
      <path d="M8 58 V18 C8 12 12 8 18 8 H58" opacity="0.6" />
      <path d="M14 20 C20 20 20 14 26 14 C22 18 26 22 20 24 C18 30 12 26 14 20Z" fill="currentColor" opacity="0.8" />
      <circle cx="30" cy="8" r="2" fill="currentColor" />
      <circle cx="8" cy="30" r="2" fill="currentColor" />
    </svg>
  );
}

/** The section's heading in the look's type, with the suite's rule (or the look's own) beneath it. */
export function Heading({ d, heading, eyebrow, look, index, align = 'center', script }: { d: Dress; heading: string; eyebrow?: string; look: LookName; index: number; align?: 'center' | 'left'; script?: string }) {
  if (look === 'heirloom') return <HeirloomHeading d={d} heading={heading} eyebrow={eyebrow} align={align} script={script} />;
  const modernNumber = look === 'modern' ? String(index).padStart(2, '0') : null;
  const left = look === 'modern' || align === 'left';
  return (
    <div className={cx(look === 'modern' ? 'mb-10' : 'mb-9', left ? 'text-left' : 'text-center')}>
      {modernNumber ? <p className="mb-3 text-sm font-semibold tracking-[0.3em] text-[var(--t-accent-ink)]">{modernNumber}</p> : null}
      {eyebrow ? <p className="mb-2 text-xs font-semibold tracking-[0.35em] uppercase text-[var(--t-secondary-ink)]">{eyebrow}</p> : null}
      <h2
        className={cx(
          'leading-tight text-balance',
          look === 'heritage' && 'text-5xl [font-family:var(--t-script)] text-[var(--t-heading-ink)] @min-[640px]:text-6xl',
          look === 'noir' && 'text-4xl italic [font-family:var(--t-heading)] @min-[640px]:text-5xl',
          look === 'royal' && 'text-3xl tracking-[0.14em] uppercase [font-family:var(--t-heading)] text-[var(--t-heading-ink)] @min-[640px]:text-4xl',
          look === 'garden' && 'text-5xl [font-family:var(--t-script)] text-[var(--t-heading-ink)]',
          look === 'celebration' && 'text-4xl font-bold [font-family:var(--t-heading)] @min-[640px]:text-5xl',
          look === 'modern' && 'text-4xl tracking-tight [font-family:var(--t-heading)] @min-[640px]:text-6xl',
          look === 'classic' && 'text-3xl [font-family:var(--t-heading)] @min-[640px]:text-4xl',
        )}
      >
        {heading}
      </h2>
      <div className={cx('mt-4', left && 'flex')}>{d.suite.name === 'none' ? <LookDivider look={look} ornament="none" /> : <SuiteDivider d={d} className={left ? 'justify-start' : undefined} />}</div>
    </div>
  );
}

/**
 * The heirloom's small capitals: spaced Lora capitals in Latin script; scripts without capitals (Devanagari…)
 * lose their joins when spaced, so they are set a little larger and unspaced.
 */
export function heirloomCaps(script: string | undefined, latin: string, other = 'text-[0.95rem]'): string {
  return !script || script === 'Latn' ? `uppercase ${latin}` : other;
}

/**
 * The heirloom's heading stack: gold capitals, an italic serif heading and the fleuron on paper; on the
 * dark bands the heading itself is set as a line of gold capitals over the fleuron.
 */
export function HeirloomHeading({ d, heading, eyebrow, align = 'center', script, className }: { d: Dress; heading: string; eyebrow?: string; align?: 'center' | 'left'; script?: string; className?: string }) {
  const left = align === 'left';
  return (
    <div className={cx('mb-8 @min-[640px]:mb-10', left ? 'text-left' : 'text-center', className)}>
      {onDark(d) ? (
        <h2 className={cx('leading-[1.4] font-semibold text-[var(--t-heading-ink)]', heirloomCaps(script, 'text-[12.5px] tracking-[0.24em] @min-[640px]:text-[15px]'))}>{heading}</h2>
      ) : (
        <>
          {eyebrow ? <p className={cx('leading-[1.4] font-semibold text-[var(--t-secondary-ink)]', heirloomCaps(script, 'text-[11.5px] tracking-[0.24em] @min-[640px]:text-[13px]'))}>{eyebrow}</p> : null}
          <h2 className={cx('text-[28px] leading-[1.15] font-medium italic text-balance text-[var(--t-heading-ink)] [font-family:var(--t-heading)] @min-[640px]:text-[36px]', eyebrow && 'mt-3.5')}>{heading}</h2>
        </>
      )}
      <div className={cx('mt-3.5', left && 'flex')}>
        <SuiteDivider d={d} className={left ? 'justify-start' : undefined} />
      </div>
    </div>
  );
}

/**
 * Standard section shell: consistent rhythm, reveal animation, a heading in
 * the look's style, the look's band, and the suite's dress (the rule under the
 * heading, corner pieces or a border along the top, the paper's pattern, stars
 * over a dark band). A section that draws suite pieces itself passes the dress
 * it drew them in (`dress`, from dressFor), so the shell's band and the pieces agree.
 *
 * Restraint: a band takes a border or corners, never both; swags (a toran, a
 * garland, bunting) hang over every third band, strips over every other one.
 */
export function SectionShell({
  id,
  heading,
  eyebrow,
  ornament,
  children,
  tone = 'plain',
  className,
  look = 'classic',
  index = 1,
  colors,
  wide,
  dark = false,
  pattern = 'none',
  band: bandOverride,
  dress: given,
  themeDress,
  bare = false,
  decor,
  mode,
  script,
  join,
  bleed,
  artRefs,
}: {
  id: string;
  heading?: string;
  eyebrow?: string;
  ornament: OrnamentName;
  children: ReactNode;
  tone?: 'plain' | 'surface' | 'inverse';
  className?: string;
  look?: LookName;
  index?: number;
  /** Palette (patterns are images, so they need real colours, not variables). */
  colors?: ThemeColors;
  wide?: boolean;
  /** The design is on dark stock (heroTone "dark"). */
  dark?: boolean;
  /** The theme's paper pattern (the suite's when none). */
  pattern?: string;
  /** A band this section always takes (the footer's). */
  band?: Band;
  /** The dress the section's own pieces were drawn in (its band wins over `band` and the look's). */
  dress?: Dress;
  /** The theme's own suite pieces (theme.dress), when the shell makes the dress itself. */
  themeDress?: ThemeDress;
  /** No corners or border (sections that frame themselves). */
  bare?: boolean;
  /** Art in the section's corners and sides (instance.decor). */
  decor?: readonly SectionDecor[];
  mode?: RenderMode;
  /** The page's script (getLanguage().script): capitals are spaced in Latin only. */
  script?: string;
  /** 'above': the section continues the band above it (no top padding, no frame). */
  join?: 'above';
  /** The section lays out its own edges (a photo to the page's edge): no padding or column (heirloom). */
  bleed?: boolean;
  /** The page's shared drawings (SectionProps.artRefs). */
  artRefs?: Readonly<Record<string, string>>;
}) {
  const dress = given ?? dressOf(ornament, look, colors, bandOverride ?? bandFor(look, index, tone, dark), themeDress);
  const band = dress.band;
  if (look === 'heirloom') {
    return (
      <HeirloomShell id={id} dress={dress} heading={heading} eyebrow={eyebrow} className={className} wide={wide} decor={decor} mode={mode} script={script} join={join} bleed={bleed} artRefs={artRefs}>
        {children}
      </HeirloomShell>
    );
  }
  const suite = dress.suite;
  const suited = suite.name !== 'none';
  const darkBand = onDark(dress);

  // The look's own decoration, for templates without a suite.
  const toran = !suited && look === 'heritage' && band === 'accent';
  const lookPattern: CSSProperties | undefined = !colors
    ? undefined
    : look === 'heritage' && band === 'primary'
      ? patternStyle('rangoli', colors.accent, 1)
      : look === 'heritage' && band === 'accent'
        ? patternStyle('rangoli', colors.primary, 0.5)
        : look === 'celebration' && band !== 'plain'
          ? patternStyle('confetti', band === 'primary' ? colors.accent : colors.primary, 1)
          : look === 'royal' && band === 'surface'
            ? patternStyle('damask', colors.secondary, 1)
            : undefined;
  // A suite prints the theme's pattern (else its own) on every band but the plain page.
  const paper = pattern && pattern !== 'none' ? pattern : suite.pattern;
  const suitePattern: CSSProperties | undefined = colors && band !== 'plain' && paper !== 'none' ? patternStyle(paper, band === 'accent' ? colors.primary : darkBand ? colors.accent : colors.secondary, 1) : undefined;
  const bandPattern = suited ? suitePattern : lookPattern;

  const swag = SWAG_EDGES.has(suite.edge);
  const edge = suited && !bare && suite.edge !== 'none' && (swag ? index % 3 === 2 : index % 2 === 0);
  const edgeRoom = edge && swag ? EDGE_HEIGHT[suite.edge] : 0;
  const corners = suited && !bare && !edge && suite.corner !== 'none' && look !== 'royal' && index % 2 === 1;
  // Stars over every other dark band (the deep ones), over every one for a night-sky suite.
  const sky = suited && darkBand && (suite.sky === 'stars' || suite.sky === 'sparkles') && (band === 'deep' || suite.name === 'stars');

  const headingBlock = heading ? <Heading d={dress} heading={heading} eyebrow={eyebrow} look={look} index={index} /> : eyebrow ? <p className="mb-6 text-center text-xs font-semibold tracking-[0.35em] uppercase text-[var(--t-secondary-ink)]">{eyebrow}</p> : null;

  const body = (
    <>
      {headingBlock}
      {children}
    </>
  );

  return (
    <section
      id={id}
      className={cx('bulava-reveal relative overflow-hidden px-6', toran ? 'pt-28 pb-16 @min-[640px]:pt-32' : 'py-16 @min-[640px]:py-24', BAND_CLASS[band], className)}
      style={{ ['--t-band' as string]: BAND_FILL[band], ...(edgeRoom ? { paddingTop: `calc(${edgeRoom}px + 3rem)` } : {}) }}
    >
      {bandPattern ? <div className={cx('pointer-events-none absolute inset-0', darkBand ? 'opacity-[0.09]' : 'opacity-[0.12]')} style={bandPattern} aria-hidden="true" /> : null}
      {sky ? <StarField className="pointer-events-none absolute inset-x-0 top-0 h-56 w-full text-[var(--t-orn)] opacity-40" count={suite.sky === 'sparkles' ? 12 : 22} /> : null}
      {toran ? <Toran className="pointer-events-none absolute inset-x-0 top-0 mx-auto w-full max-w-[760px] bulava-sway-soft" swags={4} /> : null}
      {edge ? <SuiteEdge d={dress} name={suite.edge} /> : null}
      {corners ? <SuiteCorners d={dress} /> : null}
      {!suited && look === 'garden' ? (
        <>
          <FloralCorner className="pointer-events-none absolute top-0 left-0 w-32 text-[var(--t-secondary)] opacity-50 @min-[640px]:w-44" />
          <FloralCorner className="pointer-events-none absolute top-0 right-0 w-32 -scale-x-100 text-[var(--t-secondary)] opacity-50 @min-[640px]:w-44" />
        </>
      ) : null}
      {look === 'noir' || (suited && darkBand) ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-48 max-w-xl rounded-full opacity-25 blur-3xl" style={{ background: 'var(--t-accent)' }} aria-hidden="true" />
      ) : null}
      <div className={cx('relative mx-auto', wide ? 'max-w-5xl' : 'max-w-3xl')}>
        {look === 'royal' && !bare ? (
          <div className="relative border border-[var(--t-line)] px-5 py-12 @min-[640px]:px-12">
            <div className="pointer-events-none absolute inset-2 border border-[var(--t-line)] opacity-60" aria-hidden="true" />
            {suited && suite.corner !== 'none' ? (
              <SuiteCorners d={dress} bottom inset={-1} size="sm" />
            ) : (
              <>
                <Filigree className="absolute -top-px -left-px w-12 text-[var(--t-accent)]" />
                <Filigree className="absolute -top-px -right-px w-12 -scale-x-100 text-[var(--t-accent)]" />
                <Filigree className="absolute -bottom-px -left-px w-12 -scale-y-100 text-[var(--t-accent)]" />
                <Filigree className="absolute -right-px -bottom-px w-12 -scale-100 text-[var(--t-accent)]" />
              </>
            )}
            <div className="relative">{body}</div>
          </div>
        ) : (
          body
        )}
      </div>
    </section>
  );
}

/**
 * The heirloom's band: printed paper (grain on the dark bands), generous margins, an inset hairline frame
 * with filigree corners round the dark bands, and the section's decor behind the words.
 */
function HeirloomShell({
  id,
  dress,
  heading,
  eyebrow,
  className,
  wide,
  decor,
  mode,
  script,
  join,
  bleed,
  artRefs,
  children,
}: {
  id: string;
  dress: Dress;
  heading?: string;
  eyebrow?: string;
  className?: string;
  wide?: boolean;
  decor?: readonly SectionDecor[];
  mode?: RenderMode;
  script?: string;
  join?: 'above';
  bleed?: boolean;
  artRefs?: Readonly<Record<string, string>>;
  children: ReactNode;
}) {
  const band = dress.band;
  const dark = onDark(dress);
  const colors = dress.colors;
  const paper = band === 'deep' ? deepOf(colors) : band === 'primary' ? colors.primary : band === 'surface' ? colors.surface : band === 'accent' ? colors.accent : colors.background;
  const texture = textureStyle(dark ? 'grain' : 'paper', dark ? 0.45 : 0.5, [paper]);
  const pad = dark ? 'py-[30px] @min-[640px]:py-[34px]' : 'py-[44px] @min-[640px]:py-[56px]';
  const art = decorOf(decor, colors, mode, artRefs);
  // Narrower pages: room along the band's top and foot for the pieces standing there (they start at its edge).
  const room = (px: number) => (px > 24 ? <div aria-hidden="true" className="@min-[1100px]:hidden" style={{ height: px - 24 }} /> : null);
  return (
    <section id={id} className={cx('bulava-reveal relative overflow-hidden', !bleed && 'px-6 @min-[1100px]:px-10', !bleed && pad, join === 'above' && 'pt-0 @min-[640px]:pt-0', BAND_CLASS[band], className)} style={{ ['--t-band' as string]: BAND_FILL[band] }}>
      <div className="pointer-events-none absolute inset-0" style={texture} aria-hidden="true" />
      {dark && join !== 'above' ? (
        <div className="pointer-events-none absolute inset-2.5 border border-[var(--t-line)]" aria-hidden="true">
          <Filigree className="absolute -top-px -left-px w-[26px] text-[var(--t-orn)]" />
          <Filigree className="absolute -top-px -right-px w-[26px] -scale-x-100 text-[var(--t-orn)]" />
          <Filigree className="absolute -bottom-px -left-px w-[26px] -scale-y-100 text-[var(--t-orn)]" />
          <Filigree className="absolute -right-px -bottom-px w-[26px] -scale-100 text-[var(--t-orn)]" />
        </div>
      ) : null}
      {art.layer}
      {room(art.top)}
      {bleed ? (
        children
      ) : (
        <div className={cx('relative mx-auto', wide ? 'max-w-[1240px]' : 'max-w-3xl')}>
          {heading ? <HeirloomHeading d={dress} heading={heading} eyebrow={eyebrow} script={script} /> : null}
          {children}
        </div>
      )}
      {room(art.bottom)}
    </section>
  );
}

/** A heirloom pill: the button and the disclosures' summaries (a 14 px arrow after the words). */
export const HEIRLOOM_PILL =
  'bulava-caps inline-flex min-h-11 items-center justify-center gap-2.5 rounded-full bg-[var(--t-button)] bg-[linear-gradient(to_bottom,rgb(255_255_255/0.06),rgb(255_255_255/0))] px-[30px] text-[12px] leading-none font-semibold tracking-[0.16em] uppercase text-[var(--t-on-button)] shadow-[0_10px_22px_-14px_rgba(112,37,43,0.65)] transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_14px_26px_-14px_rgba(112,37,43,0.75)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--t-accent)] @min-[640px]:min-h-[46px] @min-[640px]:text-[12.5px]';

/** The pill's arrow (or a chevron). */
export function PillArrow({ chevron = false }: { chevron?: boolean }) {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {chevron ? <path d="M5 2.5 9.5 7 5 11.5" /> : <path d="M2 7h10M8 3l4 4-4 4" />}
    </svg>
  );
}

/** Card surface in the look's style (glass on bands and noir, paper elsewhere). */
export function cardClass(look: LookName): string {
  switch (look) {
    case 'heirloom':
      return 'rounded-[var(--t-radius)] border border-[color-mix(in_srgb,var(--t-orn)_55%,transparent)] bg-[var(--t-card-alt)] shadow-[0_22px_44px_-34px_rgba(73,53,44,0.5)]';
    case 'noir':
      return 'rounded-[calc(var(--t-radius)*1.2)] border border-[var(--t-line)] bg-[var(--t-card)] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)] backdrop-blur-md';
    case 'garden':
      return 'rounded-[2rem] border border-[var(--t-line)] bg-[var(--t-card)] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)]';
    case 'modern':
      return 'rounded-none border-t-2 border-[var(--t-accent)] bg-[var(--t-card)]';
    case 'celebration':
      return 'rounded-3xl border-2 border-[var(--t-line)] bg-[var(--t-card)] shadow-[6px_6px_0_var(--t-line)]';
    case 'royal':
      return 'rounded-none border border-[var(--t-line)] bg-[var(--t-card)] shadow-sm';
    case 'heritage':
      return 'rounded-[var(--t-radius)] border border-[var(--t-line)] bg-[var(--t-card)] shadow-[0_14px_30px_-20px_rgba(0,0,0,0.5)] backdrop-blur-sm';
    default:
      return 'rounded-[var(--t-radius)] border border-[var(--t-line)] bg-[var(--t-card)] shadow-sm';
  }
}

/**
 * Splits "Ananya & Vihaan" so the ampersand can be set in the script face. Each line
 * carries `data-line` (name one, the ampersand, name two, or the single title): stage
 * heroes turn the names up in 3D by whole lines, never letters, so conjuncts stay whole.
 */
export function Names({ text, className, ampersandClassName }: { text: string; className?: string; ampersandClassName?: string }) {
  const parts = text.split(/\s+&\s+/);
  if (parts.length !== 2)
    return (
      <span className={className} data-line="">
        {text}
      </span>
    );
  return (
    <span className={cx('flex flex-col items-center', className)}>
      <span data-line="">{parts[0]}</span>
      <span className={cx('my-1 text-[0.6em] [font-family:var(--t-script)]', ampersandClassName ?? 'text-[var(--t-secondary-ink)]')} data-line="">
        &amp;
      </span>
      <span data-line="">{parts[1]}</span>
    </span>
  );
}

export function initials(text: string | undefined): string {
  if (!text) return '♥';
  const parts = text.split(/\s+&\s+|\s+and\s+/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  const words = text.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '♥';
}

/** Multi-line custom text: blank lines become paragraphs. */
export function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx('space-y-4 text-center leading-relaxed text-[var(--t-muted-ink)]', className)}>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}
