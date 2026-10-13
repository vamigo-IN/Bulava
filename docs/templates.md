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
- **The Signature collection** (tag `signature`) are "experience" websites with their own opening animation, the host's music, a verse, the menu, a countdown and RSVP.
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
  music?: { defaultMusicId?: uuid; allowCustomerChoice: boolean };
  website?: { intro: Intro; pages: { id; sections: SectionInstance[] }[] };
  canvas?: { width; height; fps };
  scenes?: Scene[];
};

type Look = 'classic' | 'heritage' | 'noir' | 'royal' | 'garden' | 'celebration' | 'modern';
type Ornament = 'none' | 'mandala' | 'paisley' | 'floral' | 'geometric' | 'confetti' | 'lotus' | 'peacock' | 'stars' | 'laurel'
              | 'temple' | 'kasavu' | 'jaali' | 'marigold' | 'bagh' | 'rangoli' | 'deco' | 'clouds' | 'chapel';
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
| `countdown` | live timer to the first function | `default`, `flip` (flip-clock digits), `rings` (each number in a double ring), `calendar` (the month printed like a calendar page, the day ringed) |
| `couple` | partners with their photos and their parents ("Daughter of / Son of", [below](#the-parents)) | `default` (round portraits in the suite's seal), `stacked`, `portraits` (alias `arch`: tall frames in the suite's shape), `duet` (two round portraits overlapping, the families side by side), `monogram` (the names either side of a seal with their initials), `flip` (3D cards that turn over to the parents), `profile` (editorial rows) |
| `story` | text with a photo | `default` (the photo in the suite's frame), `letter` (a letter on paper, the photo pinned above it), `curtain` (tap to reveal), `polaroid` |
| `parents`, `family` | the blessings | `default` (the text), `blessings` (each family's parents under the couple's names, the suite's seal between, then the text) |
| `eventTimeline` | only the functions this viewer may see, each with a motif picked from its name | `cards`, `timeline` (the suite's glyph on every node), `frames` (cards in the suite's shape), `tiles`, `tickets`, `diya` |
| `menu` | "Course \| dishes" lines from a text slot, on a card in the suite's shape | default |
| `venue`, `map` | venue card with directions | `default` (a card under the suite's seal), `illustrated` (the suite's foot art standing on the card), `postcard` (an address card with a stamp and a postmark) |
| `gallery` | approved photos the viewer may see | `default`, `frames` (a wall of the suite's frames), `stack` (swipeable 3D stack), `mosaic`, `polaroid` |
| `accommodation`, `travel`, `giftRegistry` | text slots, in a card under the suite's seal | default |
| `announcements` | published updates for this viewer | default |
| `rsvp` | the host app injects the RSVP form (or the public registration form) on a light reply card | `default`, `card` (the card in the suite's shape, its seal pressed onto the top edge) |
| `photoShare` | QR photo rooms for this guest | default |
| `footer` | closing line and photo, hashtag, check-in QR, watermark | `default`, `seal` (the couple's initials on the suite's seal, strands hanging either side), `skyline` (the suite's art along the foot), `blessing` (the closing line large, the names) |

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

**Swapping pieces.** `theme.dress` swaps single pieces for others, so two designs in one suite still differ: `frame` (jharokha, niche, mihrab, lancet, arch, oval, circle, scallop, ticket, deco, double, cloud, rounded), `edge`, `seal` (`emblem` sets the suite's own emblem in a double ring), `skyline`, `corner`, `divider` (the `SUITE_*` enums in `@bulava/template-schema`, which Template Studio offers; unset pieces stay the suite's own).

**How a template picks its suite.**

- **Factory themes** name it (`suite` in `themes-*.ts`, from the kit's art: a jharokha and elephants take `mandala`, a temple `temple`, Kerala `kasavu`, a nikah `jaali`, phulkari `bagh`, marigolds `marigold`, a church `chapel`…) and may swap pieces (`dress`); a theme that shares a suite with another of its occasion swaps a piece or two. Each **composition** lays the sections out its own way (`templates/src/factory/arrangements.ts`): a jharokha hero keeps its windows for the couple's portraits and closes on the suite's skyline, a night hero overlaps two round portraits and swipes through the photos, a photo hero turns its portraits over like prints, a minimal hero stays quiet (no border or corners). A theme that lays one composition out twice gives the second another arrangement. A layout may swap pieces too (`dress` on the layout).
- **Hand-made websites** (`website.ts`, `signature.ts`) set `ornament`, `dress` and each section's variant in their specs; **canvas collections** (`canvas-cards.ts`, `premium-cards.ts`, `canvas.ts`) set `ornament`, `dress`, `heroTone` and `closing` (the RSVP's and the footer's variants) beside their sections.
- **Dark stock.** A hero on dark stock (a dark kit, a night sky, a temple at dusk) sets `heroTone: 'dark'`, so the royal, classic, garden and modern looks carry the dark stock down the page (the primary band alternating with a deeper one) and function cards sit on the deep band on wide screens.

#### The parents

The couple's details carry each partner's father and mother ([ADR-068](decisions.md)); they fill `custom.partnerOneParents` and `custom.partnerTwoParents` as one line each, in the order the design's tradition writes them (the mother first for Hindu, Sikh and other designs, the father first for Muslim and Christian ones: `mothersFirst` in `context.ts`), unless the host wrote their own lines. Every couple section and the family section's `blessings` layout bind those slots, never the four names. Under each partner's name a small label (`template.couple.daughterOf` / `sonOf`: "Daughter of" / "Son of", सुपुत्री / सुपुत्र; the first partner is the bride, as the event form asks) sits over the parents' names on two lines, the second led by a script ampersand. The `duet` layout sets both families side by side under the names, the `blessings` layout under each family's name (`template.family.of`). An empty line shows nothing, label included. Names and verses use the heading face where it is a book face (italic only where it has a true italic, Cormorant Garamond) and the body face under a display heading such as Cinzel's capitals; Devanagari labels are set larger and unspaced (`labelClass`).

### Canvas sections

A `canvas` section is a free-form design: the Studio's Canvas editor ([template-studio.md](template-studio.md#canvas-editor)) lays out layers on fixed artboards instead of filling a prebuilt layout. The section carries `canvas.mobile` (an artboard, usually 390 × 844 design units) and optionally `canvas.desktop` (usually 1440 × 900); without a desktop artboard the phone design is shown centred at `desktopMaxWidth` on wide screens, on its own background. `repeatPerFunction` renders the artboard once per function the viewer may see, with `function.*` bound to each: the card-per-function invitations. The schema is `packages/template-schema/src/canvas.ts`; the renderer is `packages/template-engine/src/canvas/`.

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

`template-engine/src/art/illustrations-*.tsx` draws 81 full-colour illustrations in code (`ILLUSTRATIONS` in the schema):

- **Royal and floral**: a caparisoned elephant, a royal peacock with a tiered train, a jharokha (`JHAROKHA_OPENING` says where a photo sits behind it), rose clusters, floral garlands and doves.
- **Ornament**: an ornate frame, filigree corners, a flourish, a medallion, a paisley, an arabesque and domes.
- **Ritual and region**: temple bells, jasmine strings, banana leaves, a kolam, a rangoli and a hand painted with mehendi.
- **Celebration**: wedding rings, a cake, balloons, bunting, a gift box, fairy lights, a moon on a cloud, a house and a row of diyas.
- **People** (`illustrations-people.tsx`, `illustrations-family.tsx`): eight couples (a Hindu bride in lehenga and her groom in safa, after the varmala, Sikh, nikah, South Indian, Christian, Bengali in topor and mukut, and a couple who have shared a lifetime), the bride and the groom as portrait busts, a girl and a boy in party hats, a baby in a cradle and a mother-to-be in a silk saree. The tint is the outfit.
- **Props** (`illustrations-props.tsx`): a stork with a bundle, a teddy bear, a unicorn, a little dinosaur, a rocket, a cupcake, a bridal doli, a dhol, an urli of haldi and a champagne toast.
- **Stationery** (`illustrations-heirloom.tsx`): gold line art for foil-stamped cards: a mandala crown with a lotus-bud pendant and its half for the foot, a double hairline frame and an art deco frame (both drawn to the whole card, so every card format keeps its margins), a floral gold vine for the sides, scattered sparkles and a botanical wreath tied with a ribbon.
- **Faith** (`illustrations-faith.tsx`, `illustrations-sacred.tsx`): the four emblems ([Faith](#faith): Lord Ganesha, the crescent and star, the Khanda, the cross with olive branches), drawn as foil stamps in one metal; and each tradition's wedding art: a girih rosette (an eight-fold Islamic star), a jaali mehrab window in marble and gold (its opening takes a photo, `JAALI_ARCH_OPENING`), a fanoos lantern, the Darbar Sahib on its sarovar, a phulkari bagh medallion, a stained-glass lancet window (its opening takes a photo, `LANCET_OPENING`), Madonna lilies and wedding bells.
- **Regional** (`illustrations-regional.tsx`): one tradition each: a South Indian prabhavali (its opening takes a photo, like the jharokha), a brass kuthuvilakku, a Kanjeevaram zari border, a Mughal mihrab, a phulkari border, a Bengali alpana and lal paar border, marigold swags, a marigold wreath and a strand of ghungroo. Borders, frames, vines and swags are drawn to the layer's size (`FRAME_SIZED`); the editors' add menus put frames around the whole board, borders across the top and strands down a side.

The layer's colour is the illustration's main colour (the elephant, the train, the leaves, the henna) and the palette colours the rest, so a colour preset restyles the art like the text. Real flowers and flames keep their own colours (`NATURE` in `art/kit.tsx`). Garlands, strings and frames are drawn to the layer's size (`FRAME_SIZED`); the others keep their proportions (`ILLUSTRATION_ASPECT`, which also sizes new layers in the editor).

Illustrations follow the rules for scene art. `art/kit.tsx` has the shared pieces:

- `taper` (a filled stroke that narrows along Bézier curves);
- `onCubic` and `frameAt` (a point on a curve and an SVG transform aligned to it, for patterns that follow a finger or a feather);
- `Metal` (a foil gradient in the illustration's own coordinates, so straight lines and dots take it too) and `Lit` (a colour lit from one side).

The curve helpers use only arithmetic and square roots, so the server and every browser draw the same picture. To add one:

1. Add it to `ILLUSTRATIONS`.
2. Add it to the component map in `art/illustrations.tsx` and to `ILLUSTRATION_ASPECT`.
3. Check it in the editor's add menu, which shows a preview of each.

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

Template Studio's *Import card JSON* turns a card made in another tool into a canvas template draft ([ADR-056](decisions.md#adr-056-card-json-becomes-a-canvas-template-draft-cards-carry-up-to-four-functions-2026-10-10)). The JSON has a `canvas` (`width`, `height`, `background`), a `theme` (colours and `fontHeading`, `fontBody`), `data`, `assets` and `elements`, each with a `kind` (`rect`, `circle`, `line`, `image`, `text`, `button`), a `frame` (`x`, `y`, `w`, `h`), a `style` and `content` (`text`, a `binding`, or an image's `src`). `importCardJson` maps:

| JSON | Canvas template |
|---|---|
| `theme` colours (`primary`, `gold`, `goldLight`, `background` or the canvas's, `secondary`, `text`, `goldDark`) | palette roles (`primary`, `secondary`, `accent`, `background`, `surface`, `text`, `muted`); an element painted in one of them keeps the role |
| `theme.fontHeading`, `fontBody` | the heading and body fonts; a script heading (Great Vibes, Pinyon Script…) becomes the script font; a family outside Bulava's 21 becomes the body font, with a warning |
| `couple.displayName`, `wedding.dateLabel`, `wedding.venue` | `{{couple.partnerOne}} & {{couple.partnerTwo}}`, `event.startDate` (date format), `{{venue.name}}, {{venue.city}}` |
| `events.N.name`, `.date`, `.time`, `.venue` | `functions[N].*`, shown only when that function exists |
| other text bindings | a text slot (`custom.<key>`) holding the JSON's words |
| `image` with a photo binding | a photo spot (`photo.cover`, `photos[0]` …) |
| `image` with `asset:<id>` | that licensed asset |
| any other `image` | the nearest drawn art (mandala, floral border, sparkles…) or the artboard's paper texture, listed as a stand-in |

The draft is a website (canvas hero, timeline, venue, RSVP, footer) and so also a digital card. Its phone artboard keeps the JSON's canvas size; it has no desktop artboard, so wide screens show the phone design (up to 480 px wide, `desktopMaxWidth`) until staff draw one in the Canvas editor. Review the stand-ins, replace them with licensed art if the design needs the original pictures, run the checks and publish.

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

The catalog's film recipe (`filmScenes` in `templates/src/video.ts`) builds an opening, the names, the couple's photo in a jharokha arch, one card per function and a closing, each with its own scene, camera and particles. The premium recipe (`premiumFilmScenes`) cuts the same parts more cinematically: a halo blooms behind the blessing and a gold rule settles under the eyebrow, the names shine in turn with an "&" coming into focus, the photo sits in a gold arch, a gold ring or the noir scene's medallion, every function is a glass card between gold rules, and each part has its own camera. Its tests check that every film scene has a backdrop and that text and cards stay above the art.

A scene with `canvas` films a canvas artboard instead ([ADR-058](decisions.md#adr-058-canvas-invitations-become-films-2026-10-10)): the board fills the frame's width (a 9:16 board, 450 × 800, fills it exactly), its layers come in one after another (`stagger` seconds apart, top to bottom unless their own `animation.delaySec` says otherwise; a layer's own entrance, else words rise, photos open and art fades in; layers covering the board are there from the start), and `camera`/`intensity` drift over it. Buttons and the live countdown are left out of films. Hosts redraw any film's scenes in the film's canvas editor ([ADR-059](decisions.md#adr-059-every-website-and-every-film-can-be-designed-on-the-canvas-2026-10-11)): `sceneBoard` turns a scene of elements into a 9:16 board over its backdrop (entrances mapped to the nearest canvas entrance; `shine` becomes foil), and `withSceneCustomization` films the host's board with the camera still, over the backdrop's own move. **Canvas films** (`templates/src/canvas-films.ts`, keys `<design>-film`) are built from 14 canvas invitations: the opening, the function card per function, and a closing with the art, the photo and the names.

Image cards (`DIGITAL_CARD`) render one scene as a still; *Royal Card* and *Temple Card* use a scene backdrop.

The Remotion project loads every font in `FONT_FAMILIES` (`apps/video-worker/remotion/fonts.ts`); add a loader there when you add a family.

To check a film or card change, render stills with sample data (one frame per scene, half size):

```bash
pnpm --filter @bulava/template-catalog build
node infrastructure/scripts/film-stills.mjs --out ./film-stills bansuri-video royal-card   # omit keys for all
```

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

Every preview, editor and test builds its sample with `templateSampleContext(definition, …)`: a family of the template's tradition, chosen by its key, so each template always shows the same names and a gallery shows many (`sample-presets.ts`): the couple or the person celebrated, the parents in their tradition's order (the mother first for Hindu and Sikh families, the father first for Muslim and Christian ones: `mothersFirst`), the grandparents' blessings in the tradition's honorifics, the tradition's wedding functions (Haldi, Sangeet, Wedding, Reception; Mehndi, Nikah, Walima; Mehndi, Anand Karaj, Reception; Mehendi, Holy Matrimony, Reception), its verse and its wedding menu. A design that suits every family shows a family of one tradition, chosen by its key; Hindu regional designs show names of their region. No sample name is fixed in code.

### Sample photos

Previews show real photographs, never drawn placeholders or data URIs (they would ride in every bundle): `sample-photos.ts` lists them, and `samplePhotoSet(typeKey, tradition, tags)` picks a template's cover, the couple's two portraits, its story, its closing photo and a gallery of four by occasion and tradition: a couple in their tradition's wedding clothes, the bride and the groom, the wedding's moments and places (a mandap, the mosque beside the Taj Mahal, the Darbar Sahib, a church nave) for weddings; a baby, a cake, a mother-to-be or a puja's lamps for other occasions. The files are WebP (at most 1200 px on the long side, metadata removed) in `apps/web/public/samples` and the same in `apps/admin/public/samples` for Template Studio, served from `/samples/` (`SAMPLE_PHOTO_BASE`); a renderer without them passes an origin (`photoBase`: `film-stills.mjs` serves the folder while it renders).

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
| `photo.cover`, `photo.partnerOne`, `photo.partnerTwo`, `photo.story`, `photo.closing` | photos placed in named spots (usually with a `photos[n]` fallback) |
| `guest.name` | personal invitations only (never public pages or link previews) |
| `custom.<key>` | a declared text slot |

A `{{template}}` can pipe a binding through a format, as a binding's `format` does: `{{event.startDate|date}}`, `|dateWithWeekday`, `|dateShort` (day and month: "14 Dec", for timelines), `|time`, `|upper`, `|lower`, and `|initial` (a name's first letter, capitalised, for monograms: `{{couple.partnerOne|initial}} & {{couple.partnerTwo|initial}}`).

Unknown bindings and translation keys fail validation when a draft is saved or published, not at render time. Dates format through `@bulava/localization` in the event's time zone and language.

## Customization

`EventTemplateSelection.customization` (and a video job's customization) holds what the host changed. `validateCustomization` rejects anything the template's capabilities do not allow:

| Field | Needs | Effect |
|---|---|---|
| `colorPreset`, `colors` | `editable.colors` | a preset, then any of the four main colours on top of it (`effectiveColors`); inks are recomputed, so text stays readable |
| `fontPairing` | `editable.fonts` | one of `FONT_PAIRINGS` (royal, regal, romantic, classic, elegant, editorial, grand, desi, modern, playful) |
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

The script photographs `/preview-frame/<key>` (a bare page that only exists with `TEMPLATE_PREVIEW_FRAMES=1`; `?view=card`, `full` or `poster`) with reduced motion, so openings and entrances are already settled. `--full` picks the templates that also get a long image (default `marigold-mahal`, the hero); a hero chosen in the console's Home page screen plays live until it has one. A full run deletes images of templates that are gone. Rebuild the web app afterwards: the manifest is compiled in.

## Quality gates

- **Schema and semantics**: `validateTemplateDefinition` (structure, bindings, translation keys, unique ids).
- **Test matrix**: `runTemplateChecks` resolves every prop and element for English, Hindi and Hinglish × short and long names × with and without photos × the template's event types, and reports empty required content, overflow risks and canvas text set below AA contrast. The catalog test runs it for every template; Template Studio runs it before publishing.
- **Licences**: publishing refuses assets that are unapproved, unlicensed for commercial on-demand use, or expired ([template-studio.md](template-studio.md)).
- **Browser checks**: `ui-smoke.mjs` renders the catalog, template pages, openings, the dashboard design tab and live invitations in Chrome and fails on any console or hydration error.
- **Accessibility**: `pnpm a11y` runs axe (WCAG 2.1 A + AA) on every template's full preview and every opening overlay; a new section or hero variant must pass it ([testing.md](testing.md#browser-smoke-tests)).

Published versions are immutable. Editing creates a draft that becomes version N+1 when published; events keep the version they selected until the host re-selects the template.
