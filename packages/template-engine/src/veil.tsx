/**
 * The free plan's mark (ADR-067): the site's address tiled across the whole
 * invitation, faint enough to read the invitation through, impossible to crop
 * away. Two tones (a dark fill with a light edge) keep it visible on light and
 * dark designs alike. It never takes a tap, a click or a screen reader's turn.
 */
export function WatermarkVeil({ text }: { text: string }) {
  // Only an address's characters reach the drawing.
  const label = text.replace(/[^A-Za-z0-9.\- ]/g, '').slice(0, 40) || 'bulava.in';
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='170'>` +
    `<text x='130' y='85' text-anchor='middle' dominant-baseline='middle' transform='rotate(-28 130 85)' ` +
    `font-family='Arial, Helvetica, sans-serif' font-size='24' font-weight='700' letter-spacing='1' ` +
    `fill='rgba(20,20,20,0.16)' stroke='rgba(255,255,255,0.22)' stroke-width='1'>${label}</text></svg>`;
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
        backgroundSize: '260px 170px',
      }}
    />
  );
}
