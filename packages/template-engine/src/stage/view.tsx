import { memo, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { STAGE_META, type ThemeColors } from '@bulava/template-schema';
import { hex } from '../art/kit';
import { mix } from '../theme';
import { posesOf, poseTransform, lensStyle, WORLD_ORIGIN } from './camera';
import { fogGradient, hazeAt, hazedColor, hazedNature, hazedPalette, hazedPaletteBy, hazeDistance, rgba } from './haze';
import { particleLook, type ParticleLook } from './kit/particles';
import { BUILD_DURATION, buildAt, buildDelay, motionAt, motionStyle } from './motion';
import type { Particle } from './particles';
import { fadesNear, SKY_BOX } from './planes';
import { GLOW_STOPS, lightBox, placementOf, projectPiece } from './project';
import type { BuildIn, CameraPose, Draw, DrawProps, LightPiece, Motion, Piece, StageSet } from './types';
import { HORIZON_Y, num, u } from './units';

/**
 * StageView (final.md §3.1.1): a set at a camera pose as CSS 3D, server-safe
 * (no hooks, no state), the same DOM for the website hero, posters and films.
 *
 *   .bulava-stage            box: container for --u (stylesheet) or --u in px (stills, films)
 *     .bulava-stage-frame    1200×800 units, the horizon point (600, 440) at (50%, 55%) of the box
 *       .bulava-stage-lens   perspective
 *         .bulava-stage-rig    preserve-3d: breath (CSS) and scroll dolly (rig.tsx)
 *           .bulava-stage-look   preserve-3d: pointer and gyro (rig.tsx)
 *             .bulava-stage-world  preserve-3d: poseTransform(pose)
 *               .bulava-piece      flat leaves: placement, data-piece/role/d, [data-cover], [data-fade]
 *                 [data-build]       build-in wrapper (2D)
 *                   [data-motion]      ambient motion wrapper (2D)
 *                     drawing
 *               svg.bulava-particle  one element each: `translate` places it, its motion is `transform`;
 *                                    a <use> of its shared drawing, in its own colours (--pa/--pb/--pc)
 *     svg (0×0)              the particles' shared drawings and gradients (particleLook), outside the 3D chain
 *
 * Rules (a markup test holds them): preserve-3d only on rig, look and world;
 * no opacity, overflow, filter, clip, mask, blend or isolation on them or
 * anything between the lens and a piece; inline styles only inside pieces;
 * every number through num()/u().
 */

export type StageMode = 'live' | 'preview' | 'thumbnail' | 'still' | 'film';

/** A per-frame change to one piece's element (openings and films): its transform and opacity replace the placement's. */
export interface PieceOverride {
  transform?: string;
  opacity?: number;
}

export interface StageViewProps {
  set: StageSet;
  /** The palette the set was built with (pieces are hazed from it by distance). */
  colors: ThemeColors;
  /** live/preview: CSS ambient motion; thumbnail/still: static; film: motion evaluated at `time`. */
  mode: StageMode;
  /** The camera (default: the set's rest pose). */
  pose?: CameraPose;
  /** A stage opening's cover pieces (coverPieces), drawn after the set. */
  covers?: readonly Piece[];
  /** Live: covers stay hidden until the opening decides to play. */
  coversHidden?: boolean;
  /** The effect's particles (placeParticles). */
  particles?: readonly Particle[];
  /** Films: seconds into the scene, for ambient motion and particles. */
  time?: number;
  /** Films: seconds since the build-in began (null or unset: built). */
  buildTime?: number | null;
  /** Films and openings: per-piece element changes, by id. */
  overrides?: Readonly<Record<string, PieceOverride>>;
  /** Fixed boxes (stills, films): px per unit. Unset: the box's own --u from StageStyles. */
  unit?: number;
  /** The stage opening the page plays (data-opening). */
  intro?: string;
  /** 'low' leaves out `detail: 'high'` pieces (default: low for thumbnails and stills). */
  detail?: 'full' | 'low';
}

const FILL: CSSProperties = { position: 'relative', width: '100%', height: '100%' };
const FRAME: CSSProperties = {
  position: 'absolute',
  left: `calc(50% - ${u(600)})`,
  top: `calc(55% - ${u(HORIZON_Y)})`,
  width: u(1200),
  height: u(800),
};
const CHAIN: CSSProperties = { position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transformOrigin: WORLD_ORIGIN };

/** A stable rand() salt from a piece id. */
export function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100003;
}

/** The rest eye's height inside a piece's box (units from its top), or null when the box lies wholly below it. */
function eyeLineOf(piece: Exclude<Piece, LightPiece>, rest: CameraPose): number | null {
  if (piece.kind === 'plane') {
    const { plane } = piece;
    switch (plane.kind) {
      // A level plane is wholly below the eye (null) or wholly above it (the eye line under its foot: all quiet).
      case 'floor':
      case 'ceiling':
        return rest.y >= plane.geometry.y0 ? plane.h : null;
      case 'sky':
        return SKY_BOX.frameY + HORIZON_Y;
      default:
        return rest.y >= plane.geometry.y0 ? rest.y - plane.geometry.y0 : null;
    }
  }
  const top = piece.anchor === 'bottom' ? piece.at.y - piece.h : piece.anchor === 'top' ? piece.at.y : piece.at.y - piece.h / 2;
  return rest.y >= top ? rest.y - top : null;
}

/** What every drawing of a set receives, made once per (set, palette, detail) so memoised drawings skip film frames. */
const drawMemo = new WeakMap<StageSet, Map<string, DrawProps>>();
function drawPropsOf(set: StageSet, piece: Exclude<Piece, LightPiece>, colors: ThemeColors, detail: 'full' | 'low', rest: CameraPose): DrawProps {
  let byPiece = drawMemo.get(set);
  if (!byPiece) {
    byPiece = new Map();
    drawMemo.set(set, byPiece);
  }
  const key = `${piece.id}|${detail}|${colors.primary}${colors.secondary}${colors.accent}${colors.background}${colors.surface}${colors.text}${colors.muted}`;
  const hit = byPiece.get(key);
  if (hit) return hit;
  const d = hazeDistance(piece);
  const box = piece.kind === 'plane' ? { w: piece.plane.w, h: piece.plane.h } : { w: piece.w, h: piece.h };
  const props: DrawProps = {
    ...box,
    colors: hazedPalette(colors, set.fog, d),
    nature: hazedNature(set.fog, d),
    light: set.light,
    eyeLine: eyeLineOf(piece, rest),
    detail,
    seed: seedOf(piece.id),
    ...(piece.kind === 'plane' ? { plane: piece.plane.geometry } : {}),
  };
  byPiece.set(key, props);
  return props;
}

/** A drawing, memoised on its props (films re-render only what moves). */
const PieceArt = memo(function PieceArt({ draw, props }: { draw: Draw; props: DrawProps }) {
  return <>{draw(props)}</>;
});

/**
 * Particles are hazed in steps of this much fog (final.md §1.3, at their rest distance as pieces are), so a field's
 * gradients repeat and particleLook can share them: a step moves a colour 5% of the way to the fog at most.
 */
export const PARTICLE_HAZE_STEP = 0.05;

/** The palette a particle at distance d is drawn in: hazed by the fog there, rounded to PARTICLE_HAZE_STEP. */
function particleColors(set: StageSet, colors: ThemeColors, d: number): ThemeColors {
  const a = hazeAt(set.fog, d);
  return a > 0 ? hazedPaletteBy(colors, set.fog, Math.min(set.fog.max, Math.round(a / PARTICLE_HAZE_STEP) * PARTICLE_HAZE_STEP)) : colors;
}

/** Looks by particle (a film re-renders its particles every frame; their looks never change). */
const lookMemo = new WeakMap<Particle, { colors: ThemeColors; look: ParticleLook }>();
function lookOf(particle: Particle, colors: ThemeColors): ParticleLook {
  const hit = lookMemo.get(particle);
  if (hit && hit.colors === colors) return hit.look;
  const look = particleLook({ effect: particle.effect, seed: particle.seed, colors });
  lookMemo.set(particle, { colors, look });
  return look;
}

/**
 * The particles' shared drawings and gradients, once per stage: a 0×0 SVG outside the 3D chain that every particle's
 * <use> points into (never display:none, which would leave its gradients unpainted). Ids are content keys, so two stages
 * on one page that define the same id define the same drawing.
 */
const ParticleSprite = memo(
  function ParticleSprite({ looks }: { sig: string; looks: readonly ParticleLook[] }) {
    const gradients = new Map<string, ReactElement>();
    const drawings = new Map<string, ReactNode>();
    for (const look of looks) {
      for (const g of look.gradients) if (g.key !== null && !gradients.has(g.key)) gradients.set(g.key, g);
      if (!drawings.has(look.key)) drawings.set(look.key, look.drawing);
    }
    return (
      <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', left: 0, top: 0 }}>
        <defs>
          {[...gradients.values()]}
          {[...drawings].map(([key, drawing]) => (
            <g key={key} id={key}>
              {drawing}
            </g>
          ))}
        </defs>
      </svg>
    );
  },
  (a, b) => a.sig === b.sig,
);

/**
 * A soft glow: a hot core (the light's colour toward white) at its strength, falling off to
 * nothing at the disc's edge. Plain alpha, never mix-blend-mode: a blending leaf makes Chrome
 * isolate the world (a grouping property) and flatten the whole set onto one plane (VERIFIED
 * with the doorway cover's seam light, on the GPU and software compositors alike).
 */
function glow(color: string, strength: number): string {
  const core = mix(hex(color), '#ffffff', 0.45);
  return `radial-gradient(circle, ${GLOW_STOPS.map(([at, share], i) => `${rgba(i === 0 ? core : color, strength * share)} ${num(at * 100)}%`).join(', ')})`;
}

interface Env {
  set: StageSet;
  colors: ThemeColors;
  rest: CameraPose;
  mode: StageMode;
  detail: 'full' | 'low';
  time: number;
  buildTime: number | null | undefined;
  delays: ReadonlyMap<string, number>;
  overrides: Readonly<Record<string, PieceOverride>> | undefined;
  coversHidden: boolean;
}

const animated = (mode: StageMode) => mode === 'live' || mode === 'preview';

/** The build-in wrapper (web: data-build and its delay; films: the frame's state), or the child alone. */
function withBuild(kind: BuildIn | undefined, id: string, env: Env, child: ReactNode, origin = '50% 50%'): ReactNode {
  if (!kind) return child;
  const delay = env.delays.get(id) ?? 0;
  if (env.mode === 'film') {
    if (env.buildTime === null || env.buildTime === undefined) return child;
    const state = buildAt(kind, (env.buildTime - delay) / BUILD_DURATION);
    return (
      <div data-build={kind} style={{ ...FILL, transformOrigin: origin, transform: state.transform, opacity: state.opacity }}>
        {child}
      </div>
    );
  }
  if (!animated(env.mode)) return child;
  return (
    <div data-build={kind} style={{ ...FILL, transformOrigin: origin, ['--build-delay' as string]: `${num(delay)}s` }}>
      {child}
    </div>
  );
}

/** The ambient motion wrapper (web: the kind's keyframes; films: its state at `time`), or the child alone. */
function withMotion(motion: Motion | undefined, env: Env, child: ReactNode, origin?: string): ReactNode {
  if (!motion) return child;
  if (env.mode === 'film') {
    const m = motionAt(motion, env.time);
    return (
      <div data-motion={motion.kind} style={{ ...FILL, transformOrigin: origin ?? m.origin, transform: m.transform, ...(m.opacity !== 1 ? { opacity: m.opacity } : {}) }}>
        {child}
      </div>
    );
  }
  if (!animated(env.mode)) return child;
  return (
    <div data-motion={motion.kind} style={{ ...FILL, ...motionStyle(motion), ...(origin ? { transformOrigin: origin } : {}) }}>
      {child}
    </div>
  );
}

/** Data attributes every piece element carries. */
function pieceData(piece: Piece, env: Env, cover: boolean): Record<string, string> {
  const data: Record<string, string> = { 'data-piece': piece.id, 'data-role': piece.role, 'data-d': num(env.rest.z - (piece.kind === 'plane' ? -piece.plane.geometry.dNear : piece.at.z)) };
  if (cover) data['data-cover'] = '';
  if (fadesNear(piece)) data['data-fade'] = '';
  // The anchor, so the client's near fade (fadeAt) needs no set art.
  if (piece.kind !== 'plane') data['data-at'] = [piece.at.x, piece.at.y, piece.at.z].map(num).join(',');
  if (env.mode === 'preview' && !cover) {
    const r = projectPiece(piece, env.rest).rect;
    data['data-proj'] = [r.x, r.y, r.w, r.h].map(num).join(',');
  }
  return data;
}

function pieceView(piece: Piece, env: Env, cover = false): ReactElement {
  const override = env.overrides?.[piece.id];
  const leafOpacity = piece.kind === 'prop' ? piece.opacity : undefined;
  const opacity = override?.opacity !== undefined ? override.opacity * (leafOpacity ?? 1) : leafOpacity;
  const hidden = cover && env.coversHidden;
  const base: CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    transformOrigin: '0 0',
    transform: override?.transform ?? placementOf(piece),
    ...(opacity !== undefined && opacity < 1 ? { opacity: Math.max(0, Math.round(opacity * 1000) / 1000) } : {}),
    ...(hidden ? { visibility: 'hidden' } : {}),
  };
  const data = pieceData(piece, env, cover);

  if (piece.kind === 'light') {
    const { R, size } = lightBox(piece);
    const d = env.rest.z - piece.at.z;
    const color = hazedColor(piece.color, env.set.fog, d);
    const discs = (piece.bloom ? [{ r: piece.r * 3, s: piece.strength * 0.3 }] : []).concat([{ r: piece.r, s: piece.strength }]);
    const body = (
      <>
        {discs.map((disc, i) => (
          <div key={i} style={{ position: 'absolute', left: u(R - disc.r), top: u(R - disc.r), width: u(2 * disc.r), height: u(2 * disc.r), borderRadius: '50%', background: glow(color, disc.s) }} />
        ))}
      </>
    );
    return (
      <div key={piece.id} className="bulava-piece bulava-light" {...data} style={{ ...base, width: u(size), height: u(size) }}>
        {withBuild(piece.buildIn, piece.id, env, withMotion(piece.motion, env, body, '50% 50%'))}
      </div>
    );
  }

  const props = drawPropsOf(env.set, piece, env.colors, env.detail, env.rest);
  const mirrored = piece.kind === 'plane' ? piece.plane.mirror : !!piece.flipX;
  const art = <PieceArt draw={piece.draw} props={props} />;
  const drawn = mirrored ? <div style={{ ...FILL, transform: 'scaleX(-1)' }}>{art}</div> : art;
  const haze = piece.kind === 'plane' && !cover ? fogGradient(piece.plane, env.set.fog) : null;
  // A standing prop blooms up from where it stands; everything else from its centre.
  const buildOrigin = piece.kind === 'prop' && piece.anchor === 'bottom' && piece.buildIn === 'bloom' ? '50% 100%' : '50% 50%';
  return (
    <div key={piece.id} className="bulava-piece" {...data} style={{ ...base, width: u(props.w), height: u(props.h) }}>
      {withBuild(piece.buildIn, piece.id, env, withMotion(piece.motion, env, drawn), buildOrigin)}
      {haze ? <div style={{ position: 'absolute', inset: 0, background: haze }} /> : null}
    </div>
  );
}

/** A particle: one SVG element placed by `translate`, moved by `transform`, drawing its look by reference. */
function particleView(particle: Particle, look: ParticleLook, env: Env): ReactElement {
  const { at, size, motion } = particle;
  const m = env.mode === 'film' ? motionAt(motion, env.time) : null;
  // Films fade a particle the camera comes close to (StageBackdrop writes it by particle id), on top of its motion's fade.
  const fade = env.overrides?.[particle.id]?.opacity;
  const opacity = Math.max(0, Math.round((m ? m.opacity : 1) * (fade ?? 1) * 1000) / 1000);
  const style = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: u(size),
    height: u(size),
    overflow: 'visible',
    translate: `${u(at.x - size / 2)} ${u(at.y - size / 2)} ${u(at.z)}`,
    ...(m ? { transform: m.transform } : animated(env.mode) ? motionStyle(motion) : {}),
    ...(opacity < 1 ? { opacity } : {}),
    ...look.vars,
  } as CSSProperties;
  return (
    <svg key={particle.id} className="bulava-particle" data-particle={particle.id} viewBox="0 0 20 20" style={style}>
      <use href={`#${look.key}`} transform={look.transform} />
    </svg>
  );
}

/** Pieces in paint order: the sky, planes far to near, then props and lights far to near (DOM order only breaks ties of depth). */
function ordered(pieces: readonly Piece[]): Piece[] {
  const far = (p: Piece) => (p.kind === 'plane' ? p.plane.geometry.dFar : -p.at.z);
  const rank = (p: Piece) => (p.role === 'sky' ? 0 : p.kind === 'plane' ? 1 : 2);
  return [...pieces].sort((a, b) => rank(a) - rank(b) || far(b) - far(a));
}

/** Build-in delays by depth, front to back, over the pieces that build in (final.md §3.1.5). */
export function buildDelays(pieces: readonly Piece[]): Map<string, number> {
  const building = pieces.filter((p) => p.buildIn);
  const dOf = (p: Piece) => (p.kind === 'plane' ? p.plane.geometry.dNear : -p.at.z);
  const ds = building.map(dOf);
  const dMin = Math.min(...ds);
  const dMax = Math.max(...ds);
  return new Map(building.map((p) => [p.id, buildDelay(dOf(p), dMin, dMax)]));
}

/** The scroll dolly's reach (§3.1.4): 35% of the way to the close pose, never bringing a prop or light within 300 units. */
export function dollyOf(set: StageSet): number {
  const { rest, close } = posesOf(set);
  let nearest = Infinity;
  for (const p of set.pieces) if (p.kind !== 'plane') nearest = Math.min(nearest, rest.z - p.at.z);
  return Math.max(0, Math.round(Math.min(0.35 * (rest.z - close.z), nearest - 300)));
}

/** The veil's colour: the primary in deep shade on dark stages, the page's background on light ones. */
const veilColor = (name: StageSet['name'], colors: ThemeColors): string => (STAGE_META[name].dark ? mix(colors.primary, '#000000', 0.55) : colors.background);

/** The words veil (§3.1.3): the stage's top darkened (dark stages) or lightened (light ones) behind the words. */
export function stageVeil(set: Pick<StageSet, 'name' | 'veil'>, colors: ThemeColors): string {
  const v = veilColor(set.name, colors);
  const a = Math.max(0, Math.min(0.6, set.veil));
  return `linear-gradient(180deg, ${rgba(v, a)} 0%, ${rgba(v, a * 0.6)} 45%, ${rgba(v, 0)} 62%)`;
}

/**
 * The words scrim's colour (§3.1.3): the veil reaches 62% of the hero, but a long words block (an emblem, an
 * invocation, the greeting, two names, the date, the place, a tagline) runs to three quarters of a phone, over the
 * focal art. The lines above and below the names carry a scrim of their own (HeroText's head and tail on a stage hero,
 * `.bulava-stage-scrim` in StageStyles): a pool of the veil's colour sized by those lines and feathered by a blurred
 * box shadow, so it holds for any block on any screen and leaves the art beside the words untouched. No filter,
 * outside the 3D chain; it turns up with the lines. StageHero hands this to it as `--bulava-scrim`. On a dark stage
 * it is the set's own night (its fog, a shade deeper, with a little of the veil's primary), so it reads as shadow in
 * the scene rather than a tint laid over it; on a light stage, the page's paper.
 */
export function stageScrim(set: Pick<StageSet, 'name' | 'veil' | 'fog'>, colors: ThemeColors): string {
  const dark = STAGE_META[set.name].dark;
  // Dark ink on a light stage needs more of the page's colour than light ink on a dark one needs of the shade: the
  // muted and accent inks are corrected for the paper itself, so the pool must come close to it over a mid-tone ceiling
  // (QA, §8.2 item 4: the small lines at 4.5:1 against the 90th-percentile worst pixel behind them).
  const a = dark ? Math.max(0.58, Math.min(0.7, set.veil + 0.3)) : Math.max(0.72, Math.min(0.8, set.veil + 0.45));
  const shade = dark ? mix(mix(set.fog.color, '#000000', 0.2), veilColor(set.name, colors), 0.25) : veilColor(set.name, colors);
  return rgba(shade, Math.round(a * 1000) / 1000);
}

/** Dark stages set their words with the scenes' soft shadow. */
export const STAGE_TEXT_SHADOW = '0 1px 14px rgba(0,0,0,0.45)';

const poseData = (p: CameraPose) => ({ x: +num(p.x), y: +num(p.y), z: +num(p.z), yaw: +num(p.yaw), pitch: +num(p.pitch), roll: +num(p.roll), fov: +num(p.fov) });

/** What the client rig and openings read from the DOM (they never import set art): the lens, the dolly and the set's poses. */
export function stagePoseData(set: StageSet): string {
  const { rest, far, close } = posesOf(set);
  return JSON.stringify({ fov: +num(rest.fov), dolly: dollyOf(set), rest: poseData(rest), far: poseData(far), close: poseData(close) });
}

export function StageView({ set, colors, mode, pose, covers, coversHidden = false, particles, time = 0, buildTime, overrides, unit, intro, detail: detailProp }: StageViewProps) {
  const { rest } = posesOf(set);
  const at = pose ?? rest;
  const detail = detailProp ?? (mode === 'thumbnail' || mode === 'still' ? 'low' : 'full');
  const pieces = ordered(detail === 'low' ? set.pieces.filter((p) => p.detail !== 'high') : set.pieces);
  const env: Env = { set, colors, rest, mode, detail, time, buildTime, delays: buildDelays(pieces), overrides, coversHidden };
  const box: CSSProperties = { position: 'absolute', inset: 0, overflow: 'hidden', containerType: 'size', pointerEvents: 'none', ...(unit ? { ['--u' as string]: `${Math.round(unit * 100000) / 100000}px` } : {}) };
  const shown = particles ?? [];
  const looks = shown.map((p) => lookOf(p, particleColors(set, colors, rest.z - p.at.z)));
  return (
    <div className="bulava-stage" data-bulava-stage="" data-stage={set.name} data-mode={mode} data-pose={stagePoseData(set)} data-opening={intro ?? ''} aria-hidden="true" style={box}>
      {looks.length ? <ParticleSprite sig={[...new Set(looks.map((l) => l.key))].join(' ')} looks={looks} /> : null}
      <div className="bulava-stage-frame" style={FRAME}>
        <div className="bulava-stage-lens" style={{ position: 'absolute', inset: 0, ...lensStyle(at.fov) }}>
          <div className="bulava-stage-rig" style={CHAIN}>
            <div className="bulava-stage-look" style={CHAIN}>
              <div className="bulava-stage-world" style={{ ...CHAIN, transform: poseTransform(at) }}>
                {pieces.map((p) => pieceView(p, env))}
                {shown.map((p, i) => particleView(p, looks[i]!, env))}
                {(covers ?? []).map((p) => pieceView(p, env, true))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
