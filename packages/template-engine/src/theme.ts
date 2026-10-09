import type { CSSProperties } from 'react';
import { AA_TEXT, contrastRatio, ensureContrast, type FontRef, type Fonts, type Theme, type ThemeColors } from '@bulava/template-schema';

/**
 * Fonts are loaded by the host app (next/font) and exposed as CSS variables.
 * The engine only references the variables, with the family name as fallback
 * so non-Next hosts still render sensibly.
 */
export const FONT_CSS_VARS: Record<string, string> = {
  'Playfair Display': '--font-playfair',
  'Cormorant Garamond': '--font-cormorant',
  'Great Vibes': '--font-great-vibes',
  Poppins: '--font-poppins',
  'Noto Sans': '--font-noto-sans',
  'Noto Serif': '--font-noto-serif',
  'Noto Sans Devanagari': '--font-noto-devanagari',
  'Noto Serif Devanagari': '--font-noto-serif-devanagari',
  'Tiro Devanagari Hindi': '--font-tiro-devanagari',
  Cinzel: '--font-cinzel',
  'Pinyon Script': '--font-pinyon',
  Parisienne: '--font-parisienne',
  'Alex Brush': '--font-alex-brush',
  Marcellus: '--font-marcellus',
  Montserrat: '--font-montserrat',
  Italiana: '--font-italiana',
  'Yeseva One': '--font-yeseva',
  'Rozha One': '--font-rozha',
  'Yatra One': '--font-yatra',
  'Baloo 2': '--font-baloo',
  Pacifico: '--font-pacifico',
};

const family = (name: string) => `var(${FONT_CSS_VARS[name] ?? '--font-none'}, '${name}')`;

/** Font stack: primary family, then per-script fallbacks, then generic families. */
export function fontStack(ref: FontRef | undefined, generic: 'serif' | 'sans-serif' | 'cursive'): string {
  if (!ref) return generic;
  const fallbacks = Object.values(ref.fallbacks ?? {});
  const devanagari = generic === 'sans-serif' ? 'Noto Sans Devanagari' : 'Noto Serif Devanagari';
  return [family(ref.family), ...fallbacks.map(family), family(devanagari), generic].join(', ');
}

/** Mix two #rrggbb colours (0 = a, 1 = b). */
export function mix(a: string, b: string, amount: number): string {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - amount) + ((pb >> shift) & 255) * amount);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Text for a coloured fill: start from whichever palette colour already
 * contrasts most with it (so a dark palette gets its own cream text, not a
 * nudged grey), then nudge only if still needed.
 */
function onFill(fill: string, candidates: string[]): string {
  const best = candidates.reduce((a, b) => (contrastRatio(b, fill) > contrastRatio(a, fill) ? b : a));
  return ensureContrast(best, [fill], AA_TEXT);
}

/**
 * CSS custom properties consumed by every section (Tailwind arbitrary values read them).
 *
 * `--t-*` are the designed colours, used for ornaments, borders and fills.
 * Text uses the `-ink` variants: the same colours nudged just enough to be
 * readable (WCAG AA) on the page background and surfaces, and `--t-on-*` for
 * text placed on primary or secondary fills. Palettes that already pass are
 * unchanged, and customers' custom colours stay legible.
 *
 * Bands: some looks set whole sections on the primary or accent colour. For
 * those, `--bp-*` (primary band) and `--ba-*` (accent band) hold inks computed
 * against that colour; the band classes swap them in, so sections never need
 * to know which background they sit on.
 */
export function themeStyle(theme: Theme, colors: ThemeColors, fonts: Fonts): CSSProperties {
  const page = [colors.background, colors.surface];
  const ink = (c: string) => ensureContrast(c, page, AA_TEXT);
  const text = ink(colors.text);
  // Glass cards on a band lighten it slightly; check inks against both.
  const onBand = (c: string, band: string) => ensureContrast(c, [band, mix(band, '#ffffff', 0.1)], AA_TEXT);
  const bp = colors.primary;
  const ba = colors.accent;
  return {
    ['--t-primary' as string]: colors.primary,
    ['--t-secondary' as string]: colors.secondary,
    ['--t-accent' as string]: colors.accent,
    ['--t-bg' as string]: colors.background,
    ['--t-surface' as string]: colors.surface,
    ['--t-text' as string]: text,
    ['--t-muted' as string]: colors.muted,
    ['--t-primary-ink' as string]: ink(colors.primary),
    ['--t-secondary-ink' as string]: ink(colors.secondary),
    ['--t-accent-ink' as string]: ink(colors.accent),
    ['--t-muted-ink' as string]: ink(colors.muted),
    // Section headings in looks that colour them (bands swap in their own).
    ['--t-heading-ink' as string]: ink(colors.primary),
    ['--t-on-primary' as string]: onFill(colors.primary, [colors.background, colors.text, colors.surface]),
    ['--t-accent-on-primary' as string]: ensureContrast(colors.accent, [colors.primary], AA_TEXT),
    ['--t-on-secondary' as string]: onFill(colors.secondary, [colors.background, colors.text, colors.surface]),
    ['--t-on-accent' as string]: onFill(colors.accent, [colors.text, colors.primary, colors.background]),
    // Cards and hairlines (bands override these).
    ['--t-card' as string]: colors.background,
    ['--t-card-alt' as string]: colors.surface,
    ['--t-line' as string]: `${colors.secondary}59`,
    ['--t-button' as string]: colors.primary,
    ['--t-on-button' as string]: onFill(colors.primary, [colors.background, colors.text, colors.surface]),
    // Primary band.
    ['--bp-text' as string]: onBand(contrastRatio(colors.text, bp) > contrastRatio(colors.background, bp) ? colors.text : colors.background, bp),
    ['--bp-muted' as string]: onBand(mix(colors.background, bp, 0.25), bp),
    ['--bp-primary-ink' as string]: onBand(colors.accent, bp),
    ['--bp-secondary-ink' as string]: onBand(colors.accent, bp),
    ['--bp-accent-ink' as string]: onBand(colors.accent, bp),
    ['--bp-button' as string]: colors.accent,
    ['--bp-on-button' as string]: ensureContrast(bp, [colors.accent], AA_TEXT),
    // Accent band.
    ['--ba-text' as string]: onBand(colors.text, ba),
    ['--ba-muted' as string]: onBand(colors.muted, ba),
    ['--ba-primary-ink' as string]: onBand(colors.primary, ba),
    ['--ba-secondary-ink' as string]: onBand(colors.primary, ba),
    ['--ba-accent-ink' as string]: onBand(colors.primary, ba),
    ['--ba-button' as string]: colors.primary,
    ['--ba-on-button' as string]: onFill(colors.primary, [colors.background, colors.text, colors.surface]),
    // Noir: gold buttons and glass cards (set here, because inline variables win over classes).
    ...(theme.look === 'noir'
      ? {
          ['--t-button' as string]: colors.accent,
          ['--t-on-button' as string]: onFill(colors.accent, [colors.primary, colors.background, colors.text]),
          ['--t-card' as string]: 'rgb(255 255 255 / 0.05)',
          ['--t-card-alt' as string]: 'rgb(255 255 255 / 0.08)',
          ['--t-line' as string]: `${colors.accent}4d`,
        }
      : {}),
    ['--t-radius' as string]: `${theme.radius}px`,
    ['--t-heading' as string]: fontStack(fonts.heading, 'serif'),
    ['--t-body' as string]: fontStack(fonts.body, 'sans-serif'),
    ['--t-script' as string]: fontStack(fonts.script ?? fonts.heading, fonts.script ? 'cursive' : 'serif'),
    backgroundColor: colors.background,
    color: text,
    fontFamily: 'var(--t-body)',
  };
}

/** Relative luminance, used to pick readable text on coloured surfaces. */
export function isDark(hex: string): boolean {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.35;
}
