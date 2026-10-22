import { VERSION } from 'remotion/version';
import type { TemplateDefinition } from '@bulava/template-schema';

/**
 * Chromium's GL setup for films (ADR-078), in one place: render.ts passes filmChromium(definition) to every Remotion
 * call (selectComposition, renderStill, renderMedia) and main.ts logs glSetup() once at start.
 *
 * Films filmed in a Signature 3D stage composite on SwiftShader through ANGLE (`gl: 'swangle'`): Chrome's GPU
 * compositor running in software, the same on every host with or without a GPU. Remotion's default leaves its headless
 * shell on Chrome's software compositor, which leaves parts of the stages' large CSS 3D planes and props undrawn (seen
 * at 540×960 and 1080×1920). Other films keep the default they have always rendered with. Keep in step with filmGl() in
 * infrastructure/scripts/film-stills.mjs and the `worker` setup of stage-budget.mjs.
 */
export function filmChromium(definition: Pick<TemplateDefinition, 'scenes'>): { gl?: 'swangle' } {
  return (definition.scenes ?? []).some((scene) => scene.backdrop?.stage) ? { gl: 'swangle' } : {};
}

/**
 * Rasterise on the CPU while SwiftShader composites (Chrome's --disable-gpu-rasterization): rasterising through
 * SwiftShader costs about five times as much per frame, for the same frames. Remotion has no option for that switch;
 * its launcher adds it only when __RESERVED_IS_INSIDE_REMOTION_LAMBDA is 'true'. Every read of the variable in the
 * Remotion code the worker loads (checked in 4.0.529: @remotion/renderer's CommonJS and ESM builds; remotion,
 * @remotion/google-fonts, @remotion/bundler and the compositor binary never read it, and nothing derives another
 * "inside Lambda" check from it):
 *   1. open-browser.js adds --disable-gpu-rasterization to every Chrome it launches;
 *   2. screenshot-task.js words its "Unable to capture screenshot" error as advice for Lambda.
 * Temp folders, clean-up, logging, timeouts, concurrency, the browser download and ffmpeg are untouched. The software
 * compositor the other films use never rasterises on a GPU, so the switch changes nothing for them. Set at import,
 * before any browser opens; glSetup() warns when Remotion's version moves on, so the reading above is redone then.
 */
process.env.__RESERVED_IS_INSIDE_REMOTION_LAMBDA = 'true';

/** The Remotion release whose renderer was read for the variable's effects (above). */
export const REMOTION_CHECKED = '4.0.529';

/** What the worker renders films with, for its start-up log. */
export function glSetup(): { stageFilms: string; otherFilms: string; rasterization: string; remotion: string; checked: boolean } {
  const remotion: string = VERSION;
  return {
    stageFilms: "gl 'swangle' (SwiftShader through ANGLE)",
    otherFilms: "Remotion's default (Chrome's software compositor)",
    rasterization: process.env.__RESERVED_IS_INSIDE_REMOTION_LAMBDA === 'true' ? 'CPU (--disable-gpu-rasterization)' : "Chrome's default",
    remotion,
    checked: remotion === REMOTION_CHECKED,
  };
}
