'use client';

import { Player } from '@remotion/player';
import { useMemo } from 'react';
import { TemplateVideo, templateVideoMetadata, type TemplateVideoProps } from '@bulava/video-engine';
import type { LookFilmData } from './look-parts';

/** A preview's film in the browser: its own size, the event's details, always with the watermark. */
export function LookFilmPlayer({ film }: { film: LookFilmData }) {
  const props = useMemo<TemplateVideoProps>(
    () => ({ definition: film.definition, context: film.context, customization: film.customization, language: film.language, watermark: true, musicUrl: null }),
    [film],
  );
  const meta = templateVideoMetadata(props);
  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-night-900 shadow-[0_40px_80px_-40px_rgba(28,25,23,0.6)]" style={{ aspectRatio: `${meta.width} / ${meta.height}` }}>
      <Player
        component={TemplateVideo}
        inputProps={props}
        durationInFrames={meta.durationInFrames}
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
    </div>
  );
}
