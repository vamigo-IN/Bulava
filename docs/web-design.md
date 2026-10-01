# Web design system

How the marketing site (`apps/web/src/app/page.tsx`, `/templates`, `/pricing`, content pages), the sign-in screens and the host dashboard look and move. Guest invitations are styled by their templates instead ([templates.md](templates.md)).

## Tokens

Colours, shadows and animations are Tailwind 4 `@theme` tokens in `apps/web/src/app/globals.css`.

| Token | Use |
|---|---|
| `brand-*` (maroon), `gold-*`, `ivory`, `sand`, `ink` | the brand palette; `gold-600` is the darkest gold that passes AA as text on light backgrounds |
| `night-950 … night-700` | the dark sections: warm near-blacks with a maroon undertone |
| `shadow-soft`, `shadow-lift`, `shadow-glow` | resting cards, raised cards, the highlighted plan |
| `animate-word-rise`, `rise-in`, `pop-in`, `slide-in-left/right`, `fade-in-up` | entrances that run from the first paint |
| `animate-drift`, `float-slow`, `spin-slow`, `scroll-cue` | ambient loops |

Icons are [lucide](https://lucide.dev) line icons (`lucide-react`), never emoji, in marketing and dashboard UI. Guest pages may use emoji where they read as content.

Component classes in `globals.css`: `.grain` (film grain over dark sections), `.eyebrow` (the chip above section titles), `.link-grow` (underline that grows on hover), `.spotlight` (light that follows the pointer), `.tilt` / `.tilt-glare` (3D lean), `.marquee`, `.cursor-*`, `.phone-frame`, `.paper`, `.skeleton`.

## Page rhythm

Marketing pages alternate dark and light "acts". Every full-width section sets `data-header-tone="dark"` or `"light"`; `HeaderFrame` reads the section under the header and switches its glass and text colours (`--hdr-*` variables). The header is transparent at the very top and turns to glass once the page scrolls. A page that opens on a dark hero renders `<SiteHeader tone="dark" />` and pulls the hero up under the header (`-mt-16 lg:-mt-[72px]`, the header's exact height). Boxed cards inside a light section do not set a tone.

Dark backgrounds are lit with soft radial gradients (`bg-[radial-gradient(closest-side,…)]`) and grain, never a panel with hard edges.

## Motion

- **Above the fold: CSS only.** Hero words, phones and chips use the `animate-*` entrances with inline `animationDelay`, so they play from the first paint instead of flashing when JavaScript hydrates. Set delays and durations with `style`, not arbitrary classes (the `animation` shorthand can override them).
- **Below the fold: `Reveal`.** `apps/web/src/app/home-animations.tsx` has `Reveal` (one-shot GSAP ScrollTrigger reveal, optional `stagger` selector), `StepsProgress` (a rail that fills with scroll) and `Parallax` (decoration drifting at its own speed). Elements a reveal animates must not have CSS transitions on `transform` or `opacity`; transition colours, shadows and `translate` instead.
- **Pointer.** `TiltCard` leans content toward the pointer with a glare, `SpotlightGrid` lights `.spotlight` cards, `MagneticButton` pulls the main calls to action, and `CursorFollower` draws a ring that grows over links and reads "View" over `data-cursor="view"` elements. All are desktop-pointer only.
- **Scrolling.** `SmoothScroll` (Lenis, driven by GSAP's ticker) runs on marketing pages only, never in the dashboard or on guest pages. `allowNestedScroll` lets phone previews scroll on their own.
- **Reduced motion.** Every effect checks `prefers-reduced-motion`; the global rule in `globals.css` also zeroes CSS animation and transition durations and delays.

## Dashboard

`DashboardShell` is a glass top bar (events and templates as a segmented pill, notifications, an account menu that closes on outside click or Escape). An event opens under a dark header card (title, status, plan and access chips, preview and upgrade actions) with a grouped, sticky sidebar on desktop and a scrolling row of pills on phones. The shared primitives in `components/ui/primitives.tsx` (pill buttons, rounded fields with a focus ring, soft cards, ringed badges) carry the look to every tab, so pages rarely need their own styling. Numbers on the overview count up (`CountUp`) and the checklist shows a `ProgressRing`.

The shell must not render `<input>` or `<select>` elements: the UI smoke test fills the first inputs and selects on dashboard pages.

## Checks

`pnpm a11y` must report no serious issues, and `node infrastructure/scripts/ui-smoke.mjs --out <dir>` must pass (it signs up, creates an event, visits every dashboard tab and the guest pages, and fails on any console error).
