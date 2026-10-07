# Web design system

How the marketing site (`apps/web/src/app/page.tsx`, `/templates`, `/pricing`, content pages), the sign-in screens and the host dashboard look and move. Guest invitations are styled by their templates instead ([templates.md](templates.md)).

## Tokens

Colours, shadows and animations are Tailwind 4 `@theme` tokens in `apps/web/src/app/globals.css`.

| Token | Use |
|---|---|
| `brand-*` (maroon), `gold-*`, `ivory`, `sand`, `ink` | the brand palette; `gold-600` is the darkest gold that passes AA as text on light backgrounds |
| `night-950 … night-700` | the dark sections: warm near-blacks with a maroon undertone |
| `shadow-soft`, `shadow-lift`, `shadow-glow` | resting cards, raised cards, the highlighted plan |
| `animate-word-rise`, `settle-up`, `rise-in`, `pop-in`, `slide-in-left/right`, `fade-in-up` | entrances that run from the first paint (`word-rise` and `settle-up` move without hiding, for large text) |
| `animate-drift`, `float-slow`, `spin-slow`, `scroll-cue` | ambient loops |

Icons are [lucide](https://lucide.dev) line icons (`lucide-react`), never emoji, in marketing and dashboard UI. Guest pages may use emoji where they read as content.

Component classes in `globals.css`: `.grain` (film grain over dark sections), `.eyebrow` (the chip above section titles), `.link-grow` (underline that grows on hover), `.spotlight` (light that follows the pointer), `.tilt` / `.tilt-glare` (3D lean), `.marquee`, `.cursor-*`, `.phone-frame`, `.paper`, `.skeleton`.

## Page rhythm

Marketing pages alternate dark and light "acts". Every full-width section sets `data-header-tone="dark"` or `"light"`; `HeaderFrame` reads the section under the header and switches its glass and text colours (`--hdr-*` variables). The header is transparent at the very top and turns to glass once the page scrolls. A page that opens on a dark hero renders `<SiteHeader tone="dark" />` and pulls the hero up under the header (`-mt-16 lg:-mt-[72px]`, the header's exact height). Boxed cards inside a light section do not set a tone.

Dark backgrounds are lit with soft radial gradients (`bg-[radial-gradient(closest-side,…)]`) and grain, never a panel with hard edges.

## Motion

- **Above the fold: CSS only.** Hero words, phones and chips use the `animate-*` entrances with inline `animationDelay`, so they play from the first paint instead of flashing when JavaScript hydrates. Set delays and durations with `style`, not arbitrary classes (the `animation` shorthand can override them). The headline and the paragraph under it must be readable from the first frame: they rise (`word-rise` starts each word partly above its mask, `settle-up` only moves) and never fade in, because the browser counts large text as painted only once it is visible (see [Speed](#speed)). Fades are for small text such as the eyebrow, the support line and the buttons.
- **Below the fold: `Reveal`.** `apps/web/src/app/home-animations.tsx` has `Reveal` (one-shot GSAP ScrollTrigger reveal, optional `stagger` selector), `StepsProgress` (a rail that fills with scroll) and `Parallax` (decoration drifting at its own speed). Elements a reveal animates must not have CSS transitions on `transform` or `opacity`; transition colours, shadows and `translate` instead. Reveals fade with `opacity` only, never `visibility` (GSAP's `autoAlpha`): content waiting for its reveal must stay in the accessibility tree for screen readers, AI agents and keyboard focus.
- **Pointer.** `TiltCard` leans content toward the pointer with a glare, `SpotlightGrid` lights `.spotlight` cards, `MagneticButton` pulls the main calls to action, and `CursorFollower` draws a ring that grows over links and reads "View" over `data-cursor="view"` elements. All are desktop-pointer only.
- **Scrolling.** `SmoothScroll` (Lenis, driven by GSAP's ticker) runs on marketing pages only, never in the dashboard or on guest pages. `allowNestedScroll` lets phone previews scroll on their own.
- **Reduced motion.** Every effect checks `prefers-reduced-motion`; the global rule in `globals.css` also zeroes CSS animation and transition durations and delays.

## Dashboard

`DashboardShell` is a glass top bar (events and templates as a segmented pill, notifications, an account menu that closes on outside click or Escape). An event opens under a dark header card (title, status, plan and access chips, preview and upgrade actions) with a grouped, sticky sidebar on desktop and a scrolling row of pills on phones. The shared primitives in `components/ui/primitives.tsx` (pill buttons, rounded fields with a focus ring, soft cards, ringed badges) carry the look to every tab, so pages rarely need their own styling. Numbers on the overview count up (`CountUp`) and the checklist shows a `ProgressRing`.

The shell must not render `<input>` or `<select>` elements: the UI smoke test fills the first inputs and selects on dashboard pages.

## Speed

Most visitors arrive on a phone, so the marketing pages are built for a slow phone first. What keeps them fast:

- **Template previews are images.** Galleries, film posters and the hero phone show pre-rendered WebP previews; regenerate them after changing a template ([templates.md](templates.md#marketing-previews)). Images below the fold load lazily; the hero's phones load eagerly.
- **The first paint shows the headline.** Large text above the fold moves in but never starts hidden (see Motion). An entrance that hides the headline delays Largest Contentful Paint until every script before it has run.
- **Trackers wait.** `AnalyticsScripts` loads the Super Admin's trackers and custom code on the visitor's first scroll, tap or key press, or after 8 seconds, whichever comes first.
- **No template engine on marketing, sign-in or dashboard-shell pages.** Importing anything from `@bulava/template-engine` itself bundles every client component of the engine (openings, music, RSVP forms, with their translations), even if the page renders none of them. Pages and shared components that only need an ornament or a scene import the single module (`@bulava/template-engine/src/ornaments`, `src/art/scenes`). Live templates come from `components/marketing/live-template.tsx`, loaded through `next/dynamic`: `LiveScreen` in the hero and `LiveThumbnail` in cards, used only when a template has no preview image.
- **No animation library above the fold.** The home page uses no framer-motion; its entrances are CSS and IntersectionObserver.
- **Small fonts for ₹ and Devanagari.** In the web fonts, ₹ and Devanagari sit in extra subsets (Noto Sans Latin Extended 165 KB, Cormorant Latin Extended 33 KB, Noto Sans Devanagari 97 KB) that one price or one Hindi word would download. `globals.css` puts two faces first in the stacks: `Bulava Rupee` / `Bulava Rupee Serif`, the ₹ glyph cut from Noto Sans and Cormorant into 1 KB fonts inlined in `src/fonts/rupee.css` (no request), and `Bulava Devanagari`, the device's own Devanagari font, falling back to the web font where there is none. Template fonts are not affected.

Check a change with Lighthouse on the mobile profile, against a production build (`next build && next start`), not the dev server:

```bash
npx lighthouse http://localhost:3000/ --only-categories=performance --chrome-flags="--headless=new"
```

## Checks

`pnpm a11y` must report no serious issues, and `node infrastructure/scripts/ui-smoke.mjs --out <dir>` must pass (it signs up, creates an event, visits every dashboard tab and the guest pages, and fails on any console error).
