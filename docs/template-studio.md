# Template Studio and the admin console

`apps/admin` is the staff console, served at `admin.bulava.in` (port 3001 locally). It is a separate Next.js app that proxies `/api/v1` to the API, so staff sessions are first-party on the admin domain and never shared with the customer site.

## Access

Only accounts with a platform role can use the console. There are six roles, each limited to its own area; the full permission table is in [authorization.md](authorization.md#platform-roles), and roles map to permissions in `packages/auth/src/permissions.ts`:

| Role | Can |
|---|---|
| Super Admin | everything, and alone: site settings and integrations, staff roles, complimentary upgrades. Exactly one account holds it |
| Platform admin | everything except the Super Admin's three areas |
| Finance manager | orders, payments, refunds, plans and coupons |
| Content manager | templates, design assets, music, testimonials, photo moderation |
| Support | look up accounts, events and payments; photo moderation |
| User | nothing (the console shows "no admin access") |

`GET /users/me` returns `platformPermissions`, which the console uses to show navigation. That is a UI hint only: every `/admin` route is guarded by `@RequirePlatformPermission`, and `PlatformPermissionGuard` re-reads the role from the database on each request, so a role change takes effect immediately.

### The Super Admin and the first staff

The seed creates or promotes the owner account from the environment, and makes it the Super Admin while the platform has none:

```bash
# .env (never commit real values)
ADMIN_EMAIL=admin@bulava.in
ADMIN_PASSWORD=<at least 10 characters>
pnpm db:seed           # idempotent; runs in the migrate container on every deploy
```

An existing account is promoted but keeps its password unless `ADMIN_RESET_PASSWORD=true`. Once the Super Admin has handed the role to someone else (Staff & roles), the seed leaves it alone: the seeded account stays a Platform admin.

Day to day, the Super Admin gives and changes staff roles in **Staff & roles** (the person signs up on the website first). For recovery on the server, for example when the only Super Admin has lost access:

```bash
pnpm admin:set-role someone@example.com SUPPORT                # USER | SUPPORT | CONTENT_MANAGER | FINANCE_MANAGER | PLATFORM_ADMIN
pnpm admin:set-role owner@example.com SUPER_ADMIN --replace    # moves the Super Admin role; the current one becomes PLATFORM_ADMIN
```

Every path writes to the audit log, and `set-role` signs the people it changes out everywhere.

## Pages

| Page | What it does | Permission |
|---|---|---|
| Overview | users, events, invitations, RSVPs, revenue, conversion, renders, storage, popular templates and languages, queue health | `admin.read` |
| Template Studio | create, duplicate, edit, check, publish, unpublish, archive templates | `template.manage` |
| Design assets | upload images, SVG, video, audio and fonts with licence metadata; approve, reject, archive; correct licences | `asset.manage` |
| Music library | upload licensed tracks, preview, approve; correct licences | `asset.manage` |
| Licence alerts | licences expired or expiring within 30 days, with the templates that use them | `asset.manage` |
| Plans & coupons | prices, descriptions, feature limits per plan; coupons (percent or amount, limits, validity) | `pricing.manage` |
| Orders | every checkout and complimentary upgrade with a readable payment state; filters by state, kind and customer; revenue totals; refunds through the gateway; revoking complimentary upgrades | `billing.read` (refund needs `payment.refund`, revoke needs `plan.grant`) |
| Users | search, filter by role, suspend (signs out everywhere); open a profile | `admin.read` (suspending customers needs `user.manage`; staff accounts and roles need `staff.manage`) |
| User profile | account and sign-in details, totals, events with their plan and the templates they use, payment history, current paid access, complimentary upgrades, signed-in devices, recent activity | `admin.read` (payments need `billing.read`, upgrades `plan.grant`) |
| Staff & roles | the Super Admin and the handover; staff with role changes, two-step reset and sign-out; adding staff; what each role can do | `staff.manage` |
| Website: Branding & contact | site name, tagline, theme colour, logo, favicon and share image, support contacts, WhatsApp chat button, announcement bar, social profiles | `settings.manage` |
| Website: SEO & AI search | titles, description, keywords, indexing switch, extra blocked paths, search-engine verification, business details, AI crawlers allowed or blocked, `llms.txt` | `settings.manage` |
| Website: Tracking & code | Google Analytics, Tag Manager, Google Ads, Meta Pixel, Clarity, LinkedIn, PostHog; header and footer code with the hosts it may load from | `settings.manage` |
| Website: Integrations | Razorpay, email (SMTP), WhatsApp Business, Google Maps, custom domains, with a live *Test connection* each; storage (read-only, tested end to end) | `settings.manage` |
| Photo moderation | platform-wide queue of photos waiting for approval | `media.moderate` |
| Testimonials | real, consented reviews only; the consent date is required | `content.manage` |
| Queues & renders | BullMQ counts per queue; failed renders with retry | `admin.read` (retry needs `template.manage`) |
| Audit log | security-relevant actions, filterable by action prefix and event | `admin.read` |

## Template workflow

Templates are data (see [templates.md](templates.md)). A template has immutable **published versions** and at most one **working draft**.

1. **Create** a template, or **duplicate** one. A new template starts from a copy of an existing one, or blank: a **blank canvas** (the default) opens straight in the [Design Studio](#design-studio) with plain boards to design on (a website's opening and function card, then RSVP and footer; a film's 9:16 opening and function scenes; a card in portrait 4:5, square, story 9:16 or landscape 5:4), or **ready-made sections** (websites) and **film elements** (films and cards).
2. **Edit** the draft in the Studio:
   - *Details* — catalog listing (name, category, style, tier, badge, featured, tags, event types, sort order) saves immediately and does not create a version. The definition's display name, description and supported languages are part of the draft.
   - *Theme & fonts* — colours, corner radius, ornament, background pattern, hero tone, opening animation, and fonts with a Devanagari fallback.
   - *Sections* (websites) — add, reorder, remove sections, pick a layout variant, and edit each section's content bindings as JSON. A *canvas* section is a free-form design and opens in the [Design Studio](#design-studio).
   - *Scenes* (videos and cards) — canvas size and fps, scene length, background, transition, the illustrated scene the scene is filmed in with its camera move, particles, per-function repetition, and element JSON. *Design* opens a scene in the Design Studio; a new scene is an empty board there.
   - *Artwork* — painted scenes from commissioned layers (approved image assets, category `artwork`): order, depth and label per layer, loading colour, light or dark text, where text starts; then *Use as website hero* or *Use behind every scene*. It keeps the definition's `assets` in step so publishing checks every layer's licence, and flags layers that are not approved or not 3:2. See [templates.md](templates.md#painted-artwork) and the artist brief, [illustration-brief.md](illustration-brief.md).
   - *Customization* — what customers may change (colours, photos, text, music…), custom text fields and colour presets.
   - *JSON* — the whole definition, validated before it is applied.
3. **Preview** live while editing: websites render with sample data for any event type, in English, Hindi or Hinglish, with long names or no photos, on a phone or desktop frame, and can replay their opening animation. Videos and cards play in the Remotion player.
4. **Save draft.** Structure must be valid; semantic problems (unknown bindings or translation keys) come back as warnings.
5. **Run checks.** Validation, asset licences, and the test matrix: every language × short/long names × with/without photos × the template's event types. Each case lists required content that resolved to nothing and text at risk of overflowing.
6. **Publish.** Publishing is refused while validation or licence problems remain. The draft becomes the live version; events already using an older version keep it until the host re-selects the template.
7. **Unpublish** hides a template from the catalog without affecting events that use it. **Archive** retires it.
8. **Delete** (on the Templates list) soft-deletes a lookalike: it leaves the catalog, the pickers and the live list, the catalog seed never brings it back, and events using it keep their pinned version. The *Deleted* view lists deleted templates with **Restore**, which brings one back unpublished; it cannot be published while deleted.

Every create, publish, status change, delete, restore and listing change is written to the audit log, and the public catalog cache is invalidated on publish, delete and restore.

### Design Studio

*Design Studio* (in the Studio's header, on any canvas section, or *Design* on a scene) opens the full-screen editor for every board of the template, after Canva ([ADR-075](decisions.md#adr-075-the-design-studio-and-designs-from-other-software-2026-10-19)). It works on the same draft as the Studio, so Save draft, checks and publishing are unchanged, and Ctrl+Z undoes any change made in it. What a board stores is in [templates.md](templates.md#canvas-sections).

- **Pages** (the strip along the foot): a website's canvas sections and a film's or card's scenes, each drawn small. *Add page* puts an empty board after the current one (a canvas section before the RSVP and footer; a scene in the frame's shape: 450 wide, 9:16 for films, the card's own frame), and the current page can be duplicated, moved earlier or later, or deleted. A scene made of film elements shows its elements laid out as layers; *Move onto the canvas* makes them layers to edit. A scene's illustrated backdrop is drawn behind its board.
- **Elements** (left): search everything the engine draws by name or by what it is for (*zip*, *frame*, *faith*…), or browse text styles, photo spots, shapes, illustrations, ornaments, icons, scenes and widgets, each previewed as the engine draws it. Click to add in the middle of the page, or drag onto the page to drop it where it goes. *Photos* adds library images (licensed assets) or spots for the host's own photos; *Layers* lists the page's layers (Shift-click to pick several; drag to reorder; hide and lock); *Import* brings in designs from other software ([Imports](#imports)).
- **The page**: sample data as in the preview (language, event type, long names, no photos). Click to pick a layer, Shift- or Ctrl-click to add one, or drag a box over empty board to pick every layer it touches. Drag to move, handles to resize (Shift keeps proportions; corners of a group keep them and scale its words too), the ring to rotate (Shift snaps to 15°). Layers snap to the board's edges and centre and to each other (Alt disables). Double-click words with fixed text (or a `{{template}}`) to type them on the page; Ctrl+Enter or clicking away keeps them, Escape drops the change.
- **Several layers** get a toolbar: align (to each other, or to the page for one layer), space evenly (three or more), group (Ctrl+G; grouped layers are picked, moved and resized together, `layer.group`) and ungroup (Ctrl+Shift+G), bring to front, send to back, lock, duplicate (Ctrl+D) and delete. Ctrl+C / Ctrl+X / Ctrl+V copy, cut and paste through the clipboard (as JSON), so layers move between pages, templates and browser tabs; pasted onto a board of another width they are scaled, and they always land on the page.
- **Zoom**: Fit, the zoom steps, Ctrl+= / Ctrl+- / Ctrl+0, or Ctrl+wheel at the pointer; hold Space (or the middle button) and drag to pan.
- **Properties** (right): with nothing picked, the board (size, fill, paper texture, ambient effect) and the page: a section's settings (repeat once per function, desktop artboard) or a scene's (length, how it comes in, how it opens: a zipper or a ribbon, particles, camera move and strength, the gap between layers' entrances, once per function). With a layer picked, its position, size, blend and own properties, when it shows and its animation.
- **Images**: library images are placed through the picker (approved first; uploads take their licence). Every image on any board is listed in the definition's `assets` (role `canvas`), so publishing checks each licence; an unapproved image can be placed but blocks publishing until it is approved.
- **Phone first**: every canvas section has a phone board; the desktop board is optional, and without one the phone design is shown centred on wide screens.

### Imports

The Design Studio's *Import* tab (or a file dropped on the page) reads a design made elsewhere in the browser (`canvas-editor/import/`); nothing leaves the browser until it is placed. It shows what it found (pages, words, shapes, pictures) and what could not come across, then places it as new pages (after the current page) or on the current page (its first page, fitted inside the board).

| Made in | Export | What comes in |
|---|---|---|
| Canva, Illustrator (an `.ai` saved with PDF content), InDesign, Affinity, CorelDRAW | PDF | each page: its art as one picture, its words as text layers in their font, size, colour and spacing (read from where the words were drawn), turned words turned |
| Figma, Illustrator, Inkscape, CorelDRAW, Canva | SVG | words as text layers, plain rectangles, circles and lines as shapes, embedded photos as pictures, and the art between them as pictures, in paint order. Files are cleaned first: drawing only, no scripts, handlers, outside links or foreign content |
| Photoshop, Affinity, Photopea, Procreate | PSD | every visible layer in its place, groups kept as groups, layer masks and clipping masks applied, blend modes, type layers as text layers. Layer styles and adjustment layers are listed as left out |
| PowerPoint, Keynote, Google Slides, Canva | PPTX | each slide over its layout's and master's art: text boxes, shapes, pictures (cropped and masked), groups, backgrounds, theme colours and fonts. Tables, charts and SmartArt are listed as left out |
| anything | PNG, JPG, WebP | the picture, on a page of its shape |
| Bulava | JSON | layers copied from a board, or a whole board |

- **Fonts**: a font the template uses takes that role (heading, body, script), so it follows the host's font pairing; one of the engine's families is kept; any other becomes the role of its kind (scripts, serif headings, sans body text). Check the words' fonts after importing.
- **Colours** close to one of the template's colours take its name (*Use the template's colours where they are close*), so they follow the host's colour choices; the rest keep their exact colour.
- **Words** come in as fixed text. Bind names, dates and venues to the event in Properties (or retype them as `{{couple.partnerOne}}`…) before publishing.
- **Pictures** are uploaded to the library as licensed assets (category `canvas`, tagged `imported`) with one licence given for the whole file, and wait for review in Assets like any other upload.
- **Other formats**: CorelDRAW (`.cdr`), Figma, Sketch and XD files, and Keynote decks are read only by their own software; the Studio says what to export instead.
- **Without editable words** (*Keep words editable* off), PDF and PSD pages come in as one picture each, exactly as designed.

## Assets and licences

Uploads go straight from the browser to object storage with a short-lived signed URL. When the asset is registered, the API reads the stored object back: the size and type come from storage, not from the request, and empty or oversized files are deleted and refused. Music uploads must be MP3 or M4A.

Approval rules (spec §31–33, §82):

- An asset needs a licence allowing commercial use.
- A music track needs commercial **and** on-demand (per-customer) use.
- An expired licence cannot be approved, and publishing a template that references an unapproved or expired asset fails the licence check.
- Editing a licence so that it no longer covers an approved asset or track moves it back to review.

Only approved tracks with a current licence are offered to hosts (`GET /music`) and ever play on invitations or in rendered videos.

For development, `node infrastructure/scripts/demo-music.mjs` synthesizes an original, royalty-free track (a tanpura drone with a pentatonic melody) and registers it through this same admin flow. The same track ships in `packages/database/seed-assets/music`; the production `migrate` job uploads it and adds it to the library, approved, when `SEED_ORIGINAL_MUSIC=true` (it skips a track already in the library under the same title).

## Testing

- `apps/api/test/platform.e2e-spec.ts` covers the Studio round trip, asset and music registration, licence corrections and permissions.
- `infrastructure/scripts/admin-smoke.mjs` drives the console in Chrome: sign-in, every page, a full create → edit → save → check → publish → archive round trip on a throwaway template, a real asset upload, and the video preview.
