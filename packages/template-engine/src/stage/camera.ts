import type { CameraMove, StageShot } from '@bulava/template-schema';
import type { CameraPose, StageSet, Vec3 } from './types';
import { clamp, deg, HORIZON_Y, num, perspectiveOf, u } from './units';

/**
 * The eye camera (final.md §2.1, VERIFIED in the spike): a pose is the eye's
 * position plus yaw, pitch, roll and a vertical fov. `poseTransform` and
 * `lensStyle` are the only places these strings are made, on the server, in the
 * browser and in films alike. Pure and deterministic (num()/u() only).
 */

/** The poses every set starts from (a set may override any of them in `poses`). */
export const DEFAULT_POSES: Readonly<{ far: CameraPose; rest: CameraPose; close: CameraPose }> = {
  /** Arrival start, pullAway end, films' closings. */
  far: { x: 600, y: 300, z: 1100, yaw: 0, pitch: 0, roll: 0, fov: 50 },
  /** The hero, posters, every opening's end. */
  rest: { x: 600, y: 330, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 60 },
  /** The scroll dolly's target (clamped). */
  close: { x: 600, y: 350, z: -650, yaw: 0, pitch: 0, roll: 0, fov: 58 },
};

/** How the default far and close poses stand from the default rest pose (positions and turns, as offsetPose adds them). */
const stepFrom = (rest: CameraPose, to: CameraPose): CameraPose => ({
  x: to.x - rest.x,
  y: to.y - rest.y,
  z: to.z - rest.z,
  yaw: to.yaw - rest.yaw,
  pitch: to.pitch - rest.pitch,
  roll: to.roll - rest.roll,
  fov: to.fov - rest.fov,
});
const FAR_STEP = stepFrom(DEFAULT_POSES.rest, DEFAULT_POSES.far);
const CLOSE_STEP = stepFrom(DEFAULT_POSES.rest, DEFAULT_POSES.close);

/**
 * A set's three poses: its own where it has them. A set that moves its rest pose (a higher eye, a gaze lifted a few
 * degrees) and leaves far or close to the defaults gets them moved with it, by the defaults' own steps from rest, so
 * the arrival, the films' pull-aways and fly-throughs and the scroll dolly never dip, tilt or jump on the way.
 */
export function posesOf(set: Pick<StageSet, 'poses'>): { far: CameraPose; rest: CameraPose; close: CameraPose } {
  const rest = { ...DEFAULT_POSES.rest, ...set.poses?.rest };
  return {
    far: set.poses?.far ? { ...DEFAULT_POSES.far, ...set.poses.far } : offsetPose(rest, FAR_STEP),
    rest,
    close: set.poses?.close ? { ...DEFAULT_POSES.close, ...set.poses.close } : offsetPose(rest, CLOSE_STEP),
  };
}

/** transform-origin of the rig, look and world elements: the horizon point. */
export const WORLD_ORIGIN = `${u(600)} ${u(HORIZON_Y)} 0`;

/**
 * The world element's transform for an eye pose: the eye lands exactly on the
 * CSS viewer at (600, H, p) in lens space, so rotations pivot on the eye and
 * the fov acts as a pure lens.
 */
export function poseTransform(pose: CameraPose): string {
  const p = perspectiveOf(pose.fov);
  return `translateZ(${u(p)}) rotateZ(${deg(-pose.roll)}) rotateX(${deg(-pose.pitch)}) rotateY(${deg(-pose.yaw)}) translate3d(${u(600 - pose.x)}, ${u(HORIZON_Y - pose.y)}, ${u(-pose.z)})`;
}

/** The lens element's style for a vertical field of view. */
export function lensStyle(fov: number): { perspective: string; perspectiveOrigin: string } {
  return { perspective: u(perspectiveOf(fov)), perspectiveOrigin: `${u(600)} ${u(HORIZON_Y)}` };
}

/** A pose between two others (t 0..1, not clamped: callers ease first). */
export function lerpPose(a: CameraPose, b: CameraPose, t: number): CameraPose {
  const l = (x: number, y: number) => x + (y - x) * t;
  return { x: l(a.x, b.x), y: l(a.y, b.y), z: l(a.z, b.z), yaw: l(a.yaw, b.yaw), pitch: l(a.pitch, b.pitch), roll: l(a.roll, b.roll), fov: l(a.fov, b.fov) };
}

/** A pose moved by a partial delta (positions and turns add up). */
export function offsetPose(pose: CameraPose, delta: Partial<CameraPose>): CameraPose {
  return {
    x: pose.x + (delta.x ?? 0),
    y: pose.y + (delta.y ?? 0),
    z: pose.z + (delta.z ?? 0),
    yaw: pose.yaw + (delta.yaw ?? 0),
    pitch: pose.pitch + (delta.pitch ?? 0),
    roll: pose.roll + (delta.roll ?? 0),
    fov: pose.fov + (delta.fov ?? 0),
  };
}

/** cubic-bezier(x1, y1, x2, y2) as a function of 0..1 (arithmetic only, as CSS and Remotion's Easing.bezier). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s;
  const sampleY = (s: number) => ((ay * s + by) * s + cy) * s;
  const slopeX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  return (t: number) => {
    const x = clamp(t);
    if (x === 0 || x === 1) return x;
    let s = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(s) - x;
      if (Math.abs(err) < 1e-7) return sampleY(s);
      const d = slopeX(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0;
    let hi = 1;
    s = x;
    for (let i = 0; i < 40; i++) {
      const v = sampleX(s);
      if (Math.abs(v - x) < 1e-7) break;
      if (v < x) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return sampleY(s);
  };
}

/** The backdrops' camera easing, cubic-bezier(0.33, 0, 0.25, 1): shot progress is eased by the caller with it. */
export const easeCamera: (t: number) => number = cubicBezier(0.33, 0, 0.25, 1);

/** The triangle wave of TemplateVideo's `swingAt`: -1..1 over one period. */
export const tri = (t: number): number => 1 - 4 * Math.abs(t - Math.floor(t) - 0.5);

/** rotateY(a) of a vector, as CSS defines it: (x cos a + z sin a, y, −x sin a + z cos a). */
function rotY(v: Vec3, a: number): Vec3 {
  const r = (a * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

/**
 * The camera of a stage shot (final.md §2.6). `p` is the shot progress 0..1,
 * already eased with `easeCamera`; `k` the intensity (0–1.2); `station` the
 * function scene's index (stations step 260 units into the set); `t` the
 * seconds into the scene (only `settle` breathes with time).
 */
export function shotPose(set: Pick<StageSet, 'poses' | 'focus'>, shot: StageShot, p: number, k = 1, station = 0, t = 0): CameraPose {
  const { far, rest: R } = posesOf(set);
  const q = clamp(p);
  const i = ((Math.round(station) % 3) + 3) % 3;
  const S = offsetPose(R, { z: -260 * i });
  const path = (from: Partial<CameraPose>, to: Partial<CameraPose>) => lerpPose(offsetPose(S, from), offsetPose(S, to), q);
  switch (shot) {
    case 'still':
      return { ...R };
    case 'settle':
      return offsetPose(R, { z: -6 * k * tri(t / 6), yaw: 0.6 * k * tri(t / 9) });
    case 'dollyIn':
      return path({}, { z: -240 * k });
    case 'dollyOut':
      return path({ z: -240 * k }, {});
    case 'truckLeft':
      return path({ x: 110 * k, yaw: -2 * k }, { x: -110 * k, yaw: 2 * k });
    case 'truckRight':
      return path({ x: -110 * k, yaw: 2 * k }, { x: 110 * k, yaw: -2 * k });
    case 'craneDown':
      return path({ y: -180 * k, z: 60 * k }, {});
    case 'craneUp':
      return path({}, { y: -180 * k, z: 60 * k });
    case 'orbitLeft':
    case 'orbitRight': {
      const sign = shot === 'orbitLeft' ? 1 : -1;
      const theta = sign * (-6 * k + 12 * k * q);
      const F = set.focus;
      const v = rotY({ x: S.x - F.x, y: S.y - F.y, z: S.z - F.z }, theta);
      return { ...S, x: F.x + v.x, y: F.y + v.y, z: F.z + v.z, yaw: S.yaw + theta };
    }
    case 'riseOver':
      return path({}, { y: -220 * k, z: -200 * k });
    case 'flyThrough':
      return lerpPose(far, R, q);
    case 'pullAway':
      return lerpPose(R, far, q);
    default:
      return { ...R };
  }
}

/** The scenes' camera moves as the nearest stage shot: hosts' redrawn and added scenes keep valid backdrops. */
export function cameraMoveToShot(move: CameraMove): StageShot {
  switch (move) {
    case 'push':
      return 'dollyIn';
    case 'pull':
      return 'dollyOut';
    case 'panLeft':
      return 'truckLeft';
    case 'panRight':
      return 'truckRight';
    case 'rise':
      return 'craneUp';
    case 'descend':
      return 'craneDown';
    default:
      return 'still';
  }
}

/** A pose as its numbers rounded like the transform strings (for comparisons and data attributes). */
export const poseKey = (pose: CameraPose): string => [pose.x, pose.y, pose.z, pose.yaw, pose.pitch, pose.roll, pose.fov].map(num).join(',');
