import { createElement } from 'react';
import { STAGE_META, type StageIntro } from '@bulava/template-schema';
import { posesOf } from './camera';
import { CardCover, COVER_BOXES, DoorCover, GateCover, SILK_OVERLAP, SilkCover } from './kit/covers';
import { ARRIVAL_GATE_Z, enterFade, startPose, type EnterEdge, type OpeningEnter } from './openings';
import { billboard, floor, hang, propTransform, wall } from './planes';
import type { CameraPose, Draw, Piece, PlaneGeometry, SetContext, StageSet, Vec3 } from './types';
import { deg, perspectiveOf, u } from './units';

/**
 * The stage openings' cover pieces (final.md §4), in world units. Ids, counts
 * and placement are final: openingState() (openings.ts, U4) moves them by id
 * with transform and opacity only, and films draw them the same way. Budgets:
 * ≤ 6 pieces and ≤ 1 light sprite per opening.
 *
 * ── How a cover piece is placed and moved (for the opening and film units) ──
 *
 * Every piece keeps the engine's placement transform (`propTransform(piece)`
 * for props, `piece.plane.transform` for planes, origin 0 0). A cover moves by
 * PREFIXING that placement with world-space turns about hinge lines:
 *
 *     transform = [lift] [tip] hingeAbout(hinge, angle) placement
 *
 * `hingeAbout(h, a)` = translate3d(h) rotateY(a) translate3d(−h) (rotateX for
 * axis 'x'): a turn of `a` degrees about the vertical (or horizontal) world
 * line through (h.x, h.y, h.z). Angles are CSS angles: rotateY(+a) swings a
 * point right of the hinge AWAY from the viewer (−z), rotateY(−a) a point left
 * of it; rotateX(+a) tips a point above the line away. `coverTransform(piece,
 * ...prefixes)` writes the string; `coverMotion(kind, set)` gives each id's
 * hinge with its angle at q = 0 (`closed`) and fully open (`open`), and
 * `coverStartTransforms` the transforms at q = 0, which the opening must write
 * before it shows the cover (the server-rendered placement is the q = 0 state
 * for every piece except the card's left and right panels, see unfold).
 *
 * arrival (gate at z +250; start pose `far`, never nearer than 850 in front of the gate: startPose in openings.ts)
 *   cover-ground  floor plane z 250…1450, x −100…1300 (does not move; nearFade false)
 *   cover-ground-in  only where the set's floor starts further in: floor plane from z 250 to a little under that
 *                 floor, y 801.5 (beneath the set's floors), x −100…1300 (does not move; nearFade false)
 *   cover-leaf-l  prop x 300–600, top y 180, z 250. Hinge y-axis at x 300, z 250: closed 0, open +105 (less where
 *                 the set's tall side wall stands in its sweep: the leaf stops against it, leafOpen; doorway likewise)
 *   cover-leaf-r  prop x 600–900, same. Hinge at x 900, z 250: closed 0, open −105
 *   cover-frame   prop 1000×800 at z 252 (does not move)
 *   cover-seal    prop 120×120 centred (600, 490) at z 254, `coin` motion; fades out on q 0–.1
 * doorway (leaves at z +300; start pose rest + {z +600, fov 56})
 *   cover-leaf-l  prop x 350–600, top y 180, z 300. Hinge y-axis at x 350, z 300: closed 0, open +100
 *   cover-leaf-r  prop x 600–850. Hinge at x 850, z 300: closed 0, open −100
 *   cover-edge-l  left-wall plane at x 600, z 300…324 (the leaf's thickness stands IN FRONT of the drawn
 *                 face, so it shows as the leaves swing away). Turns with cover-leaf-l (same hinge, angle)
 *   cover-edge-r  right-wall plane at x 600, z 300…324. Turns with cover-leaf-r
 *   cover-frame   prop 700×760 at z 302 (does not move)
 *   cover-seam    light (600, 420, z 304), r 150, strength .4 at q 0 (write opacity .4 → 1 on q .05–.4)
 * silk (d 260 from rest; start pose rest + {z +160, fov 58})
 *   cover-band-i  prop W × (H/6 + SILK_OVERLAP) hanging from top_i = top + i·H/6, z rest.z − 260 + i/2 (each band
 *                 tucks its overlap under the next, nearer one). Hinge x-axis at (y top_i, its z): closed 0,
 *                 open −75, with a lift of −1.4·h (translate3d(0, lift·k, 0) before the hinge). The hem
 *                 band carries a `flutter` motion; dawn bands carry opacity .85
 * unfold (d 260 from rest; start pose rest + {y −20, z +260, fov 58})
 *   cover-panel-c prop x 510–690, z card (does not turn)
 *   cover-panel-l prop x 330–510, placed OPEN. Hinge y-axis at x 510, z card+1: closed +180, open 0
 *   cover-panel-r prop x 690–870, placed OPEN. Hinge at x 690, z card+2: closed −180, open 0
 *                 (closed, R lies outermost at z card+4 and its back, the same art mirrored, is the cover;
 *                 L lies under it at z card+2)
 *   cover-seal    prop 70×70 centred on the card at z card+6; fades out on q 0–.08 as R lifts
 *   tip           all four pieces then tip back together: prefix `translate3d(0, drop·k, 0) hingeAbout(tip,
 *                 82·k)` (k 0→1 on q .45–.65), tip = x-axis along the card's foot
 */

/** Where each opening's cover stands: z of the planes, hinge lines and the card's panels. */
export const COVER_LAYOUT = {
  arrival: {
    /** The gate's plane (the frame 2 units nearer, the seal 4). */
    z: ARRIVAL_GATE_Z,
    /** The leaves' outer edges: leaf L hinges on x 300, leaf R on x 900 (both swing 0→±105°). */
    hingeL: 300,
    hingeR: 900,
    seal: { x: 600, y: 490 },
  },
  doorway: {
    /** The leaves' drawn face; their edges run 24 units toward the viewer from it; the frame 2 units nearer. */
    z: 300,
    depth: 24,
    /** Leaf L hinges on x 350, leaf R on x 850 (0→±100°); the seam is x 600. */
    hingeL: 350,
    hingeR: 850,
    seam: 600,
    /** The seam light's centre (world) and radius. */
    light: { y: 420, r: 150 },
  },
  silk: { d: 260, bands: 6 },
  unfold: {
    d: 260,
    /** Panel C spans x 510–690; panel L hinges on x 510 (+180→0°), panel R on x 690 (−180→0°). */
    hingeL: 510,
    hingeR: 690,
    panel: { w: 180, h: 300 },
    /** The card tips back 82° about its foot and drops 240 units after the panels open. */
    tip: 82,
    drop: 240,
  },
} as const;

/** The start poses from the set's rest and far poses (openings.ts's startPose: one definition for covers, openings and films). */
export const COVER_START: Record<StageIntro, (rest: CameraPose, far: CameraPose) => CameraPose> = {
  arrival: (rest, far) => startPose('arrival', rest, far),
  doorway: (rest, far) => startPose('doorway', rest, far),
  silk: (rest, far) => startPose('silk', rest, far),
  unfold: (rest, far) => startPose('unfold', rest, far),
};

// ─────────────────────────── The cover in the set ───────────────────────────

/** A side wall that stops a leaf or encloses the room: its top stands above the leaves' middle (rails stay low). */
const TALL_WALL = 480;
/** How far past open a heavy leaf swings before it settles (openings.ts's `swing`). */
const SWING_OVER = 1.03;
/** The arrival's ground through the gate lies this far below the floors (theirs sit at FLOOR_Y + 0.5, lawns at + 1). */
const GROUND_IN_Y = 801.5;
/** An entering plane starts at most this far behind the rest eye (z): further back, it frames the cover from outside. */
const ENTER_FROM = 50;

/** The set's tall side walls on one side (left: wallLeft planes; right: wallRight), as plane extents. */
function sideWalls(set: Partial<Pick<StageSet, 'pieces'>>, side: 'left' | 'right'): PlaneGeometry[] {
  const kind = side === 'left' ? 'wallLeft' : 'wallRight';
  return (set.pieces ?? []).flatMap((p) => (p.kind === 'plane' && p.plane.kind === kind && p.plane.geometry.y0 <= TALL_WALL ? [p.plane.geometry] : []));
}

/**
 * How far a gate's or door's leaf may swing (degrees, at most `nominal`) before it would pass through one of the set's
 * tall side walls, overshoot included: it stops against the wall, as a real leaf does, instead of turning into the
 * room's side and showing the wall's end cut across it. Left-hand leaves as given; a right-hand leaf is measured
 * mirrored (its hinge at 1200 − x, the right walls likewise). The leaf's free edge runs out from its hinge to `width`.
 */
function leafOpen(set: Partial<Pick<StageSet, 'pieces'>>, side: 'left' | 'right', hinge: number, width: number, z: number, nominal: number): number {
  const mirror = (x: number) => (side === 'left' ? x : 1200 - x);
  const walls = sideWalls(set, side).map((g) => ({ x: mirror(g.x0), zNear: -g.dNear, zFar: -g.dFar }));
  if (!walls.length) return nominal;
  const h = mirror(hinge);
  const blocked = (a: number) => {
    const c = Math.cos((a * Math.PI) / 180);
    const s = Math.sin((a * Math.PI) / 180);
    for (let i = 1; i <= 30; i++) {
      const r = (width * i) / 30;
      const x = h + r * c;
      const at = z - r * s;
      if (walls.some((w) => x < w.x - 0.5 && at <= w.zNear && at >= w.zFar)) return true;
    }
    return false;
  };
  const reach = nominal * SWING_OVER;
  for (let a = 0.5; a < reach + 0.5; a += 0.5) {
    const at = Math.min(a, reach);
    if (blocked(at)) return Math.floor(((at - 0.5) / SWING_OVER) * 10) / 10;
  }
  return nominal;
}

/**
 * How deep (d) the arrival's ground runs on through the gate: to a little under where the set's own floor begins
 * below the middle of the gate, so no gap shows between the outside and the room, and never so far that a screen at
 * rest could see it (the floor shows from about d 900 on a phone). Null when that floor reaches the gate already, or
 * when the set has no floor there (clouds, open water).
 */
const GROUND_IN_REACH = 880;
function innerGroundOf(set: Pick<StageSet, 'pieces'>, gateZ: number): number | null {
  let front: number | null = null;
  for (const p of set.pieces) {
    if (p.kind !== 'plane' || p.plane.kind !== 'floor') continue;
    const g = p.plane.geometry;
    if (g.x0 > 600 || g.x1 < 600 || g.y0 < 760) continue;
    front = front === null ? g.dNear : Math.min(front, g.dNear);
  }
  return front === null || front <= -gateZ + 30 ? null : Math.min(front + 40, GROUND_IN_REACH);
}

/**
 * The set's planes that enter as an opening plays (openings.ts's OpeningEnter): tall side walls and ceilings that
 * start in front of the rest eye (or no more than ENTER_FROM behind it) with their front ends off the rest pose's
 * frame. Every opening starts behind rest, where a wide screen would see those ends as cut slabs standing in the open;
 * they wait off the picture until the ends leave the screen, and the set's hung pieces wait with them. A front end the
 * rest pose shows is part of the hero's picture and never waits.
 */
export function enterOf(set: Pick<StageSet, 'pieces' | 'poses'>): OpeningEnter {
  const { rest } = posesOf(set);
  const frame = { w: 1200, h: 800 };
  const edges: EnterEdge[] = [];
  for (const piece of set.pieces) {
    if (piece.kind !== 'plane') continue;
    const { kind, geometry: g } = piece.plane;
    const z = -g.dNear;
    if (z > rest.z + ENTER_FROM) continue;
    let ends: [Vec3, Vec3] | null = null;
    if ((kind === 'wallLeft' || kind === 'wallRight') && g.y0 <= TALL_WALL) ends = [{ x: g.x0, y: g.y0, z }, { x: g.x0, y: g.y1, z }];
    else if (kind === 'ceiling') ends = [{ x: g.x0, y: g.y0, z }, { x: g.x1, y: g.y0, z }];
    if (!ends || enterFade(ends[0], ends[1], rest, frame) < 1) continue;
    edges.push({ id: piece.id, kind: kind === 'ceiling' ? 'ceiling' : 'wall', a: ends[0], b: ends[1] });
  }
  const hangs = edges.length ? set.pieces.filter((p) => p.kind === 'prop' && p.anchor === 'top').map((p) => p.id) : [];
  return { edges, hangs };
}

/** The world y on the start pose's line of sight to frame y `fy`, at distance `dist` from its eye. */
const yAt = (eye: CameraPose, fy: number, dist: number) => eye.y + ((fy - 440) * dist) / perspectiveOf(eye.fov);

export interface CoverOptions {
  /** The monogram's font (films pass their font stack; the web uses var(--t-script)). */
  fontFamily?: string;
}

/** A line a cover piece turns about (world units) and its CSS angles at q = 0 and fully open. */
export interface CoverHinge {
  axis: 'x' | 'y';
  x: number;
  y: number;
  z: number;
  /** The angle at q = 0 (degrees, as rotateX/rotateY write it). */
  closed: number;
  /** The angle when open. */
  open: number;
  /** Silk bands: the rise when open (units, negative = up), applied as translate3d(0, lift·k, 0) before the hinge. */
  lift?: number;
}

/** How a kind's cover pieces move: hinges by piece id, and for the card the tip shared by all its pieces. */
export interface CoverMotion {
  hinges: Record<string, CoverHinge>;
  /** unfold: every card piece tips back about the card's foot (closed 0, open 82) and drops by `drop`. */
  tip?: CoverHinge & { drop: number };
}

/** The geometry shared by coverPieces and coverMotion (it depends on the set's own poses for silk and unfold). */
function geometry(set: Pick<StageSet, 'poses'>) {
  const { rest, far } = posesOf(set);
  const silkEye = COVER_START.silk(rest, far);
  const silkDist = silkEye.z - (rest.z - COVER_LAYOUT.silk.d);
  const silkP = perspectiveOf(silkEye.fov);
  // The frame plus 15% at the silk's start pose, centred on the frame's centre.
  const silkW = (1.15 * 1200 * silkDist) / silkP;
  const silkH = (1.15 * 800 * silkDist) / silkP;
  const silkTop = yAt(silkEye, 400, silkDist) - silkH / 2;
  const cardEye = COVER_START.unfold(rest, far);
  const cardDist = cardEye.z - (rest.z - COVER_LAYOUT.unfold.d);
  // The closed card's centre sits a little below the horizon on every screen.
  const cardCy = yAt(cardEye, 470, cardDist);
  return {
    rest,
    silk: { x: silkEye.x, z: rest.z - COVER_LAYOUT.silk.d, w: silkW, h: silkH / COVER_LAYOUT.silk.bands, top: silkTop },
    card: { z: rest.z - COVER_LAYOUT.unfold.d, cy: cardCy, top: cardCy - COVER_LAYOUT.unfold.panel.h / 2 },
  };
}

/** The cover pieces of a stage opening for a set, drawn in the set's cover styles and the palette. */
export function coverPieces(kind: StageIntro, set: StageSet, ctx: SetContext, opts: CoverOptions = {}): Piece[] {
  const g = geometry(set);
  const base = { monogram: ctx.monogram, fontFamily: opts.fontFamily, dark: STAGE_META[set.name].dark };
  const role = 'cover' as const;
  // d is measured from the rest eye (d = -z).
  const dOf = (z: number) => -z;
  switch (kind) {
    case 'arrival': {
      const z = COVER_LAYOUT.arrival.z;
      const art = `gate:${set.covers.gate}`;
      const gate = (part: 'frame' | 'leafL' | 'leafR' | 'seal' | 'ground' | 'groundIn'): Draw => (p) => createElement(GateCover, { ...p, ...base, variant: set.covers.gate, part });
      const leaf = COVER_BOXES.gate.leafL;
      // The ground on through the gate, under the set's floor, where that floor starts further in (no gap shows).
      const inner = innerGroundOf(set, z);
      const groundIn: Piece[] = inner === null ? [] : [{ kind: 'plane', id: 'cover-ground-in', art, role, nearFade: false, plane: floor({ x0: -100, x1: 1300, y: GROUND_IN_Y, dNear: dOf(z), dFar: inner }), draw: gate('groundIn') }];
      return [
        { kind: 'plane', id: 'cover-ground', art, role, nearFade: false, plane: floor({ x0: -100, x1: 1300, dNear: dOf(z + 1200), dFar: dOf(z) }), draw: gate('ground') },
        ...groundIn,
        { kind: 'prop', id: 'cover-leaf-l', art, role, ...billboard({ x: COVER_LAYOUT.arrival.hingeL + leaf.w / 2, d: dOf(z), w: leaf.w, h: leaf.h }), draw: gate('leafL') },
        { kind: 'prop', id: 'cover-leaf-r', art, role, ...billboard({ x: COVER_LAYOUT.arrival.hingeR - leaf.w / 2, d: dOf(z), w: leaf.w, h: leaf.h }), draw: gate('leafR') },
        { kind: 'prop', id: 'cover-frame', art, role, ...billboard({ x: 600, d: dOf(z + 2), ...COVER_BOXES.gate.frame }), draw: gate('frame') },
        {
          kind: 'prop',
          id: 'cover-seal',
          art,
          role,
          at: { x: COVER_LAYOUT.arrival.seal.x, y: COVER_LAYOUT.arrival.seal.y, z: z + 4 },
          ...COVER_BOXES.gate.seal,
          anchor: 'center',
          motion: { kind: 'coin', amp: 1, period: 3.2 },
          draw: gate('seal'),
        },
      ];
    }
    case 'doorway': {
      const { z, depth, hingeL, hingeR, seam, light } = COVER_LAYOUT.doorway;
      const art = `door:${set.covers.door}`;
      const door = (part: 'frame' | 'leafL' | 'leafR' | 'edgeL' | 'edgeR'): Draw => (p) => createElement(DoorCover, { ...p, ...base, variant: set.covers.door, part });
      const leaf = COVER_BOXES.door.leafL;
      const yTop = 800 - leaf.h;
      return [
        { kind: 'prop', id: 'cover-leaf-l', art, role, ...billboard({ x: hingeL + leaf.w / 2, d: dOf(z), w: leaf.w, h: leaf.h }), draw: door('leafL') },
        { kind: 'prop', id: 'cover-leaf-r', art, role, ...billboard({ x: hingeR - leaf.w / 2, d: dOf(z), w: leaf.w, h: leaf.h }), draw: door('leafR') },
        { kind: 'plane', id: 'cover-edge-l', art, role, nearFade: true, plane: wall('left', { x: seam, yTop, dNear: dOf(z + depth), dFar: dOf(z) }), draw: door('edgeL') },
        { kind: 'plane', id: 'cover-edge-r', art, role, nearFade: true, plane: wall('right', { x: seam, yTop, dNear: dOf(z + depth), dFar: dOf(z) }), draw: door('edgeR') },
        { kind: 'prop', id: 'cover-frame', art, role, ...billboard({ x: 600, d: dOf(z + 2), ...COVER_BOXES.door.frame }), draw: door('frame') },
        { kind: 'light', id: 'cover-seam', art: 'seam', role, at: { x: seam, y: light.y, z: z + 4 }, r: light.r, color: set.light.color, strength: 0.4 },
      ];
    }
    case 'silk': {
      const { bands } = COVER_LAYOUT.silk;
      const s = g.silk;
      const silk = (band: number): Draw => (q) => createElement(SilkCover, { ...q, ...base, variant: set.covers.silk, part: 'band', band, bands });
      return Array.from({ length: bands }, (_, i): Piece => ({
        kind: 'prop',
        id: `cover-band-${i}`,
        art: `silk:${set.covers.silk}`,
        role,
        // Each band's box runs SILK_OVERLAP past its pitch, under the next band, which hangs half a unit nearer: no seams.
        ...hang({ x: s.x, d: -(s.z + i * 0.5), w: s.w, h: s.h + SILK_OVERLAP, top: s.top + i * s.h }),
        ...(i === bands - 1 ? { motion: { kind: 'flutter' as const, amp: 2, period: 4.5 } } : {}),
        ...(set.covers.silk === 'dawn' ? { opacity: 0.85 } : {}),
        draw: silk(i),
      }));
    }
    case 'unfold': {
      const { hingeL, hingeR, panel } = COVER_LAYOUT.unfold;
      const { z, cy, top } = g.card;
      const art = `card:${set.covers.card}`;
      const card = (part: 'panelL' | 'panelC' | 'panelR' | 'seal'): Draw => (p) => createElement(CardCover, { ...p, ...base, variant: set.covers.card, part });
      const cx = (hingeL + hingeR) / 2;
      return [
        { kind: 'prop', id: 'cover-panel-c', art, role, ...hang({ x: cx, d: -z, ...panel, top }), draw: card('panelC') },
        // Placed open; closed (q = 0) they are turned 180° about their hinges (coverMotion), R outermost.
        { kind: 'prop', id: 'cover-panel-l', art, role, ...hang({ x: hingeL - panel.w / 2, d: -z, ...panel, top }), draw: card('panelL') },
        { kind: 'prop', id: 'cover-panel-r', art, role, ...hang({ x: hingeR + panel.w / 2, d: -z, ...panel, top }), draw: card('panelR') },
        { kind: 'prop', id: 'cover-seal', art, role, at: { x: cx, y: cy, z: z + 6 }, ...COVER_BOXES.card.seal, anchor: 'center', draw: card('seal') },
      ];
    }
    default:
      return [];
  }
}

/**
 * The hinges of a kind's cover pieces for a set (see the table at the top of this file). With the set's pieces, a
 * gate's or door's leaves stop against the set's tall side walls (leafOpen) short of their nominal swing.
 */
export function coverMotion(kind: StageIntro, set: Pick<StageSet, 'poses'> & Partial<Pick<StageSet, 'pieces'>>): CoverMotion {
  const g = geometry(set);
  switch (kind) {
    case 'arrival': {
      const { z, hingeL, hingeR } = COVER_LAYOUT.arrival;
      const w = COVER_BOXES.gate.leafL.w;
      return {
        hinges: {
          'cover-leaf-l': { axis: 'y', x: hingeL, y: 0, z, closed: 0, open: leafOpen(set, 'left', hingeL, w, z, 105) },
          'cover-leaf-r': { axis: 'y', x: hingeR, y: 0, z, closed: 0, open: -leafOpen(set, 'right', hingeR, w, z, 105) },
        },
      };
    }
    case 'doorway': {
      const { z, hingeL, hingeR } = COVER_LAYOUT.doorway;
      const w = COVER_BOXES.door.leafL.w;
      const l: CoverHinge = { axis: 'y', x: hingeL, y: 0, z, closed: 0, open: leafOpen(set, 'left', hingeL, w, z, 100) };
      const r: CoverHinge = { axis: 'y', x: hingeR, y: 0, z, closed: 0, open: -leafOpen(set, 'right', hingeR, w, z, 100) };
      return { hinges: { 'cover-leaf-l': l, 'cover-edge-l': l, 'cover-leaf-r': r, 'cover-edge-r': r } };
    }
    case 'silk': {
      const s = g.silk;
      const hinges: Record<string, CoverHinge> = {};
      for (let i = 0; i < COVER_LAYOUT.silk.bands; i++) hinges[`cover-band-${i}`] = { axis: 'x', x: 0, y: s.top + i * s.h, z: s.z + i * 0.5, closed: 0, open: -75, lift: -1.4 * s.h };
      return { hinges };
    }
    case 'unfold': {
      const { hingeL, hingeR, panel, tip, drop } = COVER_LAYOUT.unfold;
      const { z, top } = g.card;
      return {
        hinges: {
          'cover-panel-l': { axis: 'y', x: hingeL, y: 0, z: z + 1, closed: 180, open: 0 },
          'cover-panel-r': { axis: 'y', x: hingeR, y: 0, z: z + 2, closed: -180, open: 0 },
        },
        tip: { axis: 'x', x: 0, y: top + panel.h, z, closed: 0, open: tip, drop },
      };
    }
    default:
      return { hinges: {} };
  }
}

/** A turn of `angle` degrees about a hinge line, as a transform prefix ('' for no turn). */
export function hingeAbout(h: Pick<CoverHinge, 'axis' | 'x' | 'y' | 'z'>, angle: number): string {
  if (!angle) return '';
  const turn = h.axis === 'y' ? `rotateY(${deg(angle)})` : `rotateX(${deg(angle)})`;
  return `translate3d(${u(h.x)}, ${u(h.y)}, ${u(h.z)}) ${turn} translate3d(${u(-h.x)}, ${u(-h.y)}, ${u(-h.z)})`;
}

/** A cover piece's transform: world-space prefixes (lift, tip, hinge) before its own placement. Lights do not move. */
export function coverTransform(piece: Piece, ...prefixes: string[]): string {
  if (piece.kind === 'light') return '';
  const placement = piece.kind === 'plane' ? piece.plane.transform : propTransform(piece);
  return [...prefixes.filter(Boolean), placement].join(' ');
}

/** Every cover piece's transform at q = 0 (write these before the cover is shown; lights keep their own). */
export function coverStartTransforms(kind: StageIntro, set: Pick<StageSet, 'poses'>, pieces: readonly Piece[]): Record<string, string> {
  const { hinges } = coverMotion(kind, set);
  const out: Record<string, string> = {};
  for (const piece of pieces) {
    if (piece.kind === 'light') continue;
    const h = hinges[piece.id];
    out[piece.id] = coverTransform(piece, h ? hingeAbout(h, h.closed) : '');
  }
  return out;
}
