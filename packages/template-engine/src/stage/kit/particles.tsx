import type { CSSProperties, ReactElement, ReactNode } from 'react';
import type { EffectName, ThemeColors } from '@bulava/template-schema';
import { mix } from '../../theme';
import { NATURE } from '../../art/kit';
import { r2, rand } from '../../art/motifs';

/**
 * Particles at depth (final.md §6.3): placed in the stage by placeParticles()
 * and moved by the stage's motion. Each effect has four or five seeded shapes,
 * tones, turns and sizes, so a field of forty never looks cloned. Drawn on a
 * 20×20 grid and scaled to the particle's box.
 *
 * A field shares its drawings (particleLook): each shape of an effect is drawn
 * once, as a <g> in the stage's particle sprite (StageView), and every particle
 * is a <use> of it that paints it in its own colours (the custom properties
 * --pa, --pb and --pc, which inherit into the use) and turns and scales it its
 * own way. Gradients are shared by their colours. A film's sixty particles then
 * cost a few hundred bytes each instead of an SVG each. ParticleArt draws one
 * particle on its own (the kit sheet) from the same look.
 */

export interface ParticleArtProps {
  effect: Exclude<EffectName, 'none'>;
  /** rand() salt: picks the particle's tone, turn and shape. */
  seed: number;
  /** The particle's box (units, square). */
  size: number;
  /** The palette (petals, confetti); defaults to warm neutrals. */
  colors?: ThemeColors;
}

/** The custom properties a particle paints its shared drawing with. */
export type ParticleColorVar = '--pa' | '--pb' | '--pc';

export interface ParticleLook {
  /** The shared drawing's id: the effect, its shape and the gradients it fills with (identical ids draw identically). */
  key: string;
  /** The drawing on the 20×20 grid; its paints read the particle's colours as var(--pa), var(--pb) and var(--pc). */
  drawing: ReactNode;
  /** The gradients the drawing fills with, keyed by id (one id is always one gradient). */
  gradients: ReadonlyArray<ReactElement>;
  /** The particle's own colours. */
  vars: Partial<Record<ParticleColorVar, string>>;
  /** The particle's own turn and scale about the cell's centre. */
  transform?: string;
}

const FALLBACK = { primary: '#9a3c1e', secondary: '#c0903a', accent: '#f8e7c8' } as const;

/** A rose petal's pink: petals lean toward it so a navy or maroon palette still sheds flowers, not ink. */
const ROSE = '#e0627f';

/** Marigold petals in their own oranges and golds: base, shade, light. */
const MARIGOLD = [
  ['#ffb300', '#e07a00', '#ffe08a'],
  ['#f57c00', '#c24400', '#ffb74d'],
  ['#ffd54f', '#f0a000', '#fff3c4'],
  ['#ff8f00', '#d84315', '#ffcc80'],
] as const;

/** Sky-lantern paper: the glow and the darker paper at the edge. */
const LANTERN = [
  [NATURE.flame, '#d9541e'],
  ['#ff9a3d', '#c23a12'],
  ['#ffc46b', '#d9772a'],
  ['#ff7a4a', '#b8321a'],
] as const;

const hx = (c: string) => (/^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7) : '#9a8a78');
const dk = (c: string, a: number) => mix(hx(c), '#000000', a);
const lt = (c: string, a: number) => mix(hx(c), '#ffffff', a);
const bl = (a: string, b: string, t: number) => mix(hx(a), hx(b), t);

/** Paints from the particle's colours. */
const FA: CSSProperties = { fill: 'var(--pa)' };
const FB: CSSProperties = { fill: 'var(--pb)' };
const FC: CSSProperties = { fill: 'var(--pc)' };
const SA: CSSProperties = { stroke: 'var(--pa)' };
const SB: CSSProperties = { stroke: 'var(--pb)' };
const SC: CSSProperties = { stroke: 'var(--pc)' };

function hashOf(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** A particle's look: the shared drawing it uses, its colours and its own turn (pure: the same seed and colours give the same look). */
export function particleLook({ effect, seed, colors }: Omit<ParticleArtProps, 'size'>): ParticleLook {
  const c = { primary: hx(colors?.primary ?? FALLBACK.primary), secondary: hx(colors?.secondary ?? FALLBACK.secondary), accent: hx(colors?.accent ?? FALLBACK.accent) };
  const pick = rand(seed, 911);
  const shape = rand(seed, 917);
  const turn = Math.round(rand(seed, 913) * 360);
  const scale = r2(0.8 + rand(seed, 919) * 0.28);
  /** Turned and scaled about the cell's centre. */
  const spin = `translate(10 10) rotate(${turn}) scale(${scale}) translate(-10 -10)`;
  /** Gradient ids from their colours: particles that share one draw identical defs. */
  const gid = (...parts: string[]) => `pa${effect}${hashOf(parts.join('|'))}`;
  /** Drawing ids: the effect and shape, plus the gradient they fill with (gradient ids never carry a hyphen). */
  const key = (v: number, gradient?: string) => `pa-${effect}-${v}${gradient ? `-${gradient}` : ''}`;

  switch (effect) {
    case 'petals': {
      const tones = [bl(c.primary, ROSE, 0.35), bl(c.accent, ROSE, 0.3), lt(bl(c.primary, ROSE, 0.5), 0.3), bl(c.secondary, ROSE, 0.35)];
      const base = tones[Math.floor(pick * tones.length)]!;
      const v = Math.floor(shape * 4);
      return {
        key: key(v),
        vars: { '--pa': base, '--pb': dk(base, 0.24), '--pc': lt(base, 0.4) },
        transform: spin,
        gradients: [],
        drawing:
          v === 0 ? (
            <>
              <path d="M10 2C15 6 15.5 12.5 10 18C4.5 12.5 5 6 10 2Z" style={FA} />
              <path d="M10 2C15 6 15.5 12.5 10 18C12 12 12 7 10 2Z" style={FB} />
              <path d="M8.2 5.5C6.8 8 6.8 11 8 13.5" fill="none" style={SC} strokeWidth="0.9" strokeLinecap="round" />
            </>
          ) : v === 1 ? (
            <>
              <path d="M10 18C3.5 15 2.5 7.5 6 4.5C7.8 3.2 9.2 4 10 5.2C10.8 4 12.2 3.2 14 4.5C17.5 7.5 16.5 15 10 18Z" style={FA} />
              <path d="M10 18C6 14.5 6 9 10 5.2C9 10 9.5 14 10 18Z" style={FC} opacity="0.45" />
              <path d="M13.6 5.6C15.6 7.6 15.8 11 14.2 13.6" fill="none" style={SB} strokeWidth="0.8" strokeLinecap="round" />
            </>
          ) : v === 2 ? (
            <>
              <path d="M2.5 12C4 5.5 15 3.5 17.5 9C14 8 8 8.6 2.5 12Z" style={FA} />
              <path d="M2.5 12C8 14.6 14.5 13 17.5 9C13.5 10.4 8 11.2 2.5 12Z" style={FB} />
              <path d="M6 9.2C9 7.4 12.6 7 15 7.6" fill="none" style={SC} strokeWidth="0.7" strokeLinecap="round" />
            </>
          ) : (
            <>
              <path d="M10 2.5C13.5 5 14 13 10 17.5C6 13 6.5 5 10 2.5Z" style={FA} />
              <path d="M10 2.5C13.5 5 14 13 10 17.5Z" style={FB} opacity="0.75" />
              <path d="M10 4.5V15.5" style={SC} strokeWidth="0.6" opacity="0.7" />
            </>
          ),
      };
    }
    case 'marigold': {
      const [b, d, l] = MARIGOLD[Math.floor(pick * MARIGOLD.length)]!;
      const v = Math.floor(shape * 4);
      const ray = 'M10 18L5.5 7.5Q6 4 8 5Q9 2.5 10.5 4.5Q12.5 2.8 13.6 5.4Q15.8 5.6 14.5 7.5Z';
      return {
        key: key(v),
        vars: { '--pa': b, '--pb': d, '--pc': l },
        transform: spin,
        gradients: [],
        drawing:
          v === 0 ? (
            <>
              <path d={ray} style={FA} />
              <path d="M10 18L8 6.5M10 18L11 5.5M10 18L13 6.5" style={SB} strokeWidth="0.5" opacity="0.6" />
              <path d="M6.3 6.6Q8 4.6 10.4 5.6Q12.6 4.2 14 6.6" fill="none" style={SC} strokeWidth="0.7" />
            </>
          ) : v === 1 ? (
            <>
              <circle cx="10" cy="10" r="7" style={FB} />
              <circle cx="10" cy="10" r="6.1" fill="none" style={SA} strokeWidth="2.6" strokeDasharray="1.7 1.1" strokeLinecap="round" />
              <circle cx="10" cy="10" r="3.6" style={FA} />
              <circle cx="10" cy="10" r="3.4" fill="none" style={SC} strokeWidth="1.5" strokeDasharray="1 1" />
              <circle cx="10" cy="10" r="1.3" style={FB} />
            </>
          ) : v === 2 ? (
            <>
              <path d={ray} style={FB} transform="rotate(-28 10 18) scale(0.85) translate(1.8 3.2)" />
              <path d={ray} style={FA} transform="rotate(22 10 18) scale(0.85) translate(1.8 3.2)" />
            </>
          ) : (
            <>
              <path d="M3 13C4 7 9 5 14 6C17 6.5 18 9 16.5 10.5C13 9 8 10.5 3 13Z" style={FA} />
              <path d="M3 13C8 13.5 13 12.5 16.5 10.5C12.5 10.6 8 11.4 3 13Z" style={FB} />
              <path d="M6 8.4Q10 5.6 15 6.6" fill="none" style={SC} strokeWidth="1" strokeDasharray="1 0.8" />
            </>
          ),
      };
    }
    case 'goldDust': {
      const g = c.secondary;
      const core = lt(g, 0.82);
      const v = Math.floor(shape * 4);
      const id = gid(g);
      const glow = (
        <radialGradient key={id} id={id}>
          <stop offset="0" stopColor={core} />
          <stop offset="0.35" stopColor={g} stopOpacity="0.75" />
          <stop offset="1" stopColor={g} stopOpacity="0" />
        </radialGradient>
      );
      if (v === 0) return { key: key(0, id), vars: {}, gradients: [glow], drawing: <circle cx="10" cy="10" r="9" fill={`url(#${id})`} /> };
      if (v === 1)
        return {
          key: key(1, id),
          vars: { '--pa': lt(g, 0.55), '--pb': core },
          transform: `rotate(${turn % 45} 10 10)`,
          gradients: [glow],
          drawing: (
            <>
              <circle cx="10" cy="10" r="6" fill={`url(#${id})`} opacity="0.7" />
              <path d="M10 1.5L11 9L18.5 10L11 11L10 18.5L9 11L1.5 10L9 9Z" style={FA} />
              <circle cx="10" cy="10" r="1.4" style={FB} />
            </>
          ),
        };
      if (v === 2)
        return {
          key: key(2),
          vars: { '--pa': g, '--pb': core },
          gradients: [],
          drawing: (
            <>
              <circle cx="10" cy="10" r="5.5" style={FA} opacity="0.22" />
              <circle cx="10" cy="10" r="2" style={FB} />
            </>
          ),
        };
      return {
        key: key(3, id),
        vars: { '--pa': lt(g, 0.6), '--pb': core },
        gradients: [glow],
        drawing: (
          <>
            <circle cx="10" cy="10" r="5" fill={`url(#${id})`} />
            <path d="M10 4V16M4.8 7L15.2 13M4.8 13L15.2 7" style={SA} strokeWidth="0.8" strokeLinecap="round" />
            <circle cx="10" cy="10" r="1.5" style={FB} />
          </>
        ),
      };
    }
    case 'fireflies': {
      const tone = pick < 0.6 ? '#fff3a0' : pick < 0.85 ? '#e8ff9a' : '#ffe2a0';
      const v = Math.floor(shape * 4);
      const id = gid(tone);
      const glow = (
        <radialGradient key={id} id={id}>
          <stop offset="0" stopColor={tone} stopOpacity="0.6" />
          <stop offset="0.4" stopColor={tone} stopOpacity="0.18" />
          <stop offset="1" stopColor={tone} stopOpacity="0" />
        </radialGradient>
      );
      return {
        key: key(v, id),
        vars: { '--pa': bl(tone, c.secondary, 0.4) },
        // The body is the one part that is not round: the whole drawing turns about the glow's centre.
        ...(v === 1 ? { transform: `rotate(${turn} 10 10)` } : {}),
        gradients: [glow],
        drawing:
          v === 0 ? (
            <>
              <circle cx="10" cy="10" r="9.5" fill={`url(#${id})`} />
              <circle cx="10" cy="10" r="2.2" style={FA} />
              <circle cx="10" cy="10" r="1" fill="#fffef0" />
            </>
          ) : v === 1 ? (
            <>
              <circle cx="10" cy="10" r="7" fill={`url(#${id})`} />
              <ellipse cx="10" cy="10" rx="1.2" ry="2.4" style={FA} />
              <circle cx="10" cy="10.4" r="0.8" fill="#fffef0" />
            </>
          ) : v === 2 ? (
            <>
              <circle cx="10" cy="10" r="9.8" fill={`url(#${id})`} opacity="0.65" />
              <circle cx="10" cy="10" r="1.7" style={FA} />
              <circle cx="10" cy="10" r="0.9" fill="#fffef0" />
            </>
          ) : (
            <>
              <circle cx="10" cy="10" r="6" fill={`url(#${id})`} opacity="0.55" />
              <circle cx="10" cy="10" r="1.6" style={FA} opacity="0.8" />
            </>
          ),
      };
    }
    case 'confetti': {
      const tones = [lt(c.primary, 0.3), c.secondary, c.accent, bl(c.primary, c.accent, 0.35), lt(c.secondary, 0.35)];
      const col = tones[Math.floor(pick * tones.length)]!;
      const v = Math.floor(shape * 5);
      return {
        key: key(v),
        vars: v === 4 ? { '--pa': col, '--pc': lt(col, 0.3) } : { '--pa': col, '--pb': dk(col, 0.3) },
        transform: spin,
        gradients: [],
        drawing:
          v === 0 ? (
            <>
              <path d="M7 3H13L12 10H8Z" style={FA} />
              <path d="M8 10H12L13 17H7Z" style={FB} />
            </>
          ) : v === 1 ? (
            <>
              <path d="M3 9C6 4 9 14 12 9S17 6 17.5 10.5" fill="none" style={SB} strokeWidth="2.6" strokeLinecap="round" />
              <path d="M3 8.4C6 3.4 9 13.4 12 8.4" fill="none" style={SA} strokeWidth="2.2" strokeLinecap="round" />
            </>
          ) : v === 2 ? (
            <>
              <ellipse cx="10" cy="10" rx="3.8" ry="2.4" style={FA} />
              <ellipse cx="10" cy="10.6" rx="3.8" ry="1.6" style={FB} opacity="0.5" />
            </>
          ) : v === 3 ? (
            <>
              <path d="M10 4L15 10L10 16L5 10Z" style={FA} />
              <path d="M10 4L15 10L10 16Z" style={FB} />
            </>
          ) : (
            <>
              <rect x="6.5" y="5" width="7" height="10" rx="0.6" style={FA} />
              <path d="M6.5 5H13.5L6.5 11Z" style={FC} opacity="0.6" />
            </>
          ),
      };
    }
    case 'lanterns': {
      // The paper's colours are the lantern's own (never the palette's): the drawing carries them, one per tone and shape.
      const [paper, edge] = LANTERN[Math.floor(pick * LANTERN.length)]!;
      const v = Math.floor(shape * 4);
      const tilt = Math.round((rand(seed, 921) - 0.5) * 16);
      const id = gid(paper, edge);
      const body = [
        'M4 3Q10 1.6 16 3L13.6 15.2Q10 16 6.4 15.2Z',
        'M3.5 4.4Q10 2.8 16.5 4.4L14 15.4Q10 16.2 6 15.4Z',
        'M5 3Q10 1.4 15 3C16.4 7 15.6 12 13.4 15.2Q10 16 6.6 15.2C4.4 12 3.6 7 5 3Z',
        'M5.4 2.6Q10 1.6 14.6 2.6L13.8 15.2Q10 15.9 6.2 15.2Z',
      ][v]!;
      return {
        key: key(v, id),
        vars: {},
        transform: `rotate(${tilt} 10 10)`,
        gradients: [
          <radialGradient key={id} id={id} cx="50%" cy="84%" r="78%">
            <stop offset="0" stopColor={NATURE.flameCore} />
            <stop offset="0.38" stopColor={paper} />
            <stop offset="1" stopColor={edge} />
          </radialGradient>,
          <radialGradient key={`${id}h`} id={`${id}h`}>
            <stop offset="0" stopColor={paper} stopOpacity="0.4" />
            <stop offset="1" stopColor={paper} stopOpacity="0" />
          </radialGradient>,
        ],
        drawing: (
          <>
            <circle cx="10" cy="11" r="9.8" fill={`url(#${id}h)`} />
            <path d={body} fill={`url(#${id})`} />
            <path d="M8.2 3L8.8 15.4M11.8 3L11.2 15.4" stroke={edge} strokeWidth="0.4" opacity="0.5" />
            <path d="M4.6 3.2Q10 1.9 15.4 3.2" fill="none" stroke={dk(edge, 0.2)} strokeWidth="0.6" opacity="0.7" />
            <ellipse cx="10" cy="15.5" rx="3.6" ry="0.8" fill={dk(edge, 0.25)} />
            <ellipse cx="10" cy="15.1" rx="1.2" ry="1.7" fill={NATURE.flameCore} />
          </>
        ),
      };
    }
    case 'snow':
    default: {
      const tint = bl('#ffffff', c.primary, 0.2);
      const v = Math.floor(shape * 4);
      const id = gid(tint);
      const glow = (
        <radialGradient key={id} id={id}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="1" stopColor={tint} stopOpacity="0" />
        </radialGradient>
      );
      if (v === 0)
        return {
          key: key(0, id),
          vars: {},
          gradients: [glow],
          drawing: (
            <>
              <circle cx="10" cy="10" r="6" fill={`url(#${id})`} />
              <circle cx="10" cy="10" r="2.6" fill="#ffffff" />
            </>
          ),
        };
      if (v === 1)
        return {
          key: key(1),
          vars: { '--pa': tint },
          transform: `rotate(${turn % 60} 10 10)`,
          gradients: [],
          drawing: (
            <>
              <path d="M10 3.5V16.5M4.4 6.8L15.6 13.2M4.4 13.2L15.6 6.8M10 5.6L8.6 4.2M10 5.6L11.4 4.2M10 14.4L8.6 15.8M10 14.4L11.4 15.8" stroke="#ffffff" strokeWidth="0.9" strokeLinecap="round" />
              <circle cx="10" cy="10" r="1.3" fill="#ffffff" />
              <circle cx="10" cy="10" r="5" fill="none" style={SA} strokeWidth="0.4" opacity="0.4" />
            </>
          ),
        };
      if (v === 2)
        return {
          key: key(2),
          vars: { '--pa': tint },
          gradients: [],
          drawing: (
            <>
              <circle cx="10" cy="10" r="2" fill="#ffffff" />
              <circle cx="10" cy="10" r="2" fill="none" style={SA} strokeWidth="0.5" />
            </>
          ),
        };
      return { key: key(3, id), vars: {}, gradients: [glow], drawing: <circle cx="10" cy="10" r="8" fill={`url(#${id})`} opacity="0.85" /> };
    }
  }
}

/** One particle on its own, at a px size (the kit sheet): its look drawn in place, with its own defs. */
export function ParticleArt({ effect, seed, size, colors }: ParticleArtProps) {
  const look = particleLook({ effect, seed, colors });
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" style={{ display: 'block', overflow: 'visible', ...(look.vars as CSSProperties) }}>
      {look.gradients.length ? <defs>{look.gradients}</defs> : null}
      <g transform={look.transform}>{look.drawing}</g>
    </svg>
  );
}
