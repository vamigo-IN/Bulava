import { createElement, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { ThemeColors } from '@bulava/template-schema';
import { mix } from '../theme';
import { Fountain, LampPost, Pillar, Stall } from '../stage/kit/architecture';
import { FAVOURITE_BOXES, FerrisStand, FerrisWheel, HotAirBalloon, LampTower } from '../stage/kit/favourites';
import { Chandelier, HangingLantern, LampStand, SacredFire } from '../stage/kit/lights';
import { BananaPlant, Planter } from '../stage/kit/nature';
import type { DrawProps, KeyLight } from '../stage/types';
import { hex, NATURE, shade, tint, useSafeId, type IllustrationProps } from './kit';

/**
 * Props from the Signature 3D stages (stage/kit, final.md §6.5) as canvas
 * illustrations: a chandelier, a candelabra, a lamp post, a hanging lantern, a
 * carved pillar, a fountain, a potted palm, a banana plant, a sacred fire and a
 * sweet stall. Each draws the kit piece itself in its default box, lit from
 * the left, at full detail and with one fixed seed, so the editor, previews
 * and the card export draw the same picture. The tint takes the piece's main
 * colour slot (its metal, stone, water, awning or leaves); the rest is the
 * palette, and flames and leaves keep NATURE.
 *
 * Kit pieces name their gradients from a hash of what they draw, so two layers
 * of one piece in one palette would share ids. Every id (and every url(#…) and
 * href to it) is suffixed with the layer's own id instead: the kit pieces are
 * plain functions, so they are resolved here into SVG elements first.
 */

/** One seed for every instance: the seeded details (sparkles, leaf lengths) never change between renders. */
const SEED = 7;

type Draw = (p: DrawProps) => ReactNode;

/** The suffix on ids and on references to them (url(#…), href="#…"). */
function relink(name: string, value: string, suffix: string): string {
  if (name === 'id') return `${value}${suffix}`;
  if ((name === 'href' || name === 'xlinkHref') && value.startsWith('#')) return `${value}${suffix}`;
  return value.includes('url(#') ? value.replace(/url\(#([^)]+)\)/g, (_, ref: string) => `url(#${ref}${suffix})`) : value;
}

/** The node with its function components resolved and every id made the layer's own. */
function ownIds(node: ReactNode, suffix: string): ReactNode {
  if (Array.isArray(node)) return node.map((child: ReactNode) => ownIds(child, suffix));
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<Record<string, unknown>>;
  const { type, props } = el;
  // A null key must stay absent: createElement would make it the string "null".
  const keyed = el.key === null ? {} : { key: el.key };
  if (typeof type === 'function') {
    const proto = (type as { prototype?: { isReactComponent?: unknown } }).prototype;
    if (proto?.isReactComponent) return node;
    const drawn = ownIds((type as (p: Record<string, unknown>) => ReactNode)(props), suffix);
    // A component placed in a list keeps its key on what it drew.
    return el.key === null ? drawn : createElement(Fragment, keyed, drawn);
  }
  const children = props.children as ReactNode;
  const kids = Array.isArray(children) ? children.map((child: ReactNode) => ownIds(child, suffix)) : [ownIds(children, suffix)];
  if ((type as unknown) === Fragment) return createElement(Fragment, keyed, ...kids);
  if (typeof type !== 'string') return node;
  const next: Record<string, unknown> = { ...keyed };
  for (const [name, value] of Object.entries(props)) {
    if (name === 'children') continue;
    next[name] = typeof value === 'string' ? relink(name, value, suffix) : value;
  }
  return children === undefined ? createElement(type, next) : createElement(type, next, ...kids);
}

/** A key light from the upper left, warmed by the palette's metal. */
const lightOf = (colors: ThemeColors): KeyLight => ({ from: 'left', color: mix('#fff3d6', hex(colors.secondary), 0.2), rim: mix('#fffaf0', hex(colors.secondary), 0.3) });

/** A kit piece drawn in its default box (w × h units), kept in proportion inside the layer. */
function KitArt({ w, h, colors, nature = NATURE, draw, className, style }: { w: number; h: number; colors: ThemeColors; nature?: Record<keyof typeof NATURE, string>; draw: Draw; className?: string; style?: IllustrationProps['style'] }) {
  const suffix = `-${useSafeId()}`;
  const p: DrawProps = { w, h, colors, nature: { ...nature }, light: lightOf(colors), eyeLine: null, detail: 'full', seed: SEED };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} style={style} aria-hidden="true">
      {ownIds(draw(p), suffix)}
    </svg>
  );
}

/** The palette with the tint in the given slots. */
const tinted = (colors: ThemeColors, color: string, ...slots: Array<keyof ThemeColors>): ThemeColors => ({ ...colors, ...Object.fromEntries(slots.map((s) => [s, hex(color)])) });

/** A crystal chandelier on brass arms. The tint is the brass; the crystal takes the accent. */
export function ChandelierArt({ color, colors, className, style }: IllustrationProps) {
  return <KitArt w={260} h={170} colors={tinted(colors, color, 'secondary')} draw={(p) => <Chandelier {...p} variant="crystal" />} className={className} style={style} />;
}

/** A three-branch brass candelabra with ivory candles. The tint is the brass. */
export function CandelabraArt({ color, colors, className, style }: IllustrationProps) {
  return <KitArt w={60} h={300} colors={tinted(colors, color, 'secondary')} draw={(p) => <LampStand {...p} variant="candelabra" />} className={className} style={style} />;
}

/** A gilt lamp post with a lit hexagonal lantern. The tint is the gilt. */
export function LampPostArt({ color, colors, className, style }: IllustrationProps) {
  return <KitArt w={40} h={300} colors={tinted(colors, color, 'secondary')} draw={(p) => <LampPost {...p} variant="gilt" />} className={className} style={style} />;
}

/** A pierced brass lantern on a chain, its glow showing through. The tint is the brass. */
export function HangingLanternArt({ color, colors, className, style }: IllustrationProps) {
  return <KitArt w={60} h={160} colors={tinted(colors, color, 'secondary')} draw={(p) => <HangingLantern {...p} variant="brass" />} className={className} style={style} />;
}

/** A carved granite temple pillar with lotus medallions and a yali bracket. The tint is the stone. */
export function CarvedPillarArt({ color, colors, className, style }: IllustrationProps) {
  return <KitArt w={70} h={470} colors={tinted(colors, color, 'muted', 'surface')} draw={(p) => <Pillar {...p} variant="granite" />} className={className} style={style} />;
}

/** A tiered stone fountain with water curtains and a gilt finial. The tint is the stone; the water is the palette's primary over it. */
export function FountainArt({ color, colors, className, style }: IllustrationProps) {
  const c = hex(color);
  return <KitArt w={260} h={300} colors={{ ...colors, surface: c, background: tint(c, 0.35) }} draw={(p) => <Fountain {...p} variant="tiered" />} className={className} style={style} />;
}

/** An areca palm in a gadrooned brass urn. The tint is the urn; the fronds are NATURE's leaves. */
export function PottedPalmArt({ color, colors, className, style }: IllustrationProps) {
  return <KitArt w={160} h={330} colors={tinted(colors, color, 'secondary')} draw={(p) => <Planter {...p} plant="palm" />} className={className} style={style} />;
}

/** A banana plant with split leaves and a hanging bunch. The tint is its green, as on the banana leaf. */
export function BananaPlantArt({ color, colors, className, style }: IllustrationProps) {
  const c = hex(color);
  const nature = { ...NATURE, leaf: c, leafLight: tint(c, 0.25), leafDark: shade(c, 0.37) };
  return <KitArt w={140} h={420} colors={colors} nature={nature} draw={(p) => <BananaPlant {...p} />} className={className} style={style} />;
}

/** A havan: layered flames over crossed samidha in a stepped copper kund. The tint is the metal. */
export function SacredFireArt({ color, colors, className, style }: IllustrationProps) {
  return <KitArt w={140} h={150} colors={tinted(colors, color, 'secondary')} draw={(p) => <SacredFire {...p} />} className={className} style={style} />;
}

/** A sweet stall under a striped awning, lit inside, with laddoos and jars. The tint is the awning. */
export function StallArt({ color, colors, className, style }: IllustrationProps) {
  return <KitArt w={200} h={240} colors={tinted(colors, color, 'accent')} draw={(p) => <Stall {...p} variant="sweets" />} className={className} style={style} />;
}

// Set favourites promoted to the kit (stage/kit/favourites.tsx, final.md §6.5): drawn as their sets draw them.

/** Mela Chowk's Ferris wheel: lamp-pod cabins on a bulb-lit gold rim, standing on its lattice A-frame and deck. The tint is the gold. */
export function FerrisWheelArt({ color, colors, className, style }: IllustrationProps) {
  const { ferrisWheel: wheel, ferrisStand: stand } = FAVOURITE_BOXES;
  // The stand stands in front of the wheel with its apex on the hub, as the set places the two.
  const sx = (wheel.w - stand.w) / 2;
  const sy = wheel.h / 2;
  return (
    <KitArt
      w={wheel.w}
      h={wheel.h}
      colors={tinted(colors, color, 'secondary')}
      draw={(p) => (
        <>
          <FerrisWheel {...p} />
          <svg x={sx} y={sy} width={stand.w} height={stand.h}>
            <FerrisStand {...p} w={stand.w} h={stand.h} />
          </svg>
        </>
      )}
      className={className}
      style={style}
    />
  );
}

/** Cloud Nine's hot-air balloon: eight gores in the palette's pastels, a gold scalloped band, its burner aglow over a wicker basket. The tint is the main gore colour. */
export function HotAirBalloonArt({ color, colors, className, style }: IllustrationProps) {
  const { w, h } = FAVOURITE_BOXES.hotAirBalloon;
  return <KitArt w={w} h={h} colors={tinted(colors, color, 'secondary')} draw={(p) => <HotAirBalloon {...p} scheme={0} />} className={className} style={style} />;
}

/** Deepstambh's deepastambha: a black basalt lamp tower with seven ledges of lit brass lamps and a crowning flame, its halos on. The tint is the brass. */
export function LampTowerArt({ color, colors, className, style }: IllustrationProps) {
  const { w, h } = FAVOURITE_BOXES.lampTower;
  return (
    <KitArt
      w={w}
      h={h}
      colors={tinted(colors, color, 'secondary')}
      draw={(p) => (
        <>
          <LampTower {...p} part="body" />
          <LampTower {...p} part="halo" half={0} />
          <LampTower {...p} part="halo" half={1} />
        </>
      )}
      className={className}
      style={style}
    />
  );
}
