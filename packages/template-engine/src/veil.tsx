/**
 * The free plan's mark (ADR-067): the site's address tiled across the whole
 * invitation, faint enough to read the invitation through, impossible to crop
 * away. Two tones (a dark fill with a light edge) keep it visible on light and
 * dark designs alike. It never takes a tap, a click or a screen reader's turn.
 * Free digital cards wear it too, a little firmer, with tiles sized to the
 * card (`tile`, a CSS width such as `38cqw`) so every format and every export
 * shows the same number of marks.
 */
export function WatermarkVeil({ text, tile = '260px', firm = false }: { text: string; tile?: string; firm?: boolean }) {
  // Only an address's characters reach the drawing.
  const label = text.replace(/[^A-Za-z0-9.\- ]/g, '').slice(0, 40) || 'bulava.in';
  // Cards: a light fill with a dark edge, bigger, so the address reads on dark stock (maroon, navy) as well as on ivory.
  const [fill, edge, size, width] = firm ? ['rgba(255,255,255,0.34)', 'rgba(20,20,20,0.3)', 30, 1.2] : ['rgba(20,20,20,0.16)', 'rgba(255,255,255,0.22)', 24, 1];
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='170' viewBox='0 0 260 170'>` +
    `<text x='130' y='85' text-anchor='middle' dominant-baseline='middle' transform='rotate(-28 130 85)' ` +
    `font-family='Arial, Helvetica, sans-serif' font-size='${size}' font-weight='700' letter-spacing='1' ` +
    `fill='${fill}' stroke='${edge}' stroke-width='${width}'>${label}</text></svg>`;
  return (
    <div
      aria-hidden="true"
      data-watermark-veil=""
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 45,
        pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`,
        backgroundRepeat: 'repeat',
        backgroundSize: `${tile} calc(${tile} * 170 / 260)`,
      }}
    />
  );
}
