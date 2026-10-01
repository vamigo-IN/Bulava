# Video and card rendering

Video invitations (9:16 MP4) and digital cards (4:5 PNG) are rendered from the same template definitions as everything else, by a dedicated worker. The API never renders.

## Pipeline

```text
Host picks a VIDEO or DIGITAL_CARD template (+ optional music)
  → POST /events/:id/videos        checks tier, event type, render quota, music licence
  → VideoJob (QUEUED) + BullMQ video-render job { videoJobId }
  → video-worker: build RenderContext (only LISTED, non-restricted functions)
  → Remotion renderMedia (MP4, H.264 + AAC) or renderStill (PNG)
  → upload to videos/<eventId>/generated/<jobId>.<ext>
  → VideoJob COMPLETED + GeneratedVideo row + in-app "render complete" notification
  → GET /events/:id/videos/:jobId/download   signed, short-lived download URL
```

- **Composition.** `packages/video-engine` exports `TemplateVideo` (composition id `TemplateVideo`). `planScenes` lays scenes on the timeline and repeats `repeatPerFunction` scenes once per function. Elements animate in and out (fade, slide, zoom, typewriter, float, blur-in, tracking, reveal, bloom, gold shine), text shrinks to fit (measured in the loaded font), and ornaments and motifs come from the template engine so websites and videos share their art.
- **Films.** A scene with a `backdrop` is filmed inside one of the illustrated scenes the website heroes use, with a camera move (`push`, `pull`, pans, `rise`, `descend`) in which near layers move more than far ones, plus deterministic particles (`backdrop.tsx`). See [templates.md](templates.md#films-and-cards).
- **Host choices.** The job's customization carries the colour preset or colours, font pairing and placed photos (`photoSlots.cover` fills the film's arch). The API checks every photo is an approved image of the event; the worker signs them for the render only.
- **Fonts.** `apps/video-worker/remotion/fonts.ts` loads every template font family (Latin and Devanagari) through `@remotion/google-fonts`, so renders need outbound HTTPS to Google Fonts.
- **Quality.** The `video.hd` entitlement renders at full size (1080×1920); otherwise at half scale. Free plans get the "Made with Bulava" watermark, rendered as a translucent pill in the event's language.
- **Music.** Only approved tracks with a commercial, on-demand licence can be chosen. The worker signs the track URL for the render only. Volume fades in and out.
- **Limits.** `video.renders.max` caps renders per event. `VIDEO_WORKER_CONCURRENCY` bounds parallel jobs and `VIDEO_RENDER_THREADS` bounds browser tabs per job, so one worker cannot overload its host.
- **Cancellation.** `POST /events/:id/videos/:jobId/cancel` marks the job; the worker polls and aborts the render.
- **Retries.** Jobs retry with backoff. Permanently failed renders appear in the admin console (Queues & renders) with a retry button.

## Previews

The dashboard's video tab, the template pages and Template Studio play the same composition in the browser with `@remotion/player`, using the event's real details (dashboard) or sample data (catalog and Studio). What hosts preview is what the worker renders.

## Running the worker

Development:

```bash
pnpm --filter @bulava/video-worker dev    # bundles the Remotion project on start
```

Production images bundle the Remotion project at build time (`node dist/bundle.js` → `remotion-bundle/`), so the worker starts instantly and needs no TypeScript sources at runtime. `REMOTION_BUNDLE_DIR` points to the bundle; if it is missing, the worker bundles on start. Outside production, and unless `REMOTION_BUNDLE_DIR` is set, the worker always bundles fresh, so a leftover local `remotion-bundle/` never renders old templates.

The image is Debian-based (`node:22-bookworm-slim`) because Chrome Headless Shell needs glibc. It installs Chrome's shared libraries and downloads the browser during the image build (`ensureBrowser`). Remotion ships its own FFmpeg. Compose gives the container a 1 GB `/dev/shm` and a `/tmp` volume for frames.

Health: `GET :4103/health`.

## Licensing note: Remotion

Remotion is **not** MIT-licensed for companies. It is free for individuals, non-profits and companies with up to three employees; larger companies need a paid **Remotion Company License** for commercial use (see remotion.dev/license). Bulava renders videos commercially, so confirm the licence before launch. The player previews call `acknowledgeRemotionLicense`, which only silences the console notice; it does not grant a licence.

## Troubleshooting

- **Render fails with a Chrome launch error** — the image is missing a shared library, or `/dev/shm` is too small. Use the provided Dockerfile and compose settings.
- **Blank text or wrong glyphs** — the worker could not reach Google Fonts. Allow outbound HTTPS.
- **"Bundle ready" on every start in production** — `REMOTION_BUNDLE_DIR` does not contain `index.html`; rebuild the image.
