#!/usr/bin/env node
/**
 * Render stills from video and card templates with sample data: by default one
 * frame late in each scene (entrances finished), plus an early frame of the
 * opening.
 *
 *   pnpm --filter @bulava/template-catalog build
 *   node infrastructure/scripts/film-stills.mjs [--out ./film-stills] [options] [template-key …]
 *
 * Options:
 *   --points 0.05,0.3,0.6,0.85  frames at these shares of every scene instead (each copy of a
 *                               per-function scene too: stage films film each a station further in)
 *   --reveal                    also the opening at 0, 0.7, 1.3, 2.0, 2.6 and 3.3 s (a stage
 *                               opening: the cover held, opening, and landed on the set)
 *   --stage                     only films filmed in a Signature 3D stage (ADR-078)
 *   --scale 0.5                 0.5 is the standard render (540×960); 1 is HD (1080×1920)
 *   --gl swangle                Chromium's GL backend for every film (default: the video worker's, filmGl below;
 *                               `default` is Remotion's own, Chrome's software compositor)
 *
 * Uses the same Remotion project and browser settings the video worker
 * renders with, so what these stills show is what hosts get. Needs network
 * access for the Google Fonts the Remotion project loads.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * The GL backend the video worker films a definition with (filmChromium in apps/video-worker/src/gl.ts, keep in
 * step): SwiftShader through ANGLE for stage films, whose large CSS 3D planes Chrome's software compositor leaves
 * partly undrawn; Remotion's default (null) for the rest. Stills must be drawn as films are.
 */
const filmGl = (definition) => ((definition.scenes ?? []).some((scene) => scene.backdrop?.stage) ? 'swangle' : null);
// As the worker: rasterize on the CPU while SwiftShader composites (Remotion adds --disable-gpu-rasterization for it;
// apps/video-worker/src/gl.ts lists everything this variable changes in Remotion).
process.env.__RESERVED_IS_INSIDE_REMOTION_LAMBDA = 'true';
const REVEAL_TIMES = [0, 0.7, 1.3, 2.0, 2.6, 3.3];

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const fromWorker = createRequire(path.join(root, 'apps/video-worker/package.json'));
const { bundle } = fromWorker('@remotion/bundler');
const { openBrowser, renderStill, selectComposition } = fromWorker('@remotion/renderer');
const { TEMPLATE_CATALOG } = fromWorker(path.join(root, 'templates/dist/index.js'));
const { templateSampleContext, validateTemplateDefinition } = fromWorker(path.join(root, 'packages/template-schema/dist/index.js'));

const argv = process.argv.slice(2);
const VALUED = new Set(['--out', '--points', '--scale', '--gl']);
const opts = {};
const only = [];
for (let i = 0; i < argv.length; i++) {
  if (VALUED.has(argv[i])) opts[argv[i].slice(2)] = argv[++i];
  else if (argv[i].startsWith('--')) opts[argv[i].slice(2)] = true;
  else only.push(argv[i]);
}
const OUT = path.resolve(opts.out ?? 'film-stills');
const points = opts.points ? String(opts.points).split(',').map(Number).filter((n) => n >= 0 && n <= 1) : null;
const scale = opts.scale ? Number(opts.scale) : 0.5;
const glFor = (definition) => (opts.gl === 'default' ? null : (opts.gl ?? filmGl(definition)));
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
// One browser per GL backend for every still, closed at the end.
const browsers = new Map();
const browserFor = async (gl) => {
  if (!browsers.has(gl)) browsers.set(gl, await openBrowser('chrome', { chromiumOptions: { gl } }));
  return browsers.get(gl);
};
const label = (n) => String(Math.round(n * 100) / 100);
let rendered = 0;
try {
  for (const entry of TEMPLATE_CATALOG) {
    if (entry.definition.type === 'WEBSITE' || (only.length && !only.includes(entry.meta.key))) continue;
    if (opts.stage && !(entry.definition.scenes ?? []).some((s) => s.backdrop?.stage)) continue;
    const parsed = validateTemplateDefinition(entry.definition);
    if (!parsed.ok) {
      console.error(`INVALID ${entry.meta.key}: ${JSON.stringify(parsed.issues).slice(0, 400)}`);
      process.exitCode = 1;
      continue;
    }
    const definition = parsed.definition;
    const context = templateSampleContext(definition, { typeKey: definition.eventTypes[0] ?? 'WEDDING', photoBase });
    const gl = glFor(definition);
    // As the worker draws it: a stage film's standard size natively at 540×960 (frameScale), not shrunk at a device scale of 0.5.
    const native = scale < 1 && gl === 'swangle';
    const inputProps = { definition, context, customization: null, language: 'en', watermark: false, musicUrl: null, ...(native ? { frameScale: scale } : {}) };
    const chromiumOptions = { gl };
    const browser = await browserFor(gl);
    const composition = await selectComposition({ serveUrl, id: 'TemplateVideo', inputProps, puppeteerInstance: browser, chromiumOptions });
    const fps = composition.fps;
    // The scenes as the film plays them (planScenes): a per-function scene once per function.
    const planned = [];
    let from = 0;
    for (const scene of definition.scenes ?? []) {
      const copies = scene.repeatPerFunction && context.functions.length ? context.functions.length : 1;
      for (let i = 0; i < copies; i++) {
        const frames = Math.max(1, Math.round(scene.durationSec * fps));
        planned.push({ id: copies > 1 ? `${scene.id}-${i}` : scene.id, scene, from, frames, copy: i });
        from += frames;
      }
    }
    const at = (p, seconds) => Math.min(p.from + p.frames - 1, p.from + Math.round(seconds * fps));
    const frames = [];
    if (opts.reveal && planned[0]) for (const t of REVEAL_TIMES) frames.push([`${planned[0].id}-reveal@${label(t)}s`, at(planned[0], t)]);
    if (points) {
      for (const p of planned) for (const share of points) frames.push([`${p.id}@${label(share)}`, at(p, (share * p.frames) / fps)]);
    } else {
      planned.forEach((p, i) => {
        if (i === 0 && p.scene.durationSec > 2 && !opts.reveal) frames.push([`${p.id}-early`, at(p, 0.6)]);
        if (p.copy === 0) frames.push([p.scene.id, at(p, p.scene.durationSec * 0.85)]);
      });
    }
    const started = Date.now();
    for (const [name, frame] of frames) {
      await renderStill({
        composition,
        serveUrl,
        inputProps,
        frame: Math.min(frame, composition.durationInFrames - 1),
        scale: native ? 1 : scale,
        output: path.join(OUT, `${entry.meta.key}__${name}.png`),
        puppeteerInstance: browser,
        chromiumOptions,
      });
    }
    rendered++;
    console.log(`${entry.meta.key}: ${frames.length} still(s) in ${((Date.now() - started) / 1000).toFixed(1)} s, gl ${gl ?? 'default'} (${frames.map(([l]) => l).join(', ')})`);
  }
} finally {
  for (const browser of browsers.values()) await browser.close({ silent: true });
  samples.close();
}
console.log(`${rendered} template(s) rendered to ${OUT} (scale ${scale})`);
