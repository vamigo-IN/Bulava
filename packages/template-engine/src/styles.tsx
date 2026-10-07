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
/* Bands: whole sections on the primary or accent colour, with inks computed for that colour (see themeStyle). */
.bulava-band-primary { background-color: var(--t-primary); color: var(--bp-text); --t-text: var(--bp-text); --t-muted-ink: var(--bp-muted); --t-primary-ink: var(--bp-primary-ink); --t-secondary-ink: var(--bp-secondary-ink); --t-accent-ink: var(--bp-accent-ink); --t-heading-ink: var(--bp-accent-ink); --t-card: rgb(255 255 255 / 0.08); --t-card-alt: rgb(255 255 255 / 0.12); --t-line: color-mix(in srgb, var(--t-accent) 45%, transparent); --t-button: var(--bp-button); --t-on-button: var(--bp-on-button); }
.bulava-band-accent { background-color: var(--t-accent); color: var(--ba-text); --t-text: var(--ba-text); --t-muted-ink: var(--ba-muted); --t-primary-ink: var(--ba-primary-ink); --t-secondary-ink: var(--ba-secondary-ink); --t-accent-ink: var(--ba-accent-ink); --t-heading-ink: var(--ba-accent-ink); --t-card: rgb(255 255 255 / 0.1); --t-card-alt: rgb(255 255 255 / 0.16); --t-line: color-mix(in srgb, var(--t-primary) 35%, transparent); --t-button: var(--ba-button); --t-on-button: var(--ba-on-button); }
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
  .bulava-flicker, .bulava-glow, .bulava-float-up, .bulava-sway-soft, .bulava-orb, .bulava-medallion, .bulava-vinyl, .bulava-flip-leaf { animation: none; }
  .bulava-flip, .bulava-curtain, .bulava-3d-card, .bulava-tilt { transition: none; }
  .bulava-float-up { display: none; }
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
