'use client';

import { backdropArt } from '@bulava/template-engine';
import type { RenderContext, Scene, TemplateDefinition, ThemeColors } from '@bulava/template-schema';

/** The 9:16 stage film backdrops are drawn on (the video engine's), fitted to the frame. */
const STAGE = { width: 432, height: 768 };

/**
 * A film scene's or card's illustrated backdrop, still, behind its board: as
 * the film starts it (before the camera moves), so the words drawn on the
 * board are seen against what they will sit on. `width` and `height` are the
 * board's size on screen.
 */
export function SceneBackdropStill({ scene, definition, colors, ctx, width, height }: { scene: Scene; definition: Pick<TemplateDefinition, 'artworks'>; colors: ThemeColors; ctx: RenderContext; width: number; height: number }) {
  if (!scene.backdrop) return null;
  const art = backdropArt(definition, scene.backdrop, colors, { ctx, photo: ctx.photoSlots?.cover?.url ?? ctx.photos[0]?.url });
  const base = scene.background === 'gradient' ? `linear-gradient(160deg, ${colors.primary}, ${colors.secondary})` : ((colors as unknown as Record<string, string>)[scene.background] ?? scene.background);
  if (!art) return <div aria-hidden style={{ position: 'absolute', inset: 0, background: base }} />;
  const s = Math.min(width / STAGE.width, height / STAGE.height);
  const veil = scene.backdrop.veil;
  const veilColor = art.dark ? `color-mix(in srgb, ${colors.primary} 45%, #000000)` : colors.background;
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: base, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: width / s, height: height / s, transform: `scale(${s})`, transformOrigin: '0 0', background: art.background }}>
        {art.layers.map((layer, i) => (
          <div key={i} style={{ position: 'absolute', inset: 0 }}>
            {layer.node}
          </div>
        ))}
        {veil ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(180deg, color-mix(in srgb, ${veilColor} ${Math.round(veil * 100)}%, transparent) 0%, color-mix(in srgb, ${veilColor} ${Math.round(veil * 60)}%, transparent) 45%, transparent 70%)`,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
