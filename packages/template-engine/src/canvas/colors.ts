import type { CSSProperties } from 'react';
import { AA_TEXT, ensureContrast, fillSolidColors, FONT_FAMILIES, solidColorOf, type Artboard, type ColorRef, type Fill, type RenderContext, type ThemeColors } from '@bulava/template-schema';
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
    case 'gradient': {
      const g = fill.gradient;
      const stops = [g.from, ...(g.via ? [g.via] : []), g.to].map((ref) => resolveColor(ref, colors)).join(', ');
      return { background: g.kind === 'radial' ? `radial-gradient(ellipse at 50% 50%, ${stops})` : `linear-gradient(${g.angle}deg, ${stops})` };
    }
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

/** Fractal noise as a tile: `alpha` is how much of the noise shows, in a neutral grey. */
const noise = (size: number, frequency: string, octaves: number, alpha: number, offset: number, seed = 3) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'%3E%3Cfilter id='n' x='0' y='0'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 ${alpha} ${offset}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/**
 * The stock a card is printed on, over the whole artboard: grain, paper fibres,
 * a linen weave or watercolour blooms. Soft light keeps colours and only adds
 * texture, on light and dark cards alike.
 */
export function textureStyle(texture: Artboard['texture'], strength: number, backdrop: string[] | null): CSSProperties {
  const dark = backdrop?.[0] ? Number.parseInt(backdrop[0].slice(1, 3), 16) + Number.parseInt(backdrop[0].slice(3, 5), 16) + Number.parseInt(backdrop[0].slice(5, 7), 16) < 300 : false;
  const amount = Math.max(0, Math.min(1, strength));
  switch (texture) {
    case 'grain':
      return { backgroundImage: noise(180, '0.85', 2, 1.4, -0.35), mixBlendMode: 'soft-light', opacity: amount };
    case 'paper':
      return {
        backgroundImage: `${noise(220, '0.9', 1, 0.9, -0.25, 5)}, ${noise(420, '0.012 0.04', 4, 1.1, -0.45, 9)}`,
        mixBlendMode: dark ? 'soft-light' : 'multiply',
        opacity: amount * (dark ? 1 : 0.32),
      };
    case 'linen':
      return { backgroundImage: `${noise(160, '0.02 0.9', 2, 1.4, -0.45, 2)}, ${noise(160, '0.9 0.02', 2, 1.4, -0.45, 4)}`, mixBlendMode: 'soft-light', opacity: amount };
    case 'watercolor':
      return { backgroundImage: noise(700, '0.006', 3, 2.2, -0.75, 11), mixBlendMode: 'soft-light', opacity: amount, backgroundSize: '700px 700px' };
    default:
      return {};
  }
}
