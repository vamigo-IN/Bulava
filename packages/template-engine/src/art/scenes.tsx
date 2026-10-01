import { useId, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { DARK_SCENE_NAMES, SCENE_NAMES, type Artwork, type RenderContext, type TemplateDefinition, type ThemeColors } from '@bulava/template-schema';
import { Crescent, StarField } from '../ornaments-signature';
import { mix } from '../theme';
import {
  Balloon,
  Bansuri,
  Bell,
  Birds,
  Chhatri,
  Cloud,
  Diya,
  Dome,
  Gopuram,
  KadambaTree,
  Kalash,
  LotusBloom,
  LotusLeaf,
  Marigold,
  MarigoldStrand,
  Moon,
  Palm,
  PeacockPlume,
  r2,
  rand,
  Toran,
} from './motifs';

/**
 * Illustrated scenes, shared by website heroes and video backdrops.
 *
 * A scene is data: a background and a stack of layers, each with a depth
 * (0 = far, 1 = near). Artwork is drawn on a 1200×800 canvas anchored
 * bottom-centre (phones see the middle ~430 units, desktops the panorama; a
 * 9:16 video frame sees the middle as well), and everything is positioned with
 * inline styles so it renders identically in the browser and in Remotion.
 *
 * Websites move the layers at different speeds on scroll, pointer and tilt
 * (DepthScene); videos move a camera through them (push, pan, rise). Either way
 * near layers move most, which reads as depth. Decorative animation classes
 * (flicker, sway…) only run on websites, and never for reduced-motion users.
 */

export const SCENES = SCENE_NAMES;
export type SceneName = (typeof SCENE_NAMES)[number];

export interface SceneLayer {
  depth: number;
  node: ReactNode;
}

export interface SceneArt {
  background: string;
  /** Text sits on the primary colour (true) or the page background (false). */
  dark: boolean;
  /** Top padding for the website text block (scenes with torans or drapes start lower). */
  textTop: string;
  /** Painted artwork: where text starts as a fraction of the hero's height (replaces textTop). */
  textInset?: number;
  /** Painted artwork: a soft text shadow keeps names readable over busy skies. */
  textShadow?: boolean;
  layers: SceneLayer[];
}

/** Where a poster title can start, as a fraction of the height: below torans, drapes and the flower arch. */
export function sceneTitleTop(name: string): number {
  return ({ toran: 0.3, mandap: 0.34, floral: 0.3 } as Record<string, number>)[name] ?? 0.16;
}

/** Poster title position for a film or card backdrop (drawn scene or painted artwork). */
export function backdropTitleTop(definition: Pick<TemplateDefinition, 'artworks'>, backdrop: { scene?: string; artwork?: string }): number {
  if (backdrop.artwork) return Math.max(0.12, definition.artworks?.[backdrop.artwork]?.textTop ?? 0.12);
  return sceneTitleTop(backdrop.scene ?? '');
}

/** Scenes drawn on the primary colour (text uses the on-primary inks). */
export const DARK_SCENES: ReadonlySet<string> = new Set(DARK_SCENE_NAMES);

// Overflow stays visible so a moving layer reveals more of the panorama rather than a clipped edge.
const fill: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' };
const at = (style: CSSProperties): CSSProperties => ({ position: 'absolute', ...style });

function Canvas({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMax slice" style={fill} aria-hidden="true">
      {children}
    </svg>
  );
}

// ─────────────────────────── Gopuram: South Indian temple at sunrise ───────────────────────────

function GopuramSky({ colors }: { colors: ThemeColors }) {
  const id = useId();
  return (
    <Canvas>
      <defs>
        <radialGradient id={`${id}sun`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff6d8" stopOpacity="0.95" />
          <stop offset="0.35" style={{ stopColor: colors.accent }} stopOpacity="0.55" />
          <stop offset="1" style={{ stopColor: colors.accent }} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="600" cy="500" r="330" fill={`url(#${id}sun)`} />
      <Cloud x={180} y={140} w={180} opacity={0.55} />
      <Cloud x={880} y={90} w={220} opacity={0.5} />
    </Canvas>
  );
}

function gopuram(colors: ThemeColors): SceneArt {
  const stone = mix(colors.secondary, '#c98b4a', 0.55);
  const stoneShade = mix(stone, '#5a2f12', 0.45);
  const niche = mix(stone, '#3b1d0c', 0.7);
  const far = mix(colors.background, stone, 0.35);
  return {
    background: `linear-gradient(180deg, ${colors.background} 0%, ${colors.background} 38%, ${mix(colors.background, colors.accent, 0.35)} 100%)`,
    dark: false,
    textTop: 'pt-12 sm:pt-16',
    layers: [
      { depth: 0.1, node: <GopuramSky colors={colors} /> },
      { depth: 0.2, node: <Birds className="bulava-drift" style={at({ top: '40%', left: '54%', width: 112, color: colors.primary, opacity: 0.5 })} /> },
      {
        depth: 0.3,
        node: (
          <Canvas>
            <Gopuram x={250} baseY={800} width={150} height={250} tiers={5} body={far} shade={mix(far, '#000000', 0.12)} niche={mix(far, '#000000', 0.25)} gold={mix(colors.accent, far, 0.4)} />
            <Gopuram x={960} baseY={800} width={160} height={270} tiers={5} body={far} shade={mix(far, '#000000', 0.12)} niche={mix(far, '#000000', 0.25)} gold={mix(colors.accent, far, 0.4)} />
            <Palm x={120} y={800} h={260} lean={-14} color={mix(far, '#1f3b2d', 0.5)} />
            <Palm x={1100} y={800} h={240} lean={12} color={mix(far, '#1f3b2d', 0.5)} />
          </Canvas>
        ),
      },
      {
        depth: 0.55,
        node: (
          <Canvas>
            {/* Temple walls painted in kavi stripes run out from the gateway. */}
            {[0, 1].map((side) => (
              <g key={side}>
                <rect x={side ? 725 : 0} y="690" width="475" height="80" style={{ fill: mix(colors.background, '#ffffff', 0.4) }} />
                {Array.from({ length: 17 }, (_, i) => (
                  <rect key={i} x={(side ? 725 : 0) + i * 28} y="700" width="14" height="62" style={{ fill: mix(colors.primary, '#b3261e', 0.4) }} opacity="0.85" />
                ))}
                <rect x={side ? 725 : 0} y="684" width="475" height="10" style={{ fill: stoneShade }} />
              </g>
            ))}
            <Gopuram x={600} baseY={800} width={250} height={340} tiers={6} body={stone} shade={stoneShade} niche={niche} gold={colors.accent} figures={['#2a9d8f', '#e76f51', '#f4d35e', '#5e9bd6', '#e5989b', '#80b918']} />
            <rect x="555" y="715" width="90" height="85" rx="45" ry="45" style={{ fill: niche }} />
            <rect x="0" y="770" width="1200" height="30" style={{ fill: mix(stone, colors.background, 0.3) }} />
          </Canvas>
        ),
      },
      {
        depth: 0.85,
        node: (
          <>
            <Canvas>
              {/* Carved pillars frame the phone view at its edges; wide screens see the full colonnade. */}
              {[300, 432, 768, 900].map((px) => (
                <g key={px}>
                  <rect x={px - 18} y="560" width="36" height="240" style={{ fill: stoneShade }} />
                  <rect x={px - 25} y="544" width="50" height="20" rx="4" style={{ fill: stone }} />
                  <path d={`M${px - 32} 544 Q${px} 514 ${px + 32} 544Z`} style={{ fill: stone }} />
                  {[610, 670, 730].map((y) => (
                    <rect key={y} x={px - 15} y={y} width="30" height="5" style={{ fill: stone }} opacity="0.7" />
                  ))}
                  <Bell x={px + (px < 600 ? 26 : -26)} y={566} size={0.8} />
                </g>
              ))}
            </Canvas>
            <MarigoldStrand style={at({ top: 0, left: 'max(8px, calc(50% - 300px))', height: '36%', width: 18 })} count={14} />
            <MarigoldStrand style={at({ top: 0, right: 'max(8px, calc(50% - 300px))', height: '36%', width: 18 })} count={14} />
          </>
        ),
      },
    ],
  };
}

// ─────────────────────────── Palace: Rajasthani palace on a lake at night ───────────────────────────

function PalaceFacade({ body, shade, window, gold }: { body: string; shade: string; window: string; gold: string }) {
  const arches = (y: number, n: number, x0: number, x1: number, h: number) =>
    Array.from({ length: n }, (_, i) => {
      const w = (x1 - x0) / n;
      const cx = x0 + w * (i + 0.5);
      return <path key={`${y}-${i}`} d={`M${cx - w * 0.28} ${y} V${y - h * 0.6} Q${cx} ${y - h * 1.02} ${cx + w * 0.28} ${y - h * 0.6} V${y}Z`} fill={window} className={i % 3 === 1 ? 'bulava-twinkle' : undefined} />;
    });
  return (
    <g>
      <rect x="330" y="470" width="540" height="170" style={{ fill: body }} />
      <rect x="430" y="400" width="340" height="80" style={{ fill: body }} />
      <rect x="330" y="470" width="540" height="10" style={{ fill: shade }} />
      <rect x="430" y="400" width="340" height="8" style={{ fill: shade }} />
      <Dome x={600} baseY={402} w={150} fill={body} gold={gold} />
      <Dome x={480} baseY={402} w={60} fill={body} gold={gold} />
      <Dome x={720} baseY={402} w={60} fill={body} gold={gold} />
      <Chhatri x={345} baseY={472} w={46} fill={body} gold={gold} />
      <Chhatri x={855} baseY={472} w={46} fill={body} gold={gold} />
      <rect x="220" y="540" width="120" height="100" style={{ fill: shade }} />
      <rect x="860" y="540" width="120" height="100" style={{ fill: shade }} />
      <Chhatri x={280} baseY={542} w={40} fill={shade} gold={gold} />
      <Chhatri x={920} baseY={542} w={40} fill={shade} gold={gold} />
      {arches(630, 9, 340, 860, 64)}
      {arches(540, 7, 440, 760, 44)}
      {arches(470, 5, 470, 730, 36)}
      {arches(630, 3, 226, 334, 44)}
      {arches(630, 3, 866, 974, 44)}
      <rect x="560" y="560" width="80" height="80" rx="40" ry="40" fill={window} />
    </g>
  );
}

function PalaceLake({ colors, body, shade, lit, night }: { colors: ThemeColors; body: string; shade: string; lit: string; night: string }) {
  const id = useId();
  return (
    <Canvas>
      <defs>
        <linearGradient id={`${id}w`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: mix(colors.primary, '#0a1030', 0.4) }} />
          <stop offset="1" style={{ stopColor: night }} />
        </linearGradient>
        <radialGradient id={`${id}glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0" style={{ stopColor: lit }} stopOpacity="0.45" />
          <stop offset="1" style={{ stopColor: lit }} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="600" cy="640" rx="420" ry="140" fill={`url(#${id}glow)`} />
      {/* Drawn with its base at y=640, placed on the waterline at 700 and scaled to sit below the names. */}
      <g transform="translate(600 700) scale(0.62) translate(-600 -640)">
        <PalaceFacade body={body} shade={shade} window={lit} gold={colors.accent} />
      </g>
      <rect x="0" y="700" width="1200" height="100" fill={`url(#${id}w)`} />
      <g transform="translate(600 700) scale(0.62 -0.62) translate(-600 -640)" opacity="0.22">
        <PalaceFacade body={body} shade={shade} window={lit} gold={colors.accent} />
      </g>
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} x={380 + rand(i, 3) * 440} y={712 + i * 12} width={60 + rand(i, 5) * 120} height="2" rx="1" fill={lit} opacity="0.35" className="bulava-twinkle" style={{ animationDelay: `${i * 0.4}s` }} />
      ))}
    </Canvas>
  );
}

const starMask = (x: string, y: string): CSSProperties => ({
  maskImage: `radial-gradient(ellipse 34% 40% at ${x} ${y}, transparent 55%, black 90%)`,
  WebkitMaskImage: `radial-gradient(ellipse 34% 40% at ${x} ${y}, transparent 55%, black 90%)`,
});

function palace(colors: ThemeColors): SceneArt {
  const night = mix(colors.primary, '#050716', 0.55);
  const body = mix(colors.primary, '#0b0d1f', 0.35);
  const shade = mix(body, '#000000', 0.35);
  const lit = mix(colors.accent, '#ffd98a', 0.4);
  return {
    background: `linear-gradient(180deg, ${night} 0%, ${colors.primary} 70%)`,
    dark: true,
    textTop: 'pt-12 sm:pt-16',
    layers: [
      {
        depth: 0.05,
        node: (
          <>
            <StarField style={{ ...at({ left: 0, right: 0, top: 0, height: '66%', width: '100%', color: colors.accent, opacity: 0.6 }), ...starMask('50%', '38%') }} count={30} />
            <Crescent style={at({ top: '7%', right: '12%', width: 56, color: colors.accent, opacity: 0.9 })} />
          </>
        ),
      },
      {
        depth: 0.25,
        node: (
          <Canvas>
            <path d="M0 700 L140 668 L260 684 L380 660 L520 680 L700 656 L860 678 L1000 662 L1200 684 V700Z" style={{ fill: mix(body, night, 0.5) }} />
          </Canvas>
        ),
      },
      { depth: 0.5, node: <PalaceLake colors={colors} body={body} shade={shade} lit={lit} night={night} /> },
      {
        depth: 0.8,
        node: (
          <>
            {Array.from({ length: 7 }, (_, i) => (
              <span
                key={i}
                className="bulava-float-up"
                style={at({
                  display: 'block',
                  left: `${8 + rand(i, 7) * 84}%`,
                  bottom: `${4 + rand(i, 9) * 30}%`,
                  width: 12 + rand(i, 2) * 8,
                  height: 16 + rand(i, 2) * 10,
                  borderRadius: '40%',
                  boxShadow: '0 0 18px 6px rgba(255,190,90,0.45)',
                  background: 'linear-gradient(180deg,#ffe29a,#ff9f43)',
                  animationDelay: `${i * 1.3}s`,
                  animationDuration: `${12 + rand(i, 4) * 8}s`,
                })}
              />
            ))}
          </>
        ),
      },
    ],
  };
}

// ─────────────────────────── Toran: marigold doorway on a bold colour band ───────────────────────────

function Rangoli({ color, style }: { color: string; style: CSSProperties }) {
  const id = useId();
  return (
    <svg viewBox="0 0 400 400" style={{ ...style, color }} className="bulava-spin-slow" aria-hidden="true">
      <defs>
        <g id={`${id}p`}>
          <path d="M200 200 C214 150 214 110 200 60 C186 110 186 150 200 200Z" fill="currentColor" />
        </g>
      </defs>
      {Array.from({ length: 16 }, (_, i) => (
        <use key={i} href={`#${id}p`} transform={`rotate(${i * 22.5} 200 200)`} />
      ))}
      {[150, 110, 70].map((r) => (
        <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2 7" />
      ))}
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        return <circle key={i} cx={r2(200 + Math.cos(a) * 176)} cy={r2(200 + Math.sin(a) * 176)} r="6" fill="currentColor" />;
      })}
    </svg>
  );
}

function toran(colors: ThemeColors): SceneArt {
  return {
    background: `radial-gradient(ellipse at 50% 40%, ${mix(colors.primary, '#ffffff', 0.06)} 0%, ${colors.primary} 55%, ${mix(colors.primary, '#000000', 0.25)} 100%)`,
    dark: true,
    textTop: 'pt-32 sm:pt-40',
    layers: [
      { depth: 0.1, node: <Rangoli color={colors.accent} style={at({ top: '18%', left: '50%', width: 620, marginLeft: -310, opacity: 0.14 })} /> },
      {
        depth: 0.7,
        node: (
          <>
            <Toran className="bulava-sway-soft" style={at({ top: 0, left: 0, right: 0, margin: '0 auto', width: '100%', maxWidth: 900 })} swags={5} />
            <MarigoldStrand style={at({ top: 32, left: 'max(8px, calc(50% - 560px))', height: '62%', width: 22 })} count={22} />
            <MarigoldStrand style={at({ top: 32, right: 'max(8px, calc(50% - 560px))', height: '62%', width: 22 })} count={22} />
          </>
        ),
      },
      {
        depth: 0.9,
        node: (
          <div style={at({ left: 0, right: 0, bottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 28 })}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Diya key={i} style={{ width: i === 2 ? 80 : 56 }} />
            ))}
          </div>
        ),
      },
    ],
  };
}

// ─────────────────────────── Arches: receding palace arches in perspective ───────────────────────────

/** A cusped (Mughal/Rajput) arch opening of the given width and apex, centred on cx and standing on y=800. */
function archOpening(width: number, apexY: number, cx = 600): string {
  const base = 800;
  const half = width / 2;
  const spring = apexY + (base - apexY) * 0.42;
  const x0 = cx - half;
  const x1 = cx + half;
  return (
    `M${x0} ${base} V${spring} ` +
    `C${x0} ${spring - width * 0.1} ${x0 + width * 0.06} ${spring - width * 0.16} ${x0 + width * 0.14} ${spring - width * 0.17} ` +
    `C${x0 + width * 0.17} ${spring - width * 0.28} ${cx - half * 0.34} ${apexY + width * 0.06} ${cx} ${apexY} ` +
    `C${cx + half * 0.34} ${apexY + width * 0.06} ${x1 - width * 0.17} ${spring - width * 0.28} ${x1 - width * 0.14} ${spring - width * 0.17} ` +
    `C${x1 - width * 0.06} ${spring - width * 0.16} ${x1} ${spring - width * 0.1} ${x1} ${spring} V${base}Z`
  );
}

function HangingLamp({ x, drop, colors }: { x: number; drop: number; colors: ThemeColors }) {
  const id = useId();
  const glow = mix(colors.accent, '#ffd98a', 0.4);
  return (
    <g className="bulava-sway-soft" style={{ transformOrigin: `${x}px 0px` }}>
      <defs>
        <radialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
          <stop offset="0" style={{ stopColor: glow }} stopOpacity="0.6" />
          <stop offset="1" style={{ stopColor: glow }} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={`M${x} 0 V${drop}`} style={{ stroke: colors.accent }} strokeWidth="1.5" opacity="0.8" />
      <circle cx={x} cy={drop + 22} r="46" fill={`url(#${id}g)`} />
      <path d={`M${x - 14} ${drop + 6} H${x + 14} L${x + 10} ${drop + 34} Q${x} ${drop + 46} ${x - 10} ${drop + 34}Z`} style={{ fill: colors.accent }} />
      <path d={`M${x - 8} ${drop + 12} H${x + 8} L${x + 6} ${drop + 30} H${x - 6}Z`} style={{ fill: glow }} />
      <path d={`M${x - 10} ${drop + 6} Q${x} ${drop - 8} ${x + 10} ${drop + 6}Z`} style={{ fill: colors.accent }} />
    </g>
  );
}

function arches(colors: ThemeColors): SceneArt {
  // Nearest first. Sized for portrait screens: the outer arch fits a phone's width
  // and stops below the text; each wall is the canvas minus its opening.
  const layers = [
    { width: 440, apex: 452, depth: 0.85, shade: 0.42 },
    { width: 344, apex: 518, depth: 0.62, shade: 0.32 },
    { width: 262, apex: 574, depth: 0.42, shade: 0.22 },
    { width: 194, apex: 622, depth: 0.25, shade: 0.14 },
    { width: 136, apex: 662, depth: 0.1, shade: 0.07 },
  ].reverse();
  const walls = layers.map((l, i) => ({
    depth: l.depth,
    node: (
      <Canvas>
        <path d={`M-400 -400 H1600 V800 H-400Z ${archOpening(l.width, l.apex)}`} fillRule="evenodd" style={{ fill: mix(colors.primary, '#000000', l.shade) }} />
        <path d={archOpening(l.width, l.apex)} fill="none" style={{ stroke: colors.accent }} strokeWidth={i === layers.length - 1 ? 4 : 2.5} opacity={0.55 + i * 0.1} />
        <path d={archOpening(l.width - 22, l.apex + 14)} fill="none" style={{ stroke: colors.accent }} strokeWidth="1" opacity="0.35" />
      </Canvas>
    ),
  }));
  return {
    background: `radial-gradient(ellipse 30% 24% at 50% 96%, ${mix(colors.accent, '#fff6dc', 0.45)} 0%, ${mix(colors.primary, colors.accent, 0.3)} 55%, ${colors.primary} 100%)`,
    dark: true,
    textTop: 'pt-12 sm:pt-16',
    layers: [
      ...walls,
      {
        depth: 0.92,
        node: (
          <Canvas>
            {/* Jaali panels flank the outer arch on wide screens; lamps hang at the edges of a phone's view. */}
            {[190, 1010].map((cx) => (
              <g key={cx} opacity="0.5">
                <path d={archOpening(150, 470, cx)} fill="none" style={{ stroke: colors.accent }} strokeWidth="1.5" />
                {Array.from({ length: 8 }, (_, r) =>
                  Array.from({ length: 5 }, (_, c) => <circle key={`${r}-${c}`} cx={cx - 48 + c * 24} cy={560 + r * 28} r="7" fill="none" style={{ stroke: colors.accent }} strokeWidth="1" />),
                )}
              </g>
            ))}
            {[392, 808].map((x, i) => (
              <HangingLamp key={x} x={x} drop={i ? 150 : 120} colors={colors} />
            ))}
            {[230, 970].map((x) => (
              <HangingLamp key={x} x={x} drop={210} colors={colors} />
            ))}
          </Canvas>
        ),
      },
    ],
  };
}

// ─────────────────────────── Lotus pond with floating diyas ───────────────────────────

function PondShimmer() {
  const id = useId();
  return (
    <>
      <defs>
        <linearGradient id={`${id}s`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {Array.from({ length: 12 }, (_, i) => (
        <ellipse key={i} cx={100 + rand(i, 11) * 1000} cy={560 + rand(i, 13) * 200} rx={30 + rand(i, 17) * 70} ry={3} fill={`url(#${id}s)`} className="bulava-twinkle" style={{ animationDelay: `${i * 0.35}s` }} />
      ))}
    </>
  );
}

function lotus(colors: ThemeColors): SceneArt {
  const water = mix('#0f5c63', colors.secondary, 0.2);
  return {
    background: `linear-gradient(180deg, ${colors.background} 0%, ${colors.background} 48%, ${mix(colors.background, water, 0.3)} 60%, ${mix(water, '#ffffff', 0.12)} 72%, ${water} 100%)`,
    dark: false,
    textTop: 'pt-12 sm:pt-16',
    layers: [
      {
        depth: 0.3,
        node: (
          <Canvas>
            <PondShimmer />
            <LotusLeaf x={250} y={600} r={46} />
            <LotusLeaf x={930} y={610} r={52} />
            <LotusLeaf x={760} y={560} r={30} />
            <LotusLeaf x={420} y={565} r={28} />
            <LotusBloom x={280} y={598} size={0.9} />
            <LotusBloom x={900} y={604} size={1} />
          </Canvas>
        ),
      },
      {
        depth: 0.75,
        node: (
          <>
            <Canvas>
              <LotusLeaf x={130} y={760} r={90} />
              <LotusLeaf x={1080} y={740} r={80} />
              <LotusLeaf x={610} y={790} r={70} />
              <LotusBloom x={170} y={752} size={1.7} />
              <LotusBloom x={1040} y={736} size={1.5} />
              <LotusBloom x={560} y={784} size={1.25} />
            </Canvas>
            {[
              ['36%', '12%', 64],
              ['58%', '20%', 48],
              ['46%', '6%', 80],
            ].map(([left, bottom, w], i) => (
              <div key={i} className="bulava-bob" style={at({ left, bottom, animationDelay: `${i * 0.9}s` } as CSSProperties)}>
                <Diya style={{ width: w as number }} />
              </div>
            ))}
          </>
        ),
      },
    ],
  };
}

// ─────────────────────────── Mandap: the wedding canopy and sacred fire ───────────────────────────

function MandapFire() {
  const id = useId();
  return (
    <Canvas>
      <defs>
        <radialGradient id={`${id}f`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffcf6a" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ff8a00" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="600" cy="700" rx="360" ry="200" fill={`url(#${id}f)`} className="bulava-glow" />
    </Canvas>
  );
}

function mandap(colors: ThemeColors): SceneArt {
  const drape = colors.primary;
  const drapeShade = mix(colors.primary, '#000000', 0.25);
  return {
    background: `linear-gradient(180deg, ${colors.background} 0%, ${mix(colors.background, colors.accent, 0.25)} 100%)`,
    dark: false,
    textTop: 'pt-40 sm:pt-48',
    layers: [
      { depth: 0.2, node: <MandapFire /> },
      {
        depth: 0.5,
        node: (
          <>
            <Canvas>
              <rect x="520" y="690" width="160" height="70" rx="8" style={{ fill: mix(colors.secondary, '#6b3a1f', 0.4) }} />
              <rect x="500" y="680" width="200" height="16" rx="4" style={{ fill: colors.accent }} />
              <g className="bulava-flicker" style={{ transformOrigin: '600px 690px' }}>
                <path d="M578 690 C566 668 572 648 584 632 C584 650 592 660 600 668Z" fill="#ff8f00" />
                <path d="M622 690 C634 668 628 648 616 632 C616 650 608 660 600 668Z" fill="#ff8f00" />
                <path d="M600 604 C622 632 628 660 600 690 C572 660 578 632 600 604Z" fill="#ffb300" />
                <path d="M600 636 C612 652 614 670 600 690 C586 670 588 652 600 636Z" fill="#fff3c4" />
              </g>
            </Canvas>
            <Kalash style={at({ bottom: '4%', left: 'calc(50% - 190px)', width: 80 })} />
            <Kalash style={at({ bottom: '4%', right: 'calc(50% - 190px)', width: 80 })} />
          </>
        ),
      },
      {
        depth: 0.85,
        node: (
          <>
            <Canvas>
              <path d="M160 0 H1040 V56 Q970 118 900 56 Q830 118 760 56 Q690 118 620 56 Q550 118 480 56 Q410 118 340 56 Q270 118 200 56 Q180 72 160 56Z" style={{ fill: drape }} />
              <path d="M160 56 Q180 72 200 56 Q270 118 340 56 Q410 118 480 56 Q550 118 620 56 Q690 118 760 56 Q830 118 900 56 Q970 118 1040 56" fill="none" style={{ stroke: colors.accent }} strokeWidth="5" />
              {[270, 930].map((px) => (
                <g key={px}>
                  <rect x={px - 24} y="40" width="48" height="760" style={{ fill: mix(colors.accent, '#8a5a12', 0.25) }} />
                  <rect x={px - 12} y="40" width="10" height="760" fill="#fff4d0" opacity="0.35" />
                  {[180, 360, 540].map((y) => (
                    <rect key={y} x={px - 30} y={y} width="60" height="14" rx="3" style={{ fill: colors.accent }} />
                  ))}
                  <path d={`M${px - 60} 0 Q${px} ${140} ${px + 60} 0`} style={{ fill: drapeShade }} opacity="0.7" />
                </g>
              ))}
            </Canvas>
            <MarigoldStrand style={at({ top: '7%', left: 'max(12px, calc(50% - 220px))', height: '36%', width: 18 })} count={14} />
            <MarigoldStrand style={at({ top: '7%', right: 'max(12px, calc(50% - 220px))', height: '36%', width: 18 })} count={14} />
          </>
        ),
      },
    ],
  };
}

// ─────────────────────────── Noir: spotlight, floating orbs and a gold medallion ───────────────────────────

function noir(colors: ThemeColors, opts: { monogram: string; photo?: string }): SceneArt {
  return {
    background: `radial-gradient(ellipse at 50% -10%, ${mix(colors.accent, colors.primary, 0.75)} 0%, ${colors.primary} 55%, ${mix(colors.primary, '#000000', 0.5)} 100%)`,
    dark: true,
    textTop: 'pt-12 sm:pt-16',
    layers: [
      {
        depth: 0.15,
        node: (
          <>
            <span className="bulava-orb" style={at({ top: '12%', left: '6%', width: 224, height: 224, borderRadius: '50%', filter: 'blur(64px)', background: colors.accent, opacity: 0.22 })} />
            <span className="bulava-orb" style={at({ right: '4%', bottom: '16%', width: 288, height: 288, borderRadius: '50%', filter: 'blur(64px)', background: colors.secondary, opacity: 0.2, animationDelay: '-6s' })} />
            <div style={at({ left: 0, right: 0, top: 0, margin: '0 auto', height: '70%', width: '70%', maxWidth: 520, background: `conic-gradient(from 180deg at 50% 0%, transparent 42%, ${colors.accent}22 50%, transparent 58%)` })} />
          </>
        ),
      },
      {
        depth: 0.6,
        node: (
          <div style={at({ left: 0, right: 0, bottom: '7%', display: 'flex', justifyContent: 'center', perspective: 900 })}>
            <div
              className="bulava-medallion"
              style={{
                position: 'relative',
                width: 176,
                height: 176,
                borderRadius: '50%',
                border: `1px solid ${colors.accent}99`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transformStyle: 'preserve-3d',
                background: `radial-gradient(circle at 35% 30%, ${mix(colors.accent, '#ffffff', 0.35)}, ${colors.accent} 45%, ${mix(colors.accent, '#000000', 0.45)} 100%)`,
                boxShadow: `0 0 60px ${colors.accent}55`,
              }}
            >
              <span style={at({ inset: 12, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.25)' })} />
              {opts.photo ? (
                <img src={opts.photo} alt="" style={at({ inset: 16, width: 'calc(100% - 32px)', height: 'calc(100% - 32px)', borderRadius: '50%', objectFit: 'cover', backfaceVisibility: 'hidden' })} />
              ) : (
                <span style={{ fontSize: 48, letterSpacing: '0.1em', color: 'rgba(0,0,0,0.7)', fontFamily: 'var(--t-heading)' }}>{opts.monogram}</span>
              )}
            </div>
          </div>
        ),
      },
    ],
  };
}

// ─────────────────────────── Floral: a layered flower arch ───────────────────────────

/** A garden rose: two rings of cupped petals around a swirled heart. */
function Rose({ x, y, r, color, center }: { x: number; y: number; r: number; color: string; center: string }) {
  const light = mix(color, '#ffffff', 0.35);
  const petal = (k: number, ring: number, count: number, petalFill: string, offset: number) => {
    const a = ((k / count) * 360 + offset) % 360;
    return <ellipse key={`${ring}-${k}`} cx={x} cy={r2(y - r * (ring ? 0.28 : 0.5))} rx={r2(r * (ring ? 0.36 : 0.5))} ry={r2(r * (ring ? 0.3 : 0.42))} transform={`rotate(${a} ${x} ${y})`} style={{ fill: petalFill }} />;
  };
  return (
    <g>
      {Array.from({ length: 6 }, (_, k) => petal(k, 0, 6, light, 15))}
      {Array.from({ length: 5 }, (_, k) => petal(k, 1, 5, color, 0))}
      <circle cx={x} cy={y} r={r2(r * 0.3)} style={{ fill: mix(color, '#000000', 0.12) }} />
      <path d={`M${r2(x - r * 0.18)} ${y} a${r2(r * 0.18)} ${r2(r * 0.16)} 0 1 1 ${r2(r * 0.26)} ${r2(r * 0.06)}`} fill="none" style={{ stroke: center }} strokeWidth={r2(r * 0.06)} opacity="0.7" />
    </g>
  );
}

function FloralArch({ scale, colors, seed }: { scale: number; colors: ThemeColors; seed: number }) {
  const blooms: ReactElement[] = [];
  const leaves: ReactElement[] = [];
  const cx = 600;
  const baseY = 800;
  const rx = 180 * scale;
  const ry = 740 * scale;
  const palette = [colors.primary, colors.secondary, mix(colors.primary, '#ffffff', 0.45), mix(colors.accent, '#ffffff', 0.3)];
  for (let i = 0; i <= 30; i++) {
    const t = Math.PI - (i / 30) * Math.PI;
    const x = r2(cx + Math.cos(t) * rx);
    const y = r2(baseY - Math.sin(t) * ry);
    const r = (16 + rand(i, seed) * 14) * scale;
    leaves.push(<ellipse key={`l${i}`} cx={x + (rand(i, seed + 1) - 0.5) * 40 * scale} cy={y + 12 * scale} rx={r * 1.2} ry={r * 0.45} transform={`rotate(${rand(i, seed + 2) * 180} ${x} ${y})`} fill="#5f8f5a" opacity="0.85" />);
    blooms.push(<Rose key={`r${i}`} x={x} y={y} r={r} color={palette[i % palette.length]!} center={mix(palette[i % palette.length]!, '#000000', 0.4)} />);
  }
  return (
    <g>
      {leaves}
      {blooms}
    </g>
  );
}

function Butterfly({ color, style }: { color: string; style: CSSProperties }) {
  return (
    <svg viewBox="0 0 40 30" className="bulava-bob" style={style} aria-hidden="true">
      <path d="M20 15 C12 2 2 6 6 14 C2 22 12 26 20 15 C28 26 38 22 34 14 C38 6 28 2 20 15Z" style={{ fill: color }} />
    </svg>
  );
}

function floral(colors: ThemeColors): SceneArt {
  return {
    background: `radial-gradient(ellipse at 50% 45%, ${colors.background} 30%, ${mix(colors.background, colors.secondary, 0.22)} 100%)`,
    dark: false,
    textTop: 'pt-28 sm:pt-32',
    layers: [
      {
        depth: 0.3,
        node: (
          <Canvas>
            <g opacity="0.55">
              <FloralArch scale={1.22} colors={colors} seed={3} />
            </g>
          </Canvas>
        ),
      },
      {
        depth: 0.8,
        node: (
          <>
            <Canvas>
              <FloralArch scale={1.04} colors={colors} seed={7} />
            </Canvas>
            <Butterfly color={colors.secondary} style={at({ top: '30%', left: '18%', width: 36, opacity: 0.8 })} />
            <Butterfly color={colors.primary} style={at({ top: '46%', right: '16%', width: 28, opacity: 0.7, animationDelay: '1.4s' })} />
          </>
        ),
      },
    ],
  };
}

// ─────────────────────────── Balloons: birthdays and parties ───────────────────────────

function BalloonCluster({ x, y, s, seed, palette }: { x: number; y: number; s: number; seed: number; palette: string[] }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <g key={i} className="bulava-bob" style={{ animationDelay: `${i * 0.6 + seed}s`, transformBox: 'fill-box' }}>
          <Balloon x={x + (i - 2) * 46 * s + rand(i, seed) * 20} y={y - rand(i, seed + 3) * 120 * s} size={s * (0.8 + rand(i, seed + 5) * 0.4)} color={palette[(i + seed) % palette.length]!} />
        </g>
      ))}
    </>
  );
}

function balloons(colors: ThemeColors): SceneArt {
  const palette = [colors.primary, colors.secondary, colors.accent, mix(colors.secondary, '#ffffff', 0.3)];
  return {
    background: `linear-gradient(180deg, ${colors.background}, ${mix(colors.background, colors.accent, 0.2)})`,
    dark: false,
    textTop: 'pt-12 sm:pt-16',
    layers: [
      {
        depth: 0.3,
        node: (
          <Canvas>
            <g opacity="0.55">
              <BalloonCluster x={300} y={560} s={0.8} seed={2} palette={palette} />
              <BalloonCluster x={900} y={540} s={0.8} seed={5} palette={palette} />
            </g>
          </Canvas>
        ),
      },
      {
        depth: 0.85,
        node: (
          <Canvas>
            <BalloonCluster x={470} y={690} s={1.05} seed={1} palette={palette} />
            <BalloonCluster x={730} y={700} s={1.1} seed={3} palette={palette} />
          </Canvas>
        ),
      },
    ],
  };
}

// ─────────────────────────── Backwaters: Kerala palms, houseboat and kasavu gold ───────────────────────────

function backwaters(colors: ThemeColors): SceneArt {
  const water = mix(colors.secondary, '#2f6f6a', 0.5);
  const land = mix(colors.secondary, '#1f3b2d', 0.6);
  return {
    background: `linear-gradient(180deg, ${colors.background} 0%, ${colors.background} 40%, ${mix(colors.background, colors.accent, 0.45)} 71%, ${water} 71.2%, ${mix(water, '#0b2f2c', 0.4)} 100%)`,
    dark: false,
    textTop: 'pt-12 sm:pt-16',
    layers: [
      {
        depth: 0.15,
        node: (
          <Canvas>
            <circle cx="600" cy="560" r="60" style={{ fill: mix(colors.accent, '#ffffff', 0.3) }} opacity="0.85" />
          </Canvas>
        ),
      },
      {
        depth: 0.35,
        node: (
          <Canvas>
            <path d="M0 570 Q300 552 600 566 T1200 562 V572 H0Z" style={{ fill: land }} opacity="0.7" />
            {Array.from({ length: 12 }, (_, i) => (
              <g key={i} transform={`translate(${40 + i * 104} 570) scale(0.62) translate(${-(40 + i * 104)} -570)`}>
                <Palm x={40 + i * 104} y={570} h={90 + rand(i, 21) * 40} lean={(rand(i, 23) - 0.5) * 24} color={mix(land, colors.background, 0.25)} />
              </g>
            ))}
          </Canvas>
        ),
      },
      {
        depth: 0.6,
        node: (
          <Canvas>
            <g transform="translate(500 612) scale(0.78)">
              <path d="M0 40 Q130 70 260 40 L240 60 Q130 80 20 60Z" fill="#3e2415" />
              <path d="M30 40 Q130 -10 230 40Z" fill="#8d6e3f" />
              <path d="M30 40 Q130 -10 230 40" fill="none" stroke="#5d4037" strokeWidth="3" />
              {[70, 110, 150, 190].map((x) => (
                <rect key={x} x={x} y="26" width="10" height="16" fill="#ffd27a" opacity="0.8" />
              ))}
            </g>
          </Canvas>
        ),
      },
      {
        depth: 0.85,
        node: (
          <Canvas>
            <Palm x={120} y={800} h={420} lean={40} color={land} />
            <Palm x={1080} y={800} h={400} lean={-44} color={land} />
            <Palm x={430} y={800} h={260} lean={-30} color={land} />
            <Palm x={770} y={800} h={250} lean={30} color={land} />
            <rect x="0" y="770" width="1200" height="30" fill="#fbf7ec" />
            <rect x="0" y="778" width="1200" height="8" style={{ fill: colors.accent }} />
          </Canvas>
        ),
      },
    ],
  };
}

// ─────────────────────────── Sarovar: golden domes over still water ───────────────────────────

function GoldenPavilion({ gold, shade }: { gold: string; shade: string }) {
  return (
    <g>
      <rect x="470" y="470" width="260" height="120" style={{ fill: gold }} />
      <rect x="470" y="470" width="260" height="10" style={{ fill: shade }} />
      <Dome x={600} baseY={472} w={130} fill={gold} gold={gold} />
      {[500, 700].map((x) => (
        <Chhatri key={x} x={x} baseY={472} w={38} fill={gold} gold={gold} />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <path key={i} d={`M${498 + i * 51} 590 V540 Q${513 + i * 51} 518 ${528 + i * 51} 540 V590Z`} style={{ fill: shade }} opacity="0.55" />
      ))}
      <rect x="250" y="585" width="220" height="12" style={{ fill: mix(gold, '#ffffff', 0.4) }} />
      <rect x="730" y="585" width="220" height="12" style={{ fill: mix(gold, '#ffffff', 0.4) }} />
      {[270, 330, 390, 450, 750, 810, 870, 930].map((x) => (
        <g key={x}>
          <rect x={x - 1.5} y="562" width="3" height="24" style={{ fill: shade }} />
          <circle cx={x} cy="560" r="4" fill="#ffe29a" />
        </g>
      ))}
    </g>
  );
}

function sarovar(colors: ThemeColors): SceneArt {
  const gold = mix(colors.accent, '#e0a82e', 0.4);
  const shade = mix(gold, '#6b4200', 0.45);
  const water = mix(colors.primary, '#0b2447', 0.35);
  return {
    background: `linear-gradient(180deg, ${mix(colors.primary, '#050a1f', 0.4)} 0%, ${colors.primary} 70%)`,
    dark: true,
    textTop: 'pt-12 sm:pt-16',
    layers: [
      { depth: 0.05, node: <StarField style={{ ...at({ left: 0, right: 0, top: 0, height: '50%', width: '100%', color: colors.accent, opacity: 0.7 }), ...starMask('50%', '40%') }} count={30} /> },
      {
        depth: 0.45,
        node: (
          <Canvas>
            <rect x="0" y="690" width="1200" height="110" style={{ fill: water }} />
            {/* The marble parikrama on the far shore. */}
            <rect x="0" y="652" width="1200" height="38" style={{ fill: mix(colors.primary, '#e8e4da', 0.72) }} />
            {Array.from({ length: 30 }, (_, i) => (
              <path key={i} d={`M${i * 40 + 8} 690 V670 Q${i * 40 + 20} 658 ${i * 40 + 32} 670 V690Z`} style={{ fill: mix(colors.primary, '#000000', 0.2) }} opacity="0.55" />
            ))}
            <rect x="0" y="648" width="1200" height="5" style={{ fill: gold }} opacity="0.7" />
            {/* Drawn with its base at y=590; placed on the waterline at 690 and scaled below the names. */}
            <g transform="translate(600 690) scale(0.74) translate(-600 -590)">
              <GoldenPavilion gold={gold} shade={shade} />
            </g>
            <g transform="translate(600 690) scale(0.74 -0.74) translate(-600 -590)" opacity="0.3">
              <GoldenPavilion gold={gold} shade={shade} />
            </g>
            {Array.from({ length: 6 }, (_, i) => (
              <rect key={i} x={420 + rand(i, 31) * 360} y={704 + i * 14} width={40 + rand(i, 33) * 100} height="2" fill={gold} opacity="0.3" className="bulava-twinkle" style={{ animationDelay: `${i * 0.5}s` }} />
            ))}
          </Canvas>
        ),
      },
      {
        depth: 0.85,
        node: (
          <>
            <Canvas>
              {[180, 1020].map((x) => (
                <g key={x}>
                  <rect x={x - 70} y="660" width="140" height="140" style={{ fill: mix(colors.primary, '#000000', 0.35) }} />
                  <Chhatri x={x} baseY={662} w={90} fill={mix(colors.primary, '#000000', 0.3)} gold={gold} />
                </g>
              ))}
            </Canvas>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={at({ bottom: '6%', left: `${30 + i * 12}%` })}>
                <Diya style={{ width: 40 }} />
              </div>
            ))}
          </>
        ),
      },
    ],
  };
}

// ─────────────────────────── Vrindavan: moonlit Yamuna, kadamba trees, a ghat, flute and peacock plumes ───────────────────────────

function YamunaWater({ colors, lit }: { colors: ThemeColors; lit: string }) {
  const id = useId();
  const water = mix(colors.primary, '#0b2a4a', 0.35);
  return (
    <Canvas>
      <defs>
        <linearGradient id={`${id}w`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: mix(water, colors.accent, 0.25) }} />
          <stop offset="1" style={{ stopColor: mix(water, '#000000', 0.35) }} />
        </linearGradient>
      </defs>
      <path d="M0 600 Q300 586 600 596 T1200 590 V800 H0Z" fill={`url(#${id}w)`} />
      {/* The moon's path on the water, and the ghat lamps' reflections. */}
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={r2(700 - (20 + i * 9) / 2 + (rand(i, 81) - 0.5) * 30)} y={606 + i * 13} width={20 + i * 9} height="2" rx="1" style={{ fill: mix(colors.accent, '#fff6d8', 0.5), animationDelay: `${i * 0.4}s` }} opacity="0.4" className="bulava-twinkle" />
      ))}
      {[520, 548, 576, 604, 632].map((x, i) => (
        <rect key={x} x={x - 2} y={612} width="4" height={22 + (i % 2) * 8} rx="2" fill={lit} opacity="0.35" />
      ))}
    </Canvas>
  );
}

/** Far bank: ghat steps down to the river, a small temple and a row of lamps. */
function Ghat({ stone, shade, lit, flag }: { stone: string; shade: string; lit: string; flag: string }) {
  return (
    <g>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={500 + i * 8} y={572 + i * 7} width={180 - i * 16} height="7" style={{ fill: i % 2 ? shade : stone }} />
      ))}
      {/* Temple: plinth, shikhara and a saffron flag. */}
      {/* Kept low and wide so the flag stays below the names on every screen. */}
      <rect x="604" y="542" width="68" height="32" style={{ fill: stone }} />
      <path d="M600 544 Q638 488 676 544Z" style={{ fill: stone }} />
      <path d="M616 544 Q638 506 660 544" fill="none" style={{ stroke: shade }} strokeWidth="2" />
      <circle cx="638" cy="514" r="4" style={{ fill: lit }} />
      <path d="M638 511 V494" style={{ stroke: shade }} strokeWidth="2" />
      <path d="M638 494 L655 500 L638 506Z" style={{ fill: flag }} className="bulava-sway-soft" />
      <path d="M627 574 V556 Q638 544 649 556 V574Z" style={{ fill: lit }} opacity="0.85" />
      <rect x="540" y="540" width="40" height="34" style={{ fill: shade }} />
      <path d="M536 542 Q560 520 584 542Z" style={{ fill: shade }} />
      {[520, 548, 576, 604, 632].map((x, i) => (
        <g key={x} className="bulava-flicker" style={{ animationDelay: `${i * 0.3}s`, transformOrigin: `${x}px 600px` }}>
          <circle cx={x} cy={600} r="7" fill={lit} opacity="0.3" />
          <circle cx={x} cy={600} r="2.6" fill="#fff3c4" />
        </g>
      ))}
    </g>
  );
}

/** A flower-wound swing (jhoola) hanging from a branch. */
function Jhoola({ x, top, bottom, width, rope, seat }: { x: number; top: number; bottom: number; width: number; rope: string; seat: string }) {
  const left = x - width / 2;
  const right = x + width / 2;
  const blooms = (rx: number) =>
    Array.from({ length: 9 }, (_, i) => <Marigold key={`${rx}-${i}`} x={rx} y={r2(top + ((bottom - top) * (i + 0.5)) / 9)} r={4.2} tone={i % 3} />);
  return (
    <g className="bulava-sway-soft" style={{ transformOrigin: `${x}px ${top}px` }}>
      <path d={`M${left} ${top} V${bottom} M${right} ${top} V${bottom}`} style={{ stroke: rope }} strokeWidth="2.5" />
      {blooms(left)}
      {blooms(right)}
      <rect x={left - 10} y={bottom} width={width + 20} height="9" rx="3" fill="#6b3a1f" />
      <rect x={left - 4} y={bottom - 8} width={width + 8} height="9" rx="4" style={{ fill: seat }} />
    </g>
  );
}

function vrindavan(colors: ThemeColors): SceneArt {
  const dusk = mix(colors.primary, '#1b1740', 0.45);
  const tree = mix(colors.primary, '#07140f', 0.7);
  const bank = mix(tree, dusk, 0.4);
  const lit = mix(colors.accent, '#ffd98a', 0.4);
  const flower = mix(colors.accent, '#ffd166', 0.3);
  return {
    background: `linear-gradient(180deg, ${mix(dusk, '#000000', 0.25)} 0%, ${dusk} 45%, ${mix(colors.primary, colors.accent, 0.35)} 78%, ${colors.primary} 100%)`,
    dark: true,
    textTop: 'pt-12 sm:pt-16',
    layers: [
      {
        depth: 0.05,
        node: (
          <>
            <StarField style={{ ...at({ left: 0, right: 0, top: 0, height: '55%', width: '100%', color: colors.accent, opacity: 0.55 }), ...starMask('50%', '40%') }} count={26} />
            <Canvas>
              {/* Inside the phone view (x 375–825), upper right. */}
              <Moon x={752} y={118} r={32} color={mix(colors.accent, '#fff6d8', 0.6)} />
            </Canvas>
          </>
        ),
      },
      {
        depth: 0.25,
        node: (
          <Canvas>
            <path d="M0 606 Q200 560 380 590 T760 575 T1200 596 V620 H0Z" style={{ fill: bank }} opacity="0.9" />
            <Ghat stone={mix(bank, colors.accent, 0.35)} shade={mix(bank, '#000000', 0.2)} lit={lit} flag={mix(colors.secondary, '#ff8f00', 0.6)} />
          </Canvas>
        ),
      },
      { depth: 0.45, node: <YamunaWater colors={colors} lit={lit} /> },
      {
        depth: 0.62,
        node: (
          <Canvas>
            {/* Kadamba trees frame the view: their crowns reach in from both edges on phones. */}
            <KadambaTree x={300} y={700} size={1.25} color={tree} flower={flower} />
            <Jhoola x={418} top={540} bottom={664} width={50} rope={flower} seat={mix(colors.secondary, '#b91c1c', 0.5)} />
            <g transform="translate(900 690) scale(-1 1) translate(-900 -690)">
              <KadambaTree x={900} y={690} size={1.1} color={tree} flower={flower} />
            </g>
            <LotusLeaf x={520} y={700} r={40} />
            <LotusLeaf x={700} y={690} r={34} />
            <LotusBloom x={540} y={698} size={0.8} />
          </Canvas>
        ),
      },
      {
        depth: 0.88,
        node: (
          <Canvas>
            {/* The flute rests across the foreground, peacock plumes fanned behind it. */}
            <PeacockPlume x={430} y={800} length={300} angle={-28} />
            <PeacockPlume x={470} y={800} length={260} angle={-8} />
            <PeacockPlume x={770} y={800} length={300} angle={26} />
            <PeacockPlume x={730} y={800} length={250} angle={8} />
            <Bansuri x={600} y={742} length={430} angle={-10} />
            <LotusBloom x={330} y={790} size={1.3} />
            <LotusBloom x={890} y={784} size={1.15} />
          </Canvas>
        ),
      },
    ],
  };
}

// ─────────────────────────── Registry ───────────────────────────

/** The layered artwork of a scene, for website heroes and video backdrops. */
export function sceneArt(name: SceneName, colors: ThemeColors, opts: { monogram?: string; photo?: string } = {}): SceneArt {
  switch (name) {
    case 'gopuram':
      return gopuram(colors);
    case 'palace':
      return palace(colors);
    case 'toran':
      return toran(colors);
    case 'arches':
      return arches(colors);
    case 'lotus':
      return lotus(colors);
    case 'mandap':
      return mandap(colors);
    case 'noir':
      return noir(colors, { monogram: opts.monogram ?? '♥', photo: opts.photo });
    case 'floral':
      return floral(colors);
    case 'balloons':
      return balloons(colors);
    case 'backwaters':
      return backwaters(colors);
    case 'sarovar':
      return sarovar(colors);
    case 'vrindavan':
      return vrindavan(colors);
  }
}

// ─────────────────────────── Painted artwork ───────────────────────────

/**
 * URL of a painted layer. The public route checks the art is approved,
 * licensed and published, then redirects to a short-lived signed URL at the
 * requested width; renderers that cannot use it pass signed URLs in ctx.assets.
 */
export function artworkAssetUrl(assetId: string, width: 1200 | 2400, ctx?: Pick<RenderContext, 'assets'>): string {
  return ctx?.assets?.[assetId] ?? `/api/v1/public/template-assets/${assetId}?w=${width}`;
}

/**
 * Commissioned painted art as a scene: each layer is a full-canvas transparent
 * image on the same 1200×800 (3:2) canvas as the drawn scenes, so parallax,
 * camera moves, phone framing and posters behave identically.
 */
export function artworkArt(artwork: Artwork, colors: ThemeColors, opts: { ctx?: Pick<RenderContext, 'assets'>; width?: 1200 | 2400 } = {}): SceneArt {
  const width = opts.width ?? 2400;
  return {
    background: artwork.background ?? (artwork.dark ? mix(colors.primary, '#000000', 0.4) : colors.background),
    dark: artwork.dark,
    textTop: '',
    textInset: artwork.textTop,
    textShadow: true,
    layers: artwork.layers.map((layer) => ({
      depth: layer.depth,
      node: (
        <Canvas>
          <image href={artworkAssetUrl(layer.assetId, width, opts.ctx)} x="0" y="0" width="1200" height="800" preserveAspectRatio="none" />
        </Canvas>
      ),
    })),
  };
}

/** The art behind a film scene or card: a drawn scene or one of the template's artworks. */
export function backdropArt(
  definition: Pick<TemplateDefinition, 'artworks'>,
  backdrop: { scene?: SceneName; artwork?: string },
  colors: ThemeColors,
  opts: { ctx?: Pick<RenderContext, 'assets'>; width?: 1200 | 2400; monogram?: string; photo?: string } = {},
): SceneArt | null {
  if (backdrop.artwork) {
    const artwork = definition.artworks?.[backdrop.artwork];
    return artwork ? artworkArt(artwork, colors, opts) : null;
  }
  return backdrop.scene ? sceneArt(backdrop.scene, colors, opts) : null;
}

/** Every layer URL of a backdrop's painted art, so renderers can wait for it to load. */
export function backdropImageUrls(definition: Pick<TemplateDefinition, 'artworks'>, backdrop: { artwork?: string }, ctx?: Pick<RenderContext, 'assets'>, width: 1200 | 2400 = 2400): string[] {
  const artwork = backdrop.artwork ? definition.artworks?.[backdrop.artwork] : undefined;
  return artwork ? artwork.layers.map((l) => artworkAssetUrl(l.assetId, width, ctx)) : [];
}

/**
 * Website hero for a scene: layers get data-depth for DepthScene, the text
 * block sits in the sky, and a fade joins the hero to the page.
 */
export function SceneHero({ art, colors, children, thumbnail }: { art: SceneArt; colors: ThemeColors; children: ReactNode; thumbnail?: boolean }) {
  // Painted skies can be busy: a soft shadow keeps the names readable over them.
  const shadow = art.textShadow ? (art.dark ? '0 1px 14px rgba(0,0,0,0.45)' : '0 1px 12px rgba(255,255,255,0.7)') : undefined;
  return (
    <header data-bulava-scene className={`relative isolate overflow-hidden ${thumbnail ? 'h-[720px]' : 'h-[100svh] min-h-[640px] max-h-[980px]'}`} style={{ background: art.background }}>
      {art.layers.map((layer, i) => (
        <div key={i} data-depth={layer.depth} className="pointer-events-none absolute inset-0 will-change-transform" aria-hidden="true">
          {layer.node}
        </div>
      ))}
      <div data-depth="0.5" className={`relative z-10 flex h-full flex-col items-center px-6 text-center will-change-transform ${art.textTop}`} style={{ textShadow: shadow }}>
        {art.textInset !== undefined ? <div aria-hidden="true" style={{ flex: `0 0 ${Math.round(art.textInset * 1000) / 10}%` }} /> : null}
        {children}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16" style={{ background: `linear-gradient(to bottom, transparent, ${colors.background})` }} aria-hidden="true" />
    </header>
  );
}

/**
 * A still of a scene laid out at phone size and scaled into a box: catalogue
 * posters for films and cards. Children (a title) sit on top.
 */
export function SceneStill({ art, width, height, children }: { art: SceneArt; width: number; height: number; children?: ReactNode }) {
  const scale = width / 432;
  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden', background: art.background }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 432, height: height / scale, transform: `scale(${scale})`, transformOrigin: '0 0' }} aria-hidden="true">
        {art.layers.map((layer, i) => (
          <div key={i} style={{ position: 'absolute', inset: 0 }}>
            {layer.node}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}
