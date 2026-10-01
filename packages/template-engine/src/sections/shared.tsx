import type { CSSProperties, ReactNode } from 'react';
import type { LookName, ThemeColors } from '@bulava/template-schema';
import { Marigold, Toran } from '../art/motifs';
import { Divider, FloralCorner, patternStyle, type OrnamentName } from '../ornaments';
import type { SectionProps } from '../types';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

type Band = 'plain' | 'surface' | 'primary' | 'accent';

/**
 * Which band a section sits on. Looks alternate bands by position, so a page
 * reads as a sequence of distinct panels (heritage: crimson, saffron, ivory…);
 * the classic look keeps each section's own preference.
 */
function bandFor(look: LookName, index: number, tone: 'plain' | 'surface' | 'inverse'): Band {
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
    default:
      return tone === 'surface' ? 'surface' : tone === 'inverse' ? 'primary' : 'plain';
  }
}

const BAND_CLASS: Record<Band, string> = {
  plain: '',
  surface: 'bg-[var(--t-surface)]',
  primary: 'bulava-band-primary',
  accent: 'bulava-band-accent',
};

/** Common shell props from a section's props. */
export function shell(p: SectionProps) {
  return { id: p.instance.id, ornament: p.ornament, look: p.look, index: p.index, colors: p.colors };
}

/** Ornamental rule under headings, in the look's own vocabulary. */
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

/**
 * Standard section shell: consistent rhythm, reveal animation, a heading in
 * the look's style, and the look's band and decoration.
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
}) {
  const band = bandFor(look, index, tone);
  const toran = look === 'heritage' && band === 'accent';
  const bandPattern: CSSProperties | undefined = !colors
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
  const modernNumber = look === 'modern' ? String(index).padStart(2, '0') : null;

  const headingBlock = heading ? (
    <div className={cx(look === 'modern' ? 'mb-10 text-left' : 'mb-9 text-center')}>
      {modernNumber ? <p className="mb-3 text-sm font-semibold tracking-[0.3em] text-[var(--t-accent-ink)]">{modernNumber}</p> : null}
      {eyebrow ? <p className={cx('mb-2 text-xs font-semibold tracking-[0.35em] uppercase text-[var(--t-secondary-ink)]', look === 'modern' ? '' : 'text-center')}>{eyebrow}</p> : null}
      <h2
        className={cx(
          'leading-tight',
          look === 'heritage' && 'text-5xl [font-family:var(--t-script)] text-[var(--t-heading-ink)] sm:text-6xl',
          look === 'noir' && 'text-4xl italic [font-family:var(--t-heading)] sm:text-5xl',
          look === 'royal' && 'text-3xl tracking-[0.14em] uppercase [font-family:var(--t-heading)] text-[var(--t-heading-ink)] sm:text-4xl',
          look === 'garden' && 'text-5xl [font-family:var(--t-script)] text-[var(--t-heading-ink)]',
          look === 'celebration' && 'text-4xl font-bold [font-family:var(--t-heading)] sm:text-5xl',
          look === 'modern' && 'text-4xl tracking-tight [font-family:var(--t-heading)] sm:text-6xl',
          look === 'classic' && 'text-3xl [font-family:var(--t-heading)] sm:text-4xl',
        )}
      >
        {heading}
      </h2>
      <div className={cx('mt-4', look === 'modern' && 'flex')}>
        <LookDivider look={look} ornament={ornament} />
      </div>
    </div>
  ) : eyebrow ? (
    <p className="mb-6 text-center text-xs font-semibold tracking-[0.35em] uppercase text-[var(--t-secondary-ink)]">{eyebrow}</p>
  ) : null;

  const body = (
    <>
      {headingBlock}
      {children}
    </>
  );

  return (
    <section id={id} className={cx('bulava-reveal relative overflow-hidden px-6', toran ? 'pt-28 pb-16 sm:pt-32' : 'py-16 sm:py-24', BAND_CLASS[band], className)}>
      {bandPattern ? <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={bandPattern} aria-hidden="true" /> : null}
      {toran ? <Toran className="pointer-events-none absolute inset-x-0 top-0 mx-auto w-full max-w-[760px] bulava-sway-soft" swags={4} /> : null}
      {look === 'garden' ? (
        <>
          <FloralCorner className="pointer-events-none absolute top-0 left-0 w-32 text-[var(--t-secondary)] opacity-50 sm:w-44" />
          <FloralCorner className="pointer-events-none absolute top-0 right-0 w-32 -scale-x-100 text-[var(--t-secondary)] opacity-50 sm:w-44" />
        </>
      ) : null}
      {look === 'noir' ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-48 max-w-xl rounded-full opacity-25 blur-3xl" style={{ background: 'var(--t-accent)' }} aria-hidden="true" />
      ) : null}
      <div className={cx('relative mx-auto', wide ? 'max-w-5xl' : 'max-w-3xl')}>
        {look === 'royal' ? (
          <div className="relative border border-[var(--t-line)] px-5 py-12 sm:px-12">
            <div className="pointer-events-none absolute inset-2 border border-[var(--t-line)] opacity-60" aria-hidden="true" />
            <Filigree className="absolute -top-px -left-px w-12 text-[var(--t-accent)]" />
            <Filigree className="absolute -top-px -right-px w-12 -scale-x-100 text-[var(--t-accent)]" />
            <Filigree className="absolute -bottom-px -left-px w-12 -scale-y-100 text-[var(--t-accent)]" />
            <Filigree className="absolute -right-px -bottom-px w-12 -scale-100 text-[var(--t-accent)]" />
            <div className="relative">{body}</div>
          </div>
        ) : (
          body
        )}
      </div>
    </section>
  );
}

/** Card surface in the look's style (glass on bands and noir, paper elsewhere). */
export function cardClass(look: LookName): string {
  switch (look) {
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

/** Splits "Riya & Aman" so the ampersand can be set in the script face. */
export function Names({ text, className, ampersandClassName }: { text: string; className?: string; ampersandClassName?: string }) {
  const parts = text.split(/\s+&\s+/);
  if (parts.length !== 2) return <span className={className}>{text}</span>;
  return (
    <span className={cx('flex flex-col items-center', className)}>
      <span>{parts[0]}</span>
      <span className={cx('my-1 text-[0.6em] [font-family:var(--t-script)]', ampersandClassName ?? 'text-[var(--t-secondary-ink)]')}>&amp;</span>
      <span>{parts[1]}</span>
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
