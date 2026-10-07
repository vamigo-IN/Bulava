import type { CSSProperties } from 'react';
import type { RenderContext } from '@bulava/template-schema';
import type { SectionProps } from '../types';
import { CanvasArtboard } from './artboard';
import { fillBackdrop, fillStyle } from './colors';

/**
 * A canvas section on a page: its mobile artboard, and its desktop artboard
 * when it has one (a container query picks one by the page's width, see
 * styles.tsx). Without a desktop artboard the mobile one is shown centred on
 * wide screens, on a backdrop in the artboard's own colours. Repeats once per
 * function the viewer may see when the designer asked for it.
 */
export function CanvasSection(p: SectionProps) {
  const canvas = p.instance.canvas;
  if (!canvas) return null;
  const copies: RenderContext[] = canvas.repeatPerFunction
    ? p.ctx.functions.length
      ? p.ctx.functions.map((fn) => ({ ...p.ctx, function: fn, venue: fn.venue ?? p.ctx.venue }))
      : [p.ctx]
    : [p.ctx];
  const rsvpTargetId = p.rsvpSectionId;
  const backdrop = fillBackdrop(canvas.mobile.background, p.colors);
  const fallbackStyle: CSSProperties = canvas.desktop
    ? {}
    : {
        ['--cv-max' as string]: `${canvas.desktopMaxWidth}px`,
        // The centred artboard sits on its own colours, darkened a little so it reads as a card.
        ...fillStyle(canvas.mobile.background.type === 'image' ? { type: 'color', color: backdrop?.[0] ?? p.colors.background } : canvas.mobile.background, p.colors, p.ctx),
      };
  const fonts = p.fonts;
  const common = { colors: p.colors, fonts, t: p.t, language: p.language, timeZone: p.timeZone, mode: p.mode, slots: p.slots, rsvpTargetId };

  return copies.map((ctx, i) => (
    <section
      key={ctx.function?.id ?? i}
      id={i === 0 ? p.instance.id : `${p.instance.id}-${i + 1}`}
      className="bulava-reveal bulava-canvas"
      data-desktop={canvas.desktop ? '' : undefined}
      aria-label={ctx.function && canvas.repeatPerFunction ? ctx.function.name : undefined}
      style={fallbackStyle}
    >
      <div className="bulava-canvas-m">
        <CanvasArtboard board={canvas.mobile} ctx={ctx} {...common} />
      </div>
      {canvas.desktop ? (
        <div className="bulava-canvas-d">
          <CanvasArtboard board={canvas.desktop} ctx={ctx} {...common} />
        </div>
      ) : null}
    </section>
  ));
}
