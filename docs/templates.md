# Templates

Templates are data. There is no `template1.tsx`. A template version stores a **TemplateDefinition** JSON document that generic renderers interpret for each output type:

```text
Template (catalog entry: name, category, style, tier, badge, tags, event types, outputs, deletedAt)
 └─ TemplateVersion (immutable once published; version 1, 2, 3…)
     └─ definition: TemplateDefinition
          ├─ WEBSITE:      intro + pages → sections      (packages/template-engine, React)
          ├─ VIDEO:        canvas + scenes → elements    (packages/video-engine, Remotion)
          └─ DIGITAL_CARD: canvas + one scene            (rendered as a still)
```

| Package | Role |
|---|---|
| `@bulava/template-schema` | Zod schema, bindings, render context, customization rules, font pairings, test matrix, sample data |
| `@bulava/template-engine` | `TemplateRenderer` / `TemplateThumbnail`, sections, looks, illustrated scenes (`art/`), intros, effects, music player |
| `@bulava/video-engine` | `TemplateVideo` composition for videos and cards: scene backdrops, camera moves, particles |
| `@bulava/template-catalog` (`templates/`) | the seeded catalog, written with small builder helpers |

## The catalog

73 templates: 53 websites, 17 videos and 3 image cards, across every event type and the major traditions (Hindu, Sikh, Muslim, South Indian, Kerala, Christian, Bengali, Marathi, Gujarati, Punjabi, Rajasthani), in Free, Standard and Premium tiers.

- **Flagship websites** open on an illustrated 3D scene: *Marigold Mahal* (toran), *Divine Gopuram* (temple at sunrise), *Rajwada Royale* (palace on the lake), *Noor-e-Nikah* (receding arches), *Anand Karaj* (golden sarovar), *Mangal Mandap*, *Midnight Gold* (noir medallion), *Blush & Bloom* (flower arch), *Shubho Bibaho* (lotus pond), *Kerala Kasavu* (backwaters) and *Bansuri* (moonlit Vrindavan).
- **Illustrated films** are filmed inside the same scenes: *The Divine Flute*, *Temple Dawn*, *Royal Reveal*, *Noor Arches*, *Golden Sarovar*, *Marigold Mahal Film*, *Kasavu Backwaters*, *Blush & Bloom Film*, *Birthday Bash*, *Griha Pravesh Blessings* and *Lotus Blessings Film*. Each uses a different scene, so no two films look alike.
- **The Signature collection** (tag `signature`) are "experience" websites with their own opening animation, the host's music, a verse, the menu, a countdown and RSVP.

`pnpm db:seed` loads new templates and republishes catalog-owned templates whose definition changed (a version whose changelog is *Catalog seed* or *Catalog update*). Templates edited in Template Studio are left alone unless you run `pnpm --filter @bulava/database seed:templates`. Definitions are compared key-order-insensitively, so unchanged templates keep their version.

### Retiring templates

Lookalike templates are removed, never hard-deleted: `Template.deletedAt` hides them from the public catalog and from pickers, and events that already use one keep their pinned version and keep working. Two ways to retire:

- **Catalog**: add the key to `RETIRED_TEMPLATE_KEYS` (`templates/src/website.ts`). The seed switches those templates off wherever they exist and never recreates them.
- **Admin console**: *Templates → Delete* soft-deletes one (audited); the *Deleted* view lists them with *Restore*. A deleted template cannot be published until it is restored, and the seed skips templates staff deleted.

## TemplateDefinition (schemaVersion 1)

The authoritative schema is `packages/template-schema/src/definition.ts`. In short:

```ts
type TemplateDefinition = {
  schemaVersion: 1;
  templateKey: string;              // kebab-case, matches Template.key
  type: 'WEBSITE' | 'VIDEO' | 'DIGITAL_CARD' | 'EMAIL' | 'SOCIAL';
  name: string; description: string;
  eventTypes: string[];             // [] = any
  languages: string[];              // verified languages, e.g. ['en', 'hi', 'hi-Latn']
  theme: {
    colors: { primary; secondary; accent; background; surface; text; muted };  // hex
    radius: number;                 // 0–48 px
    ornament: 'none' | 'mandala' | 'paisley' | 'floral' | 'geometric' | 'confetti' | 'lotus' | 'peacock' | 'stars' | 'laurel';
    pattern: 'none' | 'dots' | 'jaali' | 'waves' | 'rangoli' | 'damask';
    heroTone: 'light' | 'dark';     // dark = hero on the primary colour with gold type
    look: Look;                     // how every section is dressed (below)
    effect: Effect;                 // ambient particles over a live invitation
  };
  fonts: { heading: FontRef; body: FontRef; script?: FontRef };  // families from FONT_FAMILIES
  capabilities: {
    editable: { colors; fonts; music; background; layout; photos; text; animation };  // booleans
    colorPresets: { name; colors }[];
    textSlots: { key; label; maxLength }[];   // custom.<key> bindings
    maxPhotos: number;
    photoSlots: PhotoSlot[];                  // named places the host can put a photo
  };
  assets: { assetId: uuid; role: string }[];  // every asset used, for licence tracking
  artworks?: Record<string, Artwork>;          // painted scenes (below)
  music?: { defaultMusicId?: uuid; allowCustomerChoice: boolean };
  website?: { intro: Intro; pages: { id; sections: SectionInstance[] }[] };
  canvas?: { width; height; fps };
  scenes?: Scene[];
};

type Look = 'classic' | 'heritage' | 'noir' | 'royal' | 'garden' | 'celebration' | 'modern';
type Effect = 'none' | 'petals' | 'marigold' | 'goldDust' | 'fireflies' | 'confetti' | 'lanterns' | 'snow';
type PhotoSlot = 'cover' | 'partnerOne' | 'partnerTwo' | 'story' | 'closing';
type Intro = 'none' | 'envelope' | 'curtain' | 'doors' | 'gates' | 'seal' | 'lanterns' | 'petals' | 'celestial' | 'scratch';
type SectionInstance = { id; section: SectionKey; variant: string; props: Record<string, Value>; visibleWhen?: { exists?: binding; eventTypes?: string[] } };
type Scene = {
  id; durationSec; background; transition: 'none' | 'fade' | 'slide' | 'wipe'; repeatPerFunction: boolean;
  backdrop?: { scene?: SceneName; artwork?: string; camera: CameraMove; intensity: number; veil: number };   // films: a drawn scene or a painted artwork
  particles: Effect;
  elements: Element[];
};
type CameraMove = 'still' | 'push' | 'pull' | 'panLeft' | 'panRight' | 'rise' | 'descend';
type Element = { id; kind: 'text' | 'image' | 'shape' | 'ornament' | 'photo'; frame: { x; y; w; h; rotate }; content?: Value;
                 style: { font; fontSize; fontWeight; color; align; letterSpacing; lineHeight; opacity; radius; fill?;
                          mask?: 'arch' | 'circle'; border?; shadow?: 'soft' | 'glow' };
                 overflow: 'shrink' | 'wrap' | 'ellipsis';
                 animation: { in?: { type: Animation; durationSec; delaySec }; out? } };
type Animation = 'none' | 'fade' | 'fadeUp' | 'fadeDown' | 'zoomIn' | 'zoomOut' | 'slideLeft' | 'slideRight' | 'typewriter' | 'float'
               | 'blurIn' | 'tracking' | 'reveal' | 'bloom' | 'shine';

type Value =
  | { literal: string | number | boolean }
  | { binding: string; fallback?: Value; format?: 'date' | 'dateWithWeekday' | 'time' | 'dateTime' | 'upper' | 'lower' }
  | { t: string }                                        // translation key
  | { template: string; fallback?: Value };              // "{{couple.partnerOne}} & {{couple.partnerTwo}}"
```

A `template` value falls back when any placeholder is empty, which is how one names line works for couples, honorees and plain events.

### Colours and readable text

`themeStyle` (engine) turns the palette into CSS variables. The raw colours (`--t-primary`, `--t-accent`, `--t-background` and so on) are for backgrounds, borders and ornaments. **Text must use the contrast-corrected inks**, which `ensureContrast` (`@bulava/template-schema`) nudges toward black or white until they reach WCAG AA (4.5:1) on every surface they can sit on:

| Variable | Use |
|---|---|
| `--t-text` | body text (adjusted in place) |
| `--t-primary-ink`, `--t-secondary-ink`, `--t-accent-ink`, `--t-muted-ink` | coloured headings, labels, links and captions on the background or surface |
| `--t-heading-ink` | section headings (a band can override it) |
| `--t-on-primary`, `--t-accent-on-primary` | text on a primary-coloured band (dark heroes, buttons) |
| `--t-on-secondary`, `--t-on-accent`, `--t-on-button` | text on the secondary, accent and button colours |
| `--bp-*`, `--ba-*` | the same inks recomputed for primary and accent bands, which `SectionShell` swaps in per band |

On-colour inks pick the most readable palette colour first (`onFill`) and only then fall back to black or white, so a dark palette keeps warm ivory text rather than grey. A palette therefore keeps its character, and a pale gold accent still draws the ornaments, while text stays readable for every template and every host colour change. Avoid fading text with opacity animations: they drop contrast mid-cycle (openings use the `bulava-breathe` scale animation instead).

## Looks

A look restyles every section without new section code. `SectionShell` wraps each section in a band chosen by `bandFor(look, index)` and swaps the band's inks:

| Look | Character |
|---|---|
| `classic` | calm cream pages with hairline ornaments |
| `heritage` | bold colour bands, marigold torans, rangoli, gold script headings |
| `noir` | black and gold, glass cards, spotlight glow, italic serif, a vinyl music player |
| `royal` | jewel tones, gold filigree frames and arches |
| `garden` | pastel florals, soft washes, rounded cards |
| `celebration` | bright bands, confetti edges, playful type |
| `modern` | editorial: large type, rules and numbers |

## Illustrated scenes

`art/scenes.tsx` holds twelve hand-built scenes: `gopuram`, `palace`, `toran`, `arches`, `lotus`, `mandap`, `noir`, `floral`, `balloons`, `backwaters`, `sarovar` and `vrindavan`. Motifs (marigolds, torans, diyas, kalash, gopurams, domes, chhatris, peacock plumes, the bansuri, kadamba trees, the moon…) are drawn in code in `art/motifs.tsx`, so there are no image licences to track and a colour change recolours the art.

`sceneArt(name, colors)` returns a scene as data: a background and layers with a depth from 0 (far) to 1 (near). The same data drives:

- **website heroes** (`SceneHero`): `DepthScene` moves the layers at different speeds on scroll, pointer and device tilt;
- **film backdrops** (`video-engine/backdrop.tsx`): a camera moves through the layers;
- **catalogue posters** (`SceneStill`).

Rules for scene art:

- Draw on a 1200×800 canvas with `preserveAspectRatio="xMidYMax slice"`. Every phone sees at least x 415–785 (tall phones), 9:16 films see x 375–825, and desktops see the panorama. Keep the story inside x 415–785.
- Text lives in the top ~55%; art stays in the bottom ~45%. Scenes that hang things from the top (toran, mandap drape, flower arch) start their text lower (`textTop`, the films' `TEXT_DROP`).
- Position everything with inline styles (no Tailwind inside scene layers), so the art renders the same in the browser and in Remotion.
- Randomness uses the integer hash `rand(i, salt)` and trigonometry is rounded with `r2()`: Node and Chrome differ in the last digits of `Math.sin`, which breaks hydration.
- Never build JSX at module load (for example a constant map of icons). Remotion defines `React` only after its modules load, so build such maps on first use.
- Decorative animation classes (`bulava-flicker`, `bulava-sway-soft`…) run on websites only and stop for reduced-motion users.

`DARK_SCENE_NAMES` (schema) lists scenes drawn on the primary colour; text over them uses the light inks.

## Painted artwork

Commissioned paintings plug into the same pipeline as the drawn scenes. A painted scene is a stack of **layers**: transparent images the size of the whole scene canvas (3600 × 2400 px, 3:2), far to near. Because they share the drawn scenes' canvas, parallax, film camera moves, phone framing and posters behave identically. The artist's brief, with safe areas and delivery rules, is [illustration-brief.md](illustration-brief.md).

```ts
artworks?: Record<key, {
  name: string;
  background?: '#rrggbb';   // shown while the layers load
  dark: boolean;            // light text over it (night skies)
  textTop: number;          // where text starts, 0–0.5 of the height (lower under torans and arches)
  layers: { assetId: uuid; depth: 0–1; label?: string }[];   // 1–8 layers, far to near
}>
```

- **Website hero**: `hero` variant `artwork` with props `artwork: { literal: '<key>' }` and optional `nameStyle` (`script`, `caps` or `italic`). Names get a soft shadow over busy painted skies.
- **Films and cards**: a scene's `backdrop` names either a drawn `scene` or an `artwork`, never both.
- **Licences**: every layer's asset must be listed in `assets` (validation fails otherwise), so publishing refuses art that is unapproved, not licensed for commercial on-demand use, or expired.
- **Colours**: painted art keeps its own colours when a host changes the palette. The palette still restyles text and sections. Order a second colourway as a separate layer set if a scene needs one.

How the files flow:

1. Staff upload each layer in **Design assets** (type Image, category `artwork`) with its licence. The licensed original is kept exactly as uploaded; the media worker adds WebP renditions 1200 and 2400 px wide with transparency kept (`templates/assets/<id>-w<width>.webp`), a thumbnail, and the real pixel size.
2. After approval, Template Studio's **Artwork** tab builds the scene: pick a layer image, set its depth, order the layers, then *Use as website hero* or *Use behind every scene*. The tab keeps `assets` in step. The Studio preview uses signed URLs, so unpublished art can be checked on a phone frame and in the Remotion player before publishing.
3. Invitations, catalogue posters and browser previews load layers from `GET /api/v1/public/template-assets/:id?w=`. It serves only approved images with a current commercial, on-demand licence that a published template version uses, and redirects to a signed URL for the smallest rendition at least `w` wide. URLs are signed at the top of the hour, so browsers reuse their copy. Events pinned to a template that was later unpublished or deleted keep working.
4. The video worker signs the largest rendition itself (`ctx.assets`), and the composition waits until every layer has decoded before it captures a frame.

A layer that is not 3:2 still renders (stretched to the canvas); the Artwork tab flags it.

## Website sections

| Section | Notes | Variants |
|---|---|---|
| `hero` | invocation, eyebrow, names, date, place, tagline, cover photo; greets the guest by name on personal invitations | `classic`, `arch`, `split`, `photo`, `minimal`, `festive`, `temple`, `monogram`, `cathedral`, `seaside`, `celestial`, `lantern`, `peacock`, the drawn scenes `gopuram`, `palace`, `toran`, `arches`, `lotus`, `mandap`, `noir`, `floral`, `balloons`, `backwaters`, `sarovar`, `vrindavan`, and `artwork` (painted) |
| `quote` | a verse, shloka or line, set large | default |
| `countdown` | live timer to the first function | `default`, `flip` (flip-clock digits) |
| `couple` | partners with their photos | `default`, `stacked`, `arch`, `flip` (3D cards that turn over), `profile` |
| `story` | text with a photo | `default`, `curtain` (tap to reveal), `polaroid` |
| `parents`, `family` | text slots | default |
| `eventTimeline` | only the functions this viewer may see, each with a motif picked from its name | `cards`, `timeline`, `tiles`, `tickets`, `diya` |
| `menu` | "Course \| dishes" lines from a text slot | default |
| `venue`, `map` | venue card with directions | default |
| `gallery` | approved photos the viewer may see | `default`, `stack` (swipeable 3D stack), `mosaic`, `polaroid` |
| `accommodation`, `travel`, `giftRegistry` | text slots | default |
| `announcements` | published updates for this viewer | default |
| `rsvp` | the host app injects the RSVP form (or the public registration form) | default |
| `photoShare` | QR photo rooms for this guest | default |
| `footer` | closing line and photo, hashtag, check-in QR, watermark | default |

Sections with nothing to show (no photos, empty text) hide themselves, and live pages reveal sections as they scroll into view (disabled for reduced motion). Every 3D control has a keyboard path: flip cards have a turn button per face and the hidden face is `inert`.

### Openings, effects and music

Openings play once per browser session per invitation, are skipped for users who prefer reduced motion, and are keyboard accessible (the scratch card has a *Reveal* button). Opening an invitation dispatches `bulava:intro-open`; the music player listens for it, because browsers only allow audio after a user gesture. Music never autoplays on page load, pauses when the tab is hidden, and has a visible play/pause control.

Effects (`theme.effect`) draw particles on a canvas over live invitations and pause for reduced motion; design previews draw them inside the preview only.

Music comes from the admin-managed library: the host picks a track (`customization.musicId`, allowed when `capabilities.editable.music`), or the template's `defaultMusicId` applies. Only approved tracks with a current commercial, on-demand licence play; the render context carries a short-lived signed URL.

## Films and cards

A video scene with a `backdrop` is filmed inside an illustrated scene:

- The art is laid out at phone size (432 px wide) and scaled to the frame, so proportions match the website hero.
- The camera moves each layer by its depth: `push` and `pull` zoom (centred higher for scenes hung from the top), `panLeft`/`panRight` glide across the panorama, `rise` and `descend` move vertically. `intensity` scales the move; `veil` darkens (or, on light scenes, lightens) the sky behind text.
- `particles` are drawn as a pure function of the frame (Remotion renders frames in any order), matching the website effects.
- Text elements shrink to fit (`overflow: 'shrink'`): lines are word-wrapped and measured in the real, loaded font in the renderer's browser, so long names and titles never clip.
- Entrances `blurIn`, `tracking`, `reveal`, `bloom` and `shine` (a band of light across gold names) add the cinematic feel; photos can sit in a gold `arch` or `circle` frame.

The catalog's film recipe (`filmScenes` in `templates/src/video.ts`) builds an opening, the names, the couple's photo in a jharokha arch, one card per function and a closing, each with its own scene, camera and particles. Its tests check that every film scene has a backdrop and that text and cards stay above the art.

Image cards (`DIGITAL_CARD`) render one scene as a still; *Royal Card* and *Temple Card* use a scene backdrop.

The Remotion project loads every font in `FONT_FAMILIES` (`apps/video-worker/remotion/fonts.ts`); add a loader there when you add a family.

To check a film or card change, render stills with sample data (one frame per scene, half size):

```bash
pnpm --filter @bulava/template-catalog build
node infrastructure/scripts/film-stills.mjs --out ./film-stills bansuri-video royal-card   # omit keys for all
```

## Bindings

A binding is a dotted path resolved from a **RenderContext** the API builds after authorization, so it only contains what the viewer may see.

| Binding | Source |
|---|---|
| `event.title`, `event.description`, `event.startDate`, `event.endDate` | Event (dates from the functions this viewer can see) |
| `couple.partnerOne`, `couple.partnerTwo` (aliases `brideName`, `groomName`) | `Event.details` for couple types |
| `honoree.name` | `Event.details` for honoree types |
| `function.name`, `.description`, `.startsAt`, `.date`, `.time`, `.venue.name`, `.venue.address`, `.venue.city` | current function (per-function scenes) |
| `functions`, `venue.*`, `announcements`, `gallery.images` | lists for sections |
| `photos`, `photos[0]` … | the host's chosen photos |
| `photo.cover`, `photo.partnerOne`, `photo.partnerTwo`, `photo.story`, `photo.closing` | photos placed in named spots (usually with a `photos[n]` fallback) |
| `guest.name` | personal invitations only (never public pages or link previews) |
| `custom.<key>` | a declared text slot |

Unknown bindings and translation keys fail validation when a draft is saved or published, not at render time. Dates format through `@bulava/localization` in the event's time zone and language.

## Customization

`EventTemplateSelection.customization` (and a video job's customization) holds what the host changed. `validateCustomization` rejects anything the template's capabilities do not allow:

| Field | Needs | Effect |
|---|---|---|
| `colorPreset`, `colors` | `editable.colors` | a preset, then any of the four main colours on top of it (`effectiveColors`); inks are recomputed, so text stays readable |
| `fontPairing` | `editable.fonts` | one of `FONT_PAIRINGS` (royal, regal, romantic, classic, elegant, editorial, grand, desi, modern) |
| `photoSlots`, `photoIds` | `editable.photos` | photos placed in the template's `photoSlots`, and extra photos up to `maxPhotos` |
| `custom` | `editable.text` | text slot values |
| `intro`, `effect` | `editable.animation` | opening animation and ambient particles |
| `hiddenSections` | `editable.layout` | sections to leave out (never the hero) |
| `musicId` | `editable.music` | a licensed track |

The API also checks that placed photos are approved images of the same event and that a chosen track is licensed.

Hosts edit websites in the dashboard's **Design** page (tabs *Style*, *Photos*, *Words*, *Motion & music*, *Sections*, with a live preview) and films on the **Video & cards** page (*Style* and *Photos*, with a live Remotion preview). Photos uploaded there go to a hidden per-event room, *Design photos* (private, auto-approved, no QR code), through the normal signed-upload and processing pipeline; see [media.md](media.md).

## Marketing previews

The home page and `/templates` show templates as pre-rendered WebP images, not live renders: 28 live previews made the home page about 28,000 DOM elements and 4.9 MB of HTML, and a phone needed seconds to draw it; the scenes of 8 film posters made `/templates` 1 MB of HTML. The images live in `apps/web/public/template-previews/`:

- `<key>.webp`: a website's thumbnail, the top 390 × 780 CSS px at 2×;
- `<key>-full.webp`: the first 2600 px of the full preview, for the hero phone;
- `<key>-poster.webp`: a film's or card's scene with its title, at the gallery card's 220 × 400 CSS px, 2×. Films and cards without a scene keep their light gradient poster.

`apps/web/src/lib/template-previews.json` lists them with content hashes, which become `?v=` in the URL so a changed image is never served from an old cache. A template without an image is still shown, drawn live as before (a website card loads the template engine on demand through `LiveThumbnail`). Every `TemplateCard` and `TemplatePhone` uses the images (including "more like this" on template pages); a template page's own preview, the demo and the dashboard's design picker keep rendering live.

After adding or changing a template, regenerate them and commit the images and the manifest:

```bash
# Terminal 1: the web app with the capture route on (it 404s otherwise)
TEMPLATE_PREVIEW_FRAMES=1 pnpm --filter @bulava/web dev
# Terminal 2 (API running too)
node infrastructure/scripts/template-previews.mjs                   # every template
node infrastructure/scripts/template-previews.mjs --only key1,key2  # just these
```

The script photographs `/preview-frame/<key>` (a bare page that only exists with `TEMPLATE_PREVIEW_FRAMES=1`; `?view=card`, `full` or `poster`) with reduced motion, so openings and entrances are already settled. `--full` picks the templates that also get a long image (default `marigold-mahal`, the hero). A full run deletes images of templates that are gone. Rebuild the web app afterwards: the manifest is compiled in.

## Quality gates

- **Schema and semantics**: `validateTemplateDefinition` (structure, bindings, translation keys, unique ids).
- **Test matrix**: `runTemplateChecks` resolves every prop and element for English, Hindi and Hinglish × short and long names × with and without photos × the template's event types, and reports empty required content and overflow risks. The catalog test runs it for every template; Template Studio runs it before publishing.
- **Licences**: publishing refuses assets that are unapproved, unlicensed for commercial on-demand use, or expired ([template-studio.md](template-studio.md)).
- **Browser checks**: `ui-smoke.mjs` renders the catalog, template pages, openings, the dashboard design tab and live invitations in Chrome and fails on any console or hydration error.
- **Accessibility**: `pnpm a11y` runs axe (WCAG 2.1 A + AA) on every template's full preview and every opening overlay; a new section or hero variant must pass it ([testing.md](testing.md#browser-smoke-tests)).

Published versions are immutable. Editing creates a draft that becomes version N+1 when published; events keep the version they selected until the host re-selects the template.
