'use client';

import { Player } from '@remotion/player';
import { useMemo } from 'react';
import type { Customization, RenderContext, TemplateDefinition } from '@bulava/template-schema';
import { TemplateVideo, templateVideoMetadata, type TemplateVideoProps } from '@bulava/video-engine';

/** In-browser preview of a video/card template with the event's real details and the host's choices. */
export function VideoPreview({ definition, context, customization = null }: { definition: TemplateDefinition; context: RenderContext; customization?: Customization | null }) {
  const props = useMemo<TemplateVideoProps>(
    () => ({ definition, context, customization, language: context.event.language, watermark: false, musicUrl: null }),
    [definition, context, customization],
  );
  const meta = templateVideoMetadata(props);
  return (
    <Player
      component={TemplateVideo}
      inputProps={props}
      durationInFrames={meta.durationInFrames}
      initialFrame={Math.min(meta.durationInFrames - 1, Math.round(meta.fps * 1.5))}
      fps={meta.fps}
      compositionWidth={meta.width}
      compositionHeight={meta.height}
      style={{ width: '100%', height: '100%' }}
      autoPlay
      loop
      controls
      initiallyMuted
      acknowledgeRemotionLicense
    />
  );
}
