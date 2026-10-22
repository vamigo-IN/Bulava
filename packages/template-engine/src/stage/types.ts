import type { ReactNode } from 'react';
import type { StageNameValue, ThemeColors } from '@bulava/template-schema';
import type { NATURE } from '../art/kit';

/**
 * The stage contract (ADR-078, final.md §1.3): what a set is made of and what
 * every drawing receives. Frozen on day 0: sets, the kit, openings and films
 * all build on these shapes.
 */

export type StageName = StageNameValue;
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
/** The EYE: position in stage units, turns in degrees (yaw > 0 turns left, pitch > 0 looks down), vertical field of view in degrees. */
export interface CameraPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  fov: number;
}
/** Haze by distance from the rest eye: colours mix toward `color` by max·clamp((d-near)/(far-near)). */
export interface Fog {
  color: string;
  near: number;
  far: number;
  max: number;
}
/** The set's key light (shade the side away from it 25% darker) and rim light (a thin edge on the side away). */
export interface KeyLight {
  from: 'left' | 'right' | 'above' | 'far' | 'below';
  color: string;
  rim: string;
}

export type MotionKind = 'sway' | 'bob' | 'flicker' | 'drift' | 'spin' | 'coin' | 'shimmer' | 'twinkle' | 'flutter' | 'pulse' | 'fall' | 'rise';
/** Ambient motion: amp in the kind's unit (deg for sway/spin/flutter, units for bob/drift/fall/rise, 0..1 otherwise), period in s, phase 0..1. */
export interface Motion {
  kind: MotionKind;
  amp: number;
  period: number;
  phase?: number;
}
export type BuildIn = 'rise' | 'drop' | 'light' | 'bloom' | 'fade';
export type Role = 'sky' | 'architecture' | 'focal' | 'prop' | 'hanging' | 'light' | 'cover';

export interface PlaneGeometry {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  dNear: number;
  dFar: number;
}
/** What every drawing receives. Draw in an <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height="100%">. */
export interface DrawProps {
  w: number;
  h: number;
  /** The palette, already mixed toward the fog for this piece's distance. */
  colors: ThemeColors;
  /** NATURE mixed the same way (leaves, flames, flowers). */
  nature: Record<keyof typeof NATURE, string>;
  light: KeyLight;
  /** The rest eye's height inside this box, in units from its top (null: the box is wholly below it). Detail above it is drawn quiet. */
  eyeLine: number | null;
  detail: 'full' | 'low';
  /** rand() salt for this piece. */
  seed: number;
  /** Planes: world extent, so floors can place light pools at world (x, d). */
  plane?: PlaneGeometry;
}
export type Draw = (p: DrawProps) => ReactNode;

interface PieceBase {
  /** [a-z0-9-]+, unique in the set; cover pieces are 'cover-*'. */
  id: string;
  /** Kit or illustration name, for budgets and lookalikes ('pillar:granite', 'templeBells', 'mandap'). */
  art: string;
  role: Role;
  /** May sit behind the words: tone-on-tone, contrast ≤ 1.6:1 above the eye line. Planes and 'sky' are quiet by default. */
  quiet?: boolean;
  motion?: Motion;
  buildIn?: BuildIn;
  /** Default true for props, lights and covers; planes never fade. */
  nearFade?: boolean;
  /** Left out at detail 'low' (stills, thumbnails, the HD lever). */
  detail?: 'high';
}
export interface PlaneRecipe {
  kind: 'floor' | 'ceiling' | 'wallLeft' | 'wallRight' | 'back' | 'sky';
  /** The content box (units). */
  w: number;
  h: number;
  /** Engine-built; never authored. */
  transform: string;
  /** Right walls: the content wrapper gets scaleX(-1). */
  mirror: boolean;
  /** World corners of content TL, TR, BR, BL (project.ts). */
  corners: [Vec3, Vec3, Vec3, Vec3];
  geometry: PlaneGeometry;
}
export interface PlanePiece extends PieceBase {
  kind: 'plane';
  plane: PlaneRecipe;
  draw: Draw;
}
export interface PropPiece extends PieceBase {
  kind: 'prop';
  /** Anchor in world units (use billboard()/hang()). */
  at: Vec3;
  w: number;
  h: number;
  anchor: 'bottom' | 'top' | 'center';
  /** rotateY about the piece's vertical centre line, |turn| ≤ 60. */
  turn?: number;
  /** Mirrored drawing (the right-hand twin of a pair). */
  flipX?: boolean;
  /** A leaf property only. */
  opacity?: number;
  draw: Draw;
}
export interface LightPiece extends PieceBase {
  kind: 'light';
  at: Vec3;
  r: number;
  color: string;
  /** 0..1 at the centre. */
  strength: number;
  /** A second disc at 3r and strength×0.3 (counts as a second sprite). */
  bloom?: boolean;
}
export type Piece = PlanePiece | PropPiece | LightPiece;

export type GateStyle = 'palace' | 'garden' | 'torana' | 'tentFlap' | 'lane' | 'haveli' | 'ghat' | 'campus';
export type DoorStyle = 'temple' | 'houseGate' | 'church' | 'cedar' | 'ballroom' | 'haveli';
export type SilkStyle = 'damask' | 'dawn' | 'organza' | 'velvet' | 'temple';
export type CardStyle = 'trifold' | 'folio' | 'patra' | 'album' | 'certificate' | 'poster' | 'popup';

export interface StageSet {
  name: StageName;
  /** CSS background of the stage box (a gradient); seen wherever no plane is. */
  sky: string;
  light: KeyLight;
  fog: Fog;
  /** The words veil, 0..0.6 (§3.1.3). */
  veil: number;
  /** Defaults: DEFAULT_POSES. */
  poses?: Partial<{ far: CameraPose; rest: CameraPose; close: CameraPose }>;
  /** What orbits circle. */
  focus: Vec3;
  /** ≤ 22, ≤ 5 light sprites. */
  pieces: Piece[];
  /** Every set supports every stage opening. */
  covers: { gate: GateStyle; door: DoorStyle; silk: SilkStyle; card: CardStyle };
  /** Web count ≤ 40; films use min(60, round(count×1.5)). */
  particles: { count: number; dNear: number; dFar: number };
}
export interface SetContext {
  colors: ThemeColors;
  /** coverMonogram(couple, initials): printed on covers' seals. */
  monogram: string;
  detail: 'full' | 'low';
}
export type StageSetFactory = (ctx: SetContext) => StageSet;
