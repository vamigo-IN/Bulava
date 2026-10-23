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

529 templates: 482 websites, 44 videos and 3 image cards, across every event type and the major traditions (Hindu, Sikh, Muslim, South Indian, Kerala, Christian, Bengali, Marathi, Gujarati, Punjabi, Rajasthani), in three collections: Free, Premium (with any paid plan) and Signature (from the Premium plan). 409 of the websites come from the [template factory](#template-factory): 132 weddings, 99 for engagements, the other wedding functions and anniversaries, 78 birthdays and 100 for baby showers, naming ceremonies, mundans, housewarmings, pujas and festivals. The 428 canvas websites are 389 designs: some designs come in versions for several occasions ([Lookalikes](#lookalikes)). Every website's sections below the hero are dressed in a [suite](#section-suites) that matches its hero.

- **Flagship websites** open on an illustrated 3D scene: *Marigold Mahal* (toran), *Divine Gopuram* (temple at sunrise), *Rajwada Royale* (palace on the lake), *Noor-e-Nikah* (receding arches), *Anand Karaj* (golden sarovar), *Mangal Mandap*, *Midnight Gold* (noir medallion), *Blush & Bloom* (flower arch), *Shubho Bibaho* (lotus pond), *Kerala Kasavu* (backwaters) and *Bansuri* (moonlit Vrindavan).
- **Illustrated films** are filmed inside the same scenes: *The Divine Flute*, *Temple Dawn*, *Royal Reveal*, *Noor Arches*, *Golden Sarovar*, *Marigold Mahal Film*, *Kasavu Backwaters*, *Blush & Bloom Film*, *Birthday Bash*, *Griha Pravesh Blessings* and *Lotus Blessings Film* each open in a different scene; the premium films (*Maharani Film*, *Ring Ceremony Film*, *Midnight Deco Film*, *Deepotsav Film*) cut between scenes in their own palettes, so no two films look alike.
- **Canvas films** (`templates/src/canvas-films.ts`, [Films and cards](#films-and-cards)) are 22 canvas invitations filmed: the card collection's *Shahi Gajraj*, *Mor Pankh*, *Kovil Mani* and *Noor Mahal*; *Kerala Kayal*, *Mehtab Raat*, *Laavan Karaj*, *Heena Haath*, *Ghungroo Mehfil*, *Swagat Shaam*, *Raja Beta*, *Godh Bharai*, *Vastu Shanti* and *Jyoti Raat*; and the stationery collection's *Royal Maroon & Gold*, *Kalyana Zari*, *Phulkari*, *Mehrab*, *Lal Paar*, *Champagne Wreath*, *Genda Phool* and *Sangeet Sandhya* (`<design>-film`).
- **The atelier** (`templates/src/atelier.ts`, tag `tactile`): invitations made like tactile stationery, opened by hand: *Olive Zip* (a wedding on olive linen, unzipped by its blush tag), *Noir Zip* (a black-tie reception in a leather clutch), *Satin Bow* (an engagement tied with a satin ribbon) and *Velvet Seal* (a wedding under a wax seal), each with four colour presets and its film.
- **The Signature collection** (tag `signature`) are "experience" websites with their own opening animation, the host's music, a verse, the menu (its own section, or the menu column of an `essentials` strip), a countdown and RSVP. **The Royal Heirloom** (`templates/src/heirloom.ts`) is one made by hand from engine sections rather than a spec: the `heirloom` look, the `balcony` hero, the `cusped` frame and `fleuron` divider, each section's band and decor, the emerald deep band and the page menu ([ADR-080](decisions.md#adr-080-section-bands-section-decor-the-page-menu-and-a-deep-band-colour-2026-10-23)). **The Sacred Garden** (`templates/src/sacred-garden.ts`) is another, recreated from a reference page with Bulava's own art: the `deckle` look, the `sealedEnvelope` opening, the `swans` hero, the `shimmer` countdown, the `stem` programme, the `sketch` venue, the `seal` reply, the `bloom` footer and the `engraved` type pairing ([ADR-081](decisions.md#adr-081-the-sacred-garden-the-deckle-look-and-a-templates-own-preview-sample-2026-10-23)).
- **The card collection** (`templates/src/canvas-cards.ts`) are [canvas](#canvas-sections) invitations composed like printed cards, with full-colour illustrations, foil lettering and paper textures: *Shahi Gajraj* (a gilded jharokha guarded by elephants), *Mor Pankh* (a peacock garden), *Kovil Mani* (temple bells and a gopuram at dusk), *Noor Mahal* (lanterns and domes), *Eternal Bloom* (roses and doves), *Mehendi Rang* (a hand painted with henna), *Cake & Candles* (birthdays), *Twinkle Star* (baby showers and naming ceremonies) and *Shubh Griha* (housewarmings). Each has phone and desktop heroes, a card for every function and three colour presets.
- **The stationery collection** (`templates/src/premium-cards.ts`, tag `stationery`) are canvas invitations composed like foil-stamped stationery, each in its own tradition's vocabulary: *Royal Maroon & Gold* (a mandala crown, gold vines, a double hairline frame and the couple's photo in a gilded frame), *Kalyana Zari* (a Kanjeevaram zari border and a flame-ringed prabhavali with brass kuthuvilakku lamps), *Phulkari* (Anand Karaj, phulkari borders and a silk-ringed diamond), *Mehrab* (a nikah under a Mughal mihrab), *Lal Paar* (a Bengali red border and an alpana), *Champagne Wreath* (an engagement in a gold olive wreath), *Genda Phool* (a haldi in marigold swags and a marigold wreath), *Sangeet Sandhya* (fairy lights, ghungroo strands and a gold dhol) and *Midnight Deco* (a reception in an art deco frame). Each has phone and desktop heroes and a card for every function; most carry an RSVP block (a pill over Accept and Decline) and a timeline of the first three functions (`functions[n].*` with short dates, each column hidden when that function is missing). The RSVP words are printed text under buttons of the panel's colour: on a website the buttons cover them and scroll to the RSVP form; a digital card drops the buttons and keeps the words.
- **The illustrated collection** ([template factory](#template-factory)): 85 art-directed themes, each laid out in the compositions that suit it. *Rajwada*, *Mayur*, *Kanchi*, *Mehtab* and *Laavan* for weddings; *Jaali* and *Firoza* for the nikah, *Amritsar* and *Kesri* for the Anand Karaj, *Covenant* and *Lilium* for church weddings ([Faith](#faith)); *Heena* and *Dholki* for the mehendi and sangeet; *Unicorn*, *Dino*, *Galaxy*, *Gudiya* and *Raja* for children's birthdays; *Godh* and *Valaikappu* for baby showers; *Vastu* for griha pravesh; *Jyoti*, *Chand*, *Gulal* and *Noel* for festivals; and so on.

`pnpm db:seed` is the catalog's migration, and the deploy's `migrate` job runs it on every release (`seedTemplates`). It loads new templates; republishes catalog-owned templates whose definition changed (a version whose changelog is *Catalog seed* or *Catalog update*) as a new version; and updates a catalog-owned template's listing (tier, tags, order, featured…) in place when only that changed, unless staff edited the listing in the console (an audited `template.meta_updated`). Templates edited in Template Studio are left alone unless you run `pnpm --filter @bulava/database seed:templates`. Definitions are compared key-order-insensitively, so unchanged templates keep their version. `node dist/seed.js --templates-only --dry-run` lists what a release would change and writes nothing ([deployment.md](deployment.md#template-releases)).

Templates need nothing besides the database: the art is drawn in code, the gallery images ship inside the web image, and fonts are bundled at build time. Only commissioned paintings ([Painted artwork](#painted-artwork)) are files in storage, uploaded through the console's asset library.

### Retiring templates

Lookalike templates are removed, never hard-deleted: `Template.deletedAt` hides them from the public catalog and from pickers, and events that already use one keep their pinned version and keep working. Two ways to retire:

- **Catalog**: add the key to `RETIRED_TEMPLATE_KEYS` (`templates/src/website.ts`). The seed switches those templates off wherever they exist and never recreates them.
- **Admin console**: *Templates → Delete* soft-deletes one (audited); the *Deleted* view lists them with *Restore*. A deleted template cannot be published until it is restored, and the seed skips templates staff deleted.

### Lookalikes

A design is its illustrations and where they sit on the phone artboard, on light or dark stock: `designLook` (`@bulava/template-schema`, `looks.ts`) hashes exactly that, leaving out palettes, fonts and words, which customers change themselves, and the scattered specks (stars, sparkles, confetti) that never make two designs different. `heroSimilarity` measures how alike two heroes look to a customer, 0 to 1, whatever their colours: the overlap of their art and where it sits (a sixth of the width, a tenth of the height), large art weighing more than small and the hero's subject most (any bride and groom in Indian dress are "a couple"; a church couple, a girl, a boy, a unicorn and a dinosaur are each their own), a little less when one is on dark stock and the other on light. So:

- **One template per design and occasion.** Two templates of one occasion whose heroes are `HERO_LOOKALIKE` (0.70) or more alike are one design in two colourways, and the catalog test fails on them (as it does on an equal `designLook`). `templates/src/lookalikes.ts` lists the ones retired: 54 on 2026-10-09 (equal looks, among them Rajwada Jharokha, a factory copy of Shahi Gajraj) and 75 on 2026-10-13 (alike heroes: the same layout and art in another colourway or on the other stock, such as Kanchi and Kerala's couple, arch, home, split and photo layouts, the pastel dream skies of seven birthday themes, Heena and Mehfil). Each points at the template kept, which takes their colours as presets (`foldLookalikes`, at most 12), so no colourway is lost. The keys are in `RETIRED_TEMPLATE_KEYS`. The one kept was chosen in this order: a hand-made original, a design already kept for earlier lookalikes, a featured one, a theme's first layout; anything as alike as `HERO_LOOKALIKE` to one kept folded into it. A film made from a retired design stays: films are built from the retired designs too (`retiredCanvasDesigns`, `canvas.ts`).
- **No two lower pages alike in one occasion.** Below the hero, the suite with its pieces, the look, the stock and every section's layout make a page's second half (see [Section suites](#section-suites)); the catalog test fails when two templates of one occasion share all of them, and when a website has no suite.
- **One card per design in galleries.** A design may have versions for several occasions (a wedding design and its anniversary version, each with its own wording and names). The API lists each template's look (`preview.look`), and galleries show a look once (`onePerLook`, `apps/web/src/lib/template-looks.ts`): the version for the occasion chosen, else the first in the gallery's order. This applies to `/templates` (the occasion filter picks the version whose main event type it is), `/cards` (the occasion filter is the category), the home page's collection and the dashboard's design picker (always showing the design in use).

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
    ornament: Ornament;             // the motif, and the suite every section below the hero is dressed in
    dress?: { frame?; edge?; seal?; skyline?; corner?; divider? };  // suite pieces swapped (SUITE_* enums)
    pattern: 'none' | 'dots' | 'jaali' | 'waves' | 'rangoli' | 'damask' | 'confetti' | 'bandhani' | 'stars' | 'paisley' | 'kolam' | 'scales';
    heroTone: 'light' | 'dark';     // dark = hero on the primary colour with gold type
    look: Look;                     // how every section is dressed (below)
    effect: Effect;                 // ambient particles over a live invitation
    faith?: 'hindu' | 'muslim' | 'sikh' | 'christian';  // the tradition the design belongs to (Faith, below)
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
  music?: { defaultMusicId?: uuid; defaultTrack?: slug; allowCustomerChoice: boolean };  // defaultTrack: an in-house track, e.g. original-shehnai-darbar
  website?: { intro: Intro; pages: { id; sections: SectionInstance[] }[] };
  canvas?: { width; height; fps };
  scenes?: Scene[];
};

type Look = 'classic' | 'heritage' | 'noir' | 'royal' | 'garden' | 'celebration' | 'modern';
type Ornament = 'none' | 'mandala' | 'paisley' | 'floral' | 'geometric' | 'confetti' | 'lotus' | 'peacock' | 'stars' | 'laurel'
              | 'temple' | 'kasavu' | 'jaali' | 'marigold' | 'bagh' | 'rangoli' | 'deco' | 'clouds' | 'chapel';
type Effect = 'none' | 'petals' | 'marigold' | 'goldDust' | 'fireflies' | 'confetti' | 'lanterns' | 'snow';
type PhotoSlot = 'cover' | 'partnerOne' | 'partnerTwo' | 'story' | 'closing';
type Intro = 'none' | 'envelope' | 'curtain' | 'doors' | 'gates' | 'seal' | 'lanterns' | 'petals' | 'celestial' | 'scratch' | 'zipper' | 'ribbon' | 'arrival' | 'doorway' | 'silk' | 'unfold' | 'sealedEnvelope';
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
| `--t-secondary-display`, `--t-muted-display` | display type only (24 px and up: script headings, large figures): the gold and the muted corrected to 3:1, as WCAG asks of large text, so they keep their designed colour where a reading ink would darken them (bands and the reply card swap in their own) |
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
| `heirloom` | printed on ivory paper: gold capitals over italic serif headings and the suite's divider, framed deep bands (the inset hairline with filigree corners); each section's band and corner art are the template's own (`band`, `decor`, below). The Royal Heirloom |
| `deckle` | one phone-wide column on cream at every width (the design's own 450 px page, its margins cropped on narrower phones): gold script headings over a light serif, sections the template prints on paper (`band: 'surface'`) set on sheets of deckle-edged paper a little wider than the column that join when they follow each other and tear open at a panel's ends (by CSS: a hidden section leaves no tear), words and art that come in as their section does (the sections themselves never fade, so the paper stays whole), a round music button. The Sacred Garden |

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

## Stages (Signature 3D)

A stage is a venue built as real CSS 3D that a camera moves through ([ADR-078](decisions.md#adr-078-signature-3d-stages-in-css-3d-one-camera-for-pages-films-and-posters-2026-10-22)). One engine (`packages/template-engine/src/stage/`) draws a set at a camera pose for every surface: the website hero (`StageHero`, hero variant `stage` with `props.stage: { literal: '<stage>' }`), film backdrops (`StageBackdrop` in `video-engine/src/stage-backdrop.tsx`, chosen by `backdrop.stage`), posters, pickers and Studio stills (`StageStill`, `stage/still.tsx`, imported as a single module) and the four stage openings, which drive the hero's own server-rendered DOM. Guest pages render the stage on the server; their client code carries no set art (`opening.tsx` and `rig.tsx` read data attributes and plain data the renderer computes). Pages that draw `TemplateRenderer` in the browser (the template page's preview switcher, `/design`, the dashboard editors) do bundle every set, about 430 KB minified (130 KB gzipped) of the engine's 1.17 MB: loading a set only when a page shows it is still to do.

The collection is 19 websites and their 19 films (`<key>-film`), all `SIGNATURE`, one per occasion (CUSTOM shares Centre Stage and Mela Chowk), with a wedding for each faith and a faith-free one:

| Template | Stage | Occasion | Opening | Track |
|---|---|---|---|---|
| Sheesh Mahal | `sheeshMahal` | wedding (Hindu) | arrival | `original-shehnai-darbar` |
| Chaar Bagh | `chaarBagh` | wedding (Muslim) | doorway | `original-mehfil-santoor` |
| Amrit Vela | `causeway` | wedding (Sikh) | silk | `original-anand-dawn` |
| Down the Aisle | `nave` | wedding (Christian) | doorway | `original-processional` |
| Bougainvillea Court | `courtyard` | wedding (no faith) | arrival | `original-promise-strings` |
| Rooftop Ring | `rooftop` | engagement | unfold | `original-promise-strings` |
| Big Top | `bigTop` | birthday | arrival | `original-carnival-tumble` |
| Grand Ballroom | `ballroom` | anniversary | doorway | `original-ballroom-waltz` |
| Cloud Nine | `cloudNine` | baby shower | silk | `original-lori-music-box` |
| Jasmine Aangan | `aangan` | naming ceremony | arrival | `original-prabhat-bansuri` |
| Haridwar Dawn | `ghat` | mundan | arrival | `original-ganga-bells` |
| Thousand Pillars | `mandapam` | thread ceremony | doorway | `original-gayatri-drone` |
| Shubh Dwaar | `dwaar` | housewarming | doorway | `original-shubh-dhol` |
| Deepstambh | `deepstambh` | puja | silk | `original-sandhya-aarti` |
| Roshni Bazaar | `bazaar` | festival | arrival | `original-roshni-dhamaal` |
| Centre Stage | `auditorium` | corporate, custom | silk | `original-keynote-ambient` |
| Alma Mater | `quadrangle` | school and college | unfold | `original-alma-anthem` |
| Mela Chowk | `mela` | community, custom | unfold | `original-mela-chowk` |
| Golden Veranda | `veranda` | retirement | unfold | `original-golden-veranda` |

The five weddings and Big Top are featured; films are not. Shubh Dwaar, Deepstambh, Roshni Bazaar, Centre Stage, Alma Mater and Mela Chowk show the event's own title instead of the names (`heroTitle: 'event'`). Stage templates have no digital cards yet: `cardFromTemplate` needs a canvas opening. Every stage website is tagged `stage`: the home page shows them in its **Walk-in invitations** section (`StageCarousel`, after the scenes; the console's showcase section `stages`, filled with the featured ones first) and links to `/templates?tag=stage`, whose filter chip reads *3D walk-in* (`tag.stage`).

### The engine

- **Sets are data.** `stage/sets/<stage-kebab>.tsx` exports one `StageSetFactory` named after the stage (`sheeshMahal`, `chaarBagh`…) and nothing else; `sets/index.ts` registers the 19 (`STAGE_SETS`, built on first use, never at module load; `stageSet(name, ctx)` is memoised per palette, monogram and detail). A set is a sky (the stage box's CSS background), a key light (`from` and a rim colour: the side away from it is shaded 25% darker), fog (colours mix toward it by distance, `hazedPalette`; never a filter), a words veil, optional poses, a focus for orbits, its pieces, the four cover styles and a particle count. Pieces are `plane`, `prop` or `light`, each with an `art` name (for budgets and lookalikes), a `role`, optional `quiet`, `motion`, `buildIn`, `nearFade` and `detail: 'high'` (left out of stills). Drawings come from the kit (`stage/kit/`: surfaces, architecture, lights, nature, covers, particles, the set favourites other sets and the Studio share, and `illus`/`motif` for existing art), or are drawn in the set file.
- **Plane recipes are the engine's.** Authors place planes with `floor`, `ceiling`, `wall('left' | 'right', …)`, `back`, `sky` and props with `billboard` and `hang` (`stage/planes.ts`), by distance `d` from the rest eye, and never write a rotation. Every recipe uses `transform-origin: 0 0` and shows its front to a camera inside the room; the right wall's drawing is mirrored, so never put words on a wall. `sky({ d })` is drawn like a 2.5D scene layer on a 1920×1280 box (the 1200×800 frame with 30% overscan) and lands exactly on the frame at rest. Its scale goes into the transform string at two decimals, so `sky()` snaps the scale first and stands the plane where that scale lands exactly (within half a hundredth of the perspective, about 3.5 units, of `d`): any `d` works, and the corners, the CSS and `project.ts` agree.
- **The eye camera.** A pose is the eye (x, y, z) plus yaw (positive turns left), pitch (positive looks down), roll and a vertical fov; the perspective is `400 / tan(fov/2)` (692.82 at 60°). `poseTransform` and `lensStyle` (`stage/camera.ts`) are the only places the transform strings are made, on the server and the client alike, with `num()` (two decimals, no exponent, no `-0`). The rest eye is (600, 330, 0), 470 above the floor, pitch 0, fov 60; `DEFAULT_POSES` adds `far` (z +1100, fov 50) and `close` (z −650, fov 58). The horizon sits at frame y 440, 55% of every screen. `stage/project.ts` mirrors the CSS matrices for the tests (projection, zones, pixel budgets, near distances, `fadeAt`).
- **Units.** The stage box declares `--u: max(calc(100cqh / 800), calc(100cqw / 1200))` (`100vh / 800` without container units) and every length is `calc(n * var(--u))`, so the server emits the same strings for every screen; stills and films set `--u` in px. The frame is anchored on the horizon point, so a phone (390×844) sees frame x 415–785, a 9:16 film x 375–825 and a desktop the whole width.

### Composing for the phone

| Rule | Numbers |
|---|---|
| Eye height | props and architecture up to 470 tall (top y ≥ 330) stay below the horizon, in the bottom 45%; the floor meets the bottom edge at d ≈ 900 |
| Top 55% | only sky, ceilings, upper walls, arch screens and far `quiet` silhouettes, plus a crown band of hanging pieces and lights from the top to `STAGE_META.textTop`, hung near (d 450–700) from high (y ≤ 120) |
| Story column | the focal piece centred (x 600) at d 1300–2400, at most 470 tall (the excess `quiet`); corridor props at \|x − 600\| 150–260 between d 900 and 2000, and \|x − 600\| × 692.82/d ≤ 185 to be seen on a phone; walls at x 250/950 frame desktops |
| Distances | nothing but covers nearer than d 300 at rest; props at d ≥ 450, so the scroll dolly (≤ 228) never brings them within `NEAR_FADE` (150) |
| Words zones | crown band [0, T): hanging pieces, lights and quiet planes; emblem box x 600 ± 40, [T, T + 0.09): quiet planes and sky, light glow ≤ 0.12; names box x 600 ± 170 (phone), 190 (film), 320 (desktop), 330 (wide), [T, T + 0.30): quiet pieces and glow ≤ 0.35; details band [T + 0.30, 0.75) under the veil. T is `textTop`, and T + 0.30 ≤ 0.55 |
| Films | pieces that are not quiet cover at most 15% of any text frame, and nothing covers the eyebrow or invocation |

Words are not part of a set. `STAGE_META` (`template-schema/src/base.ts`) holds each stage's darkness (light inks over it; the sky's luminance must agree), name style, `textTop`, film `filmTextDrop`, architecture and time of day, so the catalog, posters and apps read them without set art. The hero's words sit in `HeroText` below the crown band over a veil (`stageVeil`; films use the larger of the backdrop's and the set's veil); `withFaith`'s emblem tops the words block.

The veil fades out at 62% of the hero, but a long words block (emblem, invocation, the greeting, two names, date, place and tagline) runs to about three quarters of a phone, over the focal art. The small lines carry their own **scrims** (`stageScrim`, `stage/view.tsx`; HeroText's `ScrimLines`): one pool behind the lines above the names (invocation, greeting, eyebrow) and one behind the lines below them (date, place, tagline), each sized by its lines and feathered by a blurred box shadow about 5rem beyond them, drawn as a sibling after the lines and painted behind them (`z-index: -1`), outside the 3D chain and without a filter. On dark stages the pool is the set's own night at 0.58–0.7; on light ones the paper at 0.72–0.8. On light stages the small lines' muted and secondary inks are also held to 7:1 against the paper (`StageHero`), since the page's inks are corrected only to 4.5:1 against bare paper. Together they keep every small line at 4.5:1 against the 90th-percentile worst pixel behind it, and the names at 3:1, on phone and desktop and on every preset (measured on the real pages, final.md §8.2 item 4). The pools hold for any block length on every screen and leave the art beside the words untouched; they turn up with their lines when an opening types them in (`.bulava-type-pre` hides them, `.bulava-type` fades the head's in with the head and the tail's after the names). The hero's **foot** fades into the colour of the section that follows (`StageStyles` reads its band with `:has()`), and where the page shows none, into the stage's own ground: the deep shade on dark stages (never the pale page colour, which hazed the floor), the paper on light ones.

### Budgets and caps

`stage/stage.test.ts` enforces them for all 19 sets on the default palette and both presets:

| Cap | Limit |
|---|---|
| Set pieces | ≤ 22, with ≤ 5 light sprites (a `bloom` counts two) |
| Cover pieces | ≤ 6 and ≤ 1 sprite per opening, so ≤ 28 pieces and ≤ 6 sprites in all |
| Moving pieces | ≤ 10 with `motion`, ≤ 12 with `buildIn` |
| Particles | web ≤ 40 (`particles.count`), films `min(60, round(count × 1.5))` (`filmParticleCount`), placed at d ≥ 450 |
| Markup | ≤ 150 KB of rendered markup per set and opening: the set, one opening's cover and a film's particles, as a page shows them (every opening is checked, since a host may switch a stage template to any of the four) |
| Pixel budget | ≤ 3.5 phone screens of projected area (`pixelBudget`) |

It also checks the markup rules below, that every `url(#…)` and `href="#…"` in a set, its particles and each cover points at an id in the same markup, the words zones on phone, film, desktop and wide at rest and at the rig's extremes, every shot and every opening for near distances, that standing props touch the floor (or their `base`), unique piece ids, `STAGE_META` against the sky, byte-identical renders, sky planes at any depth, and that no two stages look alike (`stageSimilarity` < 0.72). Each test loops over the sets and stops at the first one that fails; `STAGE_ONLY=<stage>[,<stage>]` holds only those stages to the per-set checks (the lookalike test still compares them with all 19), and the tests that render every set have ten-minute timeouts, so a loaded machine does not fail them.

### Motion

- **One definition, two renderers.** `MOTION_TABLE` (`stage/motion.ts`) gives each kind its keyframe stops: `sway`, `bob`, `flicker`, `drift`, `spin`, `coin`, `shimmer`, `twinkle`, `flutter`, `pulse`, `fall`, `rise` (`{ kind, amp, period, phase }`). The web compiles each kind once to `@keyframes bulava-m-<kind>` in `StageStyles`; films evaluate `motionAt(m, t)` from the same stops and easing. Only transform and opacity animate.
- **Build-in** (after a stage opening only): pieces with `buildIn` (`rise`, `drop`, `light`, `bloom`, `fade`) enter front to back, delayed `0.15 + 1.2 × depth share` s, 0.7 s each. The page is server-rendered built, so a guest who skips the opening sees the set whole; films use `buildAt` from the frame.
- **3D type.** Name lines (`data-line` on `Names`; whole lines, never letters, so conjuncts stay whole) turn up from `rotateX(-80deg)` 0.12 s apart when the opening reaches its names point, then a foil sheen crosses them once. Films use the `flipUp` entrance for names and `coin` for monogram ornaments.
- **Particles at depth.** `placeParticles` scatters the template's effect (`petals`, `marigold`, `goldDust`, `fireflies`, `confetti`, `lanterns`, `snow`) at depth, 70% inside the phone band, falling or rising, each one element. A field shares its drawings: `particleLook` (`stage/kit/particles.tsx`) gives each particle one of its effect's few shapes, its colours and its own turn, `StageView` draws every shape and gradient once in a 0×0 SVG outside the 3D chain, and each particle is an `<svg class="bulava-particle">` holding a `<use>` of its shape, painted through `--pa`, `--pb` and `--pc`. Particles are hazed in steps of 0.05 (`PARTICLE_HAZE_STEP`) so their gradients repeat. A film particle costs about 0.5 KB of markup (lanterns 0.8 KB), half what an SVG each did. On a stage page the renderer does not mount the 2D `Effects` canvas, and stage films skip the 2D `Particles`; particles the film camera has passed are dropped, and those it comes close to fade.
- **The rig** (`stage/rig.tsx`, mounted by `TemplateRenderer` outside thumbnails when a stage hero is shown): the outer `.bulava-stage-rig` breathes (CSS, 12 s, ±1.5° yaw, ±10 units) and dollies in as the hero scrolls away (up to the pose's `dolly`, ≤ 228); the inner `.bulava-stage-look` turns toward the pointer or, on Android, the device tilt (±4° yaw, ±2.5° pitch, eased 0.08 a frame). It pauses off screen (`.bulava-stage-off`, `will-change` removed), waits during an opening and starts on `bulava:intro-done`.
- **Reduced motion.** The rest pose is the design: no rig, breath, ambient motion, particles, build-in or type-in, and stage openings are hidden by CSS from the first paint.

### Films

A scene with `backdrop.stage` is filmed in the set (`BackdropView` dispatches to `StageBackdrop`); `backdrop.shot` picks one of `STAGE_SHOTS` (`still`, `settle`, `dollyIn`, `dollyOut`, `truckLeft`, `truckRight`, `craneUp`, `craneDown`, `orbitLeft`, `orbitRight`, `riseOver`, `flyThrough`, `pullAway`), and without it the scene's `camera` maps to the nearest shot (`cameraMoveToShot`), so hosts' redrawn scenes keep a valid camera. Each copy of a per-function scene films a station further in (`repeatIndex`). Every frame is a pure function of the frame number; static pieces are memoised. Stage films run at 24 fps (`STAGE_FILM_FPS`), use no `blurIn` and no shadow on `shine` or `flipUp` text, and draw no photos in the set. The video worker renders them with `gl: 'swangle'` and CPU raster (below).

Pick each scene's shot for its words, not only for its last frame. A crane, a rise or a pull-away drops the pieces that hang in the crown band (chandeliers, bells, swags, toran, bunting, paper stars) across the words while they are on screen, so scenes with words above the set use moves that keep the crown up: closings `dollyOut` (draws back to rest; k 0.8 in the catalog), `orbitRight` or `riseOver` where nothing hangs near, names `dollyIn` or an orbit. `video-engine/src/stage-films.test.ts` follows every catalog film's shots and fails when a crown piece covers more than 15% of a text frame ([testing.md](testing.md#signature-3d-stages)).

### Adding or changing a stage

1. **The set**: `packages/template-engine/src/stage/sets/<stage-kebab>.tsx` (and its name in `STAGE_NAMES`, the registry and `STAGE_META` for a new stage). Place pieces by d with the recipes; mark anything above the eye line behind the words `quiet`; keep the caps.
2. **The template**: `templates/src/stages/<key>.ts` exports one `StageTemplateSpec` named the camelCase key (the website spec with `stage`, `intro`, `defaultTrack`, optional `eyebrow` and `heroTitle`, plus the film's parts). `stageWebsite()` (`builder.ts`) and `stageFilm()` (`video.ts`) fix what every stage template shares: the stage hero, tier `SIGNATURE`, badge `NEW` unless set, no pattern, music on with the template's own track, `theme.motion: 'stage'`.
3. **Look at it**: `node infrastructure/scripts/stage-still.mjs --set <stage> --zones --words` (phone, 9:16 film and desktop PNGs with budgets and zone issues; `--palette`, `--pose`, `--shot`, `--cover` with `--q` for an opening part-way, `--t`, `--detail low`). `--words` draws the stage template's real hero words from its sample context (invocation, greeting, tagline included) with the veil, the scrim and the foot, as a guest's page lays them out: judge the art against the whole block, not the zones alone. Look at every opening part-way, not only the template's own: the set's floor and walls must reach as far forward as each opening's camera starts (the doorway from 600 in front of the rest eye, the arrival from its gate at d −250). See [testing.md](testing.md#signature-3d-stages).
4. **Check it**: the per-template checker, `pnpm --filter @bulava/template-catalog exec vitest run src/stages/stage-template.test.ts -t <key>` (seven checks: one export, the website and film validate, the occasion row and Signature rules, the catalog matrix, the film filmed in its stage, free key and names with its own lower page, the set file's factory), then `stage.test.ts` and the catalog suite; render the film with `film-stills.mjs --reveal --points 0.05,0.3,0.6,0.85 <key>-film` and regenerate the previews.

The things the build found the hard way:

- **No `mix-blend-mode`, `filter`, `clip-path` or mask anywhere in a stage.** A blending light disc flattened the whole set in Chrome on every compositor; glows are plain alpha with a hot core. Illustrations that clip or mask (`rings`, `goldenTemple`'s reflection and a few others; `giftBox` no longer clips) cannot be placed in a stage; draw the shape as plain paths in the set. `preserve-3d` sits only on the rig, look and world elements, and nothing between the lens and a piece may carry opacity below 1, `overflow`, `isolation`, `contain` or a backdrop filter: they flatten 3D.
- **`PLANE_GAP`.** Planes that share an edge exactly are mis-sorted by Chrome's compositor (the floor painted over the foot of an upright piece), so floors lie 0.5 unit below y 800 and ceilings 0.5 above their `y` by default. Keep the defaults.
- **Never let pieces cross planes.** Chrome does not split intersecting planes: a mist band through the water plane is drawn wholly on top. Keep each piece's box on its own side of every plane (a reflection is drawn on the water, not hung below it).
- **SwiftShader for browser checks at phone width.** Chrome's software compositor (`--disable-gpu`) leaves tiles of large 3D planes undrawn at 390 px wide; launch Chrome with `--use-angle=swiftshader --enable-unsafe-swiftshader`.
- **Films render with `gl: 'swangle'` and CPU raster.** Remotion's default is the same software compositor and dropped near pews from stage film frames at both sizes. `filmChromium` (`apps/video-worker/src/gl.ts`) gives stage films `gl: 'swangle'`, and the same module sets `__RESERVED_IS_INSIDE_REMOTION_LAMBDA` on import (GPU raster on SwiftShader cost about 2.5 s a frame). Remotion has no option for CPU raster; in 4.0.529 that variable is read in exactly two places, both in `@remotion/renderer`: the launcher adds `--disable-gpu-rasterization` to every Chrome it opens, and a failed screenshot words its error as Lambda advice. Nothing else changes (temp folders, clean-up, logging, timeouts, concurrency, the browser download, FFmpeg), and other films, on the software compositor, never rasterise on a GPU. The worker logs its GL setup once at start and warns when Remotion is no longer the release that was read: re-read the variable's uses before an upgrade ships. Other films keep Remotion's default.
- **A set's far pose is not its arrival.** The arrival starts from the far pose, but never nearer than 850 units in front of its gate (`ARRIVAL_REACH`, `startPose` in `stage/openings.ts`): a set that pulls its far pose into the room so a pull-away ends inside it (Down the Aisle, Bougainvillea Court, Alma Mater, Golden Veranda) would otherwise open on a close-up of the leaves.
- **Poses move together.** A set that sets only its rest pose (a higher eye, a gaze lifted a few degrees) gets its far and close poses moved with it by the defaults' own steps (`posesOf`), so the arrival, a pull-away or fly-through and the scroll dolly never dip, tilt or jump; give `far` or `close` only to place them somewhere else.
- **The walk-in sees what the rest pose hides.** Every opening starts behind the rest pose, where a desktop sees the front ends of walls and ceilings that the rest pose keeps just off its edges: cut slabs standing in the open. Those planes (`enterOf`, `stage/covers3d.ts`: tall side walls and ceilings starting no more than 50 units behind the rest eye, ends off the rest frame) stay off the picture while their ends are on screen and come in as the ends leave it, the hung pieces with the whole room, a ceiling never before the walls (`enterFade`, judged on the screen's own size: phones keep them all the way). A gate's or door's leaves stop against a tall side wall in their sweep instead of turning through it (`leafOpen`), and the arrival's ground runs on through the gate under the set's floor where that floor starts further in (`cover-ground-in`, beneath the floors at y 801.5), so no gap shows.
- **A sky with no skyline rules no horizon line.** The kit `Sky` draws its pale horizon line only as the foot of a skyline's silhouettes; bare, it read as a seam across the sky above a low backdrop.

## Website sections

| Section | Notes | Variants |
|---|---|---|
| `hero` | invocation, eyebrow, names, date, place, tagline, cover photo; greets the guest by name on personal invitations | `classic`, `arch`, `split`, `photo`, `minimal`, `festive`, `temple`, `monogram`, `cathedral`, `seaside`, `celestial`, `lantern`, `peacock`, the drawn scenes `gopuram`, `palace`, `toran`, `arches`, `lotus`, `mandap`, `noir`, `floral`, `balloons`, `backwaters`, `sarovar`, `vrindavan`, `artwork` (painted), and `balcony` (the photo seen from a palace balcony: the left 64% feathered into the paper under a carved arcade, jasmine strands, lanterns and flowers; the words on the paper at 72%; `dateEnd` gives a span of dates; without a photo, a lake palace at golden hour), and `swans` (the names in a carved garden arch over a lake where two swans meet, on the design's own 450 × 800 page at every width: the faith emblem at the arch's point, then the eyebrow, the date (`dateNumeric` reads "27.09.26"), the names in the script face and a cue to scroll that bobs over a chevron and leads to the next section; blossoms drift through the arch, peony bouquets breathe at its foot and a torn sheet rises over the water carrying the `invocation`, the Bismillah in Amiri; the words rise as the opening lifts) |
| `invitation` | the invitation's own words: an eyebrow, a lead ("We cordially invite you to"), the event's title and description, between the fleuron and its rule; hidden without a title. On the deckle look: the lead and the text (a letter's greeting and its line) in the light serif, no title | default |
| `quote` | a verse, shloka or line, set large | `default`, `verse` (one centred line in the heading face's italic, in the gold ink, that continues the band above it); on the deckle look, gold script a phrase to a line (long verses step down a size) |
| `countdown` | live timer to the first function | `default`, `flip` (flip-clock digits), `rings` (each number in a double ring), `calendar` (the month printed like a calendar page, the day ringed), `ornate` (one row of gold figures with drawn separators and a flourish at each end), `shimmer` (Ovo figures in candlelit gold with colons between them and the units' names beneath: they ink in from the left one after another, catch the light twice through a registered `--cd-pos` property, and roll up as they change) |
| `couple` | partners with their photos and their parents ("Daughter of / Son of", [below](#the-parents)) | `default` (round portraits in the suite's seal), `stacked`, `portraits` (alias `arch`: tall frames in the suite's shape), `duet` (two round portraits overlapping, the families side by side), `monogram` (the names either side of a seal with their initials), `flip` (3D cards that turn over to the parents), `profile` (editorial rows) |
| `story` | text with a photo | `default` (the photo in the suite's frame), `letter` (a letter on paper, the photo pinned above it), `curtain` (tap to reveal), `polaroid`, `arch` (the words in the left column, the photo under a cusped arch with flowers at its foot; a story over 280 characters or two paragraphs opens in place) |
| `parents`, `family` | the blessings | `default` (the text), `blessings` (each family's parents under the couple's names, the suite's seal between, then the text), `houses` ("{name}'s Family" side by side with the template's faith emblem between them, the suite's seal for a design of no one faith) |
| `eventTimeline` | only the functions this viewer may see, each with a motif picked from its name | `cards`, `timeline` (the suite's glyph on every node), `frames` (cards in the suite's shape), `tiles`, `tickets`, `diya`, `arches` (cusped arch cards with each function's illustration, `FUNCTION_ART`, four in a row and the rest behind "View full schedule"), `stem` (a printed programme: each function's time at the left, its name at the right in a narrow column, a fine stem between them with a diamond at each and a blush peony that rides the stem down as the page scrolls, a CSS scroll timeline that waits at the first function where there is none and for reduced motion; over more than one day each day's date heads its functions) |
| `menu` | "Course \| dishes" lines from a text slot, on a card in the suite's shape | default |
| `venue`, `map` | venue card with directions | `default` (a card under the suite's seal), `illustrated` (the suite's foot art standing on the card), `postcard` (an address card with a stamp and a postmark), `photo` (the venue's own photo, `photo.venue`, across the left half; address, city and map rows and directions beside it), `sketch` (the name and "Address: …" under a script heading and a small fleuron, an inked domed hall with petals drifting over it, then the map embed in a gold frame between filigree crests, or a quiet link to directions) |
| `gallery` | approved photos the viewer may see | `default`, `frames` (a wall of the suite's frames), `stack` (swipeable 3D stack), `mosaic`, `polaroid`, `carousel` (one row at the photos' own proportions that scrolls and snaps, with buttons, dots and the arrow keys; past six photos, "View full gallery" opens a grid) |
| `accommodation`, `travel`, `giftRegistry` | text slots, in a card under the suite's seal | default |
| `essentials` | stay, travel, the dress code, gifts and the menu as one strip of columns under line icons (a list on phones); empty columns leave, the menu column opens the whole menu on a cusped card; columns carry ids `<id>-stay`, `-travel`, `-dressCode`, `-gifts`, `-menu`. On the deckle look they stand one under another on a paper sheet, each under a gold script heading (the dress code first, then "Gift Preference"), rose vines breathing in two corners | default |
| `announcements` | published updates for this viewer | default (on the heirloom look's deep band, a centred column of notices) |
| `rsvp` | the host app injects the RSVP form (or the public registration form) on a light reply card | `default`, `card` (the card in the suite's shape, its seal pressed onto the top edge), `invite` (the guest greeted by name, a line, and "Confirm your presence" opening the reply card in place; it opens by itself at `#<id>`), `seal` (a script heading, a line, and a wax seal stamped RSVP over a chevron and "Click to open" that bob: the seal opens the host's form in a native dialog over the page, which also opens when the page is reached at the section's address) |
| `photoShare` | QR photo rooms for this guest | default |
| `footer` | closing line and photo, hashtag, check-in QR, watermark | `default`, `seal` (the couple's initials on the suite's seal, strands hanging either side), `skyline` (the suite's art along the foot), `blessing` (the closing line large, the names), `vista` ("See You Soon" over a lake palace at golden hour, or the photo the template binds to `image`; carved pillars with jasmine, a peacock and flowers; share links to the event's public page, `slots.shareUrl`, never a personal link), `bloom` (the closing line in gold script and the names, "{one} and {two}", over the photo the template binds to `image` rising out of the cream, peony bouquets at its foot; without a photo the two swans close the page) |

**Bands and decor.** A section may name its band (`band`: `plain`, `surface`, `primary`, `accent`, `deep`; else the look places it) and carry art in its corners and sides (`decor`, at most eight pieces: an illustration, its place, its height on a 1440-wide page, offsets, flip, tint, foil, a warm halo, a gentle sway, and its size on narrower pages, where it stands along the band's top or foot, sunk past the edge in proportion when its `y` is negative, or hides). The deep band is the palette's own `colors.deep` (an emerald, a midnight) when it has one, else the primary toward black. Decor is never a faith emblem. Drawings that recur down a page (roses, peacocks) are defined once and placed with `<use>` (`sharedArtOf`), so a richly dressed page stays within its markup budget (about 450 KB of drawings at 1440).

**The page menu.** `website.nav: 'bar'` adds a menu: the couple's monogram, links to the sections the page shows and draws (Home, Our story, Functions, Venue, Gallery, Travel, Gifts, RSVP) and "Save the date" (Google Calendar). On wide pages it lies over the hero as a panel and sticks to the top once the hero's upper part has gone; narrower, it is a bar with a menu button and a sheet. Thumbnails and the editors draw it still.

Sections with nothing to show (no photos, empty text) hide themselves, and live pages reveal sections as they scroll into view (disabled for reduced motion). Every 3D control has a keyboard path: flip cards have a turn button per face and the hidden face is `inert`.

### Section suites

The sections below a hero are dressed as one printed suite with it (`template-engine/src/sections/suites.ts`, `dress.tsx`). The theme's ornament names the **suite**, the art vocabulary of its hero: the glyph between rules under every heading and on timeline nodes, the corner pieces, the border along the top of a band, the round seal (monograms, the countdown, the RSVP card, the closing), the shape of photo frames and cards, the art at the foot of the page, the strands hanging in the closing band, the stars over a dark band and the paper's pattern. The look still sets the type and the rhythm of the bands, the palette the colours, and each section's variant its layout.

| Suite | For | Its pieces |
|---|---|---|
| `mandala` | Rajasthani palaces | the foil flourish, filigree corners, a marigold toran, the medallion, jharokha windows, a pair of elephants, lanterns |
| `peacock` | Mayur, Krishna | peacock feathers in the corners, the medallion, arches, a pair of royal peacocks |
| `jaali` | Mughal, nikah | a row of cusped arches, filigree, the arabesque, mihrab frames, domes, lanterns |
| `temple` | South Indian temples | the temple border, the kolam, prabhavali niches, brass kuthuvilakku lamps, jasmine |
| `kasavu` | Kerala | the kasavu's gold zari border, the nilavilakku in a ring, arches, lamps, jasmine |
| `lotus` | Bengali | the laal paar border, the alpana, round frames, lotuses |
| `bagh` | Punjabi, Sikh | the phulkari border, the phulkari flower, arches |
| `marigold` | haldi, genda phool | marigold swags, the marigold wreath, scalloped frames, a row of diyas, marigold strands |
| `rangoli` | the threshold, Diwali | a mango-leaf toran, the rangoli, doorway arches, diyas |
| `paisley` | bandhani, mehendi | bandhani dots, paisley corners, a line mandala, arches, a kalash either side |
| `floral` | garden romance | rose corners, a rose garland, a botanical wreath, oval frames, roses |
| `chapel` | church weddings | a row of lancet arches, a quatrefoil, the rose window, lancet frames, doves |
| `laurel` | heirloom classic | laurel sprigs, double hairline frames, a crest |
| `deco` | art deco nights | stepped rules, fans, stepped frames and corners, a sunburst |
| `stars` | night skies | stars on the rules and over the bands, round frames, a moon seal, a crescent rising |
| `geometric` | modern | a diamond on fine rules, rounded cards, a jaali star |
| `confetti` | parties | bunting, confetti, ticket cards, a sticker seal, balloons and presents |
| `clouds` | the nursery | a scalloped cloud edge, cloud frames, a moon seal, clouds |
| `none` | templates before suites | the look's own rules and corners |

**Restraint.** A suite takes one or two pieces of its hero's art, never all of them: a band takes a border or corners, never both; swags (a toran, a garland, bunting) hang over every third band and strips over every other one; stars cross every other dark band; a page shows the suite's frame at most twice. Every piece is drawn in code in the palette (foil where the suite is metal), and takes a colour that shows on its band: gold on paper, the light accent on a dark band, the primary on the accent band. Sections render on the server, so each computes its dress (`dressFor`: band, look, palette, suite) and passes it to the shell and every piece; there is no React context.

**Swapping pieces.** `theme.dress` swaps single pieces for others, so two designs in one suite still differ: `frame` (jharokha, niche, mihrab, lancet, arch, oval, circle, scallop, ticket, deco, double, cloud, rounded, cusped: a Rajput multifoil arch whose head keeps its proportions over a body of any height), `edge`, `seal` (`emblem` sets the suite's own emblem in a double ring), `skyline`, `corner`, `divider` (`fleuron`: a lotus bud between two C-scrolls in foil, between fading hairlines; the `SUITE_*` enums in `@bulava/template-schema`, which Template Studio offers; unset pieces stay the suite's own).

**How a template picks its suite.**

- **Factory themes** name it (`suite` in `themes-*.ts`, from the kit's art: a jharokha and elephants take `mandala`, a temple `temple`, Kerala `kasavu`, a nikah `jaali`, phulkari `bagh`, marigolds `marigold`, a church `chapel`…) and may swap pieces (`dress`); a theme that shares a suite with another of its occasion swaps a piece or two. Each **composition** lays the sections out its own way (`templates/src/factory/arrangements.ts`): a jharokha hero keeps its windows for the couple's portraits and closes on the suite's skyline, a night hero overlaps two round portraits and swipes through the photos, a photo hero turns its portraits over like prints, a minimal hero stays quiet (no border or corners). A theme that lays one composition out twice gives the second another arrangement. A layout may swap pieces too (`dress` on the layout).
- **Hand-made websites** (`website.ts`, `signature.ts`) set `ornament`, `dress` and each section's variant in their specs; **canvas collections** (`canvas-cards.ts`, `premium-cards.ts`, `canvas.ts`) set `ornament`, `dress`, `heroTone` and `closing` (the RSVP's and the footer's variants) beside their sections.
- **Dark stock.** A hero on dark stock (a dark kit, a night sky, a temple at dusk) sets `heroTone: 'dark'`, so the royal, classic, garden and modern looks carry the dark stock down the page (the primary band alternating with a deeper one) and function cards sit on the deep band on wide screens.

#### The parents

The couple's details carry each partner's father and mother ([ADR-068](decisions.md)); they fill `custom.partnerOneParents` and `custom.partnerTwoParents` as one line each, in the order the design's tradition writes them (the mother first for Hindu, Sikh and other designs, the father first for Muslim and Christian ones: `mothersFirst` in `context.ts`), unless the host wrote their own lines. Every couple section and the family section's `blessings` layout bind those slots, never the four names. Under each partner's name a small label (`template.couple.daughterOf` / `sonOf`: "Daughter of" / "Son of", सुपुत्री / सुपुत्र; the first partner is the bride, as the event form asks) sits over the parents' names on two lines, the second led by a script ampersand. The `duet` layout sets both families side by side under the names, the `blessings` layout under each family's name (`template.family.of`). An empty line shows nothing, label included. Names and verses use the heading face where it is a book face (italic only where it has a true italic, Cormorant Garamond) and the body face under a display heading such as Cinzel's capitals; Devanagari labels are set larger and unspaced (`labelClass`).

### Canvas sections

A `canvas` section is a free-form design: the Studio's Design Studio ([template-studio.md](template-studio.md#design-studio)) lays out layers on fixed artboards instead of filling a prebuilt layout. The section carries `canvas.mobile` (an artboard, usually 390 × 844 design units) and optionally `canvas.desktop` (usually 1440 × 900); without a desktop artboard the phone design is shown centred at `desktopMaxWidth` on wide screens, on its own background. `repeatPerFunction` renders the artboard once per function the viewer may see, with `function.*` bound to each: the card-per-function invitations. The schema is `packages/template-schema/src/canvas.ts`; the renderer is `packages/template-engine/src/canvas/`.

An artboard has a background fill (a colour, gradient, pattern or licensed image), an optional ambient effect and up to 120 layers, drawn bottom to top. Every layer has a frame `{x, y, w, h, rotate}` in design units, an opacity, `visibleWhen` (a binding that must have a value, event types) and an animation: an entrance played once when the section scrolls into view, and an ambient motion. Layer kinds:

| Kind | What it draws |
|---|---|
| `text` | a `Value` (fixed text, a binding with a format and fallback, a translation, or a `{{template}}`) in a theme font role or a fixed family, with size, weight, colour, alignment, spacing, case and shadow. `foil` stamps the letters in a metallic foil made from their colour. `overflow: shrink` fits long names into the box in the browser; static renders (thumbnails, gallery images) have nothing to measure with, so they scale the text by an estimate from its length and font role. `wrap` and `clip` keep the size. |
| `image` | a licensed asset (listed in `assets`, loaded through `/api/v1/public/template-assets/:id`) or a host photo binding (`photo.cover`, `photos[0]`…), with fit, mask (rounded, circle, ellipse, arch, diamond, leaf), border, shadow, flips, brightness and saturation. A missing bound photo hides the layer, so designs put a shape or ornament behind it. |
| `shape` | rect, ellipse, line, arch, diamond, triangle, star, heart, scallop, with a fill and an outline |
| `ornament` | the engine's drawn motifs (mandala, paisley, floral, toran, marigold strand, diya, kalash, lantern, peacock feather, rose window, temple border…) and full-colour [illustrations](#illustrations), tinted with a colour. `foil` turns line motifs and an illustration's metal into stamped foil; `shadow` adds a soft drop shadow or a glow in the layer's colour. |
| `scene` | one of the [illustrated scenes](#illustrated-scenes) (all but `noir`) inside the frame, anchored at its bottom centre like a hero. With `sky: false` only the scenery shows, over the layers below. |
| `icon` | a line icon (calendar, clock, pin, heart, rings, music…), optionally on a circle |
| `widget` | `countdown` (boxes, flip or inline), `button` (get directions, add to Google Calendar, scroll to RSVP, open a link, back to top) and `details` (date, time, venue, address and city rows with icons) |
| `section` | one of the template's own sections, by id, drawn exactly as the template draws it, behind a host's redrawn section ([ADR-065](decisions.md#adr-065-the-website-canvas-as-one-page-and-click-to-edit-any-template-section-2026-10-12)): laid out on a 390-wide phone with an 844-high screen and zoomed with its board, its words hidden (`hideText`) while the host's text layers carry them, inert. Only in a redrawn section, for the section it stands in for; never in a template, a canvas override, a film or a card. |

Colours are palette roles (`primary`, `accent`, `text`…) or fixed hex values; roles follow the host's colour preset, so one design restyles itself. The renderer scales an artboard to its container with CSS alone: positions are percentages, sizes are container-width units (`cqw`) and the section is a container query, so a phone design keeps its proportions on every screen and the Studio's phone frame stays a phone. Text colours are nudged to WCAG AA against the artboard's fill unless the designer switches `contrast` off for a decorative layer; the test matrix lists such layers under `contrast`. Entrances and motions stop for reduced motion, and buttons only open `https:`, `mailto:`, `tel:` and same-page addresses.

Every layer also has a `blend` mode (normal, multiply, screen, overlay, soft light). Gradients are linear or radial, with an optional middle colour (`via`). An artboard can be printed on a `texture` (paper, linen, grain or a watercolour wash, at `textureStrength`), an SVG noise overlay that costs no image. The `shimmer` motion sweeps light across foil text and glints other layers; like every motion it stops for reduced motion.

Rose Arch and Confetti Pop (`templates/src/canvas.ts`), the card collection (`templates/src/canvas-cards.ts`) and the [template factory](#template-factory)'s 409 invitations are built this way. Each has phone and desktop hero artboards and a per-function card. They use only drawn art and host photos, with a shape, icon or illustration behind every photo for invitations without one; designers add painted or photographic layers from the asset library. `templates/src/canvas-kit.ts` holds the shorthands they are written with (`at`, `text`, `orn`, `scene`, `photo`, `cardButtons`…) and `canvasWebsite`, which turns a design into the website: the hero, the function cards, standard sections, RSVP and footer.

#### Illustrations

`template-engine/src/art/illustrations-*.tsx` draws 107 full-colour illustrations in code (`ILLUSTRATIONS` in the schema):

- **Royal and floral**: a caparisoned elephant, a royal peacock with a tiered train, a jharokha (`JHAROKHA_OPENING` says where a photo sits behind it), rose clusters, floral garlands and doves.
- **Ornament**: an ornate frame, filigree corners, a flourish, a medallion, a paisley, an arabesque and domes.
- **Ritual and region**: temple bells, jasmine strings, banana leaves, a kolam, a rangoli and a hand painted with mehendi.
- **Celebration**: wedding rings, a cake, balloons, bunting, a gift box, fairy lights, a moon on a cloud, a house and a row of diyas.
- **People** (`illustrations-people.tsx`, `illustrations-family.tsx`): eight couples (a Hindu bride in lehenga and her groom in safa, after the varmala, Sikh, nikah, South Indian, Christian, Bengali in topor and mukut, and a couple who have shared a lifetime), the bride and the groom as portrait busts, a girl and a boy in party hats, a baby in a cradle and a mother-to-be in a silk saree. The tint is the outfit.
- **Props** (`illustrations-props.tsx`): a stork with a bundle, a teddy bear, a unicorn, a little dinosaur, a rocket, a cupcake, a bridal doli, a dhol, an urli of haldi and a champagne toast.
- **Stationery** (`illustrations-heirloom.tsx`): gold line art for foil-stamped cards: a mandala crown with a lotus-bud pendant and its half for the foot, a double hairline frame and an art deco frame (both drawn to the whole card, so every card format keeps its margins), a floral gold vine for the sides, scattered sparkles and a botanical wreath tied with a ribbon.
- **Faith** (`illustrations-faith.tsx`, `illustrations-sacred.tsx`): the four emblems ([Faith](#faith): Lord Ganesha, the crescent and star, the Khanda, the cross with olive branches), drawn as foil stamps in one metal; and each tradition's wedding art: a girih rosette (an eight-fold Islamic star), a jaali mehrab window in marble and gold (its opening takes a photo, `JAALI_ARCH_OPENING`), a fanoos lantern, the Darbar Sahib on its sarovar, a phulkari bagh medallion, a stained-glass lancet window (its opening takes a photo, `LANCET_OPENING`), Madonna lilies and wedding bells.
- **Atelier** (`illustrations-atelier.tsx`, [ADR-074](decisions.md#adr-074-the-atelier-collection-invitations-you-pull-open-2026-10-19)): haberdashery for tactile stationery: a metal zipper (drawn to the layer's size, its teeth as many as the layer is long; turn the layer for one across), its slider pull, a scalloped tag with a gold label frame, satin ribbon (drawn to the layer's size), a satin bow with V-cut tails and a wax seal. The tint is the metal, the card, the satin or the wax.
- **Regional** (`illustrations-regional.tsx`): one tradition each: a South Indian prabhavali (its opening takes a photo, like the jharokha), a brass kuthuvilakku, a Kanjeevaram zari border, a Mughal mihrab, a phulkari border, a Bengali alpana and lal paar border, marigold swags, a marigold wreath and a strand of ghungroo. Borders, frames, vines and swags are drawn to the layer's size (`FRAME_SIZED`); the editors' add menus put frames around the whole board, borders across the top and strands down a side.
- **Stage props** (`illustrations-stage.tsx`): the Signature 3D stages' own art ([Stages](#stages-signature-3d)) as canvas pieces: a crystal chandelier, a brass candelabra, a gilt lamp post, a pierced brass lantern, a carved granite pillar, a tiered fountain, a potted palm, a banana plant, a havan fire and a sweet stall from the stage kit, and three set favourites now in the kit (`stage/kit/favourites.tsx`): Mela Chowk's Ferris wheel on its stand, Cloud Nine's hot-air balloon and Deepstambh's lamp tower with its flames alight. Each is drawn by the kit piece itself, lit from the left with one fixed seed, so the editor, previews and the card export draw the same picture; the tint is the piece's metal, stone, water, awning or leaves, and every gradient id is made the layer's own. Search *stage* in the Elements panel to list them.
- **Palace** (`illustrations-palace.tsx`, The Royal Heirloom): a carved sandstone arcade of cusped arches drawn to the layer's size (its bays from its width, pillars at the ends lit from above, a carved corbel between the bays with a slim gilt lotus bud hanging from it, a gilt finial on each keystone, a double gold hairline along each arch and its darker reveal inside, the openings clear and the foot fading so a photo shows through), a single carved pillar, a domed chhatri with roses at its plinth (its shade warm, never grey), a Rajput palace front with gold-domed towers and deep maroon-brown windows edged in gold, the wedding mandap wound with marigolds around its havan, a bed of peonies, garden roses and jasmine (drawn to its width, its blooms warm in every palette) and a hanging floral strand on a gold chain that ends in a small lantern when it is tall. Stone takes the tint warmed toward the palette's gold. `standingPeacock` (`illustrations-nature.tsx`) is the royal peacock standing on a ledge, its train over the ledge's face, for a plinth or a parapet. `art/vignettes.tsx` adds `LakePalaceVignette`, a lake palace at golden hour (a golden band along the horizon, the sun's path on the water) that stands in for a missing venue photo and closes the vista footer, `LakePalaceArt` (the palace with its reflection, for a scene to place) and `BalconyVista`, the balcony hero's view behind the whole hero.
- **Garden** (The Sacred Garden, [ADR-081](decisions.md#adr-081-the-sacred-garden-the-deckle-look-and-a-templates-own-preview-sample-2026-10-23)): `gardenArch` (`illustrations-garden.tsx`), a whole portrait page (450 × 800): a carved Mughal arch with foliate spandrels and Corinthian columns in the tint's sandstone, jasmine spilling from its crown and climbing the columns, and through it a warm sky (the page's paper), misty trees and a still lake where two swans meet; `swanPair`, the swans alone, their necks drawing a heart over their rippled reflection (the tint is the water); `peony`, `peonyBouquet` (a corner bouquet drawn for the bottom-left, its sprays rising tall; mirror it for the right), `peonyCorner` (the same flowers massed low in the corner, the space above them left open, for an arch's foot or a photo's) and `roseVine` (a top-right corner spray) in natural colours with the tint for the leaves (`garden-flowers.tsx`); `domedHall`, an Indo-Islamic hall drawn in pen and wash, the tint its ink (`garden-hall.tsx`).

The layer's colour is the illustration's main colour (the elephant, the train, the leaves, the henna) and the palette colours the rest, so a colour preset restyles the art like the text. Real flowers and flames keep their own colours (`NATURE` in `art/kit.tsx`). Garlands, strings and frames are drawn to the layer's size (`FRAME_SIZED`); the others keep their proportions (`ILLUSTRATION_ASPECT`, which also sizes new layers in the editor).

Illustrations follow the rules for scene art. `art/kit.tsx` has the shared pieces:

- `taper` (a filled stroke that narrows along Bézier curves);
- `cuspedHead` (a Rajput cusped arch head, three lobes up each side and an ogee to a pointed apex, on a 300 × 100 grid: the `cusped` frame, the arcade and the palace windows share it);
- `onCubic` and `frameAt` (a point on a curve and an SVG transform aligned to it, for patterns that follow a finger or a feather);
- `Metal` (a foil gradient in the illustration's own coordinates, so straight lines and dots take it too) and `Lit` (a colour lit from one side).

The curve helpers use only arithmetic and square roots, so the server and every browser draw the same picture. To add one:

1. Add it to `ILLUSTRATIONS`.
2. Add it to the component map in `art/illustrations.tsx` and to `ILLUSTRATION_ASPECT`.
3. Check it in the Design Studio's Elements panel, which shows a preview of each (add search words for it in `KEYWORDS`, `canvas-editor/elements-panel.tsx`).

### Template factory

Most of the catalog is made by `templates/src/factory/`, the way a design studio works: an art director picks a theme's art and colours, and the theme is laid out in several compositions.

| File | What it holds |
|---|---|
| `kit.ts` | A **kit**, the theme's art direction: dark or light stock, paper texture, foil, the name font, and which illustration sits where (`hero`, a flanking `pair`, a `top` band, mirrored `corner`s, a turning round `centre` motif, `hang`ing strings or lanterns, a `scene`, a `skyline`, the `motif` under the names, `float` art over a dream sky, a `crest`). Also the **occasions** (wedding, engagement, haldi, mehendi, sangeet, reception, anniversary, birthday, baby shower, naming, housewarming, puja, festival): category, event types, eyebrow lines, sections and a default crest. |
| `compositions.ts` | 17 **compositions** (arch, jharokha, couple, split, night, floral, temple, portrait, party, dream, home, minimal, mandap, photo, and the faith compositions mehrab, darbar and lancet), each a phone and a desktop artboard plus a function card (framed, banded, garland, header, sky or minimal). Zones are fixed (art along the top, words in the middle, art along the bottom), so any kit fits without overlaps; a piece a kit leaves out is left out. |
| `theme.ts` | A **theme**: a name word, a palette and presets, fonts, look, effect, opening, the kit, and its layouts. Each layout becomes one template named "<theme word> <layout word>", keyed `<slug>-invite`, with its tier from the composition unless the layout sets one. |
| `themes-*.ts` | The themes, by occasion. `collection.ts` gathers them and orders the templates so a gallery shows one design from every theme before the second of any. |

Rules the compositions keep, so a new theme only chooses art:

- Only round motifs turn (`isRound`: medallion, mandala, rangoli, kolam, arabesque, geometric, rose window, girih, phulkari bagh); other art floats or sways.
- A faith theme's kit carries its emblem (`kit.emblem`, set in `collection.ts`), which every composition places at the very top ([Faith](#faith)); names keep clear of strands hanging down the sides, and the piece under a photo arch is a lotus only for Hindu designs and designs of no one faith.
- A photo frame shows its art (or the couple's monogram, `{{couple.partnerOne|initial}} & …`) until the host adds a photo, so no frame is ever empty.
- The crest never repeats the art at the foot, and rings appear only for couples.
- Party themes (bunting or presents) end the split layout in balloons and presents, garden themes in roses, the rest in a turning rangoli.
- Occasions whose title is the event's own (housewarming, puja, festival) set it smaller, on two lines.
- A theme may reorder its occasion's event types (`eventTypes`); the first decides the sample content of its previews (a mundan theme shows a mundan). Festival themes are tagged (`eid`, `holi`, `christmas`, `navratri`, `pongal`) so previews use that festival's sample title (`SAMPLE_VARIANTS`).

To add a theme: write it in the occasion's `themes-*.ts` (a unique word, a palette with light accents for dark stock, a kit, its `suite` and any `dress`, and layouts with distinct words), run the catalog tests (unique names and themes, no two layouts of a theme with the same composition and art, no two heroes of an occasion `HERO_LOOKALIKE` or more alike, no two lower pages alike, the test matrix), seed, and generate its previews. A new composition gets an arrangement in `arrangements.ts`. A theme that would repeat another theme's design in new colours belongs in that theme's presets instead. Children's themes use the *Playful* font pairing (Baloo 2 and Pacifico).

### Importing card JSON

Designs from other software (PDF, SVG, PSD, PPTX) are imported page by page in the Design Studio ([template-studio.md](template-studio.md#imports)). Template Studio's *Import design JSON* turns a card made in another tool into a canvas template draft ([ADR-056](decisions.md#adr-056-card-json-becomes-a-canvas-template-draft-cards-carry-up-to-four-functions-2026-10-10)), and a website's JSON into a website draft ([Importing design JSON](template-studio.md#importing-design-json)). Card JSON has a `canvas` (`width`, `height`, `background`), a `theme` (colours and `fontHeading`, `fontBody`), `data`, `assets` and `elements`, each with a `kind` (`rect`, `circle`, `line`, `image`, `text`, `button`), a `frame` (`x`, `y`, `w`, `h`), a `style` and `content` (`text`, a `binding`, or an image's `src`). `importCardJson` maps:

| JSON | Canvas template |
|---|---|
| `theme` colours (`primary`, `gold`, `goldLight`, `background` or the canvas's, `secondary`, `text`, `goldDark`) | palette roles (`primary`, `secondary`, `accent`, `background`, `surface`, `text`, `muted`); an element painted in one of them keeps the role |
| `theme.fontHeading`, `fontBody` | the heading and body fonts; a script heading (Great Vibes, Pinyon Script…) becomes the script font; a family outside Bulava's 22 becomes the body font, with a warning |
| `couple.displayName`, `wedding.dateLabel`, `wedding.venue` | `{{couple.partnerOne}} & {{couple.partnerTwo}}`, `event.startDate` (date format), `{{venue.name}}, {{venue.city}}` |
| `events.N.name`, `.date`, `.time`, `.venue` | `functions[N].*`, shown only when that function exists |
| other text bindings | a text slot (`custom.<key>`) holding the JSON's words |
| `image` with a photo binding | a photo spot (`photo.cover`, `photos[0]` …) |
| `image` with `asset:<id>` | that licensed asset |
| any other `image` | the nearest drawn art (mandala, floral border, sparkles…) or the artboard's paper texture, listed as a stand-in |

The draft is a website (canvas hero, timeline, venue, RSVP, footer) and so also a digital card. Its phone artboard keeps the JSON's canvas size; it has no desktop artboard, so wide screens show the phone design (up to 480 px wide, `desktopMaxWidth`) until staff draw one in the Design Studio. Review the stand-ins, replace them with licensed art if the design needs the original pictures, run the checks and publish.

### Openings, effects and music

Openings play once per browser session per invitation, are skipped for users who prefer reduced motion, and are keyboard accessible (the scratch card has a *Reveal* button).

The **doors** and the **curtain** open onto the invitation itself: the overlay has no backdrop behind them, so the hero is there under the leaves from the first frame (a hero's words may wait for the guest's tap and rise as the leaves part, as the balcony hero's do). A theme dressed in the `cusped` frame gets palace doors (`IntroOverlay` reads `theme.dress.frame`): brass studs round each leaf, a cusped arch inlaid in a double gold hairline and a gilt lotus boss with its ring. The doors' hint sits on a small pill of the doors' colour under the seal, clear of the seam.

The **sealed envelope** (`sealedEnvelope`, The Sacred Garden) fills the screen with a portrait envelope of paper (the surface lightened) whose flaps carry embossed sprigs, sealed where they meet with a pool of wax (the primary) pressed with the couple's initials in the script face and gold; "Tap to open" breathes beneath it in spaced Cinzel capitals over a chevron. A tap warms the seal, turns the top flap up and over on its hinge in 3D (the seal goes with it), lets light rise from inside and fades onto the page.

Two openings are pulled by hand ([ADR-074](decisions.md#adr-074-the-atelier-collection-invitations-you-pull-open-2026-10-19); `template-engine/src/covers.tsx`, drawn in the template's palette): **zipper**, a linen pouch the guest unzips by pulling its tag down (the halves part along the teeth), and **ribbon**, a card tied with a satin band and bow the guest pulls to untie (the band slides away). A drag past a third of the way, a tap, Enter or Space opens them; a short drag springs back; the tag or the bow sways until touched and a hint says what to do (`template.intro.zipper`, `template.intro.ribbon`). The cover carries the couple's monogram (`coverMonogram`). Opening an invitation dispatches `bulava:intro-open`; the music player listens for it, because browsers only allow audio after a user gesture. Music never autoplays on page load, pauses when the tab is hidden, and has a visible play/pause control.

Four openings move through a stage hero ([Stages](#stages-signature-3d); `STAGE_INTROS`: `arrival`, `doorway`, `silk`, `unfold`). The overlay draws no stage: `stage/opening.tsx` drives the hero's own server-rendered DOM (the world and lens transforms and the `[data-cover]` pieces, server-rendered hidden), from `openingStart(kind, set)` to the hero's rest pose, so the opening ends without a cut. `openingState(kind, q, set)` (`stage/openings.ts`) is pure and shared with films; the cover pieces come from the set's cover styles (`coverPieces`, `stage/covers3d.ts`), drawn in the palette with the monogram on the seal and no other words.

| Opening | Covers | What the guest does and sees | Web |
|---|---|---|---|
| `arrival` | a gate (palace, garden, torana, tent flap, lane, haveli, ghat, campus) | The venue from outside, framed by its gate; the monogram seal turns like a coin between the leaves. The leaves swing open and the camera flies through the gate into the set as its lights come up. It starts from the set's far pose, never nearer than 850 units in front of the gate; wide screens start closer (`fitStart`) so the gate fills them. | 2.8 s |
| `doorway` | two carved door leaves with thickness, the frame and a seam of light (temple, house gate, church, cedar, ballroom, haveli) | Light leaks through the seam; drag outward from it (either way) or tap. The leaves swing in on their hinges, their edges showing, the light floods and the camera steps through. | 2.4 s |
| `silk` | a drape in six bands (damask, dawn, organza, velvet, temple) | A परदा (a stage or temple curtain, never a bride's veil) hangs close, its hem swaying. Drag up or tap: the drape folds back band by band, top first and hem last, each band hanging from the one above, then is hoisted away and fades. | 2.0 s |
| `unfold` | a tri-fold card with a seal (trifold, folio, patra, album, certificate, poster, popup) | A closed card stands in the set. Drag its edge sideways or tap: the right panel opens, then the left; the card tips back and drops as the camera glides over it into the set. | 2.4 s |

They keep every rule of openings: once a session, none for reduced motion (hidden by CSS from the first paint), a focusable button with a label and hint (`template.intro.arrival` …), Enter, Space and a tap complete them, a short drag springs back, the mouse wheel opens them on desktop, and `bulava:intro-open` fires on the first gesture. Leaves and panels swing a little past open and settle; the house lights and the glow that widens as the cover parts are flat layers in the overlay, never inside the stage. When the opening reaches its build point the set builds in; at its names point the words turn up (3D type); at the end it dispatches `bulava:intro-done` (2D openings now fire it too), which starts the rig.

Stage openings are offered only for a template whose first section is a stage hero (`validateTemplateDefinition`; `validateCustomization` refuses them elsewhere, *This opening needs a 3D stage*; the design panel and the Studio list them only then). Every set declares all four cover styles, so a host may switch a stage template to any stage opening. A host who redraws the hero still gets the 3D opening when their board keeps the template's hero behind (a `section` layer for it); otherwise the page has no stage to open on and plays the opening's **2D twin** from the first paint: arrival plays `gates`, doorway `doors`, silk `curtain`, unfold `envelope`, with the flat effects on. A film scene opens the same way with `scene.reveal` set to the same name (it needs `backdrop.stage`): the cover holds 0.7 s, the opening runs 2.6 s (`STAGE_REVEAL`), the scene's words come in from 2.78 s, and the arrival seal is timed to face the camera during the hold. The marketing *Play opening* renders the live page in an overlay and closes 1.9 s after `bulava:intro-done`, or on the X or Escape.

`theme.motion: 'stage'` (every stage template) dresses the page below the hero in 3D: sections tip up from their foot as they reveal (`motion-below.tsx`, `BelowHeroMotion`, live pages only), cards lean toward the pointer on desktop (at most 6°), and the gallery variant `depth` (`depth-gallery.tsx`) stands up to 12 photos on a ring that turns by drag, swipe, the arrow keys, Home and End, a sideways scroll or its buttons, with only the front photo focusable and a live region for turns the visitor makes. Depth is drawn with gradients only. Thumbnails, galleries of fewer than 3 photos and reduced motion show the mosaic instead. Each ships its own `<style precedence>`, never per-template CSS.

Effects (`theme.effect`) draw particles on a canvas over live invitations and pause for reduced motion; design previews draw them inside the preview only. Particles pass behind words a section marks `data-effect-shelter` (the balcony hero's names and button): they fade out near them and are not drawn over them. A page that opens on a stage hero draws its effect inside the set instead (particles at depth), and no flat canvas.

Music comes from the admin-managed library: the host picks a track (`customization.musicId`, allowed when `capabilities.editable.music`; `null` switches the music off), or, while the host has chosen nothing, the template's `defaultMusicId` applies, or else the in-house track the template names by slug (`defaultTrack`, below). Only approved tracks with a current commercial, on-demand licence play (`RenderContextService.resolveMusic` checks all three the same way); the render context carries a short-lived signed URL.

#### In-house music

Bulava's own tracks are composed and synthesised by `infrastructure/scripts/compose-music.mjs` (Node 22, no dependencies, no samples or downloads), so the platform owns them outright. The script is a small synthesis engine (a tanpura with jawari shimmer; Karplus-Strong plucks for sitar, rabab, santoor with tremolo, swarmandal, ukulele, a folk lead and an upright bass; bansuri, a formant-shaped shehnai and sarangi, harmonium, pipe organ, strings, pads, a choir, a brass swell, piano, music box, celesta, bells, a temple bell, marimba, xylophone, timpani and a conch; tabla, dhol, daf, tasha, manjira, chimta, ghungroo, tambourine, shaker, claps, a cymbal and a soft kit; a Freeverb-style reverb and a stereo widener) and a catalogue of track data: a raga or scale over a tonic, tempo and meter, sections with drone or chord progressions (roman numerals with inversions, pedals, secondary dominants, borrowed chords and a key `shift`), written phrases (grace notes, murki, gamak, andolan, meend, runs, accents) and drum thekas with variations and tihais, the instruments and their levels. Timing and velocity are humanised from a seeded PRNG, so a run on one machine is byte-identical.

Every track is one loop, because invitations play the file with `<audio loop>`: it is a whole number of bars, its first beat comes 0.25 s in, its last chord rings to the end of the file, and whatever rings past the end (notes, reverb) is folded back onto its start; the fades at the seam (0.12 s in, 0.3 s out) only keep it from clicking. The master targets -16 LUFS integrated (BS.1770, K-weighted and gated), lifts a dark mix with a presence shelf and limits the true peak with a look-ahead limiter; the AAC file is then decoded again, and because AAC overshoots, a decoded true peak above -1.2 dBTP brings the limiter's ceiling down and the track is encoded again.

`node infrastructure/scripts/compose-music.mjs [--only key,key] [--out dir] [--wav] [--stems] [--notes] [--list] [--calibrate]` writes `<slug>.m4a` per track (AAC-LC 128 kbps, stereo, 44.1 kHz, through the FFmpeg that ships with Remotion for this platform) into `packages/database/seed-assets/music/`, prints each track's duration, loudness, decoded true peak (and FFmpeg's own measure of both), RMS, spectral balance and loop seam, and draws a spectrogram and waveform into `node_modules/.cache/signature3d/music/<slug>.png` for review; `--stems` adds every instrument's level and band balance, `--notes` every part's rhythm and range and, in the Western tracks, any strong-beat clash with the chords; `--calibrate` plays one note of every instrument (the instrument levels are set so these match); `--list` names the nineteen tracks (Shehnai Darbar, Mehfil-e-Santoor, Anand Dawn, Processional, A Promise in Strings, Carnival Tumble, Ballroom Waltz, Lori, Prabhat Bansuri, Ganga Bells, Gayatri Drone, Shubh Dhol, Sandhya Aarti, Roshni Dhamaal, Keynote, Alma Mater, Mela Chowk, Golden Veranda, Garden of Noor) and their occasions. Every track is a row of `ORIGINAL_TRACKS` in `packages/database/src/music-seed.ts` (slug, file, title, artist, duration): the production `migrate` job uploads them to R2 and adds them to the library, approved, with an owned licence (`SEED_ORIGINAL_MUSIC=true`, [deployment.md](deployment.md)); locally the same seed runs with `SEED_ORIGINAL_MUSIC=true` against SeaweedFS. The seed is idempotent, so a regenerated file is uploaded only where the object is missing.

A template picks its track with `music.defaultTrack` (the slug, e.g. `original-shehnai-darbar`), which needs no database id ([ADR-079](decisions.md#adr-079-in-house-music-synthesized-originals-and-a-templates-own-track-2026-10-22)). Pages and films share one resolver, `findDefaultTrack` (`apps/api/src/modules/templates/default-track.ts`): the template's `defaultMusicId`, else the track whose storage key is `music/<slug>.m4a`, each only if it passes the same gates as every played track (`isPlayableTrack`). A `defaultMusicId` that fails the gates (unapproved, its licence lapsed, gone from the library) logs a warning and falls through to the template's own `defaultTrack`, so the template keeps its music (before the shared resolver, pages played nothing then); when neither passes, the template plays nothing, never an error. `resolveMusic` uses it when the host chose nothing (a host who switched the music off hears none). Films resolve it when the film is requested (`VideosService.create`), not when it renders: the film request's `musicId` is tri-state (left out: the template's own track; `null`: no music; an id: the host's pick), the resolved id goes into the job's input snapshot, and the worker is unchanged. Only a `VIDEO` gets the template's track, and only when the plan includes music; a host's pick on a plan without music is refused (`PLAN_UPGRADE_REQUIRED`). The dashboard's film page offers *The template's own music* as the first choice, apart from *No music*, when the template has a track of its own.

## Films and cards

A video scene with a `backdrop` is filmed inside an illustrated scene:

- The art is laid out at phone size (432 px wide) and scaled to the frame, so proportions match the website hero.
- The camera moves each layer by its depth: `push` and `pull` zoom (centred higher for scenes hung from the top), `panLeft`/`panRight` glide across the panorama, `rise` and `descend` move vertically. `intensity` scales the move; `veil` darkens (or, on light scenes, lightens) the sky behind text.
- `particles` are drawn as a pure function of the frame (Remotion renders frames in any order), matching the website effects.
- Text elements shrink to fit (`overflow: 'shrink'`): lines are word-wrapped and measured in the real, loaded font in the renderer's browser, so long names and titles never clip.
- Entrances `blurIn`, `tracking`, `reveal`, `bloom` and `shine` (a band of light across gold names) add the cinematic feel; photos can sit in a gold `arch` or `circle` frame.

The catalog's film recipe (`filmScenes` in `templates/src/video.ts`) builds an opening, the names, the couple's photo in a jharokha arch, one card per function and a closing, each with its own scene, camera and particles. The premium recipe (`premiumFilmScenes`) cuts the same parts more cinematically: a halo blooms behind the blessing and a gold rule settles under the eyebrow, the names shine in turn with an "&" coming into focus, the photo sits in a gold arch, a gold ring or the noir scene's medallion, every function is a glass card between gold rules, and each part has its own camera. Its tests check that every film scene has a backdrop and that text and cards stay above the art.

A scene with `canvas` films a canvas artboard instead ([ADR-058](decisions.md#adr-058-canvas-invitations-become-films-2026-10-10)): the board fills the frame's width (a 9:16 board, 450 × 800, fills it exactly), its layers come in one after another (`stagger` seconds apart, top to bottom unless their own `animation.delaySec` says otherwise; a layer's own entrance, else words rise, photos open and art fades in; layers covering the board are there from the start), and `camera`/`intensity` drift over it. Buttons and the live countdown are left out of films. Hosts redraw any film's scenes in the film's canvas editor ([ADR-059](decisions.md#adr-059-every-website-and-every-film-can-be-designed-on-the-canvas-2026-10-11)): `sceneBoard` turns a scene of elements into a 9:16 board over its backdrop (entrances mapped to the nearest canvas entrance; `shine` becomes foil), and `withSceneCustomization` films the host's board with the camera still, over the backdrop's own move. **Canvas films** (`templates/src/canvas-films.ts`, keys `<design>-film`) are built from 27 canvas invitations (`CANVAS_FILM_SOURCES`): the opening, the function card per function, and a closing with the art, the photo and the names.

A scene can open under the same covers (`reveal`: `zipper`, `ribbon`): the cover is held, pulled open and moved off, and the scene's layers come in after it (`REVEAL_CONTENT_DELAY` in `video-engine/src/TemplateVideo.tsx`). A canvas film takes its first scene's reveal from its website's opening, and runs that scene two seconds longer (`REVEAL_EXTRA_SEC`).

Image cards (`DIGITAL_CARD`) render one scene as a still; *Royal Card* and *Temple Card* use a scene backdrop.

The Remotion project loads every font in `FONT_FAMILIES` (`apps/video-worker/remotion/fonts.ts`); add a loader there when you add a family.

To check a film or card change, render stills with sample data (one frame per scene, half size):

```bash
pnpm --filter @bulava/template-catalog build
node infrastructure/scripts/film-stills.mjs --out ./film-stills bansuri-video royal-card   # omit keys for all
node infrastructure/scripts/film-stills.mjs --stage --reveal --points 0.05,0.3,0.6,0.85 --out ./film-stills   # stage films, openings in steps
```

The script draws stage films with the worker's browser settings (`gl: 'swangle'`, CPU raster); the flags are in [testing.md](testing.md#signature-3d-stages). A scene with `backdrop.stage` is filmed in a 3D set ([Stages](#stages-signature-3d)).

## Faith

A design that clearly belongs to one tradition carries it in `theme.faith` (`hindu`, `muslim`, `sikh` or `christian`: `FAITHS` in `@bulava/template-schema`); designs that suit every family have none.

**How a template gets its faith.** `withFaith` (`templates/src/faith.ts`) decides it for the whole catalog, so no theme sets it by hand: the one faith its tags name, else the tradition its rites name (`nikah`, `walima`, `eid`: Muslim; `anand-karaj`, `gurpurab`: Sikh; `church`, `christmas`, `vow-renewal`: Christian; `griha-pravesh`, `namkaran`, `puja` and the other rites: Hindu), else Hindu for a wedding design of a Hindu regional tradition (South Indian, Kerala, Bengali, Marathi, Gujarati, Rajasthani…). A design tagged for two faiths (a mehendi for Hindu and Muslim brides) has none. A faith template then carries its faith as a tag (the galleries' tradition filter), `theme.faith`, and its tradition's wording: "The wedding of" becomes *The Nikah of*, *The Anand Karaj of* or *United in Holy Matrimony* (`template.nikah`, `template.anandKaraj`, `template.holyMatrimony`, in English and Hindi).

### The emblem

Faith templates of the occasions in `EMBLEM_CATEGORIES` (weddings and their functions, pujas and other religious events, thread ceremonies, mundans, naming ceremonies, baby showers and housewarmings; birthdays, anniversaries and festivals have their own art) wear their faith's emblem at the very top of the opening (`FAITH_EMBLEMS`): Lord Ganesha for Hindu families, the crescent and star for Muslim families, the Khanda for Sikh families and the cross with olive branches for Christian families, each drawn as a foil stamp in the design's metal (`art/illustrations-faith.tsx`). The rules, checked for every faith template by `templates/src/faith.test.ts`:

- At the very top, above every word, upright, whole and still: never rotated, flipped, cropped or moving, never behind or touching text, never at the foot.
- One size on every design: `EMBLEM_SIZE`, 48 design units on a phone board and 64 on a desktop board.
- Drawn over the art (the last layers of the board), standing on a seal (a disc of the stock ringed in the metal) where it sits over a toran, a garland, a border or busy art.

Where it comes from:

- **Drawn heroes**: the hero's `emblem` prop (`HeroEmblem` in `sections/hero.tsx`), stamped in the hero's gold, bronze or silver (`emblemMetal`; never in a palette's leaf green).
- **Factory templates**: the kit's `emblem`, which every composition places; the minimal layout moves its crest under the names to make room.
- **Hand-made canvas openings**: `EMBLEM_SLOTS` in `templates/src/faith.ts`: the emblem's place, a seal, and the layers that make room (moved, dropped or replaced: on Kovil Mani one set of temple bells becomes two with Ganesha between them; on Noor Mahal the crescent and star takes the moon's place in the sky).
- **Cards**: made from the openings (`cardFromTemplate`), so every card format carries the emblem.

### Faith themes

`templates/src/factory/themes-faith.ts` holds wedding themes made for one faith, each in its tradition's own vocabulary and suite: *Jaali* (an emerald nikah under a carved marble jaali, fanoos and a girih star) and *Firoza* (turquoise tile-work on ivory) in the `jaali` suite; *Amritsar* (royal blue, the Darbar Sahib shining on its sarovar) and *Kesri* (saffron and royal blue, phulkari and marigolds) in the `bagh` suite; *Covenant* (a stained-glass lancet, Madonna lilies and bells) in the `chapel` suite and *Lilium* (lilies on sage and blush watercolour) in the `floral` suite. They use three compositions made for them: `mehrab` (the photo in the jaali window, fanoos either side, domes at the foot), `darbar` (the Darbar Sahib across the foot, the names in foil above) and `lancet` (the photo in a stained-glass window, lilies at its foot). Muslim, Sikh and Christian families each have at least six wedding designs, every one its own look (the faith test checks it).

### Sample people

Every preview, editor and test builds its sample with `templateSampleContext(definition, …)`: a family of the template's tradition, chosen by its key, so each template always shows the same names and a gallery shows many (`sample-presets.ts`): the couple or the person celebrated, the parents in their tradition's order (the mother first for Hindu and Sikh families, the father first for Muslim and Christian ones: `mothersFirst`), the grandparents' blessings in the tradition's honorifics, the tradition's wedding functions (Haldi, Sangeet, Wedding, Reception; Mehndi, Nikah, Walima; Mehndi, Anand Karaj, Reception; Mehendi, Holy Matrimony, Reception), its verse and its wedding menu. A design that suits every family shows a family of one tradition, chosen by its key; Hindu regional designs show names of their region. No sample name is fixed in code. A template whose design has words of its own may say what its previews show (`definition.sample`, never a host's page): a programme for its schedule (`functions`: names at wall-clock times on the sample's first day, IST) and text for its slots (`custom`; an empty string leaves a slot empty, so a section falls back to the design's own words). The Sacred Garden previews an evening of five (Guest Arrival at 5 pm to Dance at 9 pm), its dress code and gift lines, and its own verse in place of the tradition's.

### Sample photos

Previews show real photographs, never drawn placeholders or data URIs (they would ride in every bundle): `sample-photos.ts` lists them, and `samplePhotoSet(typeKey, tradition, tags)` picks a template's cover, the couple's two portraits, its story, its closing photo and a gallery of four (or more) by occasion and tradition (festival tags choose that festival's; `palace` a royal Hindu wedding's: the bride's portrait for the story, the venue lit for the evening and a gallery of eight for a carousel): a couple in their tradition's wedding clothes, the bride and the groom, the wedding's moments and places (a mandap, the mosque beside the Taj Mahal, the Darbar Sahib, a church nave) for weddings; a baby, a cake, a mother-to-be or a puja's lamps for other occasions. The files are WebP (at most 1200 px on the long side, metadata removed) in `apps/web/public/samples` and the same in `apps/admin/public/samples` for Template Studio, served from `/samples/` (`SAMPLE_PHOTO_BASE`); a renderer without them passes an origin (`photoBase`: `film-stills.mjs` serves the folder while it renders).

Every photo is CC0 or public domain and is credited in `samples/CREDITS.md` (file, what it shows, author, source page, licence). To add or replace one: only photos whose licence allows use in Bulava without payment (CC0, public domain, or the Pexels, Unsplash or Pixabay licences through their APIs), never a web image search, no recognisable public figures, nothing undignified; re-encode it the same way, keep the file name (or update `SAMPLE_PHOTOS` with its size) and its line in both `CREDITS.md`. The Muslim and Sikh couples are shown by their hands and wedding clothes until licensed nikah and Anand Karaj couple photographs replace `muslim-couple`, `muslim-bride`, `muslim-groom`, `sikh-couple`, `sikh-bride` and `sikh-groom`.

The editors' empty photo spots keep their camera placeholder: a sample photo there would read as the host's own and then vanish from the preview and the download.

## Bindings

A binding is a dotted path resolved from a **RenderContext** the API builds after authorization, so it only contains what the viewer may see.

| Binding | Source |
|---|---|
| `event.title`, `event.description`, `event.startDate`, `event.endDate` | Event (dates from the functions this viewer can see) |
| `couple.partnerOne`, `couple.partnerTwo` (aliases `brideName`, `groomName`) | `Event.details` for couple types |
| `honoree.name` | `Event.details` for honoree types |
| `function.name`, `.description`, `.startsAt`, `.date`, `.time`, `.venue.name`, `.venue.address`, `.venue.city` | current function (per-function scenes) |
| `functions[0]` … `functions[3]` with `.name`, `.startsAt`, `.date`, `.time`, `.venue.name` | the first four functions the viewer can see, in order (timelines on cards and heroes; hide each row with `visibleWhen: { exists: 'functions[n].name' }`) |
| `functions`, `venue.*`, `announcements`, `gallery.images` | lists for sections |
| `photos`, `photos[0]` … | the host's chosen photos |
| `photo.cover`, `photo.partnerOne`, `photo.partnerTwo`, `photo.story`, `photo.closing`, `photo.venue` | photos placed in named spots (usually with a `photos[n]` fallback; never for `photo.venue`, so a portrait never stands in for the venue) |
| `guest.name` | personal invitations only (never public pages or link previews) |
| `custom.<key>` | a declared text slot |

A `{{template}}` can pipe a binding through a format, as a binding's `format` does: `{{event.startDate|date}}`, `|dateWithWeekday`, `|dateShort` (day and month: "14 Dec", for timelines), `|dateNumeric` (a printed card's "27.09.26"), `|time`, `|upper`, `|lower`, and `|initial` (a name's first letter, capitalised, for monograms: `{{couple.partnerOne|initial}} & {{couple.partnerTwo|initial}}`).

Unknown bindings and translation keys fail validation when a draft is saved or published, not at render time. Dates format through `@bulava/localization` in the event's time zone and language.

## Customization

`EventTemplateSelection.customization` (and a video job's customization) holds what the host changed. `validateCustomization` rejects anything the template's capabilities do not allow:

| Field | Needs | Effect |
|---|---|---|
| `colorPreset`, `colors` | `editable.colors` | a preset, then any of the four main colours on top of it (`effectiveColors`); inks are recomputed, so text stays readable |
| `fontPairing` | `editable.fonts` | one of `FONT_PAIRINGS` (royal, regal, romantic, classic, elegant, editorial, grand, desi, modern, playful, heirloom, engraved) |
| `photoSlots`, `photoIds` | `editable.photos` | photos placed in the template's `photoSlots`, and extra photos up to `maxPhotos` |
| `custom` | `editable.text` | text slot values |
| `intro`, `effect` | `editable.animation` | opening animation and ambient particles |
| `hiddenSections` | `editable.layout` | sections to leave out (never the hero) |
| `canvas` | `editable.layout` | the host's own artboards for canvas sections (by section id, `mobile` and `desktop`), drawn instead of the template's while they fit ([ADR-057](decisions.md#adr-057-hosts-edit-their-invitation-website-on-a-canvas-like-a-card-editors-come-light-or-dark-2026-10-10)) |
| `addedSections` | `editable.layout` | canvas sections the host added (`id` `my-…`, `after` a section id or empty for the end, a 390-wide `mobile` artboard; at most 20, a redrawn section `replaces` the one it stands in for), on any website template ([ADR-059](decisions.md#adr-059-every-website-and-every-film-can-be-designed-on-the-canvas-2026-10-11)) |
| `sectionOrder` | `editable.layout` | the host's order of the page's sections (template ids and their own, a redrawn section by the id it stands in for; at most 80); the opening stays first and the footer last ([ADR-065](decisions.md#adr-065-the-website-canvas-as-one-page-and-click-to-edit-any-template-section-2026-10-12)) |
| `scenes` | `editable.layout` (films) | a film's scenes the host redrew, by scene id: `{ board }` at the scene's size (a canvas film's board, else 450 × 800), filmed instead of the scene's own over its backdrop |
| `musicId` | `editable.music` | a licensed track |

The API also checks that placed photos are approved images of the same event and that a chosen track is licensed. A `canvas` customization is validated with the template: the section must be a canvas section of the template at the same size, and the template with the host's artboards in place must pass `validateTemplateDefinition` (known bindings and words, listed licensed assets, at most 120 layers); a button may link only to the event's own details (a binding) or keep the template's address. `fittingCanvasCustomization` keeps what still fits when a template changes; the renderer ignores the rest.

Template sections lay out by the width of the page they are drawn in, not the browser window: their responsive classes are container queries (`@min-[640px]:`, a container around the sections), so a phone-wide frame or preview shows the phone's layout on any screen. Screen-high heights (`h-[calc(var(--bulava-screen,1svh)*100)]`) read `--bulava-screen` when a frame sets it (the website canvas editor; a section layer's drawing). New sections follow both rules.

Hosts edit websites in the dashboard's **Design** page (tabs *Style*, *Photos*, *Words*, *Motion & music*, *Sections*, with a live preview, and **Design it on the canvas** for templates built from canvas sections: the full-screen canvas editor, `components/design/canvas-designer.tsx`, with the card editor's stage, inspector and panels, a Sections panel, phone and desktop artboards, light or dark) and films on the **Video & cards** page (*Style* and *Photos*, with a live Remotion preview). Photos uploaded there go to a hidden per-event room, *Design photos* (private, auto-approved, no QR code), through the normal signed-upload and processing pipeline; see [media.md](media.md).

## Marketing previews

The home page and `/templates` show templates as pre-rendered WebP images, not live renders: 28 live previews made the home page about 28,000 DOM elements and 4.9 MB of HTML, and a phone needed seconds to draw it; the scenes of 8 film posters made `/templates` 1 MB of HTML. The images live in `apps/web/public/template-previews/`:

- `<key>.webp`: a website's thumbnail, the top 390 × 780 CSS px at 2×;
- `<key>-full.webp`: the first 2600 px of the full preview, for the hero phone;
- `<key>-poster.webp`: a film's or card's scene with its title, at the gallery card's 220 × 400 CSS px, 2×. Films and cards without a scene keep their light gradient poster.

`apps/web/src/lib/template-previews.json` lists them with content hashes, which become `?v=` in the URL so a changed image is never served from an old cache. A template without an image is still shown, drawn live as before (a website card loads the template engine on demand through `LiveThumbnail`).

Galleries never load the whole catalog's definitions (with the factory they run to megabytes). `GET /public/templates` lists templates without them, with a `preview` (the theme's colours and the hero section's variant) for cards; `getGalleryTemplates` fetches definitions only for the templates that have no image yet (`?include=definition&keys=…`, at most 60 a request), and a template page or demo fetches its own. The dashboard's design picker lists summaries too and fetches the definition of the design being edited and the one focused in the picker. Every `TemplateCard` and `TemplatePhone` uses the images (including "more like this" on template pages); a template page's own preview, the demo and the dashboard's design picker keep rendering live.

After adding or changing a template, regenerate them and commit the images and the manifest:

```bash
# Terminal 1: the web app with the capture route on (it 404s otherwise)
TEMPLATE_PREVIEW_FRAMES=1 pnpm --filter @bulava/web dev
# Terminal 2 (API running too)
node infrastructure/scripts/template-previews.mjs                   # every template
node infrastructure/scripts/template-previews.mjs --only key1,key2  # just these
```

The script photographs `/preview-frame/<key>` (a bare page that only exists with `TEMPLATE_PREVIEW_FRAMES=1`; `?view=card`, `full` or `poster`) with reduced motion, so openings and entrances are already settled. Chrome composites on SwiftShader, as browsers with a GPU do (its software compositor leaves tiles of the stages' large 3D planes undrawn at phone width), and is relaunched every 40 pages. `--full` picks the templates that also get a long image (default `marigold-mahal`, the hero); a hero chosen in the console's Home page screen plays live until it has one. A full run deletes images of templates that are gone. Rebuild the web app afterwards: the manifest is compiled in.

## Quality gates

- **Schema and semantics**: `validateTemplateDefinition` (structure, bindings, translation keys, unique ids).
- **Test matrix**: `runTemplateChecks` resolves every prop and element for English, Hindi and Hinglish × short and long names × with and without photos × the template's event types, and reports empty required content, overflow risks and canvas text set below AA contrast. The catalog test runs it for every template; Template Studio runs it before publishing.
- **Licences**: publishing refuses assets that are unapproved, unlicensed for commercial on-demand use, or expired ([template-studio.md](template-studio.md)).
- **Browser checks**: `ui-smoke.mjs` renders the catalog, template pages, openings, the dashboard design tab and live invitations in Chrome and fails on any console or hydration error.
- **Stages**: `stage/stage.test.ts` holds every set to the caps, the markup rules and the words zones, and the per-template checker (`templates/src/stages/stage-template.test.ts`) each stage template to its occasion, its film and the Signature rules ([Stages](#stages-signature-3d)).
- **Accessibility**: `pnpm a11y` runs axe (WCAG 2.1 A + AA) on every template's full preview and every opening overlay; a new section or hero variant must pass it ([testing.md](testing.md#browser-smoke-tests)).

Published versions are immutable. Editing creates a draft that becomes version N+1 when published; events keep the version they selected until the host re-selects the template.
