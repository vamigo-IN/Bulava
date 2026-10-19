import { useId, type CSSProperties, type ReactNode } from 'react';
import type { ThemeColors } from '@bulava/template-schema';
import { SatinBow, SatinRibbon, ScallopTag, ZipperPull } from './art/illustrations-atelier';
import { hex, shade, tint } from './art/kit';
import { textureStyle } from './canvas/colors';
import { onFill } from './theme';

/**
 * Tactile covers over an invitation (ADR-074): a zipper the guest pulls open
 * and a satin ribbon they untie. Each is a pure drawing of one moment, from
 * `progress` (0 closed, 1 undone) and `release` (0 in place, 1 gone), so the
 * website's opening drives them from the guest's finger and a film from its
 * frame number, and both draw the same thing. Sizes are CSS pixels of the box
 * they cover; colours are the palette's (the fabric is the primary, the
 * zipper's metal the secondary, the tag the accent; the ribbon's card is the
 * surface and its satin the accent).
 */

export interface CoverProps {
  /** 0: closed; 1: fully undone. */
  progress: number;
  /** 0: in place; 1: moved off the screen (the invitation shows). */
  release: number;
  width: number;
  height: number;
  colors: ThemeColors;
  /** The couple's or the host's initials, on the tag. */
  monogram: string;
  /** CSS font stack for the monogram (var(--t-script) on websites). */
  script: string;
  /** CSS font stack for monograms set in capitals (the ribbon's card); the script's when absent. */
  heading?: string;
  /** The tag swings while the cover waits (the website; a film passes its own angle). */
  swing?: boolean | number;
  children?: ReactNode;
}

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const px = (n: number) => `${Math.round(n * 100) / 100}px`;
/** The monogram on a cover: a couple's initials joined ("R & A"), else the initials as they are. */
export function coverMonogram(names: { partnerOne: string; partnerTwo: string } | null | undefined, initials: string): string {
  const one = names?.partnerOne.trim()[0];
  const two = names?.partnerTwo.trim()[0];
  return one && two ? `${one} & ${two}`.toUpperCase() : initials;
}

/** A monogram's width in em when set in a script face, whose capitals and ampersand are wide with their swashes. */
const scriptWidth = (text: string) => [...text].reduce((w, ch) => w + (ch === ' ' ? 0.3 : ch === '&' ? 0.85 : ch === ch.toUpperCase() ? 1.15 : 0.6), 0);

/** Ease in and out (cubic): progress that starts and lands softly. */
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Where the slider sits at `progress` and how far apart the teeth stand above it. */
export function zipperGeometry(progress: number, width: number, height: number) {
  const top = Math.max(18, height * 0.035);
  const end = height + Math.max(140, height * 0.16);
  const slider = top + (end - top) * clamp(progress);
  // The V above the slider: closed at rest, opening as soon as the slider moves.
  const spread = 0.44 * clamp(progress * 7);
  const half = (y: number) => Math.min(width / 2 + 60, Math.max(0, slider - y) * spread);
  return { top, slider, half, unit: Math.min(width, height * 0.6) / 390 };
}

/** One edge of teeth from `a` (the top of the opening) to `b` (the slider), drawn on the left half (the right is its mirror). */
function OpenEdge({ a, b, pattern, shadow, unit }: { a: [number, number]; b: [number, number]; pattern: string; shadow: string; unit: number }) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Local x runs across the edge (into the opening), local y along it from the top.
  const m = `matrix(${uy} ${-ux} ${ux} ${uy} ${a[0]} ${a[1]})`;
  return (
    <g transform={m}>
      <rect x={4 * unit} y={0} width={20 * unit} height={len} fill={`url(#${shadow})`} />
      <rect x={-7 * unit} y={0} width={18 * unit} height={len} fill={`url(#${pattern})`} />
    </g>
  );
}

/** A zipper down the middle of fabric, pulled open by its scalloped tag. */
export function ZipperCover({ progress, release, width: W, height: H, colors, monogram, script, swing = false, children }: CoverProps) {
  const id = `z${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const fabric = hex(colors.primary);
  const metal = hex(colors.secondary);
  const tape = shade(fabric, 0.3);
  const { slider, half, unit } = zipperGeometry(progress, W, H);
  const cx = W / 2;
  const gapTop = half(0);
  const out = easeInOut(clamp(release));
  const shift = out * (W / 2 + 80);
  const pitch = 8.4 * unit;
  const tooth = 5.2 * unit;
  const reach = 8.6 * unit;
  const leftClip = `polygon(0 0, ${px(cx - gapTop)} 0, ${px(cx)} ${px(slider)}, ${px(cx)} ${px(H)}, 0 ${px(H)})`;
  const rightClip = `polygon(${px(cx + gapTop)} 0, ${px(W)} 0, ${px(W)} ${px(H)}, ${px(cx)} ${px(H)}, ${px(cx)} ${px(slider)})`;
  const cloth: CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundColor: fabric,
    backgroundImage: `radial-gradient(120% 80% at 30% 18%, ${tint(fabric, 0.16)}, transparent 60%), radial-gradient(140% 90% at 70% 100%, ${shade(fabric, 0.22)}, transparent 70%)`,
  };
  const weave: CSSProperties = { position: 'absolute', inset: 0, ...textureStyle('linen', 0.95, [fabric]) };
  const pullW = 34 * unit;
  const pullH = (pullW * 140) / 60;
  const tagW = Math.min(W * 0.46, 180 * unit);
  const tagH = (tagW * 260) / 200;
  const tagTop = slider + pullH * 0.86;
  const angle = typeof swing === 'number' ? swing : 0;
  const ink = onFill(colors.accent, [colors.primary, colors.text, colors.background]);
  const fade = 1 - out;

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, clipPath: leftClip, transform: `translateX(${px(-shift)})`, opacity: fade }}>
        <div style={cloth} />
        <div style={weave} />
      </div>
      <div style={{ position: 'absolute', inset: 0, clipPath: rightClip, transform: `translateX(${px(shift)})`, opacity: fade }}>
        <div style={cloth} />
        <div style={weave} />
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, opacity: fade }}>
        <defs>
          <linearGradient id={`${id}m`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={tint(metal, 0.55)} />
            <stop offset="0.35" stopColor={metal} />
            <stop offset="0.75" stopColor={shade(metal, 0.18)} />
            <stop offset="1" stopColor={shade(metal, 0.45)} />
          </linearGradient>
          {/* An open edge: tape on the fabric side, one row of teeth reaching into the opening. */}
          <pattern id={`${id}e`} patternUnits="userSpaceOnUse" width={18 * unit} height={pitch} x={-7 * unit} y={0}>
            <rect x={0} y={0} width={7 * unit} height={pitch} fill={tape} />
            <rect x={5 * unit} y={(pitch - tooth) / 2} width={reach} height={tooth} rx={tooth * 0.42} fill={`url(#${id}m)`} />
            <rect x={6.5 * unit} y={(pitch - tooth) / 2 + tooth * 0.14} width={reach * 0.6} height={tooth * 0.18} fill={tint(metal, 0.8)} opacity="0.55" />
          </pattern>
          <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000000" stopOpacity="0.38" />
            <stop offset="1" stopColor="#000000" stopOpacity="0" />
          </linearGradient>
          {/* The closed zipper below the slider: tapes either side, teeth interlocking. */}
          <pattern id={`${id}c`} patternUnits="userSpaceOnUse" width={28 * unit} height={pitch} x={cx - 14 * unit} y={0}>
            <rect x={0} y={0} width={7 * unit} height={pitch} fill={tape} />
            <rect x={21 * unit} y={0} width={7 * unit} height={pitch} fill={tape} />
            <rect x={5 * unit} y={0} width={reach + 4 * unit} height={tooth} rx={tooth * 0.42} fill={`url(#${id}m)`} />
            <rect x={23 * unit - reach - 4 * unit} y={pitch / 2} width={reach + 4 * unit} height={tooth} rx={tooth * 0.42} fill={`url(#${id}m)`} />
            <rect x={6.5 * unit} y={tooth * 0.14} width={reach * 0.6} height={tooth * 0.18} fill={tint(metal, 0.8)} opacity="0.55" />
          </pattern>
        </defs>
        {slider < H ? <rect x={cx - 14 * unit} y={slider} width={28 * unit} height={H - slider} fill={`url(#${id}c)`} /> : null}
        <g transform={`translate(${-shift} 0)`}>
          <OpenEdge a={[cx - gapTop, 0]} b={[cx, Math.min(slider, H + 200)]} pattern={`${id}e`} shadow={`${id}s`} unit={unit} />
        </g>
        <g transform={`translate(${W + shift} 0) scale(-1 1)`}>
          <OpenEdge a={[cx - gapTop, 0]} b={[cx, Math.min(slider, H + 200)]} pattern={`${id}e`} shadow={`${id}s`} unit={unit} />
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: cx - tagW / 2,
          top: slider - pullH * 0.08,
          width: tagW,
          height: tagTop - slider + tagH,
          opacity: fade,
          transformOrigin: `${tagW / 2}px ${pullH * 0.08}px`,
          transform: `rotate(${angle}deg)`,
          animation: swing === true ? 'bulava-sway 3.4s ease-in-out infinite' : undefined,
        }}
      >
        <ZipperPull color={metal} colors={colors} foil w={60} h={140} style={{ position: 'absolute', left: (tagW - pullW) / 2, top: 0, width: pullW, height: pullH }} />
        <div style={{ position: 'absolute', left: 0, top: tagTop - slider + pullH * 0.08 - tagH * 0.11, width: tagW, height: tagH, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.28))' }}>
          <ScallopTag color={colors.accent} colors={colors} foil w={200} h={260} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          <span
            style={{
              position: 'absolute',
              left: '18%',
              right: '18%',
              top: '36%',
              height: '38%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: script,
              // Inside the tag's label, however wide the initials are.
              fontSize: Math.min(tagW * 0.26, (tagW * 0.6) / Math.max(1, scriptWidth(monogram))),
              lineHeight: 1,
              color: ink,
              whiteSpace: 'nowrap',
            }}
          >
            {monogram}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

/** How far the ribbon's pieces have gone at `progress`: the bow unties first, then the band slides away. */
export function ribbonGeometry(progress: number) {
  const p = clamp(progress);
  const untie = easeInOut(clamp(p / 0.6));
  const slide = easeInOut(clamp((p - 0.5) / 0.5));
  return { untie, slide };
}

/** A card tied with satin: the bow unties and the ribbon slides away. */
export function RibbonCover({ progress, release, width: W, height: H, colors, monogram, script, heading, swing = false, children }: CoverProps) {
  const card = hex(colors.surface);
  const satin = hex(colors.accent);
  const { untie, slide } = ribbonGeometry(progress);
  const out = easeInOut(clamp(release));
  const unit = Math.min(W, H * 0.6) / 390;
  const band = Math.max(40, 52 * unit);
  const bowW = Math.min(W * 0.7, 270 * unit);
  const bowH = (bowW * 210) / 300;
  const knotY = H * 0.56;
  const ink = onFill(colors.surface, [colors.primary, colors.text]);
  const angle = typeof swing === 'number' ? swing : 0;
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translateY(${px(-out * (H + 40))})`,
          backgroundColor: card,
          backgroundImage: `radial-gradient(120% 70% at 30% 12%, ${tint(card, 0.4)}, transparent 60%), radial-gradient(130% 90% at 70% 100%, ${shade(card, 0.08)}, transparent 70%)`,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, ...textureStyle('linen', 0.7, [card]) }} />
        <div style={{ position: 'absolute', inset: Math.max(14, W * 0.04), border: `1px solid ${shade(card, 0.16)}`, borderRadius: 4 }} />
        <span
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: H * 0.24,
            textAlign: 'center',
            fontFamily: heading ?? script,
            fontSize: (heading ? 44 : 64) * unit,
            letterSpacing: heading ? '0.08em' : undefined,
            lineHeight: 1,
            color: ink,
            opacity: 1 - untie * 0.4,
          }}
        >
          {monogram}
        </span>
        <div style={{ position: 'absolute', left: 0, top: knotY - band / 2, width: W, height: band, transform: `translateY(${px(slide * (H - knotY + band))})`, opacity: 1 - slide, boxShadow: '0 6px 12px -6px rgba(0,0,0,0.3)' }}>
          <SatinRibbon color={satin} colors={colors} w={W} h={band} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: (W - bowW) / 2,
            top: knotY - bowH * 0.45,
            width: bowW,
            height: bowH,
            transformOrigin: '50% 45%',
            transform: `translateY(${px(slide * (H * 0.7))}) rotate(${angle + untie * 18}deg) scale(${1 - untie * 0.55})`,
            opacity: 1 - slide,
            animation: swing === true && untie === 0 ? 'bulava-sway 4s ease-in-out infinite' : undefined,
            filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.22))',
          }}
        >
          <SatinBow color={satin} colors={colors} w={300} h={210} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>
      </div>
      {children}
    </div>
  );
}
