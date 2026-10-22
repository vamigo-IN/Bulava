import { buildCss, motionCss } from './motion';

/**
 * The stage's stylesheet (final.md §2.2, §3.1.4–3.1.6, §3.8, §3.9), rendered
 * once per page by every stage hero (React hoists and de-duplicates it):
 *
 *  - `--u` on the stage box from container units, so the server writes the
 *    same strings for every screen (fixed boxes set --u inline in px instead);
 *  - the motion kinds and build-ins compiled once;
 *  - the rig's breath (on the individual rotate/translate properties, so the
 *    scroll dolly's transform composes with it), paused off screen and while
 *    an opening plays;
 *  - 3D typography by line (`.bulava-type-pre` hides, `.bulava-type` plays),
 *    the words' scrims hidden and shown with their lines (the head's with the head, the tail's after the names);
 *  - the hero's foot fading into the section that follows (its band, read
 *    with :has(); the hero's own ground where the page does not show one);
 *  - reduced motion: the rest pose and nothing moving, no particles, no
 *    build-in or type-in, the stage opening's overlay hidden from first paint.
 *
 * Structure (frame, lens, chain, pieces) is inline in StageView, so stills and
 * films need none of this.
 */
export const STAGE_CSS = `
.bulava-stage { --u: max(calc(100cqh / 800), calc(100cqw / 1200)); }
@supports not (height: 1cqh) { .bulava-stage { --u: calc(100vh / 800); } }
${motionCss}
${buildCss}
@keyframes bulava-stage-breath {
  0% { rotate: y 0deg; translate: 0 0 0; animation-timing-function: cubic-bezier(0.61, 1, 0.88, 1); }
  25% { rotate: y 1.5deg; translate: 0 0 calc(10 * var(--u)); animation-timing-function: cubic-bezier(0.12, 0, 0.39, 0); }
  50% { rotate: y 0deg; translate: 0 0 0; animation-timing-function: cubic-bezier(0.61, 1, 0.88, 1); }
  75% { rotate: y -1.5deg; translate: 0 0 calc(-10 * var(--u)); animation-timing-function: cubic-bezier(0.12, 0, 0.39, 0); }
  100% { rotate: y 0deg; translate: 0 0 0; }
}
.bulava-stage:is([data-mode="live"], [data-mode="preview"]) .bulava-stage-rig { animation: bulava-stage-breath 12s infinite; }
[data-opening-state="playing"] .bulava-stage-rig { animation: none; }
.bulava-stage-off, .bulava-stage-off * { animation-play-state: paused !important; }
[data-stage-words] [data-line] { display: inline-block; }
.bulava-type-pre [data-line], .bulava-type-pre [data-type-fade] { opacity: 0; }
@keyframes bulava-type-in { from { transform: perspective(600px) rotateX(-80deg); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes bulava-type-foil { from { background-position: 110% 0; -webkit-text-fill-color: transparent; text-shadow: none; } to { background-position: -10% 0; -webkit-text-fill-color: transparent; text-shadow: none; } }
@keyframes bulava-type-fade { from { opacity: 0; } to { opacity: 1; } }
.bulava-type [data-line] {
  transform-origin: 50% 100%;
  background-image: linear-gradient(105deg, currentColor 0 40%, #fff6d6 50%, currentColor 60% 100%);
  background-size: 300% 100%;
  background-position: -10% 0;
  -webkit-background-clip: text;
  background-clip: text;
  animation: bulava-type-in 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) both, bulava-type-foil 1.4s ease-in-out 0.9s;
}
.bulava-type [data-line]:nth-child(2) { animation-delay: 0.12s, 1.02s; }
.bulava-type [data-line]:nth-child(3) { animation-delay: 0.24s, 1.14s; }
.bulava-type [data-type-fade] { animation: bulava-type-fade 0.8s ease-out both; }
.bulava-type [data-type-fade="tail"] { animation-delay: 0.7s; }
.bulava-stage-scrim { position: absolute; z-index: -1; inset: -0.75rem -1.5rem -0.5rem; border-radius: 3rem; background: var(--bulava-scrim, transparent); box-shadow: 0 0 3rem 3.25rem var(--bulava-scrim, transparent); pointer-events: none; }
.bulava-type-pre .bulava-stage-scrim { opacity: 0; }
.bulava-type .bulava-stage-scrim { animation: bulava-type-fade 0.8s ease-out 0.7s both; }
.bulava-type .bulava-stage-scrim[data-scrim="head"] { animation-delay: 0s; }
[data-bulava-stage-hero]:has(+ .bulava-band-primary) { --bulava-stage-foot: var(--t-primary); }
[data-bulava-stage-hero]:has(+ .bulava-band-deep) { --bulava-stage-foot: var(--t-deep); }
[data-bulava-stage-hero][data-stage-tone="light"]:has(+ .bulava-band-accent) { --bulava-stage-foot: var(--t-accent); }
[data-bulava-stage-hero][data-stage-tone="light"]:has(+ [class*="bg-[var(--t-surface)]"]) { --bulava-stage-foot: var(--t-surface); }
@media (prefers-reduced-motion: reduce) {
  .bulava-stage, .bulava-stage *, [data-stage-words], [data-stage-words] * { animation: none !important; }
  .bulava-stage .bulava-particle { display: none !important; }
  .bulava-unbuilt [data-build] { transform: none !important; opacity: 1 !important; }
  .bulava-type-pre [data-line], .bulava-type-pre [data-type-fade], .bulava-type-pre .bulava-stage-scrim { opacity: 1 !important; }
  [data-stage-opening] { display: none !important; }
}
`;

/** The stage stylesheet (one per page). */
export function StageStyles() {
  return (
    <style href="bulava-stage" precedence="bulava">
      {STAGE_CSS}
    </style>
  );
}
