'use client';

import { useMemo } from 'react';
import { backdropArt, StageStill } from '@bulava/template-engine';
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
  if (scene.backdrop.stage) return <StageBackdropStill name={scene.backdrop.stage} colors={colors} width={width} height={height} veil={scene.backdrop.veil ?? 0} />;
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

/**
 * A Signature 3D stage (ADR-078) at its rest pose, the camera before it moves.
 * The set is drawn once per stage, palette and size: zooming re-renders it, a
 * change to the board's layers does not.
 */
function StageBackdropStill({ name, colors, width, height, veil }: { name: NonNullable<NonNullable<Scene['backdrop']>['stage']>; colors: ThemeColors; width: number; height: number; veil: number }) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  // Under the scene's own veil, as the film draws it (the larger of the backdrop's and the set's).
  const still = useMemo(() => <StageStill name={name} colors={colors} width={w} height={h} veil={veil} />, [name, colors, w, h, veil]);
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {still}
    </div>
  );
}
