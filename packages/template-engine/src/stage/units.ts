/**
 * Signature 3D stages (ADR-078): the stage's units and the only number
 * formatters used in transform strings, so the server and the browser (and
 * Remotion) write identical CSS.
 *
 * World axes: x right, y down, z toward the viewer. The set lies at negative z,
 * and d = -z is a piece's distance from the rest eye. Authors place pieces by d.
 */

export const FRAME_W = 1200; // stage units: the frame's width (as the 2.5D scenes)
export const FRAME_H = 800;
export const HORIZON_Y = 440; // the principal point's y: the horizon sits at 55% of the frame on every screen
export const FLOOR_Y = 800;
export const REST_EYE = { x: 600, y: 330, z: 0 } as const; // 470 above the floor, pitch 0
export const NEAR_FADE = 150; // props fade to 0 within this distance of the eye

/** Two decimals, no exponent, no "-0": the only number formatter for transform strings (server and client agree). */
export const num = (n: number): string => {
  const r = Math.round(n * 100) / 100;
  return r === 0 ? '0' : String(r);
};

/** A stage length as CSS: n units of the stage box's --u. */
export const u = (n: number): string => (n === 0 ? '0' : `calc(${num(n)} * var(--u))`);

/** The perspective distance (units) of a vertical field of view in degrees: 60 -> 692.82. */
export const perspectiveOf = (fov: number): number => Math.round((400 / Math.tan((fov * Math.PI) / 360)) * 100) / 100;

/** An angle in degrees as CSS. */
export const deg = (n: number): string => `${num(n)}deg`;

/** Clamp to [lo, hi]. */
export const clamp = (n: number, lo = 0, hi = 1): number => (n < lo ? lo : n > hi ? hi : n);
