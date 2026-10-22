import type { CSSProperties, ReactNode } from 'react';
import type { IllustrationName, SectionDecor, ThemeColors } from '@bulava/template-schema';
import { ILLUSTRATION_ASPECT, Illustration } from '../art/illustrations';
import { r2 } from '../art/motifs';
import { resolveColor } from '../canvas/colors';
import type { RenderMode } from '../types';

/**
 * A section's decor (`SectionInstance.decor`): art in its corners and sides, behind its words, each piece
 * drawn once and placed by the page's width. From 1100 px up a piece stands at its place, sized for a
 * 1440-wide page and scaled with the page (never below 76%). Narrower, the pieces that ask for it (`phone`)
 * stand along the band's top or foot at size × phone, keeping their sides and offsets (a piece sunk past the edge, a negative y, sinks as far in proportion), and the band makes
 * room for them (`top`, `bottom`); the rest hide. Everything is aria-hidden and lets clicks through.
 * Strands and lanterns sway on live pages only.
 */

const FLIP: Record<SectionDecor['flip'], string | undefined> = { none: undefined, x: 'scaleX(-1)', y: 'scaleY(-1)', xy: 'scale(-1, -1)' };

/** A length of `px` on a 1440-wide page that follows the page's width, between 76% and 100% of it. */
function fluid(px: number): string {
  if (px === 0) return '0px';
  const a = r2(px * 0.76);
  return `clamp(${Math.min(a, px)}px, ${r2(px / 14.4)}cqw, ${Math.max(a, px)}px)`;
}

const aspectOf = (piece: SectionDecor) => piece.aspect ?? ILLUSTRATION_ASPECT[piece.art] ?? 1;
const isTop = (piece: SectionDecor) => piece.at === 'topLeft' || piece.at === 'topRight';
const isLeft = (piece: SectionDecor) => piece.at === 'topLeft' || piece.at === 'bottomLeft' || piece.at === 'left';
const isMiddle = (piece: SectionDecor) => piece.at === 'left' || piece.at === 'right';

/** Where a piece stands: phones first (along the band's edge), then from 1100 px (its own place). */
function placement(piece: SectionDecor): string {
  const side = isLeft(piece) ? 'left-[var(--px)] @min-[1100px]:left-[var(--dx)]' : 'right-[var(--px)] @min-[1100px]:right-[var(--dx)]';
  const edge = isTop(piece)
    ? 'top-[var(--py)] @min-[1100px]:top-[var(--dy)]'
    : isMiddle(piece)
      ? 'bottom-0 @min-[1100px]:top-1/2 @min-[1100px]:bottom-auto @min-[1100px]:mt-[var(--dy)] @min-[1100px]:-translate-y-1/2'
      : 'bottom-[var(--py)] @min-[1100px]:bottom-[var(--dy)]';
  return `absolute h-[var(--ph)] w-[var(--pw)] @min-[1100px]:h-[var(--dh)] @min-[1100px]:w-[var(--dw)] ${side} ${edge} ${piece.phone > 0 ? '' : 'hidden @min-[1100px]:block'}`;
}

// ─────────────────────────── Drawings shared down the page ───────────────────────────

/** Art heavy enough, and repeated enough down a page, to be drawn once and placed with <use>. */
const SHARED_ART = new Set<IllustrationName>(['roseCluster', 'royalPeacock', 'standingPeacock']);

/** The key of a drawing in one colouring (art, its tint, its foil). */
export const artKey = (art: IllustrationName, tint: string, foil: boolean) => `${art}:${tint.toLowerCase()}:${foil ? 1 : 0}`;

/** The shared drawings a page's sections place (from their decor, plus any `extra` a section draws itself), by key. */
export function sharedArtOf(sections: ReadonlyArray<{ decor?: readonly SectionDecor[] }>, colors: ThemeColors, extra: ReadonlyArray<{ art: IllustrationName; tint: string; foil: boolean }> = []): Map<string, { art: IllustrationName; tint: string; foil: boolean }> {
  const out = new Map<string, { art: IllustrationName; tint: string; foil: boolean }>();
  const add = (art: IllustrationName, tint: string, foil: boolean) => {
    if (SHARED_ART.has(art)) out.set(artKey(art, tint, foil), { art, tint, foil });
  };
  for (const section of sections) for (const piece of section.decor ?? []) add(piece.art, resolveColor(piece.tint, colors, colors.secondary), piece.foil);
  for (const piece of extra) add(piece.art, piece.tint, piece.foil);
  return out;
}

/** The shared drawings as symbols (one hidden <svg> for the page); `ids` maps each key to its symbol's id. */
export function SharedArt({ art, ids, colors }: { art: Map<string, { art: IllustrationName; tint: string; foil: boolean }>; ids: Readonly<Record<string, string>>; colors: ThemeColors }) {
  if (!art.size) return null;
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        {[...art].map(([key, piece]) => {
          const aspect = ILLUSTRATION_ASPECT[piece.art] ?? 1;
          return (
            <symbol key={key} id={ids[key]} viewBox={`0 0 ${r2(aspect * 100)} 100`}>
              <Illustration name={piece.art} color={piece.tint} colors={colors} foil={piece.foil} w={r2(aspect * 100)} h={100} style={{ width: '100%', height: '100%' }} />
            </symbol>
          );
        })}
      </defs>
    </svg>
  );
}

/** A drawing: the page's shared symbol when there is one, else drawn here. */
export function ArtOrRef({ art, tint, colors, foil, w, h, refs }: { art: IllustrationName; tint: string; colors: ThemeColors; foil: boolean; w: number; h: number; refs?: Readonly<Record<string, string>> }) {
  const ref = refs?.[artKey(art, tint, foil)];
  if (ref) {
    const aspect = ILLUSTRATION_ASPECT[art] ?? 1;
    return (
      <svg viewBox={`0 0 ${r2(aspect * 100)} 100`} aria-hidden="true" style={{ display: 'block', width: '100%', height: '100%' }}>
        <use href={`#${ref}`} />
      </svg>
    );
  }
  return <Illustration name={art} color={tint} colors={colors} foil={foil} w={w} h={h} style={{ display: 'block', width: '100%', height: '100%' }} />;
}

/** One piece drawn into its box: its halo, its flip and its sway. */
function Piece({ piece, colors, live, index, refs }: { piece: SectionDecor; colors: ThemeColors; live: boolean; index: number; refs?: Readonly<Record<string, string>> }) {
  const aspect = aspectOf(piece);
  const sway = live && piece.sway;
  const vars: CSSProperties = {
    ['--dh' as string]: fluid(piece.size),
    ['--dw' as string]: fluid(r2(piece.size * aspect)),
    ['--dx' as string]: fluid(piece.x),
    ['--dy' as string]: fluid(piece.y),
    ['--ph' as string]: `${r2(piece.size * piece.phone)}px`,
    ['--pw' as string]: `${r2(piece.size * aspect * piece.phone)}px`,
    ['--px' as string]: `${r2(piece.x * piece.phone)}px`,
    ['--py' as string]: `${r2(Math.min(0, piece.y) * piece.phone)}px`,
  };
  return (
    <div className={placement(piece)} style={vars}>
      <div className={sway ? 'bulava-sway-soft' : undefined} style={{ position: 'relative', width: '100%', height: '100%', opacity: piece.opacity, ...(sway ? { animationDelay: `${r2((index % 3) * 1.2)}s`, animationDuration: `${6 + (index % 2) * 0.8}s` } : {}) }}>
        {piece.glow ? <div style={{ position: 'absolute', inset: '-24% -60%', background: 'radial-gradient(closest-side at 50% 62%, rgba(255, 227, 163, 0.35), rgba(255, 227, 163, 0) 70%)' }} /> : null}
        <div style={{ position: 'relative', width: '100%', height: '100%', transform: FLIP[piece.flip] }}>
          <ArtOrRef art={piece.art} tint={resolveColor(piece.tint, colors, colors.secondary)} colors={colors} foil={piece.foil} w={r2(piece.size * aspect)} h={piece.size} refs={refs} />
        </div>
      </div>
    </div>
  );
}

/**
 * The decor layer and the room the band leaves for it on narrower pages (px along its top and its foot).
 * Thumbnails are phone-wide: they draw only the pieces phones show.
 */
export function decorOf(pieces: readonly SectionDecor[] | undefined, colors: ThemeColors | undefined, mode: RenderMode | undefined, refs?: Readonly<Record<string, string>>): { layer: ReactNode; top: number; bottom: number } {
  const list = (pieces ?? []).filter((piece) => mode !== 'thumbnail' || piece.phone > 0);
  if (!list.length || !colors) return { layer: null, top: 0, bottom: 0 };
  const room = (top: boolean) => r2(Math.max(0, ...list.filter((piece) => piece.phone > 0 && isTop(piece) === top).map((piece) => piece.size * piece.phone)));
  return {
    layer: (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {list.map((piece, i) => (
          <Piece key={i} piece={piece} colors={colors} live={mode === 'live'} index={i} refs={refs} />
        ))}
      </div>
    ),
    top: room(true),
    bottom: room(false),
  };
}
