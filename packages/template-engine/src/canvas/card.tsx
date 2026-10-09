import type { CSSProperties } from 'react';
import type { Translator } from '@bulava/localization';
import { CARD_TIME_ZONE, type Artboard, type CardDesign, type RenderContext, type Theme } from '@bulava/template-schema';
import { themeStyle } from '../theme';
import { CanvasArtboard, type ArtboardMode } from './artboard';

/** Cards style only their own layers: the theme's page-wide choices stay neutral. */
const CARD_THEME: Omit<Theme, 'colors'> = { radius: 16, ornament: 'none', pattern: 'none', heroTone: 'light', look: 'classic', effect: 'none' };

/** Height of the watermark band, in design units: a little under a tenth of the card's shorter side. */
export function watermarkBandHeight(board: Pick<Artboard, 'width' | 'height'>): number {
  return Math.max(30, Math.min(board.width, board.height) * 0.09);
}

/**
 * The free card's mark: a band across the bottom with the site's name, part
 * of the card itself (the exported image is rendered with it), sized to the
 * card so it reads the same on every format.
 */
function WatermarkBand({ board, text }: { board: Artboard; text: string }) {
  const u = (n: number) => `${((n / board.width) * 100).toFixed(4)}cqw`;
  const band = watermarkBandHeight(board);
  const size = band * 0.34;
  return (
    <div
      data-watermark=""
      role="img"
      aria-label={text}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: u(band),
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: u(size * 0.55),
        background: 'linear-gradient(180deg, rgba(24,14,10,0.62), rgba(24,14,10,0.82))',
        borderTop: `${u(Math.max(0.6, band * 0.02))} solid rgba(233,200,127,0.55)`,
        color: '#fff7ea',
        fontFamily: 'var(--font-dm-sans, system-ui), system-ui, sans-serif',
        fontSize: u(size),
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" style={{ width: u(size * 1.1), height: u(size * 1.1), flex: 'none' }}>
        <path d="M12 1.5c.6 5.6 4.9 9.9 10.5 10.5-5.6.6-9.9 4.9-10.5 10.5-.6-5.6-4.9-9.9-10.5-10.5C7.1 11.4 11.4 7.1 12 1.5Z" fill="#e9c87f" />
      </svg>
      <span>{text}</span>
    </div>
  );
}

export interface CardViewProps {
  design: Pick<CardDesign, 'colors' | 'fonts' | 'language' | 'board'>;
  /** The board to draw when it differs from the design's (the editor's live copy while dragging). */
  board?: Artboard;
  ctx: RenderContext;
  t: Translator;
  /** Static by default: no entrances or loops, long text still shrinks to fit. */
  mode?: ArtboardMode;
  /** The free card's watermark text; absent for paid and plan downloads. */
  watermark?: string | null;
  omit?: ReadonlySet<string>;
  className?: string;
  style?: CSSProperties;
}

/**
 * A digital card: its artboard in the card's palette and fonts, and the
 * watermark when it has one. The editor, the download preview and the export
 * renderer all draw cards with this, so what is downloaded is what was seen.
 */
export function CardView({ design, board, ctx, t, mode = 'edit', watermark, omit, className, style }: CardViewProps) {
  const shown = board ?? design.board;
  return (
    <div lang={design.language} className={['bulava-template', className].filter(Boolean).join(' ')} style={{ ...themeStyle({ ...CARD_THEME, colors: design.colors }, design.colors, design.fonts), width: '100%', backgroundColor: 'transparent', ...style }}>
      <CanvasArtboard
        board={shown}
        ctx={ctx}
        colors={design.colors}
        fonts={design.fonts}
        t={t}
        language={design.language}
        timeZone={CARD_TIME_ZONE}
        mode={mode}
        omit={omit}
        overlay={watermark ? <WatermarkBand board={shown} text={watermark} /> : undefined}
      />
    </div>
  );
}
