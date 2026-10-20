# Digital cards

Anyone can turn a template into a personalised invitation card at `/cards`, without an account, and download it: free with the watermark (the site's address across the card and a band along its foot, for a mobile number; the console can switch this off), or without it for a configurable price per card (₹50 at least). A plan may include a number of watermark-free cards (`cards.included`, [ADR-071](#plan-holders)): signed-in customers download that many card designs without paying or filling anything in. Every card is saved as a PNG or a JPEG, and a watermark-free one also as a PDF. Website and video invitations are untouched: cards are a separate flow over the same templates.

```text
/cards (gallery) → /cards/editor/:key → Download
                                         ├─ free: mobile number → watermarked image
                                         ├─ paid: number, name, email, Terms → Razorpay → clean image + email
                                         └─ plan: (signed in, cards left on the plan) → clean image
                                         each saved as the image (JPEG) or a one-page PDF
                    /cards/order#<token>  ← the paid card's page (download, email again, receipt)
                    /cards/recover        ← "find my card" by email and number
```

## Templates as cards

Every template whose first section is a canvas section can become a card: the 479 canvas templates (406 designs: the factory's, the hand-made ones and the stationery collection). The three older DIGITAL_CARD scene templates keep serving the event dashboard's card and are not in the gallery.

`cardFromTemplate(definition, { format, eventType, language, tags })` (`@bulava/template-schema`, `cards.ts`) makes a card design from the opening artboard:

- the wording for the occasion: layers shown only for other event types are dropped, other conditions follow the sample invitation;
- every text is either **linked** to the card's details (names, date, venue, message, family; `CARD_DETAIL_BINDINGS`; a timeline's `functions[0..3]` fields) or turned into words the customer can edit; time-formatted values become words, dates stay linked;
- a timeline keeps its rows: the card's details start with as many sample functions as the design shows, and a row whose function is removed hides (the only condition a card keeps);
- widgets become text (a countdown becomes the time and venue in the same lettering; date/time/venue rows become lines) or are dropped (buttons);
- motion is removed and the artboard is fitted to the format.

A **card design** (`CardDesignSchema`) is self-contained: `{ v, templateKey, format, eventType, language, colors, fonts, details, board, photos }`. Its board is an ordinary canvas artboard at the format's size; `photos` maps photo spots (`photo.*`, `photos[0..2]`) to the card's uploads. The API checks every saved design against its template: the board size matches the format, no widgets or conditions, text binds only to card details, images are the template's own assets or photo spots, photos are this card's uploads, and the language and occasion are the template's.

### Formats

| Format | Design size | Image | Starts from |
|---|---|---|---|
| Phone (default) | 390 × 844 | 1170 × 2532 | the phone artboard |
| Story 9:16 | 450 × 800 | 1080 × 1920 | the phone artboard |
| Portrait 5 × 7 | 500 × 700 | 1500 × 2100 | the phone artboard |
| Square | 640 × 640 | 1080 × 1080 | the phone artboard |
| Landscape 16:10 | 1440 × 900 | 1920 × 1200 | the desktop artboard |

`cardFromTemplate` fits the format's artboard with `fitBoard`, without stretching or cropping: layers spanning the board stretch with it, layers touching an edge stay on that edge (corner art keeps bleeding off it), the rest keep their place proportionally, and sizes, type and borders scale by the smaller ratio.

Switching format in the editor (`withCardFormat`, one undo step) lays the card out as the template does at that size, the same as starting over there, and carries the customer's work across: palette, fonts, details and photos, and on each element their words, styles, colours, crops and what they hid. Element by element (by layer id), a size they changed keeps its proportion to the template's at the new size; elements they deleted stay deleted; elements they added keep their place proportionally; the stacking order stays theirs. Their moves of the template's elements survive between sizes drawn from the same artboard (phone, story, portrait, square) and are laid out afresh across artboards (phone and landscape), where a position on one means nothing on the other.

## Editor

`apps/web/src/components/cards/`: the full-screen editor uses the engine's shared `Stage` (select, move, resize with handles, rotate, snapping) and `CardView`, the one component that draws a card everywhere (editor, preview, download dialog, export).

- **Details**: bride and groom (or the person celebrated), title, date and time, venue, address, city, message, family names, and up to four functions (name, date and time) for designs with a timeline. Linked text updates as they are typed; a detail the design does not show yet has "Add to card"; a timeline row shows only while its function has a name.
- **Text**: every line on the card, editable (editing a linked line makes it the customer's own words); headings, small capitals, paragraphs and script to add.
- **Colours**: palettes (the template's, its presets, and the editor's), each palette colour, the card background (template, colour or gradient). Text colours stay readable (the engine's contrast correction).
- **Photos**: upload, replace, remove; the inspector crops (zoom and focus), flips, frames (masks, radius, border) and brightens.
- **Elements**: decorations drawn by the engine (no licences), shapes, and the layer list (show, lock, reorder).
- **Size**: the formats, and "Reset to the original template" (details kept).
- **Inspector**: *Typography* (font: the design's fonts or any of the 21 families, Devanagari included; weight, from the weights the family is loaded in; size; colour; alignment; bold, italic, capitals), line and letter spacing, shadow, foil, long-text behaviour, *Position and size* (X, Y, width and height, centring across and up and down), rotation and opacity, duplicate, front/back, lock, hide, delete.
- **Light or dark**: the moon in the top bar switches the editor's look (kept on the device, `bulava.editor.theme`; the system's setting until then). The card keeps its colours. The same editor, with a Sections panel, edits the canvas sections of an event's website ([templates.md](templates.md#customization)).
- Undo and redo (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y), delete key, arrow nudges, zoom and fit in a bar floating over the canvas, and a preview of the final card with or without the watermark. On phones the tools are a bottom bar and the panels a sheet below the card, never over it: the card shrinks to fit above the sheet, and the sheet folds down to its title to give the card the room to move and resize things. Tapping an element opens its settings once the finger lifts, so a drag that starts by selecting keeps the card's scale.

### Saving

The design is kept in `localStorage` (`bulava.card.<templateKey>`) on every change, and on the server 1.5 s after the last one, but only once it differs from the template: an opened template is not a card. The first save creates a **card session** (`POST /public/cards/sessions`), whose 32-byte token the browser keeps; the database stores its SHA-256. A refresh, a closed dialog or a payment redirect resumes from the device copy and the server copy (the newer wins). Opening the download dialog saves first, so every download is of the design on screen.

### My cards

A card made or saved while signed in is saved in the account (`userId`), its token also kept encrypted (`tokenCiphertext`, AES-GCM under `TOKEN_ENCRYPTION_KEY`) so the account opens it on any device ([ADR-077](decisions.md)). **My cards** (`/dashboard/cards`, from the account menu and the card gallery) lists them: drafts, downloaded and watermark-free cards, cards made by a designer on the preview desk, and bought cards whose designs were tidied away (their order page still downloads them). Each card opens in the editor by its id (`/cards/editor/<key>?card=<id>`: `POST /cards/mine/:id/open` answers with the token, which never goes in an address), downloads from its order page once bought, shows its story (designed, downloaded, bought, emailed: `GET /cards/mine/:id/history`), and a draft can be deleted (`DELETE /cards/mine/:id`; a bought card stays). A card opened from the account is kept on the server only, not in the device's copy.

A preview provider's cards for customers ([previews.md](previews.md)) are opened the same way, in preview mode: the request's reference and *Back to the request* instead of *Download*; downloading or buying them is refused (`PREVIEW_HELD`) until their customer owns them, when they move into the customer's account.

## Downloads

| | Free | Watermark-free | Plan |
|---|---|---|---|
| For | anyone (`cards.freeDownloads`, on by default), else holders of any paid plan | anyone | signed in, with cards left on their plan |
| Asks for | WhatsApp/mobile number | number, full name, email, the ticked Terms and Refund Policy | nothing |
| Optional | offers on WhatsApp (unticked) | offers on WhatsApp (unticked) | |
| Image | with the watermark (the address across it, the band along its foot) | without | without |
| File | PNG or JPEG | PNG, JPEG or PDF | PNG, JPEG or PDF |
| Delivery | download | download + email with the image attached | download |
| Kept | 7 days | a year after payment | 30 days |

Numbers are validated and stored as E.164 with the calling code and national number apart (Indian mobiles: ten digits starting 6–9). One **contact** (`CardLead`) per number, however many cards, downloads and orders it has; name and email are asked only for a purchase (receipts and disputes) and kept with the order.

Each download is one **export** (`CardExport`) per design and kind: asking again (a second click, a refresh, a retry) returns the same image (`card_exports_live_per_design`). The image is made by the media worker (see [Export renderer](#export-renderer)); the browser polls `GET /public/cards/session/exports/:id` and then asks for a signed link (`POST …/download`, ten minutes, `Content-Disposition: attachment`). The first download of an image is what counts as a completed download.

The watermark is part of the image, drawn by `CardView` into the free export only: the site's address (`bulava.in`, the band's text after its last "·") tiled across the whole card (`WatermarkVeil`, the free website's mark, a little firmer, with tiles sized to the card: `38cqw`), and one band across the bottom (about a tenth of the shorter side, above the tiles) with the site's name and address from the settings (`Made with Bulava · bulava.in`). It is the only mark on a card: templates carry no brand layers (a design with one would be a catalog bug), and the editor's preview, the download dialog's previews and the export all draw the same marks. The paid and plan exports are the same render without them.

### Files

The dialog asks how to save the card once it is ready: a **PNG** (the best quality), a **JPEG** (smaller, for WhatsApp) or a **PDF** (for printing): `POST …/download { "as": "png" | "jpeg" | "pdf" }` (a JPEG when nothing is asked; `image`, from older clients, is the JPEG). All three are the same render. The media worker saves the JPEG and the PNG together (`cards/exports/<id>.jpg` and `.png`); a card made before PNGs were saved is made again when its PNG is asked for (the same design, at no charge: the answer is `CARD_NOT_READY` and the dialog waits for it). The PDF is one page at the card's size, the image at 300 dpi, so a Portrait 5 × 7 card prints at exactly 5 × 7 inches (the phone card is 3.9 × 8.44 in, the square 3.6 in). It is the JPEG itself, put in a PDF without decoding or re-encoding it (`card-pdf.ts`, no library), so it is exactly what was seen. The API makes it from the image the first time it is asked for, keeps it in private storage beside the image (`cards/exports/<id>.pdf`) and hands out a signed link like the image's; the worker deletes the PNG and the PDF with the image. **A PDF comes with a watermark-free card only** (a plan's or one bought): the free card's PDF is refused (`CARD_PDF_LOCKED`), and the dialog's PDF button on a free card offers the watermark-free card for its price instead. Every file is a download like any other: it counts, and the first of any completes the download.

## Paid cards

```text
POST /public/cards/session/orders { phone, name, email, acceptTerms: true, marketingConsent }
   → contact upserted, Consent "purchase_terms" (Terms, Refund, Privacy versions)
   → CardOrder PENDING: price from the settings, the design frozen, a receipt reference BC-XXXXXXXX
   → Razorpay order (notes: kind=card) → Checkout
POST /public/cards/order/verify   (x-card-order)  → HMAC signature checked → finalize
POST /payments/razorpay/webhook   payment.captured | order.paid → finalize;  payment.failed → reason kept
finalize: row lock; PENDING/EXPIRED → PAID once; PAID export queued; PAYMENT_SUCCEEDED
media worker: image ready → first email queued (emailStatus NONE → QUEUED)
worker: email with the image attached and the order link → SENT, or FAILED after its retries
```

- **No double charge.** One open order per design (`card_orders_open_per_design`): a second click reuses it and its gateway order, so it can be paid once. A design already bought returns the paid order. Retrying after a failed or closed checkout reopens the same order.
- **Unlocked only by a verified payment**: the checkout signature or the webhook, both idempotent under the order's row lock; amounts below the price are refused; a late payment for an expired checkout is honoured.
- **The purchase is the order, not the browser.** The order page `/cards/order#<token>` downloads the card again, emails it again (three times an hour), and makes the image again if it failed or expired, never charging again. The token is an HMAC of the order id (`cardOrderToken` in `@bulava/auth`, keyed from `TOKEN_ENCRYPTION_KEY`), so the worker can put it in the email while the database keeps only its hash; it follows a `#`, so it never reaches a server or a log. `/cards/recover` emails the links to every paid card bought with an email and number (the answer is the same either way).
- **Edits after paying** are a new design: the order keeps the one bought.
- Staff can resend, make the image again and refund (console, below).

## Plan holders

A plan includes a number of watermark-free cards: the plan feature `cards.included` (a row per plan in Pricing: 0 none, a number, or unlimited; ADR-071). The seeded tiers include none on Free and Starter, 5 on Standard, 10 on Premium and 20 on Ultimate; the console changes them. The rule is the allowance, not the watermark feature: a plan without the website's mark includes no cards unless its `cards.included` says so.

- **Which plan.** The biggest `cards.included` of the plans in force for the customer: their account's plan, or a plan bought or given for one of their events alone ([ADR-066](decisions.md)), each read as every feature is (the Free plan's row as the baseline, grants, add-ons adding to them: `loadUserFeatures`, `loadEventFeatures`). The plan's name comes from the order that brought the cards.
- **What counts.** Card designs downloaded through a plan, per account and each design once (`designHash`): an image made or on its way, or one downloaded at least once. Asking again, downloading it again (as an image or a PDF), or making it again after it expired takes nothing more; a failed image, or one never downloaded before it expired, gives its card back. Changing the design (other words, another format) is another card.
- **Taken once.** `POST /cards/session/plan-download` counts under a lock per account (`pg_advisory_xact_lock`), so two tabs cannot both take the last card, and answers with the allowance after this card. Without one left it refuses `CARD_PLAN_REQUIRED` (`details: { included, used }`); the card is then bought on its own, or downloaded with the watermark.
- **The console's switch.** `cards.planDownloads` (on by default) lets plans include cards; off, every watermark-free card is bought on its own and plan downloads are refused. Settings saved before ADR-071 still read (`any` and `subscription` as on, `off` as off).

`GET /public/cards/config` gives a signed-in customer the allowance (`account.cards`: `{ included, used, left, planName }`, null without one) and everyone the plan that unlocks (more) watermark-free cards (`unlock`: the cheapest public one-time plan with more cards than they have, `{ key, name, cards, priceMinor, fullPriceMinor }`, a plan holder's price being the difference from their plan, as the checkout charges it). `GET /public/cards/session`, signed in, says whether this design was had through the plan before (`planCounted`).

The dialog then shows, above the other ways to download, *Included in your Standard plan: 3 of 5 watermark-free cards left on your Standard plan* with one button and no form; once the card is ready it asks how to save it (PNG, JPEG or PDF), with the cards left. A design had before says so (downloading it again takes nothing more). With none left it says how many were used; without a plan that includes cards it offers the price per card and the plan to unlock (a card in the dialog for someone without a plan, a line under the options otherwise), in the checkout's words: *unlock*, a one-time payment, GST included, and only the difference for a plan holder. Unlocking goes to `/dashboard/checkout?plan=<key>` (through `/login?next=` for a visitor). If a plan download fails (the last card went meanwhile, the plan ended) the dialog returns to the choices with the numbers as they are now.

## Tracking

`CardEvent` rows record the funnel. Steps only the browser sees are posted to `POST /public/cards/events` and limited to `TEMPLATE_SELECTED`, `EDITOR_OPENED`, `DOWNLOAD_MODAL_OPENED` and `PAID_OPTION_SELECTED`; everything that is a conversion is recorded by the server when it happens, so a click can never fake one:

| Step | Recorded when |
|---|---|
| `CARD_CUSTOMIZED` | the first save that differs from the template (also `CardSession.customizedAt`) |
| `PHONE_SUBMITTED`, `FREE_DOWNLOAD_REQUESTED` | the free download is asked for with a valid number |
| `FREE_CARD_GENERATED`, `PAID_CARD_GENERATED`, `PLAN_CARD_GENERATED` | the image exists |
| `FREE_DOWNLOAD_COMPLETED`, `PAID_DOWNLOAD_COMPLETED`, `PLAN_DOWNLOAD_COMPLETED` | the first signed download link of an image |
| `CUSTOMER_DETAILS_SUBMITTED`, `PAYMENT_INITIATED` | an order is placed / a checkout opened |
| `PAYMENT_SUCCEEDED` | a verified payment settles the order |
| `PAYMENT_FAILED`, `PAYMENT_CANCELLED` | the gateway or checkout reports it (the order stays open) |
| `EMAIL_SENT`, `EMAIL_FAILED`, `EXPORT_FAILED` | the worker's outcome after its retries |

The console's numbers come from these facts: cards made (customised sessions), free downloads (sessions with a downloaded free image), checkouts, purchases (verified payments) and revenue, free-to-paid (contacts with a free download who bought afterwards), failures, popular templates and a daily chart.

## Export renderer

The media worker renders each export (`card-render` queue, one at a time by default: `CARD_RENDER_CONCURRENCY`): Chromium (`puppeteer-core`; Alpine's `chromium` in the media worker image, `CHROMIUM_PATH` to override) opens `WEB_INTERNAL_URL/cards/render/<token>` at the format's design size and pixel ratio, with reduced motion. The page fetches `GET /public/cards/render/<token>` (the design, signed photo links, the watermark or none) and draws `CardView` exactly as the editor does; it marks itself ready once fonts are in, text has been fitted with them and every image has loaded. The screenshot becomes a JPEG (quality 92, 4:4:4) and a PNG in private storage (`cards/exports/<id>.jpg`, `.png`; the PNG is saved first, so a READY export has both); its PDF is made from the JPEG when first asked for ([Files](#files)).

The render token is `<exportId>.<expiry>.<HMAC>`, valid for ten minutes, minted by the worker. Nginx refuses `/cards/render/` and `/api/v1/public/cards/render/` from outside; the worker reaches the web app inside the Docker network, and the API redacts the token from its logs. A failed render is retried twice; after the last attempt the export is FAILED, and the editor or the order page makes a new one.

Photos are uploaded straight to private storage with a signed PUT, then the media worker decodes and re-encodes them (upright, no EXIF or GPS, at most 2400 px, WebP) and deletes the original. The browser and the renderer see them only through signed links.

## Console

**Digital cards** (`cards.view`; Support, Finance, Platform Admin and the Super Admin): the funnel, revenue, conversion, failures, popular templates and daily activity; contacts (number, name and email when bought, offers consent, cards, downloads, purchases) with their consents, cards, orders and activity; card orders with payment IDs, the email's state and the timeline. `cards.manage` (Support and up) resends a card's email, makes an image again, exports the contacts who agreed to offers (CSV, audit-logged) and records a withdrawal of offers. Refunds need `payment.refund`. The price, whether cards are on, whether anyone downloads the watermarked card and whether plans include watermark-free cards are the `cards` settings group (Super Admin), on the same page; how many cards each plan includes is its *Watermark-free cards* row in Pricing (`cards.included`).

## Retention

The worker's daily `card-retention` task (batches, logged):

| What | When |
|---|---|
| Free images | deleted 7 days after they are made, with their PNG (the export row stays, `EXPIRED`) |
| Plan images | 30 days (a design downloaded stays counted against the plan) |
| Paid images | a year after payment (the order stays) |
| Photos never uploaded, or rejected | after a day |
| Checkouts never paid | closed (`EXPIRED`) after two days; a late payment still settles |
| Cards (sessions) with their photos | 30 days after they were last touched (a year for cards saved in an account), a year after a payment; a preview card while its request is open |
| Contacts without offers consent or orders | a year after they were last seen |
| Funnel steps | after two years |

## API

Public (`@Public()`; the card's token in `x-card-session`, an order's in `x-card-order`, never in a URL):

| Route | |
|---|---|
| `GET /public/cards/config` | price, payments, watermark, formats, `planCards`, the plan to `unlock`; the signed-in customer's prefill and watermark-free cards (`account.cards`) |
| `POST /public/cards/events` | browser-only funnel steps |
| `POST /public/cards/sessions` · `GET /public/cards/session` · `PUT /public/cards/session/design` | save, reopen (signed in: `planCounted`), autosave |
| `POST /public/cards/session/uploads` · `…/uploads/:id/complete` · `GET …/uploads/:id` | photos |
| `POST /public/cards/session/free-download` · `GET …/exports/:id` · `POST …/exports/:id/download` `{ as?: png, jpeg or pdf }` | the free card (the same links serve a plan card; no PDF of a free card) |
| `POST /public/cards/session/orders` | the paid card's order and checkout |
| `GET /public/cards/order` · `POST /public/cards/order/{checkout,verify,events,download,email,regenerate}` (`download`: `{ as?: png, jpeg or pdf }`) | the order page |
| `POST /public/cards/recover` | links to bought cards, by email |
| `GET /public/cards/render/:token` | the export renderer only |

Signed in: `POST /cards/session/plan-download` (the export, and the `allowance` after it); My cards: `GET /cards/mine`, `GET /cards/mine/:id/history`, `POST /cards/mine/:id/open`, `DELETE /cards/mine/:id`. Console: `GET /admin/cards/{stats,leads,leads.csv,leads/:id,orders,orders/:id}`, `POST /admin/cards/leads/:id/withdraw-offers`, `POST /admin/cards/orders/:id/{resend-email,regenerate,refund}`.

Errors: `CARDS_UNAVAILABLE` (switched off), `CARD_SESSION_EXPIRED` (cleaned up: the editor starts the server copy again from the device copy), `CARD_NOT_READY` (also while an older card is made again as a PNG), `CARD_PDF_LOCKED` (a PDF of the free card), `CARD_PLAN_REQUIRED` (a download the plan does not include: no free downloads without a plan, or no watermark-free cards left, `details: { included, used }`), `PREVIEW_HELD` (a preview card for a customer), plus `CUSTOMIZATION_INVALID`, `UPLOAD_REJECTED`, `PAYMENTS_UNAVAILABLE`, `PAYMENT_VERIFICATION_FAILED` and `ORDER_NOT_PAYABLE`.
