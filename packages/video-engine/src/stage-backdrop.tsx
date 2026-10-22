import { useCurrentFrame, useVideoConfig } from 'remotion';
import { isStageIntro, type EffectName, type SceneReveal, type StageIntro, type StageShot, type ThemeColors } from '@bulava/template-schema';
import {
  cameraMoveToShot,
  COVER_LAYOUT,
  coverMotion,
  coverPieces,
  easeCamera,
  enterOf,
  fadeAt,
  filmParticleCount,
  fitStart,
  lerpPose,
  openingLight,
  openingStart,
  openingState,
  pieceFade,
  placeParticles,
  posesOf,
  revealProgress,
  revealTimes,
  seedOf,
  shotPose,
  STAGE_REVEAL,
  stageSet,
  stageVeil,
  StageView,
  type CameraPose,
  type OpeningCovers,
  type Particle,
  type PieceOverride,
  type StageName,
  type StageSet,
  type StageViewBox,
} from '@bulava/template-engine';

/**
 * A Signature 3D stage behind a film scene (final.md §3.3, ADR-078): the
 * website's own set, filmed by a camera that moves through it.
 *
 * Every frame is a pure function of the frame number (Remotion renders frames
 * in any order, in several tabs): the camera's shot (`shotPose`, a station
 * further down the set for each repeat of a function scene), the opening the
 * website plays (`scene.reveal`: the cover held 0.7 s, then opened over 2.6 s
 * by `openingState`, ending exactly on the rest pose), the set building in
 * behind it, every piece's ambient motion and the particles at depth
 * (`motionAt`, evaluated from the same table as the website's keyframes), and
 * the near fade of anything the camera comes close to or passes (§2.5).
 *
 * The set, its drawings, the cover and the particles are made once per set and
 * scene (the registry memoises sets, this module their covers and particles,
 * StageView each drawing on its props), so a frame re-renders only the world's
 * transform, the moving wrappers and the particles.
 * Sets draw no photos, so nothing waits on `delayRender`.
 */

/** The width scenes are laid out at (the website hero's phone), scaled to the frame: the same as SceneBackdrop. */
const STAGE_WIDTH = 432;
/** Shots stay inside the intensity the near-plane rules are checked at (final.md §2.5, §8.1: k ≤ 1.2). */
export const MAX_SHOT_INTENSITY = 1.2;
/** Seconds over which a scene's shot eases in from the rest pose a stage opening landed on (no cut). */
export const SHOT_BLEND_SEC = 1.2;
/** When a stage opening has landed on the rest pose (seconds into its scene): the hold, then the run. */
export const STAGE_REVEAL_END = STAGE_REVEAL.hold + STAGE_REVEAL.run;
/** Half the arrival gate's frame (the cover-frame piece, 1000 units wide): wide films start close enough for it to fill them. */
const ARRIVAL_HALF = 500;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const smooth = (n: number) => {
  const c = clamp01(n);
  return c * c * (3 - 2 * c);
};

/** The 9:16 box a stage is laid out in for a frame (as SceneBackdrop), and the stage's px per unit inside it. */
export function stageBox(width: number, height: number): { scale: number; w: number; h: number; unit: number } {
  const scale = Math.min(width / STAGE_WIDTH, height / ((STAGE_WIDTH * 16) / 9));
  const w = width / scale;
  const h = height / scale;
  return { scale, w, h, unit: Math.max(h / 800, w / 1200) };
}

export interface StageFrameInput {
  /** The scene's shot and its strength (0–1.2). */
  shot: StageShot;
  k: number;
  /** The repeat of a per-function scene: its station along the set (final.md §2.6). */
  station: number;
  /** The frame in the scene, the scene's length in frames, and the film's rate. */
  frame: number;
  frames: number;
  fps: number;
  /** The stage opening the scene plays (scene.reveal), if any. */
  opening: StageIntro | null;
  /** The opening's cover pieces and hinges (null: the camera and timings only). */
  covers: OpeningCovers | null;
  /** Half the frame's visible width in stage units (wide films bring the arrival's gate closer to fill them). */
  halfWidth: number;
  /** The frame in stage units (the set's entering walls are judged on it while an opening plays; unset: they never wait). */
  view?: StageViewBox;
}

export interface StageFrame {
  pose: CameraPose;
  /** The cover pieces' transforms and opacities while the opening plays (null once it has landed, or without one). */
  covers: Record<string, PieceOverride> | null;
  /** Seconds since the set began to build in (negative: still to come; undefined: built, no opening). */
  buildTime: number | undefined;
  /** How much of the words veil shows (0..1): an opening brings it back as the names arrive. */
  veil: number;
}

/**
 * Where the camera is and what the opening does at one frame of a stage scene
 * (pure). Without an opening, the shot runs over the whole scene. With one, the
 * cover holds for 0.7 s, opens over 2.6 s and lands on the rest pose
 * (STAGE_REVEAL_END, 3.3 s); the shot then runs over the rest of the scene,
 * easing in from rest over SHOT_BLEND_SEC so nothing cuts.
 */
export function stageFrame(set: Pick<StageSet, 'poses' | 'focus'>, o: StageFrameInput): StageFrame {
  const k = Math.max(0, Math.min(MAX_SHOT_INTENSITY, o.k));
  const fps = Math.max(1, o.fps);
  const t = o.frame / fps;
  if (!o.opening) {
    const p = easeCamera(clamp01(o.frame / Math.max(1, o.frames)));
    return { pose: shotPose(set, o.shot, p, k, o.station, t), covers: null, buildTime: undefined, veil: 1 };
  }
  const buildTime = Math.round((t - revealTimes(o.opening).build) * 1e6) / 1e6;
  if (t < STAGE_REVEAL_END) {
    const q = revealProgress(t);
    const plain = openingStart(o.opening, set);
    const start = o.opening === 'arrival' ? fitStart(plain, { half: ARRIVAL_HALF, z: COVER_LAYOUT.arrival.z }, o.halfWidth) : plain;
    const state = openingState(o.opening, q, set, { covers: o.covers ?? undefined, start, ...(o.view ? { view: o.view } : {}) });
    return { pose: state.pose, covers: o.covers ? state.pieces : null, buildTime, veil: openingLight(o.opening, q).veil };
  }
  const { rest } = posesOf(set);
  const s = t - STAGE_REVEAL_END;
  const span = Math.max(1 / fps, o.frames / fps - STAGE_REVEAL_END);
  const shot = shotPose(set, o.shot, easeCamera(clamp01(s / span)), k, o.station, s);
  return { pose: lerpPose(rest, shot, smooth(s / SHOT_BLEND_SEC)), covers: null, buildTime, veil: 1 };
}

/**
 * The near fade of the set's props and lights at a pose (§2.5): anything the camera comes within 300 units of fades
 * out by 150, and anything it has passed is hidden. Planes never fade (Chrome clips them at the eye).
 */
export function pieceFades(set: Pick<StageSet, 'pieces'>, pose: CameraPose): Record<string, PieceOverride> {
  const out: Record<string, PieceOverride> = {};
  for (const piece of set.pieces) {
    if (piece.kind === 'plane') continue;
    const fade = pieceFade(piece, pose);
    if (fade < 1) out[piece.id] = { opacity: Math.round(fade * 1000) / 1000 };
  }
  return out;
}

/**
 * The particles still in front of the camera at a pose, with the near fade of those it comes close to. The fades go
 * in `overrides` by particle id; the particles it has passed (or that would fill the lens) are left out.
 */
export function visibleParticles(particles: readonly Particle[], pose: CameraPose, overrides: Record<string, PieceOverride>): Particle[] {
  const out: Particle[] = [];
  for (const particle of particles) {
    const fade = fadeAt(particle.at, pose);
    if (fade <= 0) continue;
    if (fade < 1) overrides[particle.id] = { opacity: Math.round(fade * 1000) / 1000 };
    out.push(particle);
  }
  return out;
}

export interface StageBackdropProps {
  stage: StageName;
  /** The scene's shot (unset: its camera move mapped to the nearest shot), strength and veil. */
  shot?: StageShot;
  camera: Parameters<typeof cameraMoveToShot>[0];
  intensity: number;
  veil: number;
  colors: ThemeColors;
  /** The scene's length in frames. */
  frames: number;
  /** The scene's reveal: a stage opening plays over its first seconds. */
  reveal: SceneReveal;
  /** The repeat of a per-function scene (its station along the set). */
  station: number;
  /** The scene's particles, drawn at depth in the stage. */
  particles: EffectName;
  /** Printed on the set's and the cover's seals (coverMonogram). */
  monogram: string;
  /** The film's script face, for the cover's monogram. */
  script: string;
  /** A rand() salt for the particles (each scene its own). */
  seed: string;
}

/** A stage opening's cover as films draw it: the pieces themselves (StageView draws them) and their hinges. */
export interface FilmCovers extends OpeningCovers {
  pieces: ReturnType<typeof coverPieces>;
}

/**
 * What a scene makes once (per set, which the registry memoises per stage, palette and monogram): the opening's
 * cover and the particles. Kept per set object, so every frame of every tab reuses the same pieces, and the
 * drawings StageView memoises on them are never redrawn while the camera moves.
 */
const coverMemo = new WeakMap<StageSet, Map<string, FilmCovers>>();
const particleMemo = new WeakMap<StageSet, Map<string, Particle[]>>();

function memoOn<T>(memo: WeakMap<StageSet, Map<string, T>>, set: StageSet, key: string, make: () => T): T {
  let byKey = memo.get(set);
  if (!byKey) {
    byKey = new Map();
    memo.set(set, byKey);
  }
  const hit = byKey.get(key);
  if (hit) return hit;
  const made = make();
  byKey.set(key, made);
  return made;
}

/**
 * Films: when a cover's seal, turning like a coin, faces the camera (seconds into the scene): the middle of the hold
 * the guest sees once the scene has faded in, so the monogram reads before the seal breaks. On the website it turns
 * for as long as the guest waits; a film holds the cover for 0.7 s.
 */
export const SEAL_FACE_SEC = 0.55;

type CoverPiece = ReturnType<typeof coverPieces>[number];
/** A coin-turning piece's phase set so it faces the camera at SEAL_FACE_SEC. */
function facingAtHold(piece: CoverPiece): CoverPiece {
  if (piece.motion?.kind !== 'coin') return piece;
  const turned = (SEAL_FACE_SEC / Math.max(0.1, piece.motion.period)) % 1;
  return { ...piece, motion: { ...piece.motion, phase: Math.round(((1 - turned) % 1) * 10000) / 10000 } };
}

/**
 * A stage opening's cover for a set: its pieces in the palette (the monogram in the film's script face), their hinges
 * (leaves stopping at the set's walls), and the set's walls that wait off the picture while their ends are in frame.
 */
export function stageCovers(kind: StageIntro, set: StageSet, ctx: { colors: ThemeColors; monogram: string }, script: string): FilmCovers {
  return memoOn(coverMemo, set, `${kind}|${script}`, () => {
    const enter = enterOf(set);
    return {
      pieces: coverPieces(kind, set, { ...ctx, detail: 'full' }, { fontFamily: script }).map(facingAtHold),
      motion: coverMotion(kind, set),
      ...(enter.edges.length ? { enter } : {}),
    };
  });
}

/** A scene's particles in a set: the film's count (filmParticleCount), placed from the scene's own salt. */
export function stageParticles(set: StageSet, effect: EffectName, seed: string): Particle[] {
  return memoOn(particleMemo, set, `${effect}|${seed}`, () => placeParticles(set, effect, filmParticleCount(set), seedOf(`${set.name}:${seed}`)));
}

export function StageBackdrop({ stage, shot, camera, intensity, veil, colors, frames, reveal, station, particles, monogram, script, seed }: StageBackdropProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const box = stageBox(width, height);
  const set = stageSet(stage, { colors, monogram, detail: 'full' });
  const opening = isStageIntro(reveal) ? reveal : null;
  const covers = opening ? stageCovers(opening, set, { colors, monogram }, script) : null;
  const placed = stageParticles(set, particles, seed);

  const state = stageFrame(set, {
    shot: shot ?? cameraMoveToShot(camera),
    k: intensity,
    station,
    frame,
    frames,
    fps,
    opening,
    covers,
    halfWidth: box.w / box.unit / 2,
    view: { w: box.w / box.unit, h: box.h / box.unit },
  });
  // The near fades, then the opening's: cover pieces take theirs; a set piece waiting off the picture keeps both.
  const overrides: Record<string, PieceOverride> = pieceFades(set, state.pose);
  for (const [id, o] of Object.entries(state.covers ?? {})) {
    const near = overrides[id]?.opacity;
    overrides[id] = near !== undefined && o.transform === undefined && o.opacity !== undefined ? { opacity: Math.round(near * o.opacity * 1000) / 1000 } : o;
  }
  const shown = visibleParticles(placed, state.pose, overrides);
  // The words veil: the scene's own, never lighter than the set's (the website hero's), back in as an opening's names arrive.
  const strength = Math.max(veil, set.veil) * state.veil;

  return (
    <div
      data-stage-backdrop={stage}
      style={{ position: 'absolute', left: 0, top: 0, width: box.w, height: box.h, transform: `scale(${box.scale})`, transformOrigin: '0 0', overflow: 'hidden', background: set.sky }}
    >
      <StageView
        set={set}
        colors={colors}
        mode="film"
        pose={state.pose}
        covers={state.covers && covers ? covers.pieces : undefined}
        particles={shown}
        time={frame / fps}
        buildTime={state.buildTime}
        overrides={overrides}
        unit={box.unit}
      />
      {strength > 0.001 ? <div style={{ position: 'absolute', inset: 0, background: stageVeil({ name: stage, veil: strength }, colors) }} /> : null}
    </div>
  );
}
