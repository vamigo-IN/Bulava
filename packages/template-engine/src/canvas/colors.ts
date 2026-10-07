import type { CSSProperties } from 'react';
import { AA_TEXT, ensureContrast, fillSolidColors, FONT_FAMILIES, solidColorOf, type ColorRef, type Fill, type RenderContext, type ThemeColors } from '@bulava/template-schema';
import { artworkAssetUrl } from '../art/scenes';
import { patternStyle } from '../ornaments';
import { fontStack } from '../theme';

/** A colour reference as CSS: palette names follow the host's colours. */
export function resolveColor(ref: ColorRef | undefined, colors: ThemeColors, fallback = 'transparent'): string {
  if (!ref) return fallback;
  if (ref === 'transparent') return 'transparent';
  if (ref.startsWith('#')) return ref;
  return colors[ref as keyof ThemeColors] ?? fallback;
}

/** #rrggbb for contrast maths (alpha or transparent → null). */
export function solidHex(ref: ColorRef | undefined, colors: ThemeColors): string | null {
  return ref ? solidColorOf(ref, colors) : null;
}

/** The solid colours behind a fill, for contrast: null when the fill is an image or see-through. */
export function fillBackdrop(fill: Fill, colors: ThemeColors): string[] | null {
  return fillSolidColors(fill, colors);
}

/**
 * Text colour over a fill: nudged toward readable (WCAG AA) on the fill's
 * colours when the designer kept contrast correction on, as every other
 * template text is. Over images the chosen colour is used as is.
 */
export function textInk(ref: ColorRef, backdrop: string[] | null, colors: ThemeColors, correct: boolean): string {
  const css = resolveColor(ref, colors, colors.text);
  if (!correct || !backdrop || !css.startsWith('#')) return css;
  const alpha = css.length === 9 ? css.slice(7) : '';
  return ensureContrast(css.slice(0, 7), backdrop, AA_TEXT) + alpha;
}

/** CSS for a fill. `assetWidth` picks the rendition for image fills. */
export function fillStyle(fill: Fill, colors: ThemeColors, ctx?: Pick<RenderContext, 'assets'>, assetWidth: 1200 | 2400 = 1200): CSSProperties {
  switch (fill.type) {
    case 'none':
      return {};
    case 'color':
      return { background: resolveColor(fill.color, colors) };
    case 'gradient':
      return { background: `linear-gradient(${fill.gradient.angle}deg, ${resolveColor(fill.gradient.from, colors)}, ${resolveColor(fill.gradient.to, colors)})` };
    case 'pattern':
      return { ...patternStyle(fill.pattern, resolveColor(fill.color, colors), fill.strength), backgroundColor: resolveColor(fill.base, colors) };
    case 'image': {
      const url = artworkAssetUrl(fill.assetId, assetWidth, ctx);
      const overlay = fill.overlay ? `linear-gradient(${resolveColor(fill.overlay, colors)}, ${resolveColor(fill.overlay, colors)}), ` : '';
      return { backgroundImage: `${overlay}url("${url}")`, backgroundSize: fill.fit, backgroundPosition: 'center', backgroundRepeat: 'no-repeat' };
    }
    default:
      return {};
  }
}

const SCRIPT_FAMILIES = new Set(['Great Vibes', 'Pinyon Script', 'Parisienne', 'Alex Brush']);
const SANS_FAMILIES = new Set(['Poppins', 'Noto Sans', 'Montserrat', 'Noto Sans Devanagari']);

/** A font role (the theme's CSS variables, which follow the host's pairing) or a fixed family, as a CSS font stack. */
export function fontFamilyFor(font: string): string {
  if (font === 'heading') return 'var(--t-heading)';
  if (font === 'body') return 'var(--t-body)';
  if (font === 'script') return 'var(--t-script)';
  if (!(FONT_FAMILIES as readonly string[]).includes(font)) return 'var(--t-body)';
  const generic = SCRIPT_FAMILIES.has(font) ? 'cursive' : SANS_FAMILIES.has(font) ? 'sans-serif' : 'serif';
  // fontStack adds the Devanagari fallback for the generic family itself.
  return fontStack({ family: font as (typeof FONT_FAMILIES)[number], scripts: ['Latn'], fallbacks: {} }, generic);
}
