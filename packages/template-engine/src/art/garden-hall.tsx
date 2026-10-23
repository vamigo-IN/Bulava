import type { ReactNode } from 'react';
import { blend, cuspedHead, hex, Metal, onCubic, tint, useSafeId, type IllustrationProps, type Segment } from './kit';
import { r2, rand } from './motifs';

/**
 * The Sacred Garden's venue: a domed hall in the Indo-Islamic style, drawn like an architect's pen-and-ink sketch with
 * soft sepia washes (an engraved stationery vignette for the location section, under the venue's name).
 *
 * A gentle three-quarter view of a long arcaded front: a large onion dome on a high drum behind a tall pishtaq (an
 * iwan arch in a double frame between two slim corner turrets, its door lit), a chhatri on each wing, a minaret with
 * two balconies and a domed kiosk at the far end, eight pointed arches along a shaded veranda (a few lamps alight),
 * jaali parapets, kangura merlons and guldasta pinnacles, broad shallow steps with thin railings, a ground line with a
 * soft shadow and a warm cream halo that fades into the page. No words or signage.
 *
 * The building is modelled in plan units (x along the front, y up, z back from the front) and seen through one fixed
 * camera: arithmetic only (the camera's turn is a pair of constants, never trigonometry), rounded to a tenth of a
 * pixel, so the server and every browser write the same markup. Repeated pieces (arches, windows, lattice, merlons,
 * pinnacles) are drawn once in elevation and placed on their walls with the affine transform that matches the
 * perspective there. Light comes from the upper left and front: fronts are lit, left returns washed and hatched,
 * recesses deep. The tint is the ink; the washes are the page's cream deepened toward it; lamplight keeps its own warm
 * colour. No filters, masks or clip paths.
 */

// ── The camera: the front turned about 25° away (cosine and sine as constants), the eye at the veranda's springing ──
const CA = 0.9075;
const SA = 0.42;
const D0 = 88;
const EYE = 7.5;
const FL = 389;
const OX = 38.6;
const HZ = 170;

// ── Heights (plan units) ──
const PL = 2.2; // the terrace, reached by six shallow steps
const EAVE = PL + 7.5; // the veranda's chhajja
const PAR = EAVE + 1.6; // the veranda's parapet
const WING = PL + 13.7; // the wings' walls and parapet
const WINGP = WING + 1;
const HALL = PL + 13.5; // the hall's front wall, above the veranda
const HALLP = HALL + 0.9;
const GATE = PL + 18.1; // the pishtaq
const GATEP = GATE + 1;
const STEPS = 6;
const RISE = PL / STEPS;
const RUN = 1.15;

const LAMPLIGHT = '#ffe2a8';

type V3 = readonly [number, number, number];
const dep = (x: number, z: number) => D0 + SA * x + CA * z;
const sx = (x: number, z: number) => OX + (FL * (CA * x - SA * z)) / dep(x, z);
const sy = (x: number, y: number, z: number) => HZ - (FL * (y - EYE)) / dep(x, z);
const t1 = (v: number) => Math.round(v * 10) / 10;
const t3 = (v: number) => Math.round(v * 1000) / 1000;
const at = (x: number, y: number, z: number) => `${t1(sx(x, z))} ${t1(sy(x, y, z))}`;
const poly = (...p: V3[]) => `M${p.map((q) => at(q[0], q[1], q[2])).join('L')}Z`;
const seg = (a: V3, b: V3) => `M${at(a[0], a[1], a[2])}L${at(b[0], b[1], b[2])}`;
/** A rectangle on a wall facing the viewer (z fixed). */
const fr = (x0: number, x1: number, y0: number, y1: number, z: number) => `M${at(x0, y0, z)}L${at(x1, y0, z)}V${t1(sy(x1, y1, z))}L${at(x0, y1, z)}Z`;
/** A rectangle on a wall facing left (x fixed), between two depths. */
const sd = (x: number, z0: number, z1: number, y0: number, y1: number) => `M${at(x, y0, z0)}L${at(x, y0, z1)}V${t1(sy(x, y1, z1))}L${at(x, y1, z0)}Z`;
const hl = (x0: number, x1: number, y: number, z: number) => seg([x0, y, z], [x1, y, z]);
const vl = (x: number, z: number, y0: number, y1: number) => `M${at(x, y0, z)}v${t1(sy(x, y1, z) - sy(x, y0, z))}`;
/** A small circle (a carved roundel) on a wall facing the viewer. */
const roundel = (x: number, y: number, z: number, r: number) => {
  const q = t1((r * FL) / dep(x, z));
  return `M${t1(sx(x, z) - q)} ${t1(sy(x, y, z))}a${q} ${q} 0 1 0 ${t1(2 * q)} 0a${q} ${q} 0 1 0 -${t1(2 * q)} 0`;
};

const matrix = (a: number, b: number, d: number, e: number, f: number) => `matrix(${r2(a)} ${t3(b)} 0 ${r2(d)} ${t1(e)} ${t1(f)})`;
/**
 * Places a piece drawn in elevation (local units, v downward, drawn sw × sh) on a wall facing the viewer, its top
 * left at (x0, y0) and w × h plan units large: the affine transform that matches the perspective at its centre.
 */
function onFront(x0: number, y0: number, z: number, w: number, h: number, sw = w, sh = h): string {
  const xc = x0 + w / 2;
  const yc = y0 - h / 2;
  const a = (sx(x0 + w, z) - sx(x0, z)) / sw;
  const b = (sy(x0 + w, yc, z) - sy(x0, yc, z)) / sw;
  const d = (sy(xc, y0 - h, z) - sy(xc, y0, z)) / sh;
  return matrix(a, b, d, sx(xc, z) - (a * sw) / 2, sy(xc, yc, z) - (b * sw) / 2 - (d * sh) / 2);
}
/** The same on a wall facing left (x fixed): local u runs toward the front, from depth z0. */
function onSide(x: number, z0: number, y0: number, w: number, h: number, sw = w, sh = h): string {
  const zc = z0 - w / 2;
  const yc = y0 - h / 2;
  const a = (sx(x, z0 - w) - sx(x, z0)) / sw;
  const b = (sy(x, yc, z0 - w) - sy(x, yc, z0)) / sw;
  const d = (sy(x, y0 - h, zc) - sy(x, y0, zc)) / sh;
  return matrix(a, b, d, sx(x, zc) - (a * sw) / 2, sy(x, yc, zc) - (b * sw) / 2 - (d * sh) / 2);
}
/** Round things (domes, drums, the minaret) are drawn in plan units about their axis: local y is minus the height. */
const onAxis = (x: number, z: number) => `translate(${t1(sx(x, z))} ${t1(sy(x, 0, z))}) scale(${t3(FL / dep(x, z))})`;
/** A small piece stood upright at a point, sized by the depth there. */
const onPoint = (x: number, y: number, z: number, s = 1) => `translate(${at(x, y, z)}) scale(${t3((s * FL) / dep(x, z))})`;
/** How far the near side of a ring of radius r at height y rises above its ends (plan units): rings above the eye arch up. */
const sagOf = (x: number, z: number, y: number, r: number) => ((y - EYE) * r) / (dep(x, z) - r);

/** Diagonal hatching (rising to the right) inside a wall seen in perspective: vertical sides xl < xr, straight top and foot. */
function hatch(xl: number, xr: number, tl: number, tr: number, bl: number, br: number, gap: number): string {
  const w = xr - xl;
  if (w < 0.6) return '';
  const mt = (tr - tl) / w;
  const mb = (br - bl) / w;
  let d = '';
  for (let c = xl + tl + gap * 0.5; c < xr + br; c += gap) {
    const xa = Math.max(xl, (c - bl + mb * xl) / (1 + mb));
    const xb = Math.min(xr, (c - tl + mt * xl) / (1 + mt));
    const run = t1(xb - xa);
    if (run > 0.25) d += `M${t1(xa)} ${t1(c - xa)}l${run} -${run}`;
  }
  return d;
}
/** Hatching on a wall facing left, between depths z0 (front) and z1 (back). */
const hatchSide = (x: number, z0: number, z1: number, y0: number, y1: number, gap = 1.8) =>
  hatch(sx(x, z1), sx(x, z0), sy(x, y1, z1), sy(x, y1, z0), sy(x, y0, z1), sy(x, y0, z0), gap);

// ── Arches and domes in elevation ──

/** A pointed Mughal arch head from (x0, vs) over its apex (mid, va) down to (x1, vs), continuing a path (v downward). */
function head(x0: number, x1: number, vs: number, va: number): string {
  const w = x1 - x0;
  const h = vs - va;
  const m = (x0 + x1) / 2;
  return `C${r2(x0)} ${r2(vs - 0.56 * h)} ${r2(x0 + 0.28 * w)} ${r2(va + 0.24 * h)} ${r2(m)} ${r2(va)}C${r2(x1 - 0.28 * w)} ${r2(va + 0.24 * h)} ${r2(x1)} ${r2(vs - 0.56 * h)} ${r2(x1)} ${r2(vs)}`;
}
const archD = (x0: number, x1: number, vs: number, va: number, vb: number) => `M${r2(x0)} ${r2(vb)}V${r2(vs)}${head(x0, x1, vs, va)}V${r2(vb)}Z`;
/** The height (v) of that head above u: a bisection on its half, arithmetic only. */
function headAt(x0: number, x1: number, vs: number, va: number, u: number): number {
  const w = x1 - x0;
  const h = vs - va;
  const m = (x0 + x1) / 2;
  const q = u <= m ? u : x0 + x1 - u;
  const s: Segment = [
    [x0, vs],
    [x0, vs - 0.56 * h],
    [x0 + 0.28 * w, va + 0.24 * h],
    [m, va],
  ];
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (onCubic(s, mid).x < q) lo = mid;
    else hi = mid;
  }
  return onCubic(s, (lo + hi) / 2).y;
}
/** The same arch on a wall facing the viewer, in perspective (y up: springing ys, apex ya, foot yb): the head alone when yb is ys, else with its jambs (closed unless `close` is false). */
function archF(x0: number, x1: number, ys: number, ya: number, yb: number, z: number, close = true): string {
  const w = x1 - x0;
  const h = ya - ys;
  const m = (x0 + x1) / 2;
  const headPart = `C${at(x0, ys + 0.56 * h, z)} ${at(x0 + 0.28 * w, ya - 0.24 * h, z)} ${at(m, ya, z)}C${at(x1 - 0.28 * w, ya - 0.24 * h, z)} ${at(x1, ys + 0.56 * h, z)} ${at(x1, ys, z)}`;
  return yb === ys ? `M${at(x0, ys, z)}${headPart}` : `M${at(x0, yb, z)}L${at(x0, ys, z)}${headPart}L${at(x1, yb, z)}${close ? 'Z' : ''}`;
}

/** The right half of an onion dome (neck rb at yb, swelling to rm, an ogee to the apex), u scaled by f (a meridian). */
/** Plan units about an axis are at least 2.4 px each: a tenth is fine enough. */
const q = t1;
function onionRight(rb: number, rm: number, yb: number, hgt: number, f = 1): Array<readonly [number, number]> {
  return [
    [rb * f, yb],
    [(rb + 0.6 * (rm - rb)) * f, yb + 0.06 * hgt],
    [rm * f, yb + 0.14 * hgt],
    [rm * f, yb + 0.3 * hgt],
    [rm * f, yb + 0.5 * hgt],
    [0.62 * rm * f, yb + 0.66 * hgt],
    [0.3 * rm * f, yb + 0.82 * hgt],
    [0.14 * rm * f, yb + 0.9 * hgt],
    [0.05 * rm * f, yb + 0.95 * hgt],
    [0, yb + hgt],
  ];
}
/** An onion dome's outline about its axis (local units, v = −height), its foot a ring arching up by `sag`. */
function onion(rb: number, rm: number, yb: number, hgt: number, sag: number): string {
  const p = onionRight(rb, rm, yb, hgt);
  const P = (i: number, sgn = 1) => `${q(sgn * p[i]![0])} ${q(-p[i]![1])}`;
  return `M${P(0, -1)}Q0 ${q(-yb - 2 * sag)} ${P(0)}C${P(1)} ${P(2)} ${P(3)}C${P(4)} ${P(5)} ${P(6)}C${P(7)} ${P(8)} ${P(9)}C${P(8, -1)} ${P(7, -1)} ${P(6, -1)}C${P(5, -1)} ${P(4, -1)} ${P(3, -1)}C${P(2, -1)} ${P(1, -1)} ${P(0, -1)}Z`;
}
/** Meridians across an onion dome (fractions of its half-width, negative on the lit side), as hatching. */
function meridians(rb: number, rm: number, yb: number, hgt: number, sag: number, fs: number[]): string {
  return fs
    .map((f) => {
      const p = onionRight(rb, rm, yb, hgt, f);
      const lift = sag * Math.sqrt(Math.max(0, 1 - f * f));
      const P = (i: number) => `${q(p[i]![0])} ${q(-p[i]![1] - (i === 0 ? lift : 0))}`;
      return `M${P(0)}C${P(1)} ${P(2)} ${P(3)}C${P(4)} ${P(5)} ${P(6)}C${P(7)} ${P(8)} ${P(9)}`;
    })
    .join('');
}
/** A ring's near half (local units about an axis): from −r to r at height y, its middle lifted by sag. */
const ring = (r: number, y: number, sag: number) => `M${q(-r)} ${q(-y)}Q0 ${q(-y - 2 * sag)} ${q(r)} ${q(-y)}`;
/** A drum or shaft between two heights (radius r0 at y0, r1 at y1), both ends rings. */
const drumD = (r0: number, y0: number, s0: number, r1: number, y1: number, s1: number) =>
  `M${q(-r0)} ${q(-y0)}Q0 ${q(-y0 - 2 * s0)} ${q(r0)} ${q(-y0)}L${q(r1)} ${q(-y1)}Q0 ${q(-y1 - 2 * s1)} ${q(-r1)} ${q(-y1)}Z`;

/** Fractions across a round thing's visible half (sines of evenly spaced bearings) and their foreshortening. */
const ACROSS = [-0.94, -0.77, -0.5, -0.17, 0.17, 0.5, 0.77, 0.94];
const SIX = [-0.9, -0.6, -0.2, 0.2, 0.6, 0.9];
const across = (s: number) => Math.sqrt(Math.max(0, 1 - s * s));
const lum = (c: string) => {
  const v = Number.parseInt(hex(c).slice(1), 16);
  return ((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11;
};

export function DomedHall({ color, colors, foil, className, style }: IllustrationProps) {
  const id = useSafeId();
  const ink = hex(color);
  // The page's cream (or the surface's, or a cream made from the ink on a dark palette), lightened for lit stone.
  const page = lum(colors.background) > 170 ? hex(colors.background) : lum(colors.surface) > 170 ? hex(colors.surface) : tint(ink, 0.86);
  const paper = blend(page, '#ffffff', 0.62);
  const cream = blend(paper, ink, 0.06);
  const wash = blend(paper, ink, 0.2);
  const shadow = blend(paper, ink, 0.34);
  const deep = blend(paper, ink, 0.56);
  const gold = hex(colors.secondary);
  const gilt = foil ? `url(#${id}f)` : blend(gold, ink, 0.2);
  // Pen weights in pixels.
  const H = 1.02;
  const M = 0.66;
  const F = 0.44;
  const R = 0.3;

  // Painted back to front; strokes of one weight drawn one after another share a path.
  const out: ReactNode[] = [];
  let ink1: { d: string; w: number; o: number | undefined } | null = null;
  const flush = () => {
    if (ink1) out.push(<path key={out.length} d={ink1.d} strokeWidth={ink1.w} opacity={ink1.o} />);
    ink1 = null;
  };
  const pen = (d: string, w: number, o?: number) => {
    if (!d) return;
    if (ink1 && ink1.w === w && ink1.o === o) ink1.d += d;
    else {
      flush();
      ink1 = { d, w, o };
    }
  };
  const fill = (d: string, f: string, o?: number) => {
    flush();
    out.push(<path key={out.length} d={d} fill={f} stroke="none" opacity={o} />);
  };
  const face = (d: string, f: string, w: number) => {
    flush();
    out.push(<path key={out.length} d={d} fill={f} strokeWidth={w} />);
  };
  const place = (ref: string, transform: string) => {
    flush();
    out.push(<use key={out.length} href={`#${id}${ref}`} transform={transform} />);
  };
  const group = (transform: string, children: ReactNode) => {
    flush();
    out.push(
      <g key={out.length} transform={transform}>
        {children}
      </g>,
    );
  };

  // ── The terrace's top (the building stands on it) ──
  fill(poly([-1.5, PL, -4], [120, PL, -4], [120, PL, 0], [-1.5, PL, 0]), paper);

  // ── The great dome behind the pishtaq: a high drum of blind niches, a lotus collar, the onion and its finial ──
  const DX = 59;
  const DZ = 11;
  const domeTop = 24.6;
  {
    const k = FL / dep(DX, DZ);
    const w = (px: number) => r2(px / k);
    const sag = (y: number, r: number) => sagOf(DX, DZ, y, r);
    const niches = ACROSS.slice(0, 3)
      .map((s) => {
        const c = across(s);
        const u = 8.4 * s;
        const hw = 0.75 * c;
        const lift = sag(20, 8.4) * c;
        const vb = -HALL - 1.4 - lift;
        const vs = -21.4 - lift;
        const va = -22.4 - lift;
        return `M${q(u - hw)} ${q(vb)}V${q(vs)}Q${q(u - hw)} ${q(va + 0.3)} ${q(u)} ${q(va)}Q${q(u + hw)} ${q(va + 0.3)} ${q(u + hw)} ${q(vs)}V${q(vb)}Z`;
      })
      .join('');
    const petals = [-0.97, -0.85, -0.66, -0.42, -0.14, 0.14, 0.42, 0.66, 0.85, 0.97]
      .map((s) => {
        const c = across(s);
        const u = 8.5 * s;
        const hw = 0.95 * Math.max(0.25, c);
        const lift = sag(24, 8.5) * c;
        const vb = -23.8 - lift;
        const vt = -24.75 - lift;
        return `M${q(u - hw)} ${q(vb)}Q${q(u - hw)} ${q(vt)} ${q(u)} ${q(vt - 0.1)}Q${q(u + hw)} ${q(vt)} ${q(u + hw)} ${q(vb)}`;
      })
      .join('');
    const sOn = sag(domeTop, 8.4);
    group(
      onAxis(DX, DZ),
      <>
        <path d={drumD(8.4, HALL, sag(HALL, 8.4), 8.4, 23.8, sag(23.8, 8.4))} fill={`url(#${id}c)`} strokeWidth={w(M)} />
        <path d={niches} fill={shadow} strokeWidth={w(R)} />
        <path d={`${ring(8.4, 23.2, sag(23.2, 8.4))}${ring(8.4, 19.6, sag(19.6, 8.4))}`} strokeWidth={w(R)} />
        <path d={drumD(8.9, 23.8, sag(23.8, 8.9), 8.5, domeTop, sOn)} fill={paper} strokeWidth={w(F)} />
        <path d={onion(8.4, 10.1, domeTop, 17.5, sOn)} fill={`url(#${id}d)`} strokeWidth={w(H)} />
        <path d={meridians(8.4, 10.1, domeTop, 17.5, sOn, [0.42, 0.62, 0.78, 0.9])} strokeWidth={w(R)} opacity="0.55" />
        <path d={meridians(8.4, 10.1, domeTop, 17.5, sOn, [-0.55])} strokeWidth={w(R)} opacity="0.28" />
        <path d={petals} fill={paper} strokeWidth={w(R)} />
        <Finial y={domeTop + 17.5} s={1.3} fill={gilt} line={w(F)} />
      </>,
    );
  }

  // ── A chhatri on each wing: four slim pillars, a shaded canopy on its chhajja, a small onion ──
  const chhatri = (cx: number, cz: number) => {
    const p = 1.9;
    const y1 = WINGP + 3.4;
    const y2 = y1 + 0.55;
    const s0 = 2.75;
    fill(poly([cx - p, WINGP, cz + p], [cx + p, WINGP, cz - p], [cx + p, y1, cz - p], [cx - p, y1, cz + p]), shadow, 0.45);
    for (const dx of [-p, p]) face(fr(cx + dx - 0.22, cx + dx + 0.22, WINGP, y1, cz + p), cream, R);
    for (const dx of [-p, p]) face(fr(cx + dx - 0.26, cx + dx + 0.26, WINGP, y1, cz - p), paper, F);
    pen(archF(cx - p + 0.26, cx + p - 0.26, y1 - 1.4, y1 - 0.2, y1 - 1.4, cz - p), R);
    fill(poly([cx - s0, y1, cz - s0], [cx + s0, y1, cz - s0], [cx + s0, y1, cz + s0], [cx - s0, y1, cz + s0]), shadow);
    face(sd(cx - s0, cz - s0, cz + s0, y1, y2), wash, F);
    face(fr(cx - s0, cx + s0, y1, y2, cz - s0), paper, F);
    const k = FL / dep(cx, cz);
    const w = (px: number) => r2(px / k);
    const sag = (y: number, r: number) => sagOf(cx, cz, y, r);
    const yb = y2 + 0.6;
    const sOn = sag(yb, 1.85);
    group(
      onAxis(cx, cz),
      <>
        <path d={drumD(2, y2, sag(y2, 2), 1.95, yb, sOn)} fill={`url(#${id}c)`} strokeWidth={w(F)} />
        <path d={onion(1.85, 2.35, yb, 3.9, sOn)} fill={`url(#${id}d)`} strokeWidth={w(M)} />
        <path d={meridians(1.85, 2.35, yb, 3.9, sOn, [0.55, 0.82])} strokeWidth={w(R)} opacity="0.5" />
        <Finial y={yb + 3.9} s={0.42} fill={gilt} line={w(R)} />
      </>,
    );
  };
  chhatri(7.5, 7);
  chhatri(102.5, 7);

  // ── The right wing's left return, seen above the veranda ──
  face(sd(95, 0, 14, PAR - 0.6, WINGP), wash, M);
  pen(hatchSide(95, 0, 14, PAR - 0.6, WINGP, 2.5), R, 0.62);

  // ── The hall's front wall above the veranda, with clerestory windows ──
  face(fr(15, 95, PAR - 0.6, HALLP, 4), cream, M);
  pen(hl(15, 95, HALL, 4), R);
  for (let i = 0; i < 4; i++) {
    for (const x0 of [15, 65]) place('w', onFront(x0 + 3.5 + 7.2 * i, HALL - 0.6, 4, 1.4, 2.6, 2, 3.4));
  }

  // ── The wings (left near, right far): string course, two windows up, a lamplit niche below, merlons, guldastas ──
  const wing = (x0: number, near: boolean) => {
    const x1 = x0 + 15;
    if (near) {
      face(sd(x0, 0, 14, PL, WINGP), wash, M);
      pen(hatchSide(x0, 0, 14, PL, WINGP, 2.05), R, 0.62);
      pen(`${seg([x0, EAVE, 14], [x0, EAVE, 0])}${seg([x0, EAVE + 0.6, 14], [x0, EAVE + 0.6, 0])}${seg([x0, WING, 14], [x0, WING, 0])}`, F);
      place('w', onSide(x0, 8.2, WING - 1, 2, 3.4));
      place('w', onSide(x0, 8.4, EAVE - 1.4, 2.4, 5, 2, 3.4));
      for (let i = 0; i < 2; i++) place('m', onSide(x0, 14 - 7 * i, WINGP + 0.9, 7, 0.9, 5, 0.9));
    }
    face(fr(x0, x1, PL, WINGP, 0), paper, M);
    pen(`${vl(x0 + 0.8, 0, PL, WING)}${vl(x1 - 0.8, 0, PL, WING)}${hl(x0, x1, WING, 0)}${hl(x0, x1, PL + 0.5, 0)}`, R);
    fill(fr(x0, x1, EAVE - 0.6, EAVE, 0), shadow, 0.5);
    face(fr(x0 - 0.4, x1, EAVE, EAVE + 0.6, -0.7), paper, F);
    place('w', onFront(x0 + 3.2, WING - 1, 0, 2, 3.4));
    place('w', onFront(x1 - 5.2, WING - 1, 0, 2, 3.4));
    const niche = onFront(x0 + 4.5, EAVE - 0.6, 0, 6, EAVE - 0.6 - PL, 6, 7);
    place('a', niche);
    if (near) place('l', `${niche} translate(2.75 0.95)`);
    for (let i = 0; i < 3; i++) place('m', onFront(x0 + 5 * i, WINGP + 0.9, 0, 5, 0.9));
    place('p', onPoint(x0, WINGP, 0, 1.25));
    place('p', onPoint(x1, WINGP, 0, 1.25));
    if (near) place('p', onPoint(x0, WINGP, 14, 1.25));
  };
  wing(0, true);
  // The near wing's silhouette, the sketch's strongest lines (a little overshoot at the corners).
  pen(`${vl(0, 0, PL - 0.4, WINGP + 0.5)}${seg([0, WINGP, 14.6], [0, WINGP, 0])}${hl(-0.5, 15, WINGP, 0)}`, H);
  pen(vl(0, 14, PL, WINGP + 0.4), M);
  wing(95, false);

  // ── The veranda: eight pointed arches (lamps in a few), jaali parapets, pinnacles over the piers ──
  const lit = [1, 3, 4, 6];
  const apex = EAVE - 0.4;
  const spring = apex - (2.2 * (apex - PL)) / 7;
  for (const [n, x0] of [15, 65].entries()) {
    face(fr(x0, x0 + 30, PL, EAVE, 0), paper, M);
    let piers = '';
    let roses = '';
    for (let i = 0; i < 5; i++) {
      const px = x0 + 7.2 * i;
      piers += `${hl(px, px + 1.2, spring, 0)}${hl(px - 0.1, px + 1.3, spring + 0.25, 0)}`;
      roses += roundel(px + 0.6, apex - 0.75, 0, 0.42);
    }
    for (let i = 0; i < 4; i++) {
      const m = onFront(x0 + 1.2 + 7.2 * i, apex, 0, 6, apex - PL, 6, 7);
      place('a', m);
      if (lit.includes(n * 4 + i)) place('l', `${m} translate(2.75 0.95)`);
    }
    pen(piers, R);
    pen(roses, R);
    fill(fr(x0, x0 + 30, EAVE - 0.55, EAVE, 0), shadow, 0.5);
    face(fr(x0, x0 + 30, EAVE, EAVE + 0.6, -0.8), paper, F);
    face(fr(x0, x0 + 30, EAVE + 0.6, PAR, -0.3), paper, F);
    for (let i = 0; i < 4; i++) place('j', onFront(x0 + 7.5 * i, PAR - 0.08, -0.3, 7.5, 0.84, 7.5, 1));
    pen(hl(x0 - 0.2, x0 + 30.2, PAR, -0.3), M);
    for (let i = 1; i < 4; i++) place('p', onPoint(x0 + 7.2 * i + 0.6, PAR, -0.3));
  }

  // ── The pishtaq: a tall iwan arch in a double frame, its door lit, a jaali window above, turrets at its corners ──
  {
    const z = -2;
    const ys = PL + 10.7;
    const ya = PL + 16.1;
    face(poly([45, PL, -2], [45, PL, 0], [45, PAR, 0], [45, PAR, 4], [45, GATEP, 4], [45, GATEP, -2]), wash, M);
    pen(`${hatchSide(45, -2, 0, PL, PAR, 2.1)}${hatchSide(45, -2, 4, PAR, GATEP, 2.1)}`, R, 0.62);
    face(fr(45, 65, PL, GATEP, z), paper, M);
    pen(`${fr(46.7, 63.3, PL + 1.5, GATE - 0.7, z)}${fr(47.15, 62.85, PL + 1.5, GATE - 1.15, z)}`, R);
    // The iwan: its lit right reveal, the shaded hood and walls, hatching under the half dome.
    fill(archF(48.8, 61.2, ys, ya, PL, z), paper);
    fill(archF(48.8, 60.1, ys + 0.1, ya - 0.3, PL, z), `url(#${id}v)`);
    let hood = '';
    for (let x = 49.3; x < 59.8; x += 0.62) {
      const top = -headAt(48.8, 60.1, -(ys + 0.1), -(ya - 0.3), x) - 0.15;
      if (top > PL + 9.7) hood += vl(x, z, PL + 9.7, top);
    }
    pen(hood, R, 0.45);
    place('n', onFront(52.2, PL + 7.9, 1, 5.2, 7.9, 5.2, 7.7));
    place('w', onFront(53.4, PL + 11.1, 1, 2.8, 2.7, 2, 3.4));
    pen(archF(48.8, 61.2, ys, ya, PL, z, false), M);
    pen(archF(48.3, 61.7, ys, ya + 0.6, ys, z), R);
    pen(`${roundel(50.1, PL + 15.4, z, 0.75)}${roundel(59.9, PL + 15.4, z, 0.75)}`, R);
    pen(hl(45, 65, GATE, z), F);
    for (let i = 0; i < 4; i++) place('m', onFront(45 + 5 * i, GATEP + 0.9, z, 5, 0.9));
    pen(`${hl(44.6, 65.4, GATEP, z)}${vl(65, z, PAR, GATEP)}`, H);
    // The corner turrets: slim engaged shafts with ring mouldings and bulb domes.
    for (const x of [45, 65]) {
      const k = FL / dep(x, z);
      const w = (px: number) => r2(px / k);
      const sag = (y: number, r: number) => sagOf(x, z, y, r);
      const top = GATE + 2.7;
      group(
        onAxis(x, z),
        <>
          <path d={drumD(0.62, PL, sag(PL, 0.62), 0.55, top, sag(top, 0.55))} fill={`url(#${id}c)`} strokeWidth={w(F)} />
          <path d={`${ring(0.75, EAVE, sag(EAVE, 0.75))}${ring(0.7, WING, sag(WING, 0.7))}${ring(0.7, GATE, sag(GATE, 0.7))}${ring(0.8, top, sag(top, 0.8))}`} strokeWidth={w(R)} />
          <path d={onion(0.62, 0.95, top, 2, sag(top, 0.62))} fill={`url(#${id}d)`} strokeWidth={w(F)} />
          <path d={`M0 ${r2(-top - 2)}V${r2(-top - 3.3)}`} strokeWidth={w(F)} />
        </>,
      );
    }
  }

  // ── The minaret at the far corner: a pedestal, two balconies on corbels, a domed kiosk ──
  {
    const X = 116;
    const Z = -1;
    const top = PL + 4.5;
    face(sd(113.8, -3.2, 1.2, PL, top), wash, M);
    pen(hatchSide(113.8, -3.2, 1.2, PL, top, 2.1), R, 0.62);
    face(fr(113.8, 118.2, PL, top, -3.2), paper, M);
    pen(`${hl(113.8, 118.2, top - 0.7, -3.2)}${seg([113.8, top - 0.7, 1.2], [113.8, top - 0.7, -3.2])}`, R);
    place('w', onFront(115.2, top - 1.1, -3.2, 1.6, 2.7, 2, 3.4));
    const k = FL / dep(X, Z);
    const w = (px: number) => r2(px / k);
    const sag = (y: number, r: number) => sagOf(X, Z, y, r);
    const balcony = (y: number, r0: number, r1: number) => {
      const s = sag(y, r1);
      const corbel = `M${q(-r0)} ${q(-y + 0.9)}C${q(-r0 - 0.2)} ${q(-y + 0.5)} ${q(-r1 + 0.1)} ${q(-y + 0.25)} ${q(-r1)} ${q(-y)}Q0 ${q(-y - 2 * s)} ${q(r1)} ${q(-y)}C${q(r1 - 0.1)} ${q(-y + 0.25)} ${q(r0 + 0.2)} ${q(-y + 0.5)} ${q(r0)} ${q(-y + 0.9)}Z`;
      const teeth = SIX.map((f) => `M${q(f * (r0 + 0.35))} ${q(-y + 0.75 - sag(y, r0) * across(f))}V${q(-y + 0.15 - s * across(f))}`).join('');
      const rail = SIX.map((f) => `M${q(f * (r1 - 0.1))} ${q(-y - 0.35 - s * across(f))}V${q(-y - 1.15 - s * across(f))}`).join('');
      return (
        <>
          <path d={corbel} fill={wash} strokeWidth={w(F)} />
          <path d={teeth} strokeWidth={w(R)} opacity="0.6" />
          <path d={drumD(r1 + 0.1, y, s, r1 + 0.1, y + 0.35, sag(y + 0.35, r1 + 0.1))} fill={paper} strokeWidth={w(F)} />
          <path d={rail} strokeWidth={w(R)} />
          <path d={ring(r1 - 0.1, y + 1.2, sag(y + 1.2, r1))} strokeWidth={w(F)} />
        </>
      );
    };
    const b1 = 18.4;
    const b2 = 29.2;
    const k0 = b2 + 1.2;
    const k1 = k0 + 3.6;
    const kiosk = [-0.87, -0.34, 0.34, 0.87].map((f) => `M${q(1.4 * f - 0.14 * across(f))} ${q(-k0 - sag(k0, 1.4) * across(f))}V${q(-k1)}H${q(1.4 * f + 0.14 * across(f))}V${q(-k0 - sag(k0, 1.4) * across(f))}`).join('');
    const capY = k1 + 0.5;
    const sCap = sag(capY, 1.5);
    group(
      onAxis(X, Z),
      <>
        <path d={drumD(1.8, top, sag(top, 1.8), 1.65, b1 - 0.9, sag(b1 - 0.9, 1.65))} fill={`url(#${id}c)`} strokeWidth={w(M)} />
        <path d={`M0.9 ${q(-top - 0.4)}V${q(-b1 + 1.2)}M1.3 ${q(-top - 0.4)}V${q(-b1 + 1.2)}M1.58 ${q(-top - 0.4)}V${q(-b1 + 1.2)}`} strokeWidth={w(R)} opacity="0.45" />
        <path d={`${archD(-0.45, 0.25, -12, -12.7, -10.6)}${archD(-0.4, 0.2, -24.2, -24.8, -22.9)}`} fill={deep} strokeWidth={w(R)} />
        {balcony(b1, 1.65, 2.55)}
        <path d={drumD(1.55, b1 + 1.2, sag(b1 + 1.2, 1.55), 1.45, b2 - 0.9, sag(b2 - 0.9, 1.45))} fill={`url(#${id}c)`} strokeWidth={w(M)} />
        <path d={`M0.8 ${q(-b1 - 1.6)}V${q(-b2 + 1.2)}M1.15 ${q(-b1 - 1.6)}V${q(-b2 + 1.2)}M1.38 ${q(-b1 - 1.6)}V${q(-b2 + 1.2)}`} strokeWidth={w(R)} opacity="0.45" />
        {balcony(b2, 1.45, 2.3)}
        <path d={drumD(1.4, k0, sag(k0, 1.4), 1.4, k1, sag(k1, 1.4))} fill={shadow} strokeWidth={w(R)} />
        <path d={kiosk} fill={paper} strokeWidth={w(R)} />
        <path d={drumD(2, k1, sag(k1, 2), 1.7, capY, sCap)} fill={paper} strokeWidth={w(F)} />
        <path d={onion(1.5, 1.85, capY, 3.5, sCap)} fill={`url(#${id}d)`} strokeWidth={w(M)} />
        <path d={meridians(1.5, 1.85, capY, 3.5, sCap, [0.55, 0.82])} strokeWidth={w(R)} opacity="0.5" />
        <Finial y={capY + 3.5} s={0.42} fill={gilt} line={w(R)} />
      </>,
    );
  }

  // ── The terrace's face, broad shallow steps, thin railings ──
  face(sd(-1.5, -4, 14, 0, PL), wash, M);
  face(fr(-1.5, 15, 0, PL, -4), paper, M);
  face(fr(95, 120, 0, PL, -4), paper, M);
  pen(`${hl(-1.5, 15, PL - 0.45, -4)}${hl(95, 120, PL - 0.45, -4)}`, R);
  let risers = '';
  let noses = '';
  const profile: V3[] = [[15, 0, -4]];
  for (let s = 0; s < STEPS; s++) {
    const z = -4 - RUN * s;
    const y = PL - RISE * s;
    if (s % 2) risers += fr(15, 95, y - RISE, y, z);
    if (s > 0) noses += hl(15, 95, y, z);
    profile.push([15, y, z], [15, y, z - RUN]);
  }
  profile.push([15, 0, -4 - RUN * STEPS]);
  fill(fr(15, 95, 0, PL, -4 - RUN * (STEPS - 1)), paper);
  fill(risers, cream);
  pen(noses, R);
  pen(`${hl(15, 95, 0, -4 - RUN * (STEPS - 1))}`, F);
  face(poly(...profile), wash, F);
  let rails = '';
  const foot = -4 - RUN * (STEPS - 1);
  for (const x of [15.3, 45, 65, 94.7]) {
    rails += `${seg([x, PL + 1.1, -4], [x, RISE + 1.1, foot])}${vl(x, -4, PL, PL + 1.1)}${vl(x, -4 - RUN * 2.5, PL - RISE * 2, PL - RISE * 2 + 1.1)}${vl(x, foot, RISE, RISE + 1.3)}`;
  }
  pen(rails, R);
  pen(hl(-1.5, 120, PL, -4), M);
  flush();

  // The ground: a fine line under the foot that fades at both ends, a soft shadow along it, a few strokes of shade.
  const gx0 = sx(-1.5, -4) - 26;
  const gy0 = sy(-1.5, 0, -4) + 2.5;
  const gx1 = sx(120, -4) + 14;
  const gy1 = sy(120, 0, -4) + 2.5;
  const gcx = (gx0 + gx1) / 2;
  const gcy = (gy0 + gy1) / 2 + 10;
  const onGround = (t: number) => [(1 - t) * (1 - t) * gx0 + 2 * t * (1 - t) * gcx + t * t * gx1, (1 - t) * (1 - t) * gy0 + 2 * t * (1 - t) * gcy + t * t * gy1] as const;
  let tufts = '';
  for (let i = 0; i < 5; i++) {
    const [x, y] = onGround(0.14 + 0.17 * i + 0.05 * rand(i, 41));
    const len = 12 + 16 * rand(i, 43);
    const drop = 2 + 1.8 * rand(i, 47);
    tufts += `M${t1(x - len / 2)} ${t1(y + drop + len * 0.02)}l${t1(len)} ${t1(-len * 0.04)}`;
  }
  const domeX = sx(DX, DZ);
  const domeY = sy(DX, domeTop + 8, DZ);
  return (
    <svg viewBox="0 0 380 253" className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}h`}>
          <stop offset="0" stopColor={paper} />
          <stop offset="0.5" stopColor={paper} stopOpacity="0.82" />
          <stop offset="0.78" stopColor={paper} stopOpacity="0.35" />
          <stop offset="1" stopColor={page} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}o`}>
          <stop offset="0" stopColor={tint(gold, 0.55)} stopOpacity="0.3" />
          <stop offset="1" stopColor={tint(gold, 0.55)} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}s`}>
          <stop offset="0" stopColor={ink} stopOpacity="0.22" />
          <stop offset="0.6" stopColor={ink} stopOpacity="0.09" />
          <stop offset="1" stopColor={ink} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}e`} gradientUnits="userSpaceOnUse" x1={t1(gx0)} y1="0" x2={t1(gx1)} y2="0">
          <stop offset="0" stopColor={ink} stopOpacity="0" />
          <stop offset="0.5" stopColor={ink} stopOpacity="0.8" />
          <stop offset="1" stopColor={ink} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}g`}>
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="0.3" stopColor={LAMPLIGHT} stopOpacity="0.85" />
          <stop offset="0.65" stopColor={LAMPLIGHT} stopOpacity="0.35" />
          <stop offset="1" stopColor={LAMPLIGHT} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}k`} cx="50%" cy="72%" r="70%">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="0.5" stopColor={LAMPLIGHT} />
          <stop offset="1" stopColor={blend(LAMPLIGHT, ink, 0.4)} />
        </radialGradient>
        <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={deep} />
          <stop offset="0.5" stopColor={shadow} />
          <stop offset="1" stopColor={wash} />
        </linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.3" stopColor={paper} />
          <stop offset="0.7" stopColor={cream} />
          <stop offset="1" stopColor={shadow} />
        </linearGradient>
        <radialGradient id={`${id}d`} cx="36%" cy="34%" r="78%">
          <stop offset="0" stopColor={blend(paper, '#ffffff', 0.5)} />
          <stop offset="0.45" stopColor={paper} />
          <stop offset="0.78" stopColor={cream} />
          <stop offset="1" stopColor={wash} />
        </radialGradient>
        {foil ? <Metal id={`${id}f`} base={gold} foil x2={380} y2={120} /> : null}
        {/* A pointed arch of the veranda (6 × 7, apex at the top): its lit right reveal, the shaded veranda, the door in its back wall, hatching, the opening and its moulding. */}
        <g id={`${id}a`}>
          <path d={archD(0, 6, 2.2, 0, 7)} fill={paper} stroke="none" />
          <path d={archD(0, 5.4, 2.4, 0.25, 7)} fill={`url(#${id}v)`} stroke="none" />
          <path d={archD(1.2, 3.4, 4.4, 3.3, 7)} fill={deep} stroke="none" />
          <path
            d={Array.from({ length: 13 }, (_, i) => {
              const u = 0.32 + i * 0.4;
              return `M${r2(u)} 6.9V${r2(headAt(0, 5.4, 2.4, 0.25, u) + 0.12)}`;
            }).join('')}
            strokeWidth="0.07"
            opacity="0.5"
          />
          <path d={`M0 7V2.2${head(0, 6, 2.2, 0)}V7`} strokeWidth="0.16" />
          <path d={`M-0.36 2.2${head(-0.36, 6.36, 2.2, -0.4)}`} strokeWidth="0.08" opacity="0.8" />
        </g>
        {/* A hanging lamp and its glow (hung from 0 0). */}
        <g id={`${id}l`}>
          <ellipse cx="0" cy="2.4" rx="2.3" ry="2.7" fill={`url(#${id}g)`} stroke="none" />
          <path d="M0 0V1.15" strokeWidth="0.05" />
          <path d="M-0.3 1.38L0 1.1L0.3 1.38ZM-0.22 1.38H0.22L0.4 1.8V2.4L0.22 2.78H-0.22L-0.4 2.4V1.8Z" fill="#fff3d0" strokeWidth="0.06" />
          <path d="M0 2.78V3.05" strokeWidth="0.05" />
        </g>
        {/* An arched window in its rectangular frame (2 × 3.4). */}
        <g id={`${id}w`}>
          <path d={archD(0.3, 1.7, 1.25, 0.35, 3.1)} fill={deep} stroke="none" />
          <path d="M0.66 3.05V1.4M1 3.05V0.95M1.34 3.05V1.4" strokeWidth="0.06" opacity="0.6" />
          <path d={`M0.3 3.1V1.25${head(0.3, 1.7, 1.25, 0.35)}V3.1`} strokeWidth="0.11" />
          <path d="M-0.08 3.28H2.08M0 0H2V3.28M0 0V3.28" strokeWidth="0.07" opacity="0.75" />
        </g>
        {/* The pishtaq's door, cusped, lit from within (5.2 × 7.7). */}
        <g id={`${id}n`}>
          <path d={`M0 7.7V2.6${cuspedHead(0, 2.6, 5.2, 2.3, false)}V7.7Z`} fill={`url(#${id}k)`} strokeWidth="0.14" />
          <path d="M2.6 7.7V3.4" strokeWidth="0.06" opacity="0.5" />
        </g>
        {/* A jaali parapet (7.5 × 1): a lattice between two rails. */}
        <g id={`${id}j`}>
          <path d="M0 0.1H7.5M0 0.9H7.5" strokeWidth="0.07" />
          <path
            d={[0, 1]
              .map((o) => `M0 ${o ? 0.88 : 0.12}${Array.from({ length: 20 }, (_, i) => `L${r2((i + 1) * 0.375)} ${(i + o) % 2 ? 0.12 : 0.88}`).join('')}`)
              .join('')}
            strokeWidth="0.045"
            opacity="0.7"
          />
        </g>
        {/* Four kangura merlons (5 × 0.9, tips at the top). */}
        <g id={`${id}m`}>
          <path
            d={[0.625, 1.875, 3.125, 4.375].map((c) => `M${r2(c - 0.42)} 0.9V0.5C${r2(c - 0.42)} 0.24 ${r2(c - 0.18)} 0.08 ${c} 0C${r2(c + 0.18)} 0.08 ${r2(c + 0.42)} 0.24 ${r2(c + 0.42)} 0.5V0.9`).join('')}
            fill={paper}
            strokeWidth="0.07"
          />
        </g>
        {/* A guldasta pinnacle standing on 0 0. */}
        <g id={`${id}p`}>
          <path d="M-0.17 0V-1.45H0.17V0" fill={paper} strokeWidth="0.08" />
          <path d="M-0.27 -1.45H0.27" strokeWidth="0.08" />
          <path d="M0 -1.5C-0.42 -1.62 -0.4 -2.12 0 -2.3C0.4 -2.12 0.42 -1.62 0 -1.5Z" fill={paper} strokeWidth="0.07" />
          <path d="M0 -2.3V-2.8" strokeWidth="0.06" />
        </g>
      </defs>
      <ellipse cx="190" cy="124" rx="190" ry="126" fill={`url(#${id}h)`} />
      <ellipse cx={t1(domeX)} cy={t1(domeY)} rx="74" ry="62" fill={`url(#${id}o)`} />
      <ellipse cx={t1(gcx)} cy={t1(gcy - 7)} rx={t1((gx1 - gx0) / 2 - 6)} ry="10" transform={`rotate(-2.3 ${t1(gcx)} ${t1(gcy - 7)})`} fill={`url(#${id}s)`} />
      <path d={`M${t1(gx0)} ${t1(gy0)}Q${t1(gcx)} ${t1(gcy)} ${t1(gx1)} ${t1(gy1)}`} fill="none" stroke={`url(#${id}e)`} strokeWidth={F} />
      <path d={tufts} fill="none" stroke={`url(#${id}e)`} strokeWidth={R} opacity="0.55" />
      <g fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        {out}
      </g>
    </svg>
  );
}

/** A gilt finial standing on a dome's apex (local units about the axis, v = −height): lotus cup, two bulbs, a spire. */
function Finial({ y, s, fill, line }: { y: number; s: number; fill: string; line: number }) {
  return (
    <g fill={fill} strokeWidth={line}>
      <path d={`M${r2(-0.75 * s)} ${r2(-y - 0.1 * s)}Q0 ${r2(-y + 0.55 * s)} ${r2(0.75 * s)} ${r2(-y - 0.1 * s)}Q0 ${r2(-y - 0.4 * s)} ${r2(-0.75 * s)} ${r2(-y - 0.1 * s)}Z`} />
      <circle cy={r2(-y - 0.75 * s)} r={r2(0.48 * s)} />
      <circle cy={r2(-y - 1.6 * s)} r={r2(0.34 * s)} />
      <path d={`M0 ${r2(-y - 1.95 * s)}V${r2(-y - 3.9 * s)}`} fill="none" />
      <circle cy={r2(-y - 2.75 * s)} r={r2(0.16 * s)} />
    </g>
  );
}
