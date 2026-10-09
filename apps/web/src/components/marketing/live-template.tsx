'use client';

import { useMemo } from 'react';
import { TemplateRenderer, TemplateStyles, TemplateThumbnail } from '@bulava/template-engine';
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
