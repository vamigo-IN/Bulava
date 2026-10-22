import { DEFAULT_POSES } from './camera';
import type { CameraPose, LightPiece, Piece, PlaneRecipe, PropPiece, Vec3 } from './types';
import { deg, FLOOR_Y, num, perspectiveOf, u } from './units';

/**
 * Plane recipes (final.md §1.4, VERIFIED in the spike with an "F" on every
 * plane): every recipe uses transform-origin 0 0 and backface-visibility
 * visible, and shows its front face to a camera inside the room. Set authors
 * never write rotations: they call these helpers.
 *
 * `corners` are the world corners of the content as it is drawn (TL, TR, BR,
 * BL): for a right wall that is after the mirror, so on both walls the
 * drawing's left edge is the near end.
 */

/** Every plane and piece element's transform-origin. */
export const PIECE_ORIGIN = '0 0';
/** The right wall's content wrapper (transform-origin: center). */
export const MIRROR = 'scaleX(-1)';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/**
 * Floors and ceilings sit this far beyond the edges that stand or hang on them
 * (walls, back planes and props stop at y 800; hanging pieces start at the
 * ceiling's y). Planes that share an edge exactly get mis-sorted by Chrome's
 * 3D compositor (the floor painted over the foot of an upright piece); half a
 * unit apart they never intersect and the gap is invisible.
 */
export const PLANE_GAP = 0.5;

/** A floor, drawn flat in plan: content top = the far end. It lies PLANE_GAP below `y` by default. */
export function floor({ x0, x1, y = FLOOR_Y + PLANE_GAP, dNear, dFar }: { x0: number; x1: number; y?: number; dNear: number; dFar: number }): PlaneRecipe {
  return {
    kind: 'floor',
    w: x1 - x0,
    h: dFar - dNear,
    transform: `translate3d(${u(x0)}, ${u(y)}, ${u(-dFar)}) rotateX(90deg)`,
    mirror: false,
    corners: [v(x0, y, -dFar), v(x1, y, -dFar), v(x1, y, -dNear), v(x0, y, -dNear)],
    geometry: { x0, x1, y0: y, y1: y, dNear, dFar },
  };
}

/** A ceiling, seen from below: content top = the near end. It lies PLANE_GAP above `y`, so walls and hanging pieces that reach `y` never share its edge. */
export function ceiling({ x0, x1, y: yAt, dNear, dFar }: { x0: number; x1: number; y: number; dNear: number; dFar: number }): PlaneRecipe {
  const y = yAt - PLANE_GAP;
  return {
    kind: 'ceiling',
    w: x1 - x0,
    h: dFar - dNear,
    transform: `translate3d(${u(x0)}, ${u(y)}, ${u(-dNear)}) rotateX(-90deg)`,
    mirror: false,
    corners: [v(x0, y, -dNear), v(x1, y, -dNear), v(x1, y, -dFar), v(x0, y, -dFar)],
    geometry: { x0, x1, y0: y, y1: y, dNear, dFar },
  };
}

/**
 * A side wall, drawn as an elevation whose left edge is the near end. The left
 * wall's origin is its near top corner; the right wall's is its far top corner
 * and its content is mirrored (never put words on walls).
 */
export function wall(side: 'left' | 'right', { x, yTop, yBottom = FLOOR_Y, dNear, dFar }: { x: number; yTop: number; yBottom?: number; dNear: number; dFar: number }): PlaneRecipe {
  const corners: PlaneRecipe['corners'] = [v(x, yTop, -dNear), v(x, yTop, -dFar), v(x, yBottom, -dFar), v(x, yBottom, -dNear)];
  const geometry = { x0: x, x1: x, y0: yTop, y1: yBottom, dNear, dFar };
  const w = dFar - dNear;
  const h = yBottom - yTop;
  return side === 'left'
    ? { kind: 'wallLeft', w, h, transform: `translate3d(${u(x)}, ${u(yTop)}, ${u(-dNear)}) rotateY(90deg)`, mirror: false, corners, geometry }
    : { kind: 'wallRight', w, h, transform: `translate3d(${u(x)}, ${u(yTop)}, ${u(-dFar)}) rotateY(-90deg)`, mirror: true, corners, geometry };
}

/** A wall across the room (or any upright plane facing the camera) at distance d. */
export function back({ x0, x1, yTop, yBottom = FLOOR_Y, d }: { x0: number; x1: number; yTop: number; yBottom?: number; d: number }): PlaneRecipe {
  return {
    kind: 'back',
    w: x1 - x0,
    h: yBottom - yTop,
    transform: `translate3d(${u(x0)}, ${u(yTop)}, ${u(-d)})`,
    mirror: false,
    corners: [v(x0, yTop, -d), v(x1, yTop, -d), v(x1, yBottom, -d), v(x0, yBottom, -d)],
    geometry: { x0, x1, y0: yTop, y1: yBottom, dNear: d, dFar: d },
  };
}

/** The sky's content box in frame units: the 1200×800 frame plus 30% overscan on every side. */
export const SKY_BOX = { w: 1920, h: 1280, frameX: 360, frameY: 240 } as const;

/**
 * A sky plane at distance d from the rest eye, drawn like a 2.5D scene layer:
 * its content is 1920×1280 frame units with the frame's origin at (360, 240),
 * the horizon at frame y 440 and the story inside frame x 415–785. At rest it
 * lands exactly on the frame (s = d/p).
 *
 * The transform string carries the scale at num()'s two decimals, so the scale
 * is snapped to two decimals first and the plane stands at the distance that
 * scale lands exactly at (within half a hundredth of p, about 3.5 units, of the
 * d asked for): the CSS, the corners and project.ts then agree at any d.
 */
export function sky({ d: dAsked, rest = DEFAULT_POSES.rest }: { d: number; rest?: CameraPose }): PlaneRecipe {
  const p = perspectiveOf(rest.fov);
  const s = Math.round((dAsked / p) * 100) / 100;
  const d = s * p;
  const z = rest.z - d;
  const x0 = rest.x - 960 * s;
  const x1 = rest.x + 960 * s;
  const y0 = rest.y - 680 * s;
  const y1 = rest.y + 600 * s;
  return {
    kind: 'sky',
    w: SKY_BOX.w,
    h: SKY_BOX.h,
    transform: `translate3d(${u(x0)}, ${u(y0)}, ${u(z)}) scale(${num(s)})`,
    mirror: false,
    corners: [v(x0, y0, z), v(x1, y0, z), v(x1, y1, z), v(x0, y1, z)],
    geometry: { x0, x1, y0, y1, dNear: -z, dFar: -z },
  };
}

/** Where a prop stands: what billboard() and hang() return, spread into a PropPiece. */
export type PropGeometry = Pick<PropPiece, 'at' | 'w' | 'h' | 'anchor' | 'turn'>;

/** A prop standing on the floor (or on `base`), centred on x at distance d, facing the rest camera (turned by `turn`, |turn| ≤ 60). */
export function billboard({ x, d, w, h, base = FLOOR_Y, turn }: { x: number; d: number; w: number; h: number; base?: number; turn?: number }): PropGeometry {
  return turn ? { at: v(x, base, -d), w, h, anchor: 'bottom', turn } : { at: v(x, base, -d), w, h, anchor: 'bottom' };
}

/** A prop hanging from `top`, centred on x at distance d. */
export function hang({ x, d, w, h, top }: { x: number; d: number; w: number; h: number; top: number }): PropGeometry {
  return { at: v(x, top, -d), w, h, anchor: 'top' };
}

/** The top-left of a prop's box before any turn, from its anchor. */
function propTop(piece: Pick<PropPiece, 'at' | 'h' | 'anchor'>): number {
  return piece.anchor === 'bottom' ? piece.at.y - piece.h : piece.anchor === 'top' ? piece.at.y : piece.at.y - piece.h / 2;
}

/** A prop's placement transform (engine-built, origin 0 0). */
export function propTransform(piece: Pick<PropPiece, 'at' | 'w' | 'h' | 'anchor' | 'turn'>): string {
  const top = propTop(piece);
  const { x, z } = piece.at;
  return piece.turn
    ? `translate3d(${u(x)}, ${u(top)}, ${u(z)}) rotateY(${deg(piece.turn)}) translateX(${u(-piece.w / 2)})`
    : `translate3d(${u(x - piece.w / 2)}, ${u(top)}, ${u(z)})`;
}

/** A prop's world corners (TL, TR, BR, BL), its turn included. */
export function propCorners(piece: Pick<PropPiece, 'at' | 'w' | 'h' | 'anchor' | 'turn'>): [Vec3, Vec3, Vec3, Vec3] {
  const top = propTop(piece);
  const a = ((piece.turn ?? 0) * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const at = (lx: number, y: number) => v(piece.at.x + lx * c, y, piece.at.z - lx * s);
  const half = piece.w / 2;
  return [at(-half, top), at(half, top), at(half, top + piece.h), at(-half, top + piece.h)];
}

/** A light sprite's discs: the glow (2r) and, with bloom, a second one at 3r and strength×0.3. */
export function lightDiscs(piece: Pick<LightPiece, 'at' | 'r' | 'strength' | 'bloom'>): Array<{ size: number; strength: number; transform: string }> {
  const disc = (r: number, strength: number) => ({ size: 2 * r, strength, transform: `translate3d(${u(piece.at.x - r)}, ${u(piece.at.y - r)}, ${u(piece.at.z)})` });
  return piece.bloom ? [disc(piece.r * 3, piece.strength * 0.3), disc(piece.r, piece.strength)] : [disc(piece.r, piece.strength)];
}

/** Light sprites a piece costs (a bloom is a second sprite). */
export const spriteCount = (piece: Piece): number => (piece.kind === 'light' ? (piece.bloom ? 2 : 1) : 0);

/** A piece's distance from the rest eye (planes: their near edge), for data-d, near fade and haze. */
export function pieceDistance(piece: Piece): number {
  return piece.kind === 'plane' ? piece.plane.geometry.dNear : -piece.at.z;
}

/** Whether a piece fades near the eye: props, lights and covers by default, planes never (unless a cover says so). */
export const fadesNear = (piece: Piece): boolean => (piece.kind === 'plane' ? piece.role === 'cover' && piece.nearFade !== false : piece.nearFade !== false);
