/**
 * Built-in sample "photos" for template previews and tests: small SVG
 * illustrations as data URIs. They need no network, leak nothing to third
 * parties, pass any CSP that allows data: images, and render in Remotion.
 */

interface Palette {
  top: string;
  bottom: string;
  ink: string;
  accent: string;
}

const PALETTES: Palette[] = [
  { top: '#f7d9c4', bottom: '#c9786b', ink: '#6b2737', accent: '#f2b33d' },
  { top: '#fbe7b5', bottom: '#e39b3b', ink: '#7a3312', accent: '#fff4d6' },
  { top: '#d7ece8', bottom: '#5f9f98', ink: '#1f4d4a', accent: '#f6d68b' },
  { top: '#f3d1dc', bottom: '#a8566f', ink: '#4a1830', accent: '#f7c9a0' },
  { top: '#e9e2f5', bottom: '#8b79b8', ink: '#3a2d63', accent: '#f4d58d' },
  { top: '#e3ecd6', bottom: '#7f9b62', ink: '#33461f', accent: '#f1c75b' },
];

const W = 1200;
const H = 800;

function bokeh(seed: number): string {
  const spots: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const x = (seed * 137 + i * 211) % W;
    const y = (seed * 71 + i * 97) % (H * 0.55);
    const r = 30 + ((seed + i * 13) % 5) * 18;
    spots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="url(#s)"/>`);
  }
  return spots.join('');
}

function arch(p: Palette): string {
  return (
    `<path d="M420 800V430q0-190 180-250q180 60 180 250v370z" fill="${p.ink}" opacity=".32"/>` +
    `<path d="M470 800V450q0-150 130-200q130 50 130 200v350z" fill="${p.accent}" opacity=".35"/>` +
    `<rect x="340" y="760" width="520" height="40" fill="${p.ink}" opacity=".4"/>`
  );
}

function garlands(p: Palette): string {
  const beads: string[] = [];
  for (const [y0, sag] of [
    [90, 120],
    [60, 210],
  ] as const) {
    for (let i = 0; i <= 24; i += 1) {
      const tt = i / 24;
      const x = tt * W;
      const y = y0 + sag * 4 * tt * (1 - tt);
      beads.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="17" fill="${i % 2 ? p.accent : '#f08a24'}"/>`);
    }
  }
  return beads.join('') + `<path d="M0 800q300-120 600-60t600-20v80z" fill="${p.ink}" opacity=".3"/>`;
}

function diyas(p: Palette): string {
  const lamps: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const x = 180 + i * 210;
    lamps.push(
      `<circle cx="${x}" cy="520" r="90" fill="url(#s)"/>` +
        `<path d="M${x - 60} 600q60 60 120 0z" fill="${p.ink}" opacity=".75"/>` +
        `<path d="M${x} 520q-22 40 0 70q22-30 0-70z" fill="${p.accent}"/>`,
    );
  }
  return lamps.join('') + `<rect y="640" width="${W}" height="160" fill="${p.ink}" opacity=".25"/>`;
}

function mandala(p: Palette): string {
  const petals: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    petals.push(`<ellipse cx="600" cy="280" rx="38" ry="120" fill="${p.accent}" opacity=".45" transform="rotate(${i * 30} 600 400)"/>`);
  }
  return (
    petals.join('') +
    `<circle cx="600" cy="400" r="90" fill="${p.ink}" opacity=".35"/>` +
    `<circle cx="600" cy="400" r="250" fill="none" stroke="${p.ink}" stroke-opacity=".3" stroke-width="6"/>`
  );
}

function portrait(p: Palette, flip: boolean): string {
  const cx = flip ? 700 : 500;
  return (
    `<circle cx="${cx}" cy="330" r="120" fill="${p.ink}" opacity=".45"/>` +
    `<path d="M${cx - 260} 800q0-270 260-270t260 270z" fill="${p.ink}" opacity=".45"/>` +
    `<path d="M${cx + (flip ? -260 : 60)} 800q60-220 200-250" fill="none" stroke="${p.accent}" stroke-width="18" opacity=".6"/>`
  );
}

const SCENES = [arch, garlands, diyas, mandala];

/** Sample image n (1-based). 5 and 6 are portraits for the couple section. */
export function sampleImageDataUri(n: number): string {
  const p = PALETTES[(n - 1) % PALETTES.length]!;
  const body = n >= 5 ? portrait(p, n % 2 === 0) : SCENES[(n - 1) % SCENES.length]!(p);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.top}"/><stop offset="1" stop-color="${p.bottom}"/></linearGradient>` +
    `<radialGradient id="s"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#g)"/>${bokeh(n)}${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const SAMPLE_IMAGE_SIZE = { width: W, height: H } as const;
