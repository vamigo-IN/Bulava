#!/usr/bin/env node
/**
 * Render stills from video and card templates with sample data: one frame late
 * in each scene (entrances finished), plus an early frame of the opening.
 *
 *   pnpm --filter @bulava/template-catalog build
 *   node infrastructure/scripts/film-stills.mjs [--out ./film-stills] [template-key …]
 *
 * Uses the same Remotion project the video worker renders with, so what these
 * stills show is what hosts get. Frames are half size (540×960). Needs network
 * access for the Google Fonts the Remotion project loads.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const fromWorker = createRequire(path.join(root, 'apps/video-worker/package.json'));
const { bundle } = fromWorker('@remotion/bundler');
const { renderStill, selectComposition } = fromWorker('@remotion/renderer');
const { TEMPLATE_CATALOG } = fromWorker(path.join(root, 'templates/dist/index.js'));
const { templateSampleContext, validateTemplateDefinition } = fromWorker(path.join(root, 'packages/template-schema/dist/index.js'));

const argv = process.argv.slice(2);
const outAt = argv.indexOf('--out');
const OUT = path.resolve(outAt === -1 ? 'film-stills' : argv[outAt + 1]);
const only = outAt === -1 ? argv : argv.filter((_, i) => i !== outAt && i !== outAt + 1);
mkdirSync(OUT, { recursive: true });
// Remotion looks for its browser under the working directory: reuse the video worker's copy.
process.chdir(path.join(root, 'apps/video-worker'));

const serveUrl = await bundle({ entryPoint: path.join(root, 'apps/video-worker/remotion/index.ts'), enableCaching: true });
// The sample photos live in the web app (apps/web/public/samples): serve them while the stills render.
const samplesDir = path.join(root, 'apps/web/public/samples');
const samples = createServer((req, res) => {
  const name = decodeURIComponent((req.url ?? '').split('?')[0].replace(/^\/samples\//, ''));
  if (!/^[a-z0-9-]+\.webp$/.test(name)) return void res.writeHead(404).end();
  try {
    res.writeHead(200, { 'content-type': 'image/webp', 'access-control-allow-origin': '*' }).end(readFileSync(path.join(samplesDir, name)));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => samples.listen(0, '127.0.0.1', resolve));
const photoBase = `http://127.0.0.1:${samples.address().port}/samples`;
let rendered = 0;
for (const entry of TEMPLATE_CATALOG) {
  if (entry.definition.type === 'WEBSITE' || (only.length && !only.includes(entry.meta.key))) continue;
  const parsed = validateTemplateDefinition(entry.definition);
  if (!parsed.ok) {
    console.error(`INVALID ${entry.meta.key}: ${JSON.stringify(parsed.issues).slice(0, 400)}`);
    process.exitCode = 1;
    continue;
  }
  const definition = parsed.definition;
  const context = templateSampleContext(definition, { typeKey: definition.eventTypes[0] ?? 'WEDDING', photoBase });
  const inputProps = { definition, context, customization: null, language: 'en', watermark: false, musicUrl: null };
  const composition = await selectComposition({ serveUrl, id: 'TemplateVideo', inputProps });
  const frames = [];
  let t = 0;
  for (const scene of definition.scenes ?? []) {
    const start = t;
    t += scene.durationSec * (scene.repeatPerFunction ? context.functions.length : 1);
    if (scene.repeatPerFunction && !context.functions.length) continue;
    if (!frames.length && scene.durationSec > 2) frames.push([`${scene.id}-early`, Math.round((start + 0.6) * composition.fps)]);
    frames.push([scene.id, Math.round((start + scene.durationSec * 0.85) * composition.fps)]);
  }
  for (const [label, frame] of frames) {
    await renderStill({ composition, serveUrl, inputProps, frame: Math.min(frame, composition.durationInFrames - 1), scale: 0.5, output: path.join(OUT, `${entry.meta.key}__${label}.png`) });
  }
  rendered++;
  console.log(`${entry.meta.key}: ${frames.map(([l]) => l).join(', ')}`);
}
samples.close();
console.log(`${rendered} template(s) rendered to ${OUT}`);
