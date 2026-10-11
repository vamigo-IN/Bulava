'use client';

import { Play } from 'lucide-react';
import { useMemo } from 'react';
import { createTranslator } from '@bulava/localization';
import { CanvasArtboard, fillStyle, TemplateRenderer, TemplateStyles, TemplateThumbnail, themeStyle } from '@bulava/template-engine';
import { sampleRenderContext, type TemplateDefinition } from '@bulava/template-schema';

/*
 * Templates drawn live, for those without a pre-rendered preview image yet
 * (lib/template-previews). Pages load this module on demand with next/dynamic
 * (HeroStage, LiveThumbnail), so the template engine stays out of their
 * bundles whenever the images exist.
 */

/** The hero phone's invitation: the full preview, which HeroStage scrolls. */
export function LiveScreen({ definition, eventType }: { definition: TemplateDefinition; eventType: string }) {
  const ctx = useMemo(() => sampleRenderContext({ typeKey: eventType }), [eventType]);
  return <TemplateRenderer definition={definition} context={ctx} mode="preview" language="en" />;
}

/**
 * A canvas film's poster: its opening board as the film ends it (every layer
 * in), on the board's own colours, with a Video label. Fills its box unless a
 * size is given.
 */
export function FilmPosterView({ definition, eventType, tags, width, height, label }: { definition: TemplateDefinition; eventType: string; tags?: readonly string[]; width?: number; height?: number; label: string }) {
  const ctx = useMemo(() => sampleRenderContext({ typeKey: eventType, tags }), [eventType, tags]);
  const t = useMemo(() => createTranslator('en'), []);
  const board = definition.scenes?.find((s) => s.canvas)?.canvas?.board;
  // What films leave out: the website's buttons and live countdown.
  const omit = useMemo(() => new Set(board?.layers.flatMap((l) => (l.kind === 'widget' && l.widget.type !== 'details' ? [l.id] : [])) ?? []), [board]);
  if (!board) return null;
  const colors = definition.theme.colors;
  return (
    <div className="relative flex size-full items-center overflow-hidden" style={{ ...(width && height ? { width, height } : {}), ...fillStyle(board.background, colors, ctx) }}>
      <TemplateStyles />
      <div className="bulava-template w-full" lang="en" style={{ ...themeStyle(definition.theme, colors, definition.fonts), backgroundColor: 'transparent' }}>
        <CanvasArtboard board={board} ctx={ctx} colors={colors} fonts={definition.fonts} t={t} language="en" timeZone={ctx.event.timezone} mode="thumbnail" omit={omit} />
      </div>
      <span className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold tracking-[0.2em] text-white uppercase">
        <Play aria-hidden className="size-3 fill-current" /> {label}
      </span>
    </div>
  );
}

/** A gallery phone's first sections, with the animation styles that thumbnails leave out. */
export function LiveThumbnailView({
  definition,
  eventType,
  tags,
  width,
  height,
  sections,
}: {
  definition: TemplateDefinition;
  eventType: string;
  /** The template's tags: a festival's design previews with that festival's sample title. */
  tags?: readonly string[];
  width: number;
  height: number;
  sections: number;
}) {
  const ctx = useMemo(() => sampleRenderContext({ typeKey: eventType, noPhotos: true, tags }), [eventType, tags]);
  return (
    <>
      <TemplateStyles />
      <TemplateThumbnail definition={definition} context={ctx} width={width} height={height} sections={sections} />
    </>
  );
}
