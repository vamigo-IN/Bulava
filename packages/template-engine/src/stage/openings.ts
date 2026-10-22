import type { StageIntro } from '@bulava/template-schema';
import { cubicBezier, easeCamera, lerpPose, posesOf } from './camera';
import type { CoverHinge, CoverMotion } from './covers3d';
import { propTransform } from './planes';
import type { CameraPose, Piece, StageSet, Vec3 } from './types';
import { clamp, deg, NEAR_FADE, num, perspectiveOf, u } from './units';

/**
 * The four stage openings (final.md §4) as pure functions of their progress q
 * (0 closed … 1 open): where the camera is, how each cover piece has moved, how
 * the light changes, and when the set builds in and the words turn up. One
 * choreography for the web (q from time or the guest's drag, opening.tsx) and
 * for films (q from the frame, `scene.reveal`).
 *
 * Client-safe on purpose: at runtime this module reads only camera.ts,
 * planes.ts and units.ts, never set art, the cover kit or the schema's values,
 * so the page's opening ships without them. The covers' hinge lines come in as
 * data: `coverMotion(kind, set)` from covers3d.ts (the server hands it to the
 * overlay; films call it), and the pieces' placements come from the pieces
 * (films: `coverInfo`) or from the server-rendered DOM (the web).
 *
 * Every opening starts at `openingStart(kind)` and ends EXACTLY on the set's
 * rest pose with every cover piece gone, so the hero never cuts.
 */

/** The stage openings (STAGE_INTROS in the schema, kept here as data so the client needs no schema code). */
export const STAGE_OPENINGS = ['arrival', 'doorway', 'silk', 'unfold'] as const satisfies readonly StageIntro[];

/** Whether an opening is one of the stage openings. */
export const isStageOpening = (name: string | undefined | null): name is StageIntro => !!name && (STAGE_OPENINGS as readonly string[]).includes(name);

/** How long each opening plays on the web once the guest has opened it (ms). */
export const OPENING_MS: Readonly<Record<StageIntro, number>> = { arrival: 2800, doorway: 2400, silk: 2000, unfold: 2400 };

/**
 * Films (`scene.reveal`): the cover holds for `hold` s at q = 0, then q runs over
 * `run` s; the scene's words enter `content` s in (0.7 + 0.8 × 2.6 = 2.78 s).
 */
export const STAGE_REVEAL = { hold: 0.7, run: 2.6, content: 2.78 } as const;

/** A film reveal's q at t seconds into its scene. */
export const revealProgress = (t: number): number => clamp(Math.round(((t - STAGE_REVEAL.hold) / STAGE_REVEAL.run) * 1e9) / 1e9);

/** Where each opening's set starts to build in and its words turn up (q). */
export const OPENING_MARKS: Readonly<Record<StageIntro, { build: number; type: number }>> = {
  arrival: { build: 0.35, type: 0.92 },
  doorway: { build: 0.3, type: 0.9 },
  silk: { build: 0.25, type: 0.85 },
  unfold: { build: 0.45, type: 0.9 },
};

/** A film reveal's moments in seconds into its scene: the build-in starts, the names turn up, the reveal ends. */
export function revealTimes(kind: StageIntro): { build: number; type: number; end: number } {
  const at = (q: number) => Math.round((STAGE_REVEAL.hold + q * STAGE_REVEAL.run) * 1000) / 1000;
  return { build: at(OPENING_MARKS[kind].build), type: at(OPENING_MARKS[kind].type), end: at(1) };
}

/**
 * How the guest scrubs each opening with a finger (§4): `up` drags upward, `side`
 * drags sideways either way (outward from the doors' seam, or the card's edge).
 * A drag of `reach` × the screen's height (up) or width (side) scrubs to q `max`.
 */
export const OPENING_DRAG: Readonly<Record<StageIntro, { axis: 'up' | 'side'; max: number; reach: number }>> = {
  arrival: { axis: 'up', max: 0.6, reach: 0.45 },
  doorway: { axis: 'side', max: 0.45, reach: 0.33 },
  silk: { axis: 'up', max: 0.5, reach: 0.45 },
  unfold: { axis: 'side', max: 0.3, reach: 0.4 },
};

/** A drag let go past this share of its scrub (arrival: q 0.2 of 0.6) completes the opening; shorter springs back. */
export const DRAG_COMMIT = 1 / 3;

/** Fired on the window when a stage opening has landed on the rest pose (the rig starts on it). */
export const INTRO_DONE_EVENT = 'bulava:intro-done';

// ─────────────────────────── Easing ───────────────────────────

const inOut = cubicBezier(0.45, 0, 0.55, 1);
const out = cubicBezier(0.22, 0.61, 0.36, 1);
const lift = cubicBezier(0.5, 0, 0.35, 1);
const smoothstep = (t: number) => {
  const c = clamp(t);
  return c * c * (3 - 2 * c);
};
/** 0 → 1 → 0 over 0..1 (a swell that peaks halfway). */
const swell = (t: number) => {
  const c = clamp(t);
  return 4 * c * (1 - c);
};
const span = (q: number, from: number, to: number) => clamp((q - from) / (to - from));
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * A weighted turn that goes a little past its mark and settles back, ending
 * exactly on 1: it leaves rest gently (the weight of the leaf), sweeps to
 * `1 + over` at `peak` with no jolt and eases back.
 */
function settling(over: number, peak: number, x1: number): (t: number) => number {
  const sweep = cubicBezier(x1, 0, 0.3, 1);
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t < peak ? (1 + over) * sweep(t / peak) : 1 + over - over * smoothstep((t - peak) / (1 - peak));
  };
}
/** Heavy gate and door leaves: 3% past open, settled. */
const swing = settling(0.03, 0.78, 0.55);
/** How far the folded silk is hoisted, in band heights: the folded drape clears the rest pose's view. */
const SILK_HOIST = 4.8;
/** A card's panels: stiff paper that flaps 1.5% past flat. */
const paper = settling(0.015, 0.74, 0.4);

// ─────────────────────────── The camera ───────────────────────────

/** Where the arrival's gate stands (covers3d's COVER_LAYOUT.arrival.z, kept here as data so the client needs no cover code). */
export const ARRIVAL_GATE_Z = 250;

/**
 * How far in front of its gate the arrival starts at least: the default far pose's distance, from which the gate
 * stands whole on a phone with its seal in view. A set whose own far pose is nearer (so that its film's pull-away ends
 * inside the room) starts the arrival from here, with that pose's height and lens; it would otherwise open on a
 * close-up of the leaves.
 */
export const ARRIVAL_REACH = 850;

/** The camera when an opening starts (§4; covers3d's COVER_START is this function). */
export function startPose(kind: StageIntro, rest: CameraPose, far: CameraPose): CameraPose {
  switch (kind) {
    case 'arrival':
      return far.z >= ARRIVAL_GATE_Z + ARRIVAL_REACH ? { ...far } : { ...far, z: ARRIVAL_GATE_Z + ARRIVAL_REACH };
    case 'doorway':
      return { ...rest, z: rest.z + 600, fov: 56 };
    case 'silk':
      return { ...rest, z: rest.z + 160, fov: 58 };
    case 'unfold':
      return { ...rest, y: rest.y - 20, z: rest.z + 260, fov: 58 };
  }
}

/** The camera when a set's opening starts. */
export function openingStart(kind: StageIntro, set: Pick<StageSet, 'poses'>): CameraPose {
  const { rest, far } = posesOf(set);
  return startPose(kind, rest, far);
}

/**
 * A start brought in until a cover of half-width `cover.half` standing at
 * `cover.z` fills a screen `halfWidth` units wide (the arrival's gate on wide
 * screens; phones and 9:16 films see the gate whole from the far pose already).
 */
export function fitStart(start: CameraPose, cover: { half: number; z: number }, halfWidth: number): CameraPose {
  const p = 400 / Math.tan((start.fov * Math.PI) / 360);
  const dist = start.z - cover.z;
  if (dist <= 0 || cover.half <= 0) return start;
  const need = halfWidth / cover.half;
  if (need <= p / dist) return start;
  return { ...start, z: Math.round((cover.z + p / need) * 100) / 100 };
}

/** When each opening's camera moves (q) and how far it dips its gaze on the way (degrees, back to 0 at rest). */
const CAMERA: Readonly<Record<StageIntro, { from: number; dip: number }>> = {
  // Through the gate and down the set, looking a little down the aisle as it passes.
  arrival: { from: 0.1, dip: 2.2 },
  // A step through the doorway.
  doorway: { from: 0.2, dip: 1.5 },
  // Easing in as the drape rises.
  silk: { from: 0, dip: 0 },
  // Gliding over the card as it tips away.
  unfold: { from: 0.35, dip: 4 },
};

/** The camera at q: from `start`, eased (the backdrops' easeCamera) onto `rest`, exactly `rest` at q = 1. */
export function openingPose(kind: StageIntro, q: number, start: CameraPose, rest: CameraPose): CameraPose {
  if (q >= 1) return { ...rest };
  const { from, dip } = CAMERA[kind];
  const e = easeCamera(span(q, from, 1));
  if (e <= 0) return { ...start };
  const pose = lerpPose(start, rest, e);
  return dip ? { ...pose, pitch: pose.pitch + dip * swell(e) } : pose;
}

/**
 * The web's camera while a closed cover waits for the guest: a slow, barely
 * there sway about the pose (the cover reads as standing in depth before it
 * is touched). It fades out by q 0.2, so the opening still lands exactly on
 * rest. `t` is seconds since the cover showed. Films hold still and skip it.
 */
export function idlePose(pose: CameraPose, t: number, q: number): CameraPose {
  const k = 1 - smoothstep(q / 0.2);
  if (k <= 0 || !Number.isFinite(t)) return pose;
  const wave = (period: number, phase: number) => Math.sin((2 * Math.PI * t) / period + phase);
  return { ...pose, x: pose.x + 6 * k * wave(13, 0.4), yaw: pose.yaw + 0.55 * k * wave(9, 0), pitch: pose.pitch + 0.22 * k * wave(7, 1.3), z: pose.z + 8 * k * wave(11, 2.1) };
}

// ─────────────────────────── The cover ───────────────────────────

/** How one cover piece has moved at q (world space; composed by coverPrefix before its own placement). */
export interface CoverMove {
  /** The turn about its hinge (coverMotion's hinge for the piece), in degrees. */
  turn?: number;
  /** Silk: the rise (units, negative = up), applied after the turn. */
  lift?: number;
  /** Seals: a lift toward the viewer as they break (units). */
  push?: number;
  /** The card: its tip back about the card's foot (coverMotion's tip), in degrees. */
  tip?: number;
  /** The card: its drop after the tip (units, down). */
  drop?: number;
  /** Lights: a scale about the piece's anchor. */
  scale?: number;
  /** The choreography's opacity (0..1), before the near fade and the piece's own opacity. */
  opacity: number;
}

/** The silk's drape: its band pitch and band count, from the hinges (each band hangs from its top line). */
function drapeOf(motion: CoverMotion | undefined): { pitch: number; bands: number } {
  const ys: number[] = [];
  for (let i = 0; motion?.hinges[`cover-band-${i}`]; i++) ys.push(motion.hinges[`cover-band-${i}`]!.y);
  if (ys.length >= 2) return { pitch: (ys[ys.length - 1]! - ys[0]!) / (ys.length - 1), bands: ys.length };
  const lone = motion?.hinges['cover-band-0']?.lift;
  return { pitch: lone ? -lone / 1.4 : 90, bands: Math.max(6, ys.length) };
}

const angle = (h: CoverHinge | undefined, k: number, fallback: [number, number]) => {
  const [closed, open] = h ? [h.closed, h.open] : fallback;
  return closed + (open - closed) * k;
};

/**
 * Every cover piece's move at q, by id (§4, with the craft notes of the art
 * direction): leaves swing with weight and settle, the seam light floods, silk
 * bands tilt back and gather up with a lag down the drape, the card's panels
 * turn with paper stiffness before it tips away. Without `motion` the turns
 * keep their nominal angles (§4) but cannot be placed: transforms need it.
 */
export function coverMoves(kind: StageIntro, q: number, motion?: CoverMotion): Record<string, CoverMove> {
  const h = motion?.hinges ?? {};
  switch (kind) {
    case 'arrival': {
      const k = swing(span(q, 0, 0.25));
      const seal = out(span(q, 0, 0.1));
      return {
        'cover-leaf-l': { turn: angle(h['cover-leaf-l'], k, [0, 105]), opacity: 1 },
        'cover-leaf-r': { turn: angle(h['cover-leaf-r'], k, [0, -105]), opacity: 1 },
        'cover-seal': { push: 36 * seal, opacity: 1 - seal },
        'cover-frame': { opacity: 1 },
        'cover-ground': { opacity: 1 },
      };
    }
    case 'doorway': {
      const k = swing(span(q, 0.05, 0.45));
      const flood = inOut(span(q, 0.05, 0.4));
      return {
        'cover-leaf-l': { turn: angle(h['cover-leaf-l'], k, [0, 100]), opacity: 1 },
        'cover-edge-l': { turn: angle(h['cover-edge-l'] ?? h['cover-leaf-l'], k, [0, 100]), opacity: 1 },
        'cover-leaf-r': { turn: angle(h['cover-leaf-r'], k, [0, -100]), opacity: 1 },
        'cover-edge-r': { turn: angle(h['cover-edge-r'] ?? h['cover-leaf-r'], k, [0, -100]), opacity: 1 },
        'cover-frame': { opacity: 1 },
        // Light leaks through the seam (the light's own .4), spreads as the leaves part and dissolves into the room as the camera steps through.
        'cover-seam': { scale: 1 + 1.4 * out(span(q, 0.05, 0.45)), opacity: (0.7 + 0.3 * flood) * (1 - inOut(span(q, 0.5, 0.75))) },
      };
    }
    case 'silk': {
      const { pitch, bands } = drapeOf(motion);
      const moves: Record<string, CoverMove> = {};
      // The drape folds back over its top bar band by band, the top first and the hem last, every band still hanging
      // from the one above it (no gaps open between them), and is hoisted into the flies as it folds.
      const hoist = -SILK_HOIST * pitch * lift(span(q, 0.2, 0.9));
      const fade = 1 - smoothstep(span(q, 0.72, 0.95));
      let dy = 0;
      let dz = 0;
      for (let i = 0; i < bands; i++) {
        const t = span(q, 0.05 * i, 0.05 * i + 0.5);
        const turn = angle(h[`cover-band-${i}`], out(t), [0, -75]);
        moves[`cover-band-${i}`] = { turn, lift: dy + hoist, push: dz, opacity: fade };
        // The next band hangs from this one's foot, wherever its turn has carried it (rotateX: y h·cos a, z h·sin a).
        const r = (turn * Math.PI) / 180;
        dy += pitch * (Math.cos(r) - 1);
        dz += pitch * Math.sin(r);
      }
      return moves;
    }
    case 'unfold': {
      const r = paper(span(q, 0, 0.3));
      const l = paper(span(q, 0.15, 0.45));
      const k = inOut(span(q, 0.45, 0.65));
      const tipOpen = motion?.tip?.open ?? 82;
      const dropBy = motion?.tip?.drop ?? 240;
      const tip = tipOpen * k;
      const drop = dropBy * k;
      // Gone by the time the camera glides over it (below the view by then; the fade makes sure).
      const gone = 1 - smoothstep(span(q, 0.62, 0.72));
      const seal = out(span(q, 0, 0.08));
      return {
        'cover-panel-c': { tip, drop, opacity: gone },
        'cover-panel-r': { turn: angle(h['cover-panel-r'], r, [-180, 0]), tip, drop, opacity: gone },
        'cover-panel-l': { turn: angle(h['cover-panel-l'], l, [180, 0]), tip, drop, opacity: gone },
        'cover-seal': { push: 20 * seal, tip, drop, opacity: (1 - seal) * gone },
      };
    }
  }
}

/** A turn of `a` degrees about a hinge line (the same string covers3d's hingeAbout writes; '' for no turn). */
function turnAbout(h: Pick<CoverHinge, 'axis' | 'x' | 'y' | 'z'>, a: number): string {
  if (!a) return '';
  const turn = h.axis === 'y' ? `rotateY(${deg(a)})` : `rotateX(${deg(a)})`;
  return `translate3d(${u(h.x)}, ${u(h.y)}, ${u(h.z)}) ${turn} translate3d(${u(-h.x)}, ${u(-h.y)}, ${u(-h.z)})`;
}

/**
 * A cover piece's world-space prefix for a move: `[lift/drop] [push] [tip] [turn] [scale]`,
 * written before the piece's own placement (transform-origin 0 0), as covers3d's coverTransform does.
 * `at` is the piece's anchor (lights scale about it).
 */
export function coverPrefix(id: string, move: CoverMove, motion: CoverMotion | undefined, at?: Vec3): string {
  const parts: string[] = [];
  const dy = (move.lift ?? 0) + (move.drop ?? 0);
  if (Math.abs(dy) >= 0.005) parts.push(`translate3d(0, ${u(dy)}, 0)`);
  if (move.push && Math.abs(move.push) >= 0.005) parts.push(`translate3d(0, 0, ${u(move.push)})`);
  if (move.tip && motion?.tip) parts.push(turnAbout(motion.tip, move.tip));
  const hinge = motion?.hinges[id];
  if (hinge && move.turn !== undefined) parts.push(turnAbout(hinge, move.turn));
  if (at && move.scale !== undefined && Math.abs(move.scale - 1) >= 0.001) {
    parts.push(`translate3d(${u(at.x)}, ${u(at.y)}, ${u(at.z)}) scale(${num(move.scale)}) translate3d(${u(-at.x)}, ${u(-at.y)}, ${u(-at.z)})`);
  }
  return parts.filter(Boolean).join(' ');
}

/** A point turned `a` degrees about a hinge line, as rotateY/rotateX turn it (CSS angles). */
function turnPoint(p: Vec3, h: Pick<CoverHinge, 'axis' | 'x' | 'y' | 'z'>, a: number): Vec3 {
  if (!a) return p;
  const r = (a * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const x = p.x - h.x;
  const y = p.y - h.y;
  const z = p.z - h.z;
  return h.axis === 'y' ? { x: h.x + x * c + z * s, y: p.y, z: h.z - x * s + z * c } : { x: p.x, y: h.y + y * c - z * s, z: h.z + y * s + z * c };
}

/** Where a world point of a cover piece is after its move (the prefix applied right to left: turn, tip, push, rise). */
export function movedPoint(p: Vec3, id: string, move: CoverMove, motion: CoverMotion | undefined): Vec3 {
  let at = p;
  const hinge = motion?.hinges[id];
  if (hinge && move.turn !== undefined) at = turnPoint(at, hinge, move.turn);
  if (move.tip && motion?.tip) at = turnPoint(at, motion.tip, move.tip);
  return { x: at.x, y: at.y + (move.lift ?? 0) + (move.drop ?? 0), z: at.z + (move.push ?? 0) };
}

/** A piece's placement transform, as StageView writes it (props from planes.ts, lights centred on their largest disc). */
function placementOf(piece: Piece): string {
  if (piece.kind === 'plane') return piece.plane.transform;
  if (piece.kind === 'prop') return propTransform(piece);
  const R = piece.bloom ? piece.r * 3 : piece.r;
  return `translate3d(${u(piece.at.x - R)}, ${u(piece.at.y - R)}, ${u(piece.at.z)})`;
}

/**
 * The near fade of an anchor at a pose (§2.5, as project.ts's fadeAt, from numbers alone so the client can
 * read anchors from `data-at`): 0 at or behind the eye's plane, else 0 → 1 between 150 and 300 units.
 */
export function nearFade(at: Vec3, pose: CameraPose, fades = true): number {
  const vx = at.x - pose.x;
  const vy = at.y - pose.y;
  const vz = at.z - pose.z;
  const yaw = (pose.yaw * Math.PI) / 180;
  const pitch = (pose.pitch * Math.PI) / 180;
  const z1 = vx * Math.sin(yaw) + vz * Math.cos(yaw);
  const ahead = vy * Math.sin(pitch) - z1 * Math.cos(pitch);
  if (ahead <= 0) return 0;
  return fades ? clamp((Math.hypot(vx, vy, vz) - NEAR_FADE) / NEAR_FADE) : 1;
}

/** Cover planes that fade with the leaf they belong to (their own anchor is a plane's, which the DOM does not carry). */
export const COVER_PARTNER: Readonly<Record<string, string>> = { 'cover-edge-l': 'cover-leaf-l', 'cover-edge-r': 'cover-leaf-r' };

/**
 * A cover piece as an opening moves it: its id and kind, its anchor (props and lights), its placement transform,
 * whether it fades near the eye, and its own opacity. Films make it from the pieces (`coverInfo`); the web reads
 * it from the server-rendered DOM (`data-piece`, `data-at`, `data-fade`, the inline transform and opacity).
 */
export interface CoverPieceInfo {
  id: string;
  kind: 'plane' | 'prop' | 'light';
  at?: Vec3;
  placement: string;
  fades: boolean;
  /** The piece's own opacity (dawn silk is sheer). openingState leaves it out: StageView and the web multiply it in. */
  opacity?: number;
}

/** A cover piece's opening data (films and tests; the web reads the same from the DOM). */
export function coverInfo(piece: Piece): CoverPieceInfo {
  return {
    id: piece.id,
    kind: piece.kind,
    ...(piece.kind === 'plane' ? {} : { at: piece.at }),
    placement: placementOf(piece),
    fades: piece.kind === 'plane' ? piece.nearFade === true : piece.nearFade !== false,
    ...(piece.kind === 'prop' && piece.opacity !== undefined ? { opacity: piece.opacity } : {}),
  };
}

// ─────────────────────────── The room around the walk-in ───────────────────────────

/**
 * A set's walls and ceilings frame the rest pose with their front ends just off the screen, but every opening
 * starts behind it, where a wide screen sees those ends: a room's sides and lid standing in the open as cut slabs. While
 * an opening plays, such a plane stays out of the picture until its front end has left the screen, and the pieces
 * hung in the room wait with it (enterOf in covers3d.ts chooses them; the rest pose never sees a difference).
 */
export interface EnterEdge {
  /** The plane's id. */
  id: string;
  /** A side wall enters on its own; a ceiling never before the walls (no lid floats over an open floor). */
  kind: 'wall' | 'ceiling';
  /** Its front end (world units): a wall's upright edge, a ceiling's front edge. */
  a: Vec3;
  b: Vec3;
}
export interface OpeningEnter {
  edges: readonly EnterEdge[];
  /** Pieces hung from above (bells, chandeliers, bunting): they take the least of the edges' fades. */
  hangs: readonly string[];
}

/** A screen in stage units: the box's size over its --u (max(h/800, w/1200), as StageStyles sets it). */
export interface StageViewBox {
  w: number;
  h: number;
}

/** A box of `w` × `h` px in stage units. */
export function viewIn(w: number, h: number): StageViewBox {
  const unit = Math.max(h / 800, w / 1200);
  return unit > 0 ? { w: w / unit, h: h / unit } : { w: 1200, h: 800 };
}

/** How far in from a screen's edge (a fraction of the screen) an entering plane's front end may come before it is gone. */
const ENTER_BAND = 0.05;

/** How far into a screen (fractions of it, 0 at an edge) a world segment reaches at a pose, the deepest of its points. */
function reachInto(a: Vec3, b: Vec3, pose: CameraPose, view: StageViewBox): number {
  // World to eye, as poseTransform: translate, then rotateY(−yaw), rotateX(−pitch), rotateZ(−roll); the lens divides by depth.
  const ry = (-pose.yaw * Math.PI) / 180;
  const rx = (-pose.pitch * Math.PI) / 180;
  const rz = (-pose.roll * Math.PI) / 180;
  const p = perspectiveOf(pose.fov);
  let best = -Infinity;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x0 = a.x + (b.x - a.x) * t - pose.x;
    const y0 = a.y + (b.y - a.y) * t - pose.y;
    const z0 = a.z + (b.z - a.z) * t - pose.z;
    const x1 = x0 * Math.cos(ry) + z0 * Math.sin(ry);
    const z1 = -x0 * Math.sin(ry) + z0 * Math.cos(ry);
    const y2 = y0 * Math.cos(rx) - z1 * Math.sin(rx);
    const z2 = y0 * Math.sin(rx) + z1 * Math.cos(rx);
    const x3 = x1 * Math.cos(rz) - y2 * Math.sin(rz);
    const y3 = x1 * Math.sin(rz) + y2 * Math.cos(rz);
    const depth = -z2;
    if (depth < 1) continue;
    const fx = 0.5 + (x3 * p) / depth / view.w;
    // The frame's horizon point sits at (50%, 55%) of the box (StageView's frame).
    const fy = 0.55 + (y3 * p) / depth / view.h;
    best = Math.max(best, Math.min(fx, 1 - fx, fy, 1 - fy));
  }
  return best;
}

/** How much of an entering plane shows at a pose: all of it once its front end is off the screen, none while it is a band in. */
export function enterFade(a: Vec3, b: Vec3, pose: CameraPose, view: StageViewBox): number {
  const reach = reachInto(a, b, pose, view);
  return reach <= 0 ? 1 : 1 - smoothstep(clamp(reach / ENTER_BAND));
}

// ─────────────────────────── Light and words ───────────────────────────

/**
 * The web overlay's light at q (0..1 each): `dim`, the house lights down around
 * the closed cover, lifting as it opens (the room brightens); `glow`, light
 * flooding through as the cover parts and the set's focal bloom as the camera
 * arrives, `spread` its width (×, as the gap between the leaves widens); `veil`,
 * the words veil coming back as the names arrive. At q = 1: no dim, no glow,
 * the veil whole. Films draw their own light and ignore this.
 */
export function openingLight(kind: StageIntro, q: number): { dim: number; glow: number; spread: number; veil: number } {
  const marks = OPENING_MARKS[kind];
  const veil = r3(q >= 1 ? 1 : inOut(span(q, marks.build, marks.type)));
  if (q >= 1) return { dim: 0, glow: 0, spread: 1, veil };
  switch (kind) {
    case 'arrival':
      // Light spills through the gate as its leaves part, then the focal bloom as the camera arrives (q .85).
      // Closed, the venue's light glows behind the seal between the leaves.
      return {
        dim: r3(1 - inOut(span(q, 0.12, 0.72))),
        glow: r3(Math.max(0.22 * (1 - inOut(span(q, 0.25, 0.5))), 0.6 * swell(span(q, 0.02, 0.38)), 0.4 * swell(span(q, 0.7, 1)))),
        spread: r3(q < 0.6 ? 0.55 + 0.75 * out(span(q, 0, 0.3)) : 1.3),
        veil,
      };
    case 'doorway':
      // A blade of light leaks at the seam of the closed doors, widens as the leaves swing and floods out as the camera steps through.
      return {
        dim: r3(1 - inOut(span(q, 0.08, 0.58))),
        glow: r3(Math.max(0.32 * (1 - inOut(span(q, 0.3, 0.55))), 0.68 * swell(span(q, 0.03, 0.5)))),
        spread: r3(0.35 + 2.4 * out(span(q, 0.05, 0.45))),
        veil,
      };
    case 'silk':
      return { dim: r3(1 - inOut(span(q, 0, 0.75))), glow: r3(0.36 * swell(span(q, 0.15, 0.85))), spread: 1, veil };
    case 'unfold':
      return { dim: r3(1 - inOut(span(q, 0.3, 0.8))), glow: r3(0.48 * swell(span(q, 0.4, 0.92))), spread: 1, veil };
  }
}

// ─────────────────────────── The state at q ───────────────────────────

/**
 * An opening's cover: its pieces (coverPieces, or their CoverPieceInfo) and their hinge lines (coverMotion), both from
 * covers3d.ts, and the set's planes that enter as the opening plays (enterOf; with `view` in openingState).
 */
export interface OpeningCovers {
  pieces: readonly (Piece | CoverPieceInfo)[];
  motion: CoverMotion;
  enter?: OpeningEnter;
}

export interface OpeningState {
  pose: CameraPose;
  /**
   * The cover pieces by id. With `covers`, each has its full transform (its moves before its placement:
   * StageView's override replaces the placement with it) and its opacity, the near fade included (StageView
   * multiplies a piece's own opacity in). Without, the choreography's opacities only. With the covers' `enter`
   * and a `view`, the entering set pieces too, by their ids: an opacity alone (their placement stays).
   */
  pieces: Record<string, { transform?: string; opacity?: number }>;
  /** How far past the build-in's start the opening is (q; null before it). Films: the build began at revealTimes(kind).build s. */
  build: number | null;
  /** Whether the names have turned up (the web adds `.bulava-type` from here). */
  type: boolean;
}

const infoOf = (p: Piece | CoverPieceInfo): CoverPieceInfo => ('placement' in p ? p : coverInfo(p));

/**
 * An opening at q (§4): pure and bounded; at q = 0 the camera is at
 * `openingStart(kind)` (or `opts.start`) and at q = 1 exactly on the set's rest pose.
 * `opts.pose` replaces the camera the fades are judged from (the web's idle sway); `opts.view` is the screen
 * in stage units (viewIn), which the entering planes are judged on.
 */
export function openingState(
  kind: StageIntro,
  q: number,
  set: Pick<StageSet, 'poses'>,
  opts: { covers?: OpeningCovers; start?: CameraPose; pose?: CameraPose; view?: StageViewBox } = {},
): OpeningState {
  const at = clamp(Number.isFinite(q) ? q : 0);
  const { rest } = posesOf(set);
  const pose = opts.pose ?? openingPose(kind, at, opts.start ?? openingStart(kind, set), rest);
  const covers = opts.covers;
  const moves = coverMoves(kind, at, covers?.motion);
  const pieces: OpeningState['pieces'] = {};
  if (covers) {
    const infos = covers.pieces.map(infoOf);
    const fades = new Map<string, number>();
    for (const piece of infos) {
      if (!piece.at) continue;
      const move = moves[piece.id] ?? { opacity: 1 };
      fades.set(piece.id, nearFade(movedPoint(piece.at, piece.id, move, covers.motion), pose, piece.fades));
    }
    for (const piece of infos) {
      const move = moves[piece.id] ?? { opacity: 1 };
      const prefix = coverPrefix(piece.id, move, covers.motion, piece.at);
      const partner = COVER_PARTNER[piece.id];
      const fade = piece.at ? fades.get(piece.id)! : partner ? (fades.get(partner) ?? 1) : 1;
      // Open is open: every cover piece is gone on the rest pose (the arrival's ground lies behind the eye by then).
      pieces[piece.id] = { transform: prefix ? `${prefix} ${piece.placement}` : piece.placement, opacity: at >= 1 ? 0 : r3(clamp(move.opacity * fade)) };
    }
  } else {
    for (const [id, move] of Object.entries(moves)) pieces[id] = { opacity: at >= 1 ? 0 : r3(clamp(move.opacity)) };
  }
  // The room around the walk-in: planes whose front ends are on screen wait off the picture (all in at q = 1). Walls
  // enter on their own, a ceiling with the last of them, the hung pieces with the whole room.
  const enter = covers?.enter;
  if (enter && opts.view && at < 1) {
    const fades = enter.edges.map((edge) => r3(enterFade(edge.a, edge.b, pose, opts.view!)));
    const walls = Math.min(1, ...fades.filter((_, i) => enter.edges[i]!.kind === 'wall'));
    enter.edges.forEach((edge, i) => {
      pieces[edge.id] = { opacity: edge.kind === 'ceiling' ? Math.min(fades[i]!, walls) : fades[i]! };
    });
    const room = Math.min(1, ...fades);
    for (const id of enter.hangs) pieces[id] = { opacity: room };
  }
  const marks = OPENING_MARKS[kind];
  return { pose, pieces, build: at >= marks.build ? Math.round((at - marks.build) * 1e6) / 1e6 : null, type: at >= marks.type };
}
