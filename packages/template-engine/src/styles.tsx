/**
 * Reveal-on-scroll (only after RevealOnScroll adds `reveal-ready` on live pages)
 * and the Signature collection's motion. All motion stops for reduced-motion users.
 * Kept apart from the renderer, so pages that only need the styles (scene posters)
 * can import this module without the whole engine.
 */
const STYLES = `
.bulava-template.reveal-ready .bulava-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s ease, transform 0.7s ease; }
.bulava-template.reveal-ready .bulava-reveal.is-visible { opacity: 1; transform: none; }
@keyframes bulava-twinkle { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
@keyframes bulava-sway { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
@keyframes bulava-drift { from { transform: translateX(0); } to { transform: translateX(-16%); } }
@keyframes bulava-spin { to { transform: rotate(360deg); } }
@keyframes bulava-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes bulava-rise { from { transform: translateY(0) scale(1); opacity: 1; } to { transform: translateY(-120vh) scale(0.7); opacity: 0; } }
@keyframes bulava-fall { from { transform: translateY(-5vh) rotate(0deg); opacity: 0; } 10% { opacity: 0.95; } to { transform: translateY(110vh) rotate(540deg); opacity: 0.2; } }
@keyframes bulava-eq { 0%, 100% { height: 30%; } 50% { height: 100%; } }
@keyframes bulava-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
.bulava-twinkle { animation: bulava-twinkle 3s ease-in-out infinite; }
.bulava-sway { transform-origin: top center; animation: bulava-sway 5s ease-in-out infinite; }
.bulava-drift { animation: bulava-drift 14s ease-in-out infinite alternate; }
.bulava-spin-slow { animation: bulava-spin 80s linear infinite; }
.bulava-bob { animation: bulava-bob 4s ease-in-out infinite; }
.bulava-rise { animation: bulava-rise 2s ease-in forwards; }
.bulava-fall { animation: bulava-fall 2s linear forwards; }
.bulava-eq { height: 30%; animation: bulava-eq 0.9s ease-in-out infinite; }
/* Invitation prompts ("Tap to open") breathe instead of fading, so the text stays readable. */
.bulava-breathe { display: inline-block; animation: bulava-breathe 2.4s ease-in-out infinite; }
/* Foil: light sweeps across foil text; other layers glint. */
@keyframes bulava-shimmer { 0%, 15% { background-position: 110% 0; } 85%, 100% { background-position: -10% 0; } }
@keyframes bulava-glint { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.22) saturate(1.05); } }
.bulava-shimmer { animation: bulava-shimmer 5s ease-in-out infinite alternate; }
.bulava-glint { animation: bulava-glint 3.6s ease-in-out infinite; }
/* Bands: whole sections on the primary or accent colour, with inks computed for that colour (see themeStyle). */
.bulava-band-primary { background-color: var(--t-primary); color: var(--bp-text); --t-text: var(--bp-text); --t-muted-ink: var(--bp-muted); --t-primary-ink: var(--bp-primary-ink); --t-secondary-ink: var(--bp-secondary-ink); --t-accent-ink: var(--bp-accent-ink); --t-heading-ink: var(--bp-accent-ink); --t-secondary-display: var(--bp-secondary-ink); --t-muted-display: var(--bp-muted); --t-card: rgb(255 255 255 / 0.08); --t-card-alt: rgb(255 255 255 / 0.12); --t-line: color-mix(in srgb, var(--t-accent) 45%, transparent); --t-button: var(--bp-button); --t-on-button: var(--bp-on-button); --t-orn: var(--t-accent); --t-band: var(--t-primary); }
.bulava-band-accent { background-color: var(--t-accent); color: var(--ba-text); --t-text: var(--ba-text); --t-muted-ink: var(--ba-muted); --t-primary-ink: var(--ba-primary-ink); --t-secondary-ink: var(--ba-secondary-ink); --t-accent-ink: var(--ba-accent-ink); --t-heading-ink: var(--ba-accent-ink); --t-secondary-display: var(--ba-secondary-ink); --t-muted-display: var(--ba-muted); --t-card: rgb(255 255 255 / 0.1); --t-card-alt: rgb(255 255 255 / 0.16); --t-line: color-mix(in srgb, var(--t-primary) 35%, transparent); --t-button: var(--ba-button); --t-on-button: var(--ba-on-button); --t-orn: var(--t-primary); --t-band: var(--t-accent); }
/* Dark stock (heroTone "dark"): the deep band, a shade darker than the primary one. */
.bulava-band-deep { background-color: var(--t-deep); color: var(--bd-text); --t-text: var(--bd-text); --t-muted-ink: var(--bd-muted); --t-primary-ink: var(--bd-accent-ink); --t-secondary-ink: var(--bd-accent-ink); --t-accent-ink: var(--bd-accent-ink); --t-heading-ink: var(--bd-accent-ink); --t-secondary-display: var(--bd-accent-ink); --t-muted-display: var(--bd-muted); --t-card: rgb(255 255 255 / 0.07); --t-card-alt: rgb(255 255 255 / 0.11); --t-line: color-mix(in srgb, var(--t-accent) 40%, transparent); --t-button: var(--bd-button); --t-on-button: var(--bd-on-button); --t-orn: var(--t-accent); --t-band: var(--t-deep); }
/* A light reply card on any band (the RSVP form inside it is the host's, drawn in dark ink). */
.bulava-reply-card { background-color: var(--rc-bg); color: var(--rc-text); --t-text: var(--rc-text); --t-muted-ink: var(--rc-muted); --t-primary-ink: var(--rc-primary-ink); --t-secondary-ink: var(--rc-secondary-ink); --t-accent-ink: var(--rc-accent-ink); --t-heading-ink: var(--rc-primary-ink); --t-secondary-display: var(--rc-secondary-ink); --t-muted-display: var(--rc-muted); --t-card: var(--rc-bg); --t-card-alt: var(--rc-bg); --t-line: color-mix(in srgb, var(--t-secondary) 45%, transparent); --t-button: var(--rc-button); --t-on-button: var(--rc-on-button); --t-orn: var(--t-secondary); }
@keyframes bulava-flicker { 0%, 100% { transform: scale(1, 1) skewX(0deg); } 25% { transform: scale(0.94, 1.06) skewX(-2deg); } 50% { transform: scale(1.04, 0.96) skewX(2deg); } 75% { transform: scale(0.97, 1.03) skewX(-1deg); } }
@keyframes bulava-glow { 0%, 100% { opacity: 0.75; } 50% { opacity: 1; } }
@keyframes bulava-float-up { 0% { transform: translateY(0) translateX(0); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(-110vh) translateX(40px); opacity: 0; } }
@keyframes bulava-sway-soft { 0%, 100% { transform: rotate(-0.6deg); } 50% { transform: rotate(0.6deg); } }
@keyframes bulava-orb { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(30px, -24px) scale(1.12); } }
@keyframes bulava-medallion { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(360deg); } }
@keyframes bulava-flip-leaf { from { transform: rotateX(0deg); } to { transform: rotateX(-180deg); } }
.bulava-flicker { animation: bulava-flicker 1.6s ease-in-out infinite; transform-box: fill-box; }
.bulava-glow { animation: bulava-glow 2.8s ease-in-out infinite; }
.bulava-float-up { animation: bulava-float-up 14s linear infinite; }
.bulava-sway-soft { transform-origin: top center; animation: bulava-sway-soft 6s ease-in-out infinite; }
.bulava-orb { animation: bulava-orb 16s ease-in-out infinite; }
.bulava-medallion { animation: bulava-medallion 14s linear infinite; }
.bulava-vinyl { position: relative; animation: bulava-spin 3.5s linear infinite; }
.bulava-flip { transition: transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1); }
.bulava-flip-leaf { animation: bulava-flip-leaf 0.6s ease-in forwards; }
.bulava-curtain { transition: transform 1.3s cubic-bezier(0.6, 0, 0.2, 1); }
.bulava-3d-card { transition: transform 0.4s cubic-bezier(0.2, 0.7, 0.2, 1), opacity 0.4s ease; }
.bulava-tilt { transition: transform 0.4s ease; }
@media (hover: hover) { .bulava-tilt:hover { transform: perspective(700px) rotateX(4deg) rotateY(-6deg) scale(1.03); } }
@media (prefers-reduced-motion: reduce) {
  .bulava-twinkle, .bulava-sway, .bulava-drift, .bulava-spin-slow, .bulava-bob, .bulava-eq, .bulava-breathe,
  .bulava-flicker, .bulava-glow, .bulava-float-up, .bulava-sway-soft, .bulava-orb, .bulava-medallion, .bulava-vinyl, .bulava-flip-leaf, .bulava-shimmer, .bulava-glint { animation: none; }
  .bulava-flip, .bulava-curtain, .bulava-3d-card, .bulava-tilt { transition: none; }
  .bulava-float-up { display: none; }
}
/* Canvas sections (canvas/section.tsx): the section is a query container, so the page's own width
   (not the window's) decides between the phone and desktop artboards; previews in a phone frame stay phones. */
.bulava-canvas { container: bulava-canvas / inline-size; position: relative; overflow: hidden; }
.bulava-canvas-m { width: 100%; margin: 0 auto; }
.bulava-canvas-d { display: none; }
@container bulava-canvas (min-width: 900px) {
  .bulava-canvas[data-desktop] .bulava-canvas-m { display: none; }
  .bulava-canvas[data-desktop] .bulava-canvas-d { display: block; }
  .bulava-canvas:not([data-desktop]) .bulava-canvas-m { max-width: var(--cv-max, 480px); padding: 56px 0; }
  .bulava-canvas:not([data-desktop]) .bulava-canvas-m .bulava-artboard { border-radius: 28px; box-shadow: 0 40px 80px -40px rgba(0,0,0,0.45); }
}
/* Layers animate in one by one, so the section itself does not fade as a block. */
.bulava-template.reveal-ready .bulava-canvas.bulava-reveal { opacity: 1; transform: none; transition: none; }
.bulava-template.reveal-ready .bulava-canvas:not(.is-visible) .bulava-cv-in { opacity: 0; }
@keyframes bulava-cv-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes bulava-cv-fade-up { from { opacity: 0; transform: translateY(8%); } to { opacity: 1; transform: none; } }
@keyframes bulava-cv-fade-down { from { opacity: 0; transform: translateY(-8%); } to { opacity: 1; transform: none; } }
@keyframes bulava-cv-zoom { from { opacity: 0; transform: scale(0.84); } to { opacity: 1; transform: none; } }
@keyframes bulava-cv-slide-left { from { opacity: 0; transform: translateX(10%); } to { opacity: 1; transform: none; } }
@keyframes bulava-cv-slide-right { from { opacity: 0; transform: translateX(-10%); } to { opacity: 1; transform: none; } }
@keyframes bulava-cv-blur { from { opacity: 0; filter: blur(14px); transform: scale(1.06); } to { opacity: 1; filter: blur(0); transform: none; } }
@keyframes bulava-cv-pop { 0% { opacity: 0; transform: scale(0.6); } 70% { opacity: 1; transform: scale(1.06); } 100% { transform: none; } }
.bulava-canvas.is-visible .bulava-cv-fade { animation: bulava-cv-fade var(--cv-dur, .8s) ease-out var(--cv-delay, 0s) both; }
.bulava-canvas.is-visible .bulava-cv-fade-up { animation: bulava-cv-fade-up var(--cv-dur, .8s) cubic-bezier(0.2, 0.7, 0.2, 1) var(--cv-delay, 0s) both; }
.bulava-canvas.is-visible .bulava-cv-fade-down { animation: bulava-cv-fade-down var(--cv-dur, .8s) cubic-bezier(0.2, 0.7, 0.2, 1) var(--cv-delay, 0s) both; }
.bulava-canvas.is-visible .bulava-cv-zoom { animation: bulava-cv-zoom var(--cv-dur, .8s) cubic-bezier(0.2, 0.7, 0.2, 1) var(--cv-delay, 0s) both; }
.bulava-canvas.is-visible .bulava-cv-slide-left { animation: bulava-cv-slide-left var(--cv-dur, .8s) cubic-bezier(0.2, 0.7, 0.2, 1) var(--cv-delay, 0s) both; }
.bulava-canvas.is-visible .bulava-cv-slide-right { animation: bulava-cv-slide-right var(--cv-dur, .8s) cubic-bezier(0.2, 0.7, 0.2, 1) var(--cv-delay, 0s) both; }
.bulava-canvas.is-visible .bulava-cv-blur { animation: bulava-cv-blur var(--cv-dur, .8s) ease-out var(--cv-delay, 0s) both; }
.bulava-canvas.is-visible .bulava-cv-pop { animation: bulava-cv-pop var(--cv-dur, .8s) cubic-bezier(0.2, 0.7, 0.2, 1) var(--cv-delay, 0s) both; }
@media (prefers-reduced-motion: reduce) {
  .bulava-template.reveal-ready .bulava-canvas:not(.is-visible) .bulava-cv-in { opacity: 1; }
  .bulava-canvas.is-visible .bulava-cv-in { animation: none; }
}
/* The heirloom look (The Royal Heirloom): headings clear of the page menu, disclosures that open in place,
   clamped text, the hero's photo feathered into the paper and its words coming in as the opening lifts. */
.bulava-look-heirloom [id] { scroll-margin-top: 72px; }
/* Spaced capitals are for Latin script: Devanagari and the other Indic scripts have no capitals and lose their joins when spaced. */
.bulava-template:not([data-script="Latn"]) .bulava-caps { letter-spacing: normal !important; text-transform: none !important; }
.bulava-more > details[open] > summary, .bulava-more-list[open] > summary, .bulava-reply[open] > summary { display: none; }
.bulava-clamp-4, .bulava-clamp-story { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; overflow: hidden; }
.bulava-clamp-story { -webkit-line-clamp: 5; }
@container (min-width: 900px) {
  .bulava-clamp-story { -webkit-line-clamp: 3; }
  .bulava-heirloom-photo { -webkit-mask-image: linear-gradient(to right, #000 76%, transparent); mask-image: linear-gradient(to right, #000 76%, transparent); }
}
.bulava-more:has(> details[open]) .bulava-clamp-4, .bulava-more:has(> details[open]) .bulava-clamp-story { display: block; -webkit-line-clamp: unset; overflow: visible; }
.bulava-ess-wrap:has(.bulava-ess-toggle[open]) .bulava-ess-menu { display: block; }
@supports not selector(:has(*)) {
  .bulava-ess-menu { display: block; }
  .bulava-ess-toggle, .bulava-more > details { display: none; }
  .bulava-clamp-4, .bulava-clamp-story { display: block; -webkit-line-clamp: unset; overflow: visible; }
}
@keyframes bulava-rise-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.bulava-heirloom-words[data-enter="wait"] > * { opacity: 0; }
.bulava-heirloom-words[data-enter="play"] > * { animation: bulava-rise-in 0.8s ease-out both; }
.bulava-heirloom-words[data-enter="play"] > :nth-child(2) { animation-delay: 0.09s; }
.bulava-heirloom-words[data-enter="play"] > :nth-child(3) { animation-delay: 0.18s; }
.bulava-heirloom-words[data-enter="play"] > :nth-child(4) { animation-delay: 0.27s; }
.bulava-heirloom-words[data-enter="play"] > :nth-child(5) { animation-delay: 0.36s; }
.bulava-heirloom-words[data-enter="play"] > :nth-child(6) { animation-delay: 0.45s; }
.bulava-heirloom-words[data-enter="play"] > :nth-child(7) { animation-delay: 0.54s; }
@media (prefers-reduced-motion: reduce) {
  .bulava-heirloom-words[data-enter] > * { opacity: 1; animation: none; }
}
/* The deckle look (The Sacred Garden, ADR-081). Paper sections next to each other join into one sheet: the tears
   between them go and their paper meets (by CSS, so a section that hides itself leaves no tear behind). Sections stay
   put as they come into view (their paper never fades as a block); their words, art and figures come in instead. */
.bulava-look-deckle { font-variation-settings: 'opsz' 72, 'SOFT' 50; }
.bulava-template.reveal-ready.bulava-look-deckle .bulava-reveal { opacity: 1; transform: none; transition: none; }
.bulava-deckle-paper + .bulava-deckle-paper { padding-top: 6px; }
.bulava-deckle-paper + .bulava-deckle-paper .bulava-deckle-top { display: none; }
.bulava-deckle-paper + .bulava-deckle-paper .bulava-deckle-body { top: 0; }
.bulava-deckle-paper:has(+ .bulava-deckle-paper) { padding-bottom: 6px; }
.bulava-deckle-paper:has(+ .bulava-deckle-paper) .bulava-deckle-bottom { display: none; }
.bulava-deckle-paper:has(+ .bulava-deckle-paper) .bulava-deckle-body { bottom: 0; }
.bulava-deckle-paper:has(+ .bulava-deckle-paper) .bulava-deckle-foot { bottom: -6px; }
@keyframes bulava-dk-rise { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: none; } }
@keyframes bulava-dk-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes bulava-dk-zoom { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: none; } }
@keyframes bulava-dk-left { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: none; } }
@keyframes bulava-dk-right { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: none; } }
@keyframes bulava-dk-breathe { from { transform: scale(1) rotate(0deg); } to { transform: scale(1.04) rotate(1.5deg); } }
@keyframes bulava-dk-bob { 0%, 100% { transform: translateY(0); } 55% { transform: translateY(5px); } }
@keyframes bulava-dk-petal { 0% { opacity: 0; transform: translate(0, 0) rotate(0deg); } 12% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dk-dx, 30px), var(--dk-dy, 160px)) rotate(var(--dk-rot, 40deg)); } }
@keyframes bulava-dk-drift { 0% { opacity: 0; transform: translate(0, 0) rotate(0deg); } 12% { opacity: 0.95; } 82% { opacity: 0.85; } 100% { opacity: 0; transform: translate(var(--dk-dx, 30px), var(--dk-dy, 260px)) rotate(var(--dk-rot, 200deg)); } }
.bulava-template.reveal-ready .bulava-reveal:not(.is-visible) :is(.bulava-deckle-rise, .bulava-deckle-fade, .bulava-deckle-zoom, .bulava-deckle-from-left, .bulava-deckle-from-right) { opacity: 0; }
.bulava-reveal.is-visible .bulava-deckle-rise { animation: bulava-dk-rise 2s cubic-bezier(0.2, 0.7, 0.2, 1) var(--dk-delay, 0s) both; }
.bulava-reveal.is-visible .bulava-deckle-fade { animation: bulava-dk-fade 1.5s ease-out var(--dk-delay, 0s) both; }
.bulava-reveal.is-visible .bulava-deckle-zoom { animation: bulava-dk-zoom 1.6s cubic-bezier(0.2, 0.7, 0.2, 1) var(--dk-delay, 0s) both; }
.bulava-reveal.is-visible .bulava-deckle-from-left { animation: bulava-dk-left 2s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.bulava-reveal.is-visible .bulava-deckle-from-right { animation: bulava-dk-right 2s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.bulava-deckle-breathe { transform-origin: var(--dk-origin, center); animation: bulava-dk-breathe 4.2s ease-in-out infinite alternate; }
.bulava-deckle-bob { animation: bulava-dk-bob 1.1s ease-in-out infinite; }
.bulava-deckle-petal { opacity: 0; }
.bulava-reveal.is-visible .bulava-deckle-petal { animation: bulava-dk-petal var(--dk-dur, 5s) ease-in var(--dk-delay, 0s) both; }
.bulava-swans-blossom { opacity: 0; animation: bulava-dk-drift var(--dk-dur, 12s) linear var(--dk-delay, 0s) infinite; }
.bulava-swans-words[data-enter="wait"] > * { opacity: 0; }
.bulava-swans-words[data-enter="play"] > * { animation: bulava-dk-rise 2s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.bulava-swans-words[data-enter="play"] > :nth-child(2) { animation-delay: 0.12s; }
.bulava-swans-words[data-enter="play"] > :nth-child(3) { animation-delay: 0.24s; }
.bulava-swans-words[data-enter="play"] > :nth-child(4) { animation-delay: 0.36s; }
.bulava-swans-words[data-enter="play"] > :nth-child(5) { animation-delay: 0.6s; }
/* The candlelit countdown (countdown "shimmer"): figures ink in from the left one after another and catch the light
   twice; a changing figure rolls up out of sight as the new one rises. */
@keyframes bulava-cd-ink { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@property --cd-pos { syntax: '<percentage>'; inherits: true; initial-value: 100%; }
@keyframes bulava-cd-candle { 0%, 100% { --cd-pos: 100%; } 50% { --cd-pos: 0%; } }
@keyframes bulava-roll-out { to { opacity: 0; transform: translateY(-60%); } }
@keyframes bulava-roll-in { from { opacity: 0; transform: translateY(60%); } to { opacity: 1; transform: none; } }
.bulava-cd-digit { background-image: linear-gradient(105deg, var(--t-secondary-display) 0%, var(--t-secondary-display) 25%, color-mix(in srgb, var(--t-secondary-display) 50%, var(--t-accent)) 46%, var(--t-accent) 52%, color-mix(in srgb, var(--t-secondary-display) 50%, var(--t-accent)) 58%, var(--t-secondary-display) 75%, var(--t-secondary-display) 100%); background-size: 300% 100%; background-position: var(--cd-pos, 100%) 0; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.bulava-template.reveal-ready .bulava-reveal:not(.is-visible) .bulava-cd-num { clip-path: inset(0 100% 0 0); }
.bulava-template.reveal-ready .bulava-reveal:not(.is-visible) :is(.bulava-cd-sep, .bulava-cd-label) { opacity: 0; }
.bulava-reveal.is-visible .bulava-cd-num { animation: bulava-cd-ink 1.1s cubic-bezier(0.4, 0, 0.2, 1) var(--cd-delay, 0s) both, bulava-cd-candle 4.5s ease-in-out calc(var(--cd-delay, 0s) + 1.1s) 2; }
.bulava-reveal.is-visible :is(.bulava-cd-sep, .bulava-cd-label) { animation: bulava-dk-fade 0.8s ease var(--cd-delay, 0s) both; }
.bulava-roll-out { animation: bulava-roll-out 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) forwards; }
.bulava-roll-in { animation: bulava-roll-in 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) 0.12s both; }
/* The schedule's peony rides its stem down as the page scrolls (a scroll timeline); elsewhere it waits at the top. */
.bulava-stem-ride { transform: translateY(-100%); }
@keyframes bulava-stem-ride { from { transform: translateY(-100%); } to { transform: translateY(0); } }
@supports (animation-timeline: view()) {
  .bulava-stem { view-timeline-name: --bulava-stem; }
  .bulava-stem-ride { animation: bulava-stem-ride linear both; animation-timeline: --bulava-stem; animation-range: cover 24% cover 72%; }
}
.bulava-seal-dialog[open] { animation: bulava-dk-zoom 0.35s cubic-bezier(0.2, 0.7, 0.2, 1); }
/* The sealed envelope's prompt: its letters breathe apart and the chevron nudges up (intro "sealedEnvelope"). */
@keyframes bulava-env-pulse { 0%, 100% { letter-spacing: 0.26em; } 50% { letter-spacing: 0.3em; } }
@keyframes bulava-env-nudge { 0%, 100% { translate: 0 0; } 50% { translate: 0 -3px; } }
.bulava-env-label { animation: bulava-env-pulse 2.4s ease-in-out 1.6s infinite; }
.bulava-env-chevron { animation: bulava-env-nudge 2.4s ease-in-out 1.9s infinite; }
@media (prefers-reduced-motion: reduce) {
  .bulava-deckle-breathe, .bulava-deckle-bob, .bulava-stem-ride, .bulava-roll-out, .bulava-roll-in, .bulava-seal-dialog[open] { animation: none !important; }
  .bulava-swans-blossom, .bulava-deckle-petal { display: none; }
  .bulava-reveal.is-visible :is(.bulava-deckle-rise, .bulava-deckle-fade, .bulava-deckle-zoom, .bulava-deckle-from-left, .bulava-deckle-from-right, .bulava-cd-num, .bulava-cd-sep, .bulava-cd-label) { animation: none; }
  .bulava-swans-words[data-enter] > * { opacity: 1; animation: none; }
}
`;

/**
 * Animation styles for templates. Rendered by full previews; pages showing
 * many thumbnails render it once (React hoists and de-duplicates it).
 */
export function TemplateStyles() {
  return (
    <style href="bulava-template-styles" precedence="bulava">
      {STYLES}
    </style>
  );
}

/**
 * A template section behind a host's redrawn section (canvas/artboard.tsx, ADR-065): it lays out on a
 * 390 px phone with an 844 px screen (which screen-high heroes follow) and is zoomed to its board's width:
 * exactly where CSS divides lengths, else to the common phone width at or below the board's. Its words are
 * hidden while the host's text layers carry them (they keep their space); a ticking countdown stays.
 * Rendered by the layer itself, so thumbnails (which leave out the template styles) have it too.
 */
const SECTION_LAYER_STYLES = `
.bulava-sec { --bulava-screen: 8.44px; container-type: inline-size; zoom: 0.75; }
@container (min-width: 300px) { .bulava-sec { zoom: 0.7692; } }
@container (min-width: 320px) { .bulava-sec { zoom: 0.8205; } }
@container (min-width: 340px) { .bulava-sec { zoom: 0.8718; } }
@container (min-width: 360px) { .bulava-sec { zoom: 0.9231; } }
@container (min-width: 375px) { .bulava-sec { zoom: 0.9615; } }
@container (min-width: 384px) { .bulava-sec { zoom: 0.9846; } }
@container (min-width: 390px) { .bulava-sec { zoom: 1; } }
@container (min-width: 393px) { .bulava-sec { zoom: 1.0077; } }
@container (min-width: 400px) { .bulava-sec { zoom: 1.0256; } }
@container (min-width: 412px) { .bulava-sec { zoom: 1.0564; } }
@container (min-width: 414px) { .bulava-sec { zoom: 1.0615; } }
@container (min-width: 428px) { .bulava-sec { zoom: 1.0974; } }
@container (min-width: 430px) { .bulava-sec { zoom: 1.1026; } }
@container (min-width: 440px) { .bulava-sec { zoom: 1.1282; } }
@container (min-width: 460px) { .bulava-sec { zoom: 1.1795; } }
@container (min-width: 480px) { .bulava-sec { zoom: 1.2308; } }
@container (min-width: 500px) { .bulava-sec { zoom: 1.2821; } }
@container (min-width: 540px) { .bulava-sec { zoom: 1.3846; } }
@container (min-width: 600px) { .bulava-sec { zoom: 1.5385; } }
@container (min-width: 680px) { .bulava-sec { zoom: 1.7436; } }
@container (min-width: 768px) { .bulava-sec { zoom: 1.9692; } }
@container (min-width: 820px) { .bulava-sec { zoom: 2.1026; } }
@container (min-width: 860px) { .bulava-sec { zoom: 2.2051; } }
@supports (zoom: calc(100cqw / 1px)) { .bulava-sec { zoom: calc(100cqw / 390px); } }
.bulava-sec-words-off * { -webkit-text-fill-color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; }
.bulava-sec-words-off [data-live], .bulava-sec-words-off [data-live] * { -webkit-text-fill-color: currentcolor !important; }
.bulava-sec-words-off a { visibility: hidden !important; }
`;

export function SectionLayerStyles() {
  return (
    <style href="bulava-section-layer-styles" precedence="bulava">
      {SECTION_LAYER_STYLES}
    </style>
  );
}
