# Web design system

How the marketing site (`apps/web/src/app/page.tsx`, `/templates`, `/pricing`, content pages), the sign-in screens and the host dashboard look and move. Guest invitations are styled by their templates instead ([templates.md](templates.md)).

## The look: clay (design system v3)

A warm cream canvas with tactile 3D surfaces, all lit from the top left: a light rim on the top and left edges, a shaded rim on the bottom and right, and a soft drop shadow falling to the bottom right. Raised things (cards, buttons, chips) bulge out of the canvas; inputs, toggle tracks and wells are pressed into it. Brand colours stay maroon and gold. Headings are Fraunces, text is DM Sans.

## Tokens

Colours, shadows and animations are Tailwind 4 `@theme` tokens in `apps/web/src/app/globals.css`.

| Token | Use |
|---|---|
| `canvas`, `surface` | the page background (warm cream), and the face of raised cards and buttons on it |
| `brand-*` (maroon), `gold-*`, `ivory`, `sand`, `ink` | the brand palette; `gold-600` is the darkest gold that passes AA as text on light backgrounds |
| `night-950 … night-700` | the dark bands (pricing, footer): warm near-blacks with a maroon undertone |
| `shadow-clay`, `shadow-clay-raised`, `shadow-clay-sm`, `shadow-clay-inset` | raised, lifted (hover), small raised (pills, chips) and pressed-in surfaces |
| `font-display` (Fraunces), `font-sans` (DM Sans) | headings and text; both start with the inlined ₹ faces and the device's Devanagari |
| `animate-word-rise`, `settle-up`, `rise-in`, `pop-in`, `slide-in-left/right`, `fade-in-up` | entrances that run from the first paint (`word-rise` and `settle-up` move without hiding, for large text) |
| `animate-drift`, `float-slow`, `spin-slow`, `scroll-cue` | ambient loops |

Icons are [lucide](https://lucide.dev) line icons (`lucide-react`), never emoji, in marketing and dashboard UI. Guest pages may use emoji where they read as content.

## Components

Use these classes rather than one-off shadows, so every surface shares the same light.

| Class | What it is |
|---|---|
| `.clay` | a raised card (surface colour + `shadow-clay`); add a radius (`rounded-3xl`) and padding |
| `.clay-lift` | lifts a clay card 5px on hover and focus (animates `translate`, so it never fights GSAP or the 3D tilt) |
| `.clay-inset` | a pressed-in well: inputs, segmented-control tracks, the phone stage inside template cards, info panels |
| `.btn-3d` | the maroon 3D button: glossy gradient, bulging rims, drop shadow; rises on hover, presses down on click. Size and shape come from utilities (`min-h-12 rounded-2xl px-6 text-base`) |
| `.btn-3d-light` / `-gold` / `-green` | the light (secondary actions, chips, icon buttons), gold (on maroon or dark) and WhatsApp versions; combine with `.btn-3d` |
| `.btn-3d-template` | guest forms inside an invitation (RSVP, registration): the 3D shape in the template's `--t-button` / `--t-on-button`, never Bulava maroon |
| `.icon-3d` | a static maroon 3D tile for icons (feature, occasion and step cards, avatars); add a size and radius |
| `.eyebrow` | small spaced capitals after a four-point star, above section titles (`text-brand-700` on cream, `text-gold-200` on dark) |

Chips and segmented controls show the chosen option as `.btn-3d` (maroon) and the others as `.btn-3d-light`. The shared `Button` and form fields in `components/ui/primitives.tsx` use the same classes, so the dashboard gets the same buttons and pressed-in fields. Other classes: `.link-grow` (underline that grows on hover), `.spotlight` (light that follows the pointer), `.tilt` / `.tilt-glare` (3D lean), `.marquee`, `.cursor-*`, `.phone-frame`, `.paper`, `.skeleton`, `.grain`.

## Page rhythm

Marketing pages sit on the cream canvas. Sections are separated by space and, now and then, a soft band (a faint gradient with hairline borders), not by colour changes. Dark appears only as the pricing band, the footer and, as maroon clay slabs, the closing invitation and the sign-in panel.

Every full-width section sets `data-header-tone="dark"` or `"light"`. The header is a clay bar; `HeaderFrame` reads the section under it and switches to dark glass over the dark bands (`--hdr-*` variables). Boxed cards inside a section do not set a tone.

Light comes from soft radial gradients (`bg-[radial-gradient(closest-side,…)]`, gold on cream) and the faint gold mandala, never a panel with hard edges. A section that holds something sticky (the gallery's filters, a policy's index) clips the decoration with `overflow-x-clip`, never `overflow-hidden`, which would stop the sticky element.

The footer's text (the line under the logo, the description, the copyright line and an extra line) is a site setting (Branding & contact > Footer), and its Company and Legal columns list the published site pages.

## Site pages

About, Contact, the policies and pages staff add come from the API (`/public/pages/:slug`, edited in the console under Pages) and render through `app/(content)/[page]`, one route for three layouts:

- **Document** (policies): the title, the last-updated date and the reading time, a sticky "On this page" index in a `.clay-inset` panel (folded into a `<details>` on phones), numbered sections in one `.clay` reading card, a contact prompt and the other policies as chips.
- **Cards** (About): each section a numbered `.clay-lift` card.
- **Contact**: the form in a `.clay` card, with the contact actions (email, phone, WhatsApp from the settings) and the page's sections as `.clay-inset` notes beside it. Trackers never load on the form (`isTrackerFreePath`).

Section text is parsed by `parsePageBody` (`@bulava/validation`) and rendered by `PageBlocks`: paragraphs, sub-headings, gold-diamond bullets, numbered lists, bold and links. Placeholders such as `{legalName}` come from the settings; a paragraph whose value is missing is left out.

## Templates gallery

`/templates` puts its filters in a sticky `.clay` sidebar (`TemplateGallery`): occasion, tradition, plan and format, each option with the number of templates it would show (zero dims it), long lists folded behind "+ N more". On phones the same filters fold into a "Filters" panel. Active filters show as chips with a remove button and "Clear all". The homepage teaser keeps chip rows (`TemplateExplorer`).

The digital card gallery (`/cards`) is the same `TemplateGallery` with its own groups (occasion, tradition, style), a search and an order above the results (a GET form, so it works before hydration), and two cards to a row on phones.

Galleries show each design once: templates that are one design for different occasions share a look (`preview.look`), and `onePerLook` keeps the version for the occasion chosen, else the first in the gallery's order. Counts on the filters and in the eyebrows count designs, after the same step ([templates.md](templates.md#lookalikes)).

## Home page templates

The home page's template sections (the hero's live phone and the two behind it, the illustrated scenes, the collection, the spotlight and the films) and the card gallery's Featured order show what staff chose in the console's Home page screen first (`GET /public/showcase`, `showcase.manage`), then their automatic choice fills what is left (`withPicks` in `app/page.tsx`); a pick that is unpublished later drops out. A new home section that shows templates gets a showcase section (`SHOWCASE_SECTIONS` in `@bulava/validation`) rather than hard-coded keys. A hero pick without a long pre-rendered preview plays live, which loads the template engine with the page: give it one with the preview script's `--full <key>` ([templates.md](templates.md#marketing-previews)). The console shows the same pre-rendered previews through a rewrite to the web app (`/template-previews/*`, `WEB_INTERNAL_URL`).

A card (`TemplateCard`, 280px minimum) is a `.clay-lift` card: a stage tinted with the template's own accent and primary colours, where the phone (176 × 320, the posters' shape) stands near the bottom edge and rises on hover; the badge and format icons sit on the stage; below are the occasion and tradition, the name, the price with its plan, the palette as four dots, and "Live demo" (websites) or "Preview".

## Motion

- **Above the fold: CSS only.** Hero words, phones and chips use the `animate-*` entrances with inline `animationDelay`, so they play from the first paint instead of flashing when JavaScript hydrates. Set delays and durations with `style`, not arbitrary classes (the `animation` shorthand can override them). The headline and the paragraph under it must be readable from the first frame: they rise (`word-rise` starts each word partly above its mask, `settle-up` only moves) and never fade in, because the browser counts large text as painted only once it is visible (see [Speed](#speed)). Fades are for small text such as the eyebrow, the support line and the buttons.
- **Below the fold: `Reveal`.** `apps/web/src/app/home-animations.tsx` has `Reveal` (one-shot GSAP ScrollTrigger reveal, optional `stagger` selector), `StepsProgress` (a rail that fills with scroll) and `Parallax` (decoration drifting at its own speed). Elements a reveal animates must not have CSS transitions on `transform` or `opacity`; transition colours, shadows and `translate` instead. Reveals fade with `opacity` only, never `visibility` (GSAP's `autoAlpha`): content waiting for its reveal must stay in the accessibility tree for screen readers, AI agents and keyboard focus.
- **Pointer.** `TiltCard` leans content toward the pointer with a glare, `SpotlightGrid` lights `.spotlight` cards, `MagneticButton` pulls the main calls to action, and `CursorFollower` draws a ring that grows over links and reads "View" over `data-cursor="view"` elements. All are desktop-pointer only.
- **Scrolling.** `SmoothScroll` (Lenis, driven by GSAP's ticker) runs on marketing pages only, never in the dashboard or on guest pages. `allowNestedScroll` lets phone previews scroll on their own.
- **Reduced motion.** Every effect checks `prefers-reduced-motion`; the global rule in `globals.css` also zeroes CSS animation and transition durations and delays.

## Dashboard

`DashboardShell` is a glass top bar (Home, My events and Templates as a segmented pill, notifications, an account menu that closes on outside click or Escape). The shared primitives in `components/ui/primitives.tsx` (3D buttons, pressed-in fields with a focus ring, clay cards, ringed badges) carry the look to every tab, so pages rarely need their own styling. Numbers count up (`CountUp`) and progress shows as a `ProgressRing`.

- **Home** (`/dashboard`): a dark greeting slab with the next celebration's countdown, the event to pick up where the host left off (its design as the cover, its setup progress and the one next step with its button), their events, numbers across them, recent activity and shortcuts into the event. Before the first event: occasions to start from, how it works, and designs to browse. **My events** (`/dashboard/events`) lists every event as a card (`EventCard`: the chosen design as a `DesignCover`, a blurred backdrop with the invitation as a small phone; status, date, days to go, and setup progress for drafts) with All, Drafts, Live and Past filters.
- **Creating an event** (`/dashboard/events/new`) is three short steps with a stepper, never one long form: the occasion as cards (event types from the database, with icons from `lib/occasions.ts`), then the names (the title fills itself from them), the main day and the invitation language as chips, then the suggested functions as toggles and the guest groups that come with them. A live invitation card and "what happens next" follow along on wide screens. Nothing about access is asked: events start as one private link, and the host chooses who can open the invitation when publishing. A new event opens on its design step with the design browser open.
- **The event workspace**: a dark header card (title, status, date, plan; access once published; the preview while a draft and the public page once published, **Unlock** and **Publish** actions; slimmer on inner pages) over a grouped, sticky sidebar on desktop (with the setup's progress on top and a tick beside finished steps) and a scrolling row of pills on phones. The setup steps (`lib/setup-steps.ts`: design, functions, guests, publish, share, replies; functions counts once one function has a date, time and venue, `counts.readyFunctions`) drive the overview's checklist, the sidebar ticks, the home page and the **next-step bar** at the end of every page but the overview: where the page sits, the next unfinished step with its button, and every step as a rail to jump along.
- **Publishing** happens in one dialog (`PublishProvider` in the event layout; `?publish=1` opens it from elsewhere): who can open the invitation as option cards with the private link recommended, soft warnings (starter design, no functions), the way to unlock the design when the plan does not cover it, then the live link with copy and WhatsApp. Settings changes access afterwards with the same cards.
- **Design**: the design in use with its preview thumbnail, a live phone preview with the host's names, customisation tabs, and a full-screen design browser (`TemplatePicker`): plan and search filters, the gallery's pre-rendered previews, and the focused design live beside them.
- **Plans and checkout**: plan cards (pricing, an event's **Unlock** page) only choose; `/dashboard/checkout` is short: the plan with its features, then the price, a coupon with **Apply** and its answer beside the field, the terms box and **Pay** ([payments.md](payments.md#checkout-page)). Plans belong to the account, so nothing asks for an event. A plan limit met anywhere says which limit in words and offers **Click here to unlock** (inline on the new-event page, a small prompt at the bottom of event pages). Customer copy says *unlock*, never *upgrade*.
- **Signing in** (`/login`, `/signup` redirects there) is one card: one field for an email or a WhatsApp number (an Indian number typed without its code shows India's flag and +91), **Continue**, and Google; then the code, the password (with "email me a code" beside it) or, for someone new, **Create your account**: a name, an optional password and the unticked Terms box, without explanations around them ([authentication.md](authentication.md#hosts-users)).
- **Account** (`/dashboard/account`, a route group with `/dashboard/payments`): a header with who is signed in and how well the account is protected, and sections beside every page like an event's: Profile, Sign-in & security, Payments (totals, filters, receipts; checkouts still end on `/dashboard/payments/:orderId`), Privacy & data (export, policies, deleting the account).

Dialogs and other closed panels are mounted only while open, and positioned scroll containers keep screen-reader-only labels inside them (an absolutely positioned label inside an unpositioned scrolling row would widen the page on phones).

The shell must not render `<input>` or `<select>` elements: the UI smoke test fills the first inputs and selects on dashboard pages.

The host's preview link (`/preview/<token>`) shows the invitation with only a small dark pill at the bottom: *Preview · Not published yet*. The host (signed in, allowed to edit or publish the event) also gets **Edit** and **Publish** in the pill; guests and family see the mark alone.

Checkout ends on the payment status page (`/dashboard/payments/:orderId`, [payments.md](payments.md#payment-status-page)): a large 3D status tile and message (thank you, confirming, still waiting, failed with the bank's reason, not completed, refunded), the four-step progress (order placed, payment, confirmation, plan active) and the receipt with copyable order and payment IDs.

## Speed

Most visitors arrive on a phone, so the marketing pages are built for a slow phone first. What keeps them fast:

- **Template previews are images.** Galleries, film posters and the hero phone show pre-rendered WebP previews; regenerate them after changing a template ([templates.md](templates.md#marketing-previews)). Images below the fold load lazily; the hero's phones load eagerly.
- **The first paint shows the headline.** Large text above the fold moves in but never starts hidden (see Motion). An entrance that hides the headline delays Largest Contentful Paint until every script before it has run.
- **Trackers wait.** `AnalyticsScripts` loads the Super Admin's trackers and custom code on the visitor's first scroll, tap or key press, or after 8 seconds, whichever comes first.
- **No template engine on marketing, sign-in or dashboard-shell pages.** Importing anything from `@bulava/template-engine` itself bundles every client component of the engine (openings, music, RSVP forms, with their translations), even if the page renders none of them. Pages and shared components that only need an ornament or a scene import the single module (`@bulava/template-engine/src/ornaments`, `src/art/scenes`). Live templates come from `components/marketing/live-template.tsx`, loaded through `next/dynamic`: `LiveScreen` in the hero and `LiveThumbnail` in cards, used only when a template has no preview image.
- **No animation library above the fold.** The home page uses no framer-motion; its entrances are CSS and IntersectionObserver.
- **Two preloaded fonts.** Only DM Sans and Fraunces (Latin, variable) preload. Noto Sans, Cormorant and the Devanagari faces stay registered for the fallbacks and templates but load only when a page uses them.
- **Small fonts for ₹ and Devanagari.** In the web fonts, ₹ and Devanagari sit in extra subsets (Latin Extended, Noto Sans Devanagari 97 KB) that one price or one Hindi word would download. `globals.css` puts two faces first in the stacks: `Bulava Rupee` / `Bulava Rupee Serif`, the ₹ glyph of DM Sans and Fraunces as 2 KB variable fonts inlined in `src/fonts/rupee.css` (no request; Google Fonts' `text=₹` subset), and `Bulava Devanagari`, the device's own Devanagari font, falling back to the web font where there is none. Template fonts are not affected.

Check a change with Lighthouse on the mobile profile, against a production build (`next build && next start`), not the dev server:

```bash
npx lighthouse http://localhost:3000/ --only-categories=performance --chrome-flags="--headless=new"
```

## Checks

`pnpm a11y` must report no serious issues, and `node infrastructure/scripts/ui-smoke.mjs --out <dir>` must pass (it signs up, creates an event, visits every dashboard tab and the guest pages, and fails on any console error).
