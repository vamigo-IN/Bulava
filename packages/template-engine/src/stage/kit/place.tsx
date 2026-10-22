import { createElement, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import type { IllustrationName, ThemeColors } from '@bulava/template-schema';
import { FRAME_SIZED, Illustration, ILLUSTRATION_ASPECT } from '../../art/illustrations';
import { Balloon, Bell, Birds, Chhatri, Cloud, Diya, Dome, KadambaTree, Kalash, LotusBloom, MarigoldStrand, Moon, Palm, r2, Toran } from '../../art/motifs';
import { Crescent, Lantern, StarField } from '../../ornaments-signature';
import type { Draw, DrawProps, PlaneRecipe } from '../types';

/**
 * Existing art placed as stage pieces (final.md §1.5): illustrations and
 * motifs fitted to a piece's box and tinted from its (hazed) palette. Also the
 * kit's shared registry type and `drawWith`, which turns a kit component and
 * its options into a piece's `draw`.
 *
 * Fitting: art keeps its proportions. A box within a few percent of the art's
 * aspect is filled exactly (a slight stretch); otherwise the art is fitted
 * inside it, centred across, standing on the box's foot (hanging art: from its
 * top). Garlands, strings and frames (FRAME_SIZED) are drawn to the box itself.
 * The wrapper re-declares the palette variables (--t-*) from the hazed colours,
 * so art that paints with var(--t-…) takes the haze too.
 */

/** A kit piece in the registry: what sheets, budgets and the Studio know of it. */
export interface KitEntry {
  /** The component's name, as kit/index.ts exports it. */
  name: string;
  file: 'surfaces' | 'architecture' | 'lights' | 'nature';
  /** Its variants, the first the default ('' for a piece without variants). */
  variants: readonly string[];
  /** The default box (units) of a variant. */
  box: (variant: string) => { w: number; h: number };
  /** Draws the variant (with sample options for a sheet). */
  render: (p: DrawProps, variant: string) => ReactNode;
  /** Planes: the recipe the piece is drawn for. */
  plane?: PlaneRecipe['kind'];
}

/** A kit component with its options as a piece's draw: `draw: drawWith(Pillar, { variant: 'granite' })`. */
export function drawWith<O extends object>(Component: ComponentType<DrawProps & O>, options: O): Draw {
  return (p) => createElement(Component, { ...p, ...options });
}

type Tint = 'primary' | 'secondary' | 'accent' | `#${string}`;
const PALETTE_KEYS = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted'] as const;

const hx = (c: string) => (/^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7) : '#9a8a78');

/** A palette key or a colour, resolved against the piece's (hazed) palette. */
function tintOf(colors: ThemeColors, tint: string | undefined, fallback: keyof ThemeColors): string {
  if (tint && (PALETTE_KEYS as readonly string[]).includes(tint)) return hx(colors[tint as keyof ThemeColors]);
  return tint && /^#[0-9a-f]{6}$/i.test(tint) ? tint : hx(colors[fallback]);
}

const FILL = { width: '100%', height: '100%', display: 'block' } as const;
type Align = 'top' | 'bottom' | 'center';

/** The piece's box, with the palette variables re-declared from the hazed colours. */
function frame(colors: ThemeColors, child: ReactNode): ReactNode {
  const style = {
    position: 'relative',
    width: '100%',
    height: '100%',
    '--t-primary': colors.primary,
    '--t-secondary': colors.secondary,
    '--t-accent': colors.accent,
    '--t-bg': colors.background,
    '--t-surface': colors.surface,
    '--t-text': colors.text,
    '--t-muted': colors.muted,
  } as CSSProperties;
  return createElement('div', { style }, child);
}

const pct = (v: number) => `${r2(v * 100)}%`;

/**
 * Where art of proportions `aspect` (w / h) sits in a w×h box: filled exactly
 * when the box is within `stretch` of its aspect, else fitted and aligned.
 */
function placed(aspect: number, w: number, h: number, align: Align, stretch: number): CSSProperties {
  const fw = Math.min(w, h * aspect);
  const fh = Math.min(h, w / aspect);
  const sx = w / fw;
  const sy = h / fh;
  if (Math.max(sx, sy) <= 1 + stretch) {
    const exact = Math.max(sx, sy) < 1.005;
    return { position: 'absolute', left: 0, top: 0, width: pct(fw / w), height: pct(fh / h), transform: exact ? undefined : `scale(${r2(sx)}, ${r2(sy)})`, transformOrigin: '0 0' };
  }
  const top = align === 'top' ? 0 : align === 'bottom' ? (h - fh) / h : (h - fh) / 2 / h;
  return { position: 'absolute', left: pct((w - fw) / 2 / w), top: pct(top), width: pct(fw / w), height: pct(fh / h) };
}

/** An illustration's proportions (w / h): give its piece a box of this aspect. */
export const illusAspect = (name: IllustrationName): number => ILLUSTRATION_ASPECT[name];

/** Illustrations that hang from the top of their box. */
const HANGING = new Set<IllustrationName>(['templeBells', 'weddingBells', 'ghungroo', 'jasmineStrand', 'marigoldSwag', 'bunting', 'fairyLights']);

/** The natural tint of an illustration placed without one (leaves stay green, the elephant caparisoned in the accent). */
function naturalTint(name: IllustrationName, p: DrawProps): string {
  switch (name) {
    case 'bananaLeaf':
      return hx(p.nature.leaf);
    case 'elephant':
      return hx(p.colors.accent);
    default:
      return hx(p.colors.secondary);
  }
}

/** An existing illustration as a piece, tinted from the palette (ILLUSTRATION_ASPECT gives its proportions). */
export function illus(name: IllustrationName, tint?: Tint, opts?: { foil?: boolean }): Draw {
  return (p) => {
    const color = tint ? tintOf(p.colors, tint, 'secondary') : naturalTint(name, p);
    const sized = FRAME_SIZED.has(name);
    const style: CSSProperties = sized ? { position: 'absolute', inset: 0 } : placed(ILLUSTRATION_ASPECT[name] ?? p.w / p.h, p.w, p.h, HANGING.has(name) ? 'top' : 'bottom', 0.08);
    return frame(p.colors, createElement('div', { style }, createElement(Illustration, { name, color, colors: p.colors, foil: opts?.foil, w: p.w, h: p.h, style: FILL })));
  };
}

export type MotifName = 'toran' | 'marigoldStrand' | 'diya' | 'kalash' | 'birds' | 'lantern' | 'crescent' | 'starField' | 'moon' | 'bell' | 'palm' | 'cloud' | 'dome' | 'chhatri' | 'kadambaTree' | 'lotusBloom' | 'balloon';

/** Positioned motifs (drawn at an origin): the viewBox that frames each, and where it sits in its box. */
const FRAMED: Partial<Record<MotifName, { box: string; align: Align }>> = {
  bell: { box: '-15 0 30 43', align: 'top' },
  palm: { box: '-82 -6 174 212', align: 'bottom' },
  cloud: { box: '8 -2 110 42', align: 'center' },
  dome: { box: '-2 -10 104 132', align: 'bottom' },
  chhatri: { box: '-2 -32 104 174', align: 'bottom' },
  kadambaTree: { box: '-168 -342 350 344', align: 'bottom' },
  lotusBloom: { box: '-52 -60 104 66', align: 'bottom' },
  balloon: { box: '-36 -4 72 162', align: 'center' },
  moon: { box: '-50 -50 100 100', align: 'center' },
};

/** Self-contained motif SVGs: their proportions, where they sit, how much they may stretch. */
const SIZED: Partial<Record<MotifName, { aspect: number; align: Align; stretch: number }>> = {
  toran: { aspect: 400 / 120, align: 'top', stretch: 0.25 },
  diya: { aspect: 1, align: 'bottom', stretch: 0.08 },
  kalash: { aspect: 100 / 130, align: 'bottom', stretch: 0.1 },
  birds: { aspect: 200 / 60, align: 'center', stretch: 0.4 },
  lantern: { aspect: 60 / 120, align: 'bottom', stretch: 0.15 },
  crescent: { aspect: 1, align: 'center', stretch: 0.05 },
  starField: { aspect: 200 / 120, align: 'center', stretch: 1 },
};

const ALIGN_SVG: Record<Align, string> = { top: 'xMidYMin meet', bottom: 'xMidYMax meet', center: 'xMidYMid meet' };

/** A motif from art/motifs.tsx or ornaments-signature.tsx, fitted to the box (self-contained SVGs are sized; positioned ones are wrapped in a viewBox). */
export function motif(name: MotifName, opts?: { count?: number; tint?: string }): Draw {
  return (p) => {
    const color = tintOf(p.colors, opts?.tint, 'secondary');
    const own = (aspect: number, align: Align, stretch: number, node: ReactNode) => frame(p.colors, createElement('div', { style: { ...placed(aspect, p.w, p.h, align, stretch), color } }, node));
    const sized = { style: FILL };
    if (name === 'marigoldStrand') {
      // As many marigolds as fill the box's height at its width (a strand hangs from its top).
      const count = opts?.count ?? Math.max(3, Math.round(((p.h / Math.max(1, p.w)) * 24 - 40) / 13));
      return own(24 / (count * 13 + 40), 'top', 0.25, createElement(MarigoldStrand, { ...sized, count }));
    }
    const fit = SIZED[name];
    if (fit) {
      const node =
        name === 'toran'
          ? createElement(Toran, { ...sized, swags: opts?.count ?? 5 })
          : name === 'diya'
            ? createElement(Diya, sized)
            : name === 'kalash'
              ? createElement(Kalash, sized)
              : name === 'birds'
                ? createElement(Birds, sized)
                : name === 'lantern'
                  ? createElement(Lantern, sized)
                  : name === 'crescent'
                    ? createElement(Crescent, sized)
                    : createElement(StarField, { ...sized, count: opts?.count ?? 26 });
      return own(fit.aspect, fit.align, fit.stretch, node);
    }
    const tinted = opts?.tint ? color : undefined;
    const inner = (() => {
      switch (name) {
        case 'bell':
          return createElement(Bell, { x: 0, y: 0 });
        case 'palm':
          return createElement(Palm, { x: 0, y: 200, h: 160, lean: 8, color: tinted ?? hx(p.nature.leafDark) });
        case 'cloud':
          return createElement(Cloud, { x: 0, y: 0, w: 120, opacity: 1 });
        case 'dome':
          return createElement(Dome, { x: 50, baseY: 120, w: 100, fill: color, gold: hx(p.colors.secondary) });
        case 'chhatri':
          return createElement(Chhatri, { x: 50, baseY: 140, w: 100, fill: color, gold: hx(p.colors.secondary) });
        case 'kadambaTree':
          return createElement(KadambaTree, { x: 0, y: 0, size: 1, color: tinted ?? hx(p.nature.leaf) });
        case 'lotusBloom':
          return createElement(LotusBloom, { x: 0, y: 0, tinted: !!opts?.tint });
        case 'balloon':
          return createElement(Balloon, { x: 0, y: 0, color: tinted ?? hx(p.colors.accent) });
        case 'moon':
          return createElement(Moon, { x: 0, y: 0, r: 20, color: tinted ?? '#fff6d8' });
        default:
          return null;
      }
    })();
    const framed = FRAMED[name] ?? { box: `0 0 ${p.w} ${p.h}`, align: 'center' as Align };
    return frame(
      p.colors,
      createElement('svg', { viewBox: framed.box, preserveAspectRatio: ALIGN_SVG[framed.align], 'aria-hidden': true, style: { ...FILL, color, overflow: 'visible' } }, inner),
    );
  };
}
