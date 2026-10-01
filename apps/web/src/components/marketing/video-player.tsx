'use client';

import { Player } from '@remotion/player';
import { useMemo } from 'react';
import { sampleRenderContext, type TemplateDefinition } from '@bulava/template-schema';
import { TemplateVideo, templateVideoMetadata, type TemplateVideoProps } from '@bulava/video-engine';

export function VideoPlayer({ definition, eventType, label }: { definition: TemplateDefinition; eventType: string; label: string }) {
  const props = useMemo<TemplateVideoProps>(
    () => ({ definition, context: sampleRenderContext({ typeKey: eventType, noPhotos: false }), customization: null, language: 'en', watermark: false, musicUrl: null }),
    [definition, eventType],
  );
  const meta = templateVideoMetadata(props);
  return (
    <Player
      component={TemplateVideo}
      inputProps={props}
      durationInFrames={meta.durationInFrames}
      // Start after the first fade-in so a paused/first frame is never blank.
      initialFrame={Math.min(meta.durationInFrames - 1, Math.round(meta.fps * 1.5))}
      fps={meta.fps}
      compositionWidth={meta.width}
      compositionHeight={meta.height}
      style={{ width: '100%', height: '100%' }}
      autoPlay
      loop
      controls={false}
      clickToPlay
      initiallyMuted
      acknowledgeRemotionLicense
      aria-label={label}
    />
  );
}
