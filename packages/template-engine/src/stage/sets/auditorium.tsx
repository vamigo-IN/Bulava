import { mix } from '../../theme';
import { onCubic, shade, tint, type Pt, type Segment } from '../../art/kit';
import { r2, rand } from '../../art/motifs';
import { bodyStops, Glow, kitId, KitSvg, Lin, metalLit, P, Rim } from '../kit/architecture';
import { drawWith, Floor, Wall } from '../kit';
import { back, billboard, ceiling, floor, hang, wall } from '../planes';
import type { DrawProps, Piece, StageSetFactory } from '../types';

/**
 * T16 · Centre Stage (`centre-stage`, final.md §5.3 T16): an auditorium at
 * night, a minute before the keynote. Rows of velvet seats, back-lit by the
 * stage, step down a carpeted aisle whose step lights lead to a lit stage: a
 * wide LED screen carries the host's monogram inside a slowly turning ring,
 * aluminium truss towers stand either side with a lectern at the screen's
 * right, the house curtain hangs tied back under a swagged valance, two moving
 * heads cross their beams on the speaker's mark and stage haze drifts along
 * the footlights. Key light from far (the stage), rim in ice blue.
 *
 * Set-local pieces (§6.4): SeatRow, KeynoteStage, CurtainDrape, plus Valance
 * (the proscenium's swagged pelmet), StageBeam (a slanted moving-head beam:
 * the kit's LightShaft only draws upright cones, so two of them cannot cross)
 * and ScreenRing (the motion graphic that turns on the screen).
 */

type Side = 'left' | 'right';
const url = (id: string) => `url(#${id})`;
const HEADING = 'var(--t-heading, "Montserrat"), "Helvetica Neue", Arial, sans-serif';
const WARM = '#ffe7b8';

/** A polyline through points. */
const poly = (pts: readonly Pt[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x)} ${r2(y)}`).join('');
/** Points along a chain of cubics. */
function along(segs: readonly Segment[], steps = 10): Pt[] {
  const out: Pt[] = [];
  segs.forEach((s, k) => {
    for (let i = k ? 1 : 0; i <= steps; i++) {
      const q = onCubic(s, i / steps);
      out.push([q.x, q.y]);
    }
  });
  return out;
}
/** A rounded-top rectangle (a seat back): corners of radius r on top only. */
const capRect = (x: number, y: number, w: number, h: number, r: number) => P`M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
/** A small dot as a path (many in one d). */
const dot = (x: number, y: number, r: number) => P`M${x + r} ${y}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0Z`;

// Unit vectors every 15° (a table, no trigonometry): [cos, sin].
const Q15: readonly Pt[] = [[1, 0], [0.9659, 0.2588], [0.866, 0.5], [0.7071, 0.7071], [0.5, 0.866], [0.2588, 0.9659]];
/** The unit vector at k·15° (k 0..23). */
function dir15(k: number): Pt {
  const q = ((k % 24) + 24) % 24;
  const i = q % 6;
  const [c, s] = Q15[i]!;
  const quad = Math.floor(q / 6);
  if (quad === 0) return [c, s];
  if (quad === 1) return [-s, c];
  if (quad === 2) return [-c, -s];
  return [s, -c];
}
/** An arc of radius r round (cx, cy) from step a to step b (15° steps, clockwise on screen). */
function arc15(cx: number, cy: number, r: number, a: number, b: number): string {
  const [x0, y0] = dir15(a);
  const [x1, y1] = dir15(b);
  const large = (b - a) * 15 > 180 ? 1 : 0;
  return P`M${cx + x0 * r} ${cy + y0 * r}A${r} ${r} 0 ${large} 1 ${cx + x1 * r} ${cy + y1 * r}`;
}

// ─────────────────────────── SeatRow ───────────────────────────

/**
 * A row of five velvet seats seen from behind (260×150), with the tops of the
 * row behind it showing above, back-lit by the stage: rim light on every top,
 * the backs falling dark toward the floor. The aisle end carries a brushed
 * metal end standard with a row plaque and a blue step light at its foot.
 */
function SeatRow(p: DrawProps & { aisle: Side }) {
  const { w, h, colors: c } = p;
  const id = kitId(p, `seat${p.aisle[0]}`);
  const full = p.detail === 'full';
  const velvet = mix(c.primary, c.secondary, 0.26);
  const back = shade(velvet, 0.3);
  const seatW = (w - 16) / 5;
  const x0 = p.aisle === 'left' ? 16 : 0;
  const end = p.aisle === 'left' ? 0 : w - 16;
  const step = mix(c.accent, '#ffffff', 0.25);
  const seats = Array.from({ length: 5 }, (_, i) => x0 + i * seatW);
  const behind = Array.from({ length: 6 }, (_, i) => x0 + (i - 0.5) * seatW);
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}v`} stops={[[0, tint(velvet, 0.12)], [0.22, velvet], [0.75, shade(velvet, 0.42)], [1, shade(velvet, 0.62)]]} x1={0} y1={38} x2={0} y2={h} />
        <Lin id={`${id}b`} stops={[[0, back], [1, shade(back, 0.5)]]} x1={0} y1={14} x2={0} y2={60} />
        <Lin id={`${id}m`} stops={bodyStops(mix(c.primary, c.surface, 0.2), 'far')} x1={end} y1={0} x2={end + 16} y2={0} />
        <Glow id={`${id}g`} color={step} core="#ffffff" a={0.9} />
      </defs>
      {/* the row behind: only its tops */}
      <path d={behind.map((x) => capRect(x + 4, 16, seatW - 8, 44, 12)).join('')} fill={url(`${id}b`)} />
      <path d={behind.map((x) => P`M${x + 6} ${18}Q${x + 6} ${16} ${x + 16} ${16}H${x + seatW - 16}Q${x + seatW - 6} ${16} ${x + seatW - 6} ${18}`).join('')} stroke={p.light.rim} strokeWidth={1.1} opacity={0.32} fill="none" />
      {/* this row */}
      <path d={seats.map((x) => capRect(x + 2, 38, seatW - 4, h - 52, 14)).join('')} fill={url(`${id}v`)} />
      {full ? <path d={seats.map((x) => P`M${x + 7} ${70}H${x + seatW - 7}M${x + seatW / 2} ${44}V${66}`).join('')} stroke={shade(velvet, 0.5)} strokeWidth={1} opacity={0.5} fill="none" /> : null}
      {/* armrests between the seats, and the seat bases */}
      <path d={seats.slice(1).map((x) => P`M${x - 3} ${h - 44}h6v30h-6Z`).join('')} fill={shade(velvet, 0.55)} />
      <rect x={x0} y={h - 16} width={w - 16} height={16} fill={shade(velvet, 0.7)} />
      {/* rim light from the stage on every top and down the edges */}
      <path d={seats.map((x) => P`M${x + 3} ${52}Q${x + 3} ${39} ${x + 16} ${39}H${x + seatW - 16}Q${x + seatW - 3} ${39} ${x + seatW - 3} ${52}`).join('')} stroke={p.light.rim} strokeWidth={1.6} opacity={0.62} fill="none" />
      <path d={seats.map((x) => P`M${x + 2.6} ${54}V${h - 40}M${x + seatW - 2.6} ${54}V${h - 40}`).join('')} stroke={p.light.rim} strokeWidth={0.9} opacity={0.22} fill="none" />
      {/* the aisle end standard, its plaque and its step light */}
      <path d={capRect(end, 62, 16, h - 62, 7)} fill={url(`${id}m`)} />
      <rect x={end + 4} y={76} width={8} height={10} rx={1.5} fill={mix(c.secondary, c.accent, 0.3)} opacity={0.75} />
      <Rim p={p} x0={end} x1={end + 16} y0={68} y1={h - 4} />
      <ellipse cx={end + 8} cy={h - 10} rx={14} ry={9} fill={url(`${id}g`)} />
      <rect x={end + 5} y={h - 12} width={6} height={3} rx={1.5} fill="#ffffff" opacity={0.95} />
      <ellipse cx={w / 2} cy={h - 1} rx={w / 2} ry={3} fill="#000000" opacity={0.35} />
    </KitSvg>
  );
}

// ─────────────────────────── KeynoteStage (focal) ───────────────────────────

/** A square aluminium truss tower from y0 to y1 at x (36 wide). */
function truss(x: number, y0: number, y1: number, wd = 36): { chords: string; web: string } {
  let web = '';
  const n = Math.max(1, Math.round((y1 - y0) / wd));
  const s = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const a = y0 + i * s;
    web += P`M${x + 3} ${a}L${x + wd - 3} ${a + s}M${x + 3} ${a}H${x + wd - 3}`;
  }
  return { chords: P`M${x + 2} ${y0}V${y1}M${x + wd - 2} ${y0}V${y1}M${x + wd / 2} ${y0}V${y1}`, web };
}

/**
 * The focal (680×560): a raised stage with an LED lip, footlights and centre
 * steps; a dark stage house; a 16:9 LED screen with the monogram in the accent;
 * slim LED banners; truss towers carrying a lighting bar with PAR cans; and a
 * lectern with a glowing front panel and a gooseneck microphone.
 */
function KeynoteStage(p: DrawProps & { monogram: string }) {
  const { w, h, colors: c } = p;
  const id = kitId(p, 'keynote');
  const full = p.detail === 'full';
  const eye = p.eyeLine ?? 0;
  const house = mix(c.primary, '#000000', 0.4);
  const metal = mix(c.surface, c.primary, 0.55);
  const quietMetal = mix(metal, house, 0.6);
  const screenHi = mix(c.primary, c.secondary, 0.68);
  const screenLo = mix(c.primary, c.secondary, 0.22);
  const glyph = tint(c.accent, 0.5);
  const deckY = 470;
  const riserY = 480;
  // screen box
  const sx0 = 120;
  const sx1 = 560;
  const sy0 = 30;
  const sy1 = 278;
  const scx = (sx0 + sx1) / 2;
  const scy = 146;
  const mono = p.monogram.trim() || '·';
  const fs = r2(Math.min(70, 160 / (0.6 * Math.max(mono.length, 1))));
  const lx = 505;
  const left = truss(22, 8, deckY);
  const right = truss(w - 58, 8, deckY);
  const pars = [150, 252, 428, 530];
  const feet = Array.from({ length: 16 }, (_, i) => 26 + i * 42).filter((x) => x < 282 || x > 398);
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}h`} stops={[[0, house, 0], [0.16, house, 1], [0.86, shade(house, 0.15), 1], [1, shade(house, 0.3), 1]]} x1={0} y1={0} x2={0} y2={deckY} />
        <radialGradient id={`${id}s`} cx="50%" cy="46%" r="70%">
          <stop offset="0" stopColor={screenHi} />
          <stop offset="0.55" stopColor={mix(screenHi, screenLo, 0.55)} />
          <stop offset="1" stopColor={screenLo} />
        </radialGradient>
        <Glow id={`${id}sg`} color={c.secondary} core={mix(c.secondary, c.accent, 0.4)} a={0.5} />
        <Glow id={`${id}mg`} color={c.accent} core={c.accent} a={0.38} />
        <Glow id={`${id}w`} color={WARM} core="#ffffff" a={0.9} />
        <Glow id={`${id}lens`} color={c.accent} core="#ffffff" a={0.8} />
        <Lin id={`${id}d`} stops={[[0, tint(house, 0.12)], [1, shade(house, 0.2)]]} x1={0} y1={deckY} x2={0} y2={riserY} />
        <Lin id={`${id}r`} stops={[[0, mix(house, WARM, 0.08)], [1, shade(house, 0.35)]]} x1={0} y1={riserY} x2={0} y2={h} />
        <Lin id={`${id}ref`} stops={[[0, c.accent, 0], [0.5, c.accent, 0.38], [1, c.accent, 0]]} x1={sx0} y1={0} x2={sx1} y2={0} />
        <Lin id={`${id}ban`} stops={[[0, mix(c.secondary, c.primary, 0.2)], [0.6, mix(c.secondary, c.primary, 0.6)], [1, shade(c.primary, 0.3)]]} x1={0} y1={60} x2={0} y2={330} />
        <Lin id={`${id}lec`} stops={bodyStops(mix(c.primary, c.surface, 0.22), 'far')} x1={lx - 28} y1={0} x2={lx + 28} y2={0} />
        <Lin id={`${id}lp`} stops={[[0, mix(c.secondary, c.accent, 0.3)], [1, shade(c.secondary, 0.45)]]} x1={0} y1={372} x2={0} y2={444} />
        <Lin id={`${id}t`} stops={metalLit(metal, 'far', false)} x1={0} y1={0} x2={36} y2={0} />
      </defs>
      {/* the stage house and the screen's spill on it */}
      <rect x={60} y={0} width={w - 120} height={deckY} fill={url(`${id}h`)} />
      <ellipse cx={scx} cy={scy + 20} rx={330} ry={210} fill={url(`${id}sg`)} />
      {full ? <path d={Array.from({ length: 22 }, (_, i) => P`M${72 + i * 25} ${90}V${deckY - 4}`).join('')} stroke={c.secondary} strokeWidth={0.8} opacity={0.1} /> : null}
      {/* LED banners */}
      {[70, w - 108].map((x) => (
        <g key={x}>
          <rect x={x} y={60} width={38} height={270} fill={url(`${id}ban`)} />
          <path d={P`M${x + 19} ${74}V${316}`} stroke={c.accent} strokeWidth={1.2} opacity={0.55} />
          <path d={[0, 1, 2, 3, 4].map((k) => P`M${x + 9} ${110 + k * 40}L${x + 19} ${100 + k * 40}L${x + 29} ${110 + k * 40}`).join('')} stroke={c.accent} strokeWidth={1.4} opacity={0.4} fill="none" />
        </g>
      ))}
      {/* the screen */}
      <rect x={sx0 - 6} y={sy0 - 6} width={sx1 - sx0 + 12} height={sy1 - sy0 + 12} rx={3} fill={shade(metal, 0.55)} />
      <rect x={sx0} y={sy0} width={sx1 - sx0} height={sy1 - sy0} fill={url(`${id}s`)} />
      {full ? <path d={Array.from({ length: 40 }, (_, i) => P`M${sx0} ${sy0 + 3 + i * 6.2}H${sx1}`).join('')} stroke={c.accent} strokeWidth={0.6} opacity={0.06} /> : null}
      <ellipse cx={scx} cy={scy} rx={150} ry={104} fill={url(`${id}mg`)} />
      <path d={P`M${sx0 + 10} ${sy0 + 28}V${sy0 + 10}H${sx0 + 28}M${sx1 - 28} ${sy0 + 10}H${sx1 - 10}V${sy0 + 28}M${sx1 - 10} ${sy1 - 28}V${sy1 - 10}H${sx1 - 28}M${sx0 + 28} ${sy1 - 10}H${sx0 + 10}V${sy1 - 28}`} stroke={c.accent} strokeWidth={1.6} opacity={0.6} fill="none" />
      <path d={P`M${scx - 70} ${sy1 - 22}H${scx - 10}M${scx + 10} ${sy1 - 22}H${scx + 70}M${scx} ${sy1 - 27}L${scx + 5} ${sy1 - 22}L${scx} ${sy1 - 17}L${scx - 5} ${sy1 - 22}Z`} stroke={c.accent} strokeWidth={1.2} opacity={0.7} fill={c.accent} fillOpacity={0.7} />
      <g style={{ fontFamily: HEADING }}>
        <text x={scx} y={r2(scy + fs * 0.35)} textAnchor="middle" fontSize={fs} fontWeight={600} letterSpacing={r2(fs * 0.08)} fill={glyph}>
          {mono}
        </text>
      </g>
      <path d={P`M${sx0} ${sy0}L${sx0 + 120} ${sy0}L${sx0 + 40} ${sy1}L${sx0} ${sy1}Z`} fill="#ffffff" opacity={0.035} />
      {/* truss towers and the lighting bar (above the eye line: quiet) */}
      {[left, right].map((t, i) => (
        <g key={i}>
          <path d={t.chords} stroke={url(`${id}t`)} strokeWidth={3} fill="none" />
          <path d={t.web} stroke={metal} strokeWidth={1.3} opacity={0.75} fill="none" />
        </g>
      ))}
      <rect x={22} y={eye > 0 ? 8 : 8} width={w - 44} height={22} fill={house} />
      <path d={P`M22 ${10}H${w - 22}M22 ${28}H${w - 22}`} stroke={quietMetal} strokeWidth={2.4} fill="none" />
      <path d={Array.from({ length: 18 }, (_, i) => P`M${24 + i * 35.4} ${10}L${24 + (i + 1) * 35.4} ${28}`).join('')} stroke={quietMetal} strokeWidth={1} fill="none" />
      {pars.map((x) => (
        <g key={x}>
          <rect x={x - 7} y={30} width={14} height={17} rx={2} fill={shade(metal, 0.6)} />
          <ellipse cx={x} cy={48} rx={9} ry={5} fill={url(`${id}lens`)} />
        </g>
      ))}
      {/* the stage deck, its glossy edge and the screen's reflection */}
      <rect x={0} y={deckY} width={w} height={riserY - deckY} fill={url(`${id}d`)} />
      <rect x={sx0} y={deckY + 1} width={sx1 - sx0} height={7} fill={url(`${id}ref`)} />
      <rect x={0} y={riserY} width={w} height={h - riserY} fill={url(`${id}r`)} />
      {full ? <path d={[85, 170, 255, 425, 510, 595].map((x) => P`M${x} ${riserY + 4}V${h}`).join('')} stroke={shade(house, 0.4)} strokeWidth={1.2} opacity={0.6} /> : null}
      <path d={P`M0 ${riserY + 1}H${w}`} stroke={c.accent} strokeWidth={5} opacity={0.18} />
      <path d={P`M0 ${riserY + 1}H${w}`} stroke={mix(c.secondary, c.accent, 0.5)} strokeWidth={1.6} opacity={0.9} />
      {feet.map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={riserY + 9} rx={12} ry={7} fill={url(`${id}w`)} />
          <rect x={x - 4} y={riserY + 7} width={8} height={4} rx={2} fill="#fff6e0" />
        </g>
      ))}
      {/* centre steps down to the aisle */}
      {[0, 1, 2].map((k) => {
        const x0 = 300 - k * 9;
        const x1 = 380 + k * 9;
        const y0 = riserY + k * 27;
        return (
          <g key={k}>
            <rect x={x0} y={y0} width={x1 - x0} height={27 + (k === 2 ? 0 : 0)} fill={mix(house, c.surface, 0.06 + k * 0.03)} />
            <path d={P`M${x0} ${y0 + 0.8}H${x1}`} stroke={c.accent} strokeWidth={1.4} opacity={0.85} />
          </g>
        );
      })}
      {/* the lectern and its microphone */}
      <path d={P`M${lx - 33} ${342}H${lx + 33}L${lx + 29} ${354}H${lx - 29}Z`} fill={tint(mix(c.primary, c.surface, 0.3), 0.1)} />
      <path d={P`M${lx - 26} ${354}H${lx + 26}L${lx + 21} ${462}H${lx - 21}Z`} fill={url(`${id}lec`)} />
      <rect x={lx - 16} y={372} width={32} height={72} rx={2} fill={url(`${id}lp`)} opacity={0.9} />
      <path d={P`M${lx - 9} ${392}H${lx + 9}`} stroke={c.accent} strokeWidth={2} />
      <circle cx={lx} cy={410} r={5} fill="none" stroke={c.accent} strokeWidth={1.2} opacity={0.8} />
      <rect x={lx - 30} y={462} width={60} height={8} rx={1} fill={shade(metal, 0.5)} />
      <path d={P`M${lx + 8} ${343}C${lx + 9} ${330} ${lx + 2} ${322} ${lx - 6} ${318}`} stroke={shade(metal, 0.4)} strokeWidth={1.6} fill="none" />
      <ellipse cx={lx - 7} cy={317} rx={3.2} ry={2.4} fill={shade(metal, 0.5)} />
      <path d={P`M${lx - 33} ${342}V${354}M${lx + 33} ${342}V${354}`} stroke={p.light.rim} strokeWidth={1} opacity={0.5} />
      <Rim p={p} x0={lx - 26} x1={lx + 26} y0={356} y1={460} />
    </KitSvg>
  );
}

// ─────────────────────────── CurtainDrape ───────────────────────────

/**
 * The house curtain at one side of the proscenium (110×600), tied back with a
 * gold rope and tassel: velvet folds converging on the tie, a warm footlight
 * glow on the hem and a gold fringe. Above the eye line it is tone-on-tone.
 */
function CurtainDrape(p: DrawProps & { side: Side }) {
  const { w, h, colors: c } = p;
  const id = kitId(p, `drape${p.side[0]}`);
  const velvet = mix(c.primary, c.secondary, 0.24);
  const gold = c.secondary;
  const mx = (x: number) => (p.side === 'left' ? x : w - x);
  const tieY = h * 0.6;
  const inner: Segment[] = [
    [[w, 0], [w, h * 0.26], [w * 0.44, h * 0.46], [w * 0.36, tieY]],
    [[w * 0.36, tieY], [w * 0.46, h * 0.72], [w * 0.9, h * 0.86], [w, h]],
  ];
  const edge = along(inner, 12);
  const sil = poly([[0, 0], ...edge, [0, h]].map(([x, y]) => [mx(x), y] as Pt)) + 'Z';
  const fold = (f: number) => poly(edge.map(([x, y]) => [mx(x * f), y] as Pt));
  const eye = p.eyeLine ?? 0;
  const top = eye / h;
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}v`} stops={[[0, mix(velvet, c.primary, 0.5)], [Math.min(0.9, top), velvet], [0.82, tint(velvet, 0.06)], [1, mix(velvet, WARM, 0.22)]]} x1={0} y1={0} x2={0} y2={h} />
        <Lin id={`${id}g`} stops={metalLit(gold, 'far')} x1={0} y1={tieY - 8} x2={0} y2={tieY + 8} />
      </defs>
      <path d={sil} fill={url(`${id}v`)} />
      {[0.18, 0.42, 0.66, 0.86].map((f, i) => (
        <path key={f} d={fold(f)} stroke={shade(velvet, 0.45)} strokeWidth={i % 2 ? 5 : 7} opacity={0.42} fill="none" />
      ))}
      {[0.3, 0.55, 0.78].map((f) => (
        <path key={f} d={fold(f)} stroke={tint(velvet, 0.22)} strokeWidth={2.4} opacity={0.22} fill="none" />
      ))}
      <path d={poly(edge.map(([x, y]) => [mx(x - 1.2), y] as Pt))} stroke={p.light.rim} strokeWidth={1.4} opacity={0.4} fill="none" />
      {/* the gold rope tieback and tassel */}
      <path d={P`M${mx(0)} ${tieY - 4}Q${mx(w * 0.2)} ${tieY + 6} ${mx(w * 0.4)} ${tieY - 2}L${mx(w * 0.4)} ${tieY + 5}Q${mx(w * 0.2)} ${tieY + 13} ${mx(0)} ${tieY + 3}Z`} fill={url(`${id}g`)} />
      <path d={P`M${mx(w * 0.4)} ${tieY + 2}C${mx(w * 0.44)} ${tieY + 12} ${mx(w * 0.36)} ${tieY + 22} ${mx(w * 0.42)} ${tieY + 30}`} stroke={gold} strokeWidth={1.4} fill="none" />
      <path d={P`M${mx(w * 0.42) - 5} ${tieY + 30}h10l3 26h-16Z`} fill={url(`${id}g`)} />
      <path d={[0, 1, 2, 3, 4].map((k) => P`M${mx(w * 0.42) - 6 + k * 3} ${tieY + 54}v6`).join('')} stroke={gold} strokeWidth={1} opacity={0.8} />
      {/* the fringe along the hem */}
      <path d={Array.from({ length: 22 }, (_, i) => P`M${i * (w / 22) + 2} ${h - 9}v8`).join('')} stroke={gold} strokeWidth={1.3} opacity={0.75} />
      <path d={P`M0 ${h - 10}H${w}`} stroke={gold} strokeWidth={2} opacity={0.85} />
    </KitSvg>
  );
}

// ─────────────────────────── Valance ───────────────────────────

/** The proscenium's swagged velvet pelmet (600×80), wholly above the eye: tone-on-tone with a quiet gold fringe. */
function Valance(p: DrawProps) {
  const { w, h, colors: c } = p;
  const id = kitId(p, 'valance');
  const velvet = mix(c.primary, c.secondary, 0.2);
  const gold = mix(c.secondary, velvet, 0.55);
  const n = 4;
  const sw = w / n;
  const swags = Array.from({ length: n }, (_, i) => i * sw);
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}v`} stops={[[0, shade(velvet, 0.35)], [0.6, velvet], [1, tint(velvet, 0.05)]]} x1={0} y1={0} x2={0} y2={h} />
      </defs>
      <rect x={0} y={0} width={w} height={20} fill={shade(velvet, 0.3)} />
      <path d={swags.map((x) => P`M${x} ${16}Q${x + sw / 2} ${h - 4} ${x + sw} ${16}Z`).join('')} fill={url(`${id}v`)} />
      <path d={swags.map((x) => P`M${x + 10} ${22}Q${x + sw / 2} ${h - 22} ${x + sw - 10} ${22}M${x + 22} ${24}Q${x + sw / 2} ${h - 36} ${x + sw - 22} ${24}`).join('')} stroke={shade(velvet, 0.4)} strokeWidth={2.5} opacity={0.5} fill="none" />
      <path d={swags.map((x) => P`M${x} ${16}Q${x + sw / 2} ${h - 4} ${x + sw} ${16}`).join('')} stroke={gold} strokeWidth={2} opacity={0.75} fill="none" />
      <path d={swags.slice(1).map((x) => P`M${x - 5} ${14}h10l-2 ${h - 34}h-6Z`).join('')} fill={gold} opacity={0.55} />
      <path d={P`M0 ${19}H${w}`} stroke={gold} strokeWidth={1.4} opacity={0.6} />
    </KitSvg>
  );
}

// ─────────────────────────── StageBeam ───────────────────────────

/**
 * A moving-head fixture hung from the ceiling grid and its slanted beam
 * (410×700): three nested cones from linear gradients along the beam (hot at
 * the lens, fading at the far end), haze motes and a soft pool where it lands.
 * The left beam runs from the top left to the bottom right; the right mirrors.
 */
function StageBeam(p: DrawProps & { side: Side }) {
  const { w, h, colors: c } = p;
  const id = kitId(p, `beam${p.side[0]}`);
  const full = p.detail === 'full';
  const mx = (x: number) => (p.side === 'left' ? x : w - x);
  const beam = mix(c.accent, '#ffffff', 0.45);
  const S: Pt = [mx(30), 34];
  const L: Pt = [mx(330), h - 34];
  const ax = L[0] - S[0];
  const ay = L[1] - S[1];
  const len = Math.sqrt(ax * ax + ay * ay);
  const ux = ax / len;
  const uy = ay / len;
  const nx = -uy;
  const ny = ux;
  const cone = (a: number, b: number) => P`M${S[0] + nx * a} ${S[1] + ny * a}L${L[0] + nx * b} ${L[1] + ny * b}L${L[0] - nx * b} ${L[1] - ny * b}L${S[0] - nx * a} ${S[1] - ny * a}Z`;
  const motes = full
    ? Array.from({ length: 12 }, (_, i) => {
        const t = 0.12 + rand(i, p.seed + 3) * 0.8;
        const off = (rand(i, p.seed + 5) - 0.5) * 2 * (6 + 34 * t);
        return dot(S[0] + ax * t + nx * off, S[1] + ay * t + ny * off, 0.8 + rand(i, 9) * 1.1);
      }).join('')
    : '';
  const head = (k: number) => [S[0] - ux * k, S[1] - uy * k] as const;
  const [hx, hy] = head(20);
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}g`} stops={[[0, '#ffffff', 1], [0.1, beam, 0.9], [0.62, beam, 0.42], [1, beam, 0.16]]} x1={S[0]} y1={S[1]} x2={L[0]} y2={L[1]} />
        <Glow id={`${id}p`} color={beam} core={beam} a={0.4} />
        <Glow id={`${id}l`} color={beam} core="#ffffff" a={1} />
      </defs>
      <path d={cone(8, 60)} fill={url(`${id}g`)} opacity={0.09} />
      <path d={cone(5, 36)} fill={url(`${id}g`)} opacity={0.13} />
      <path d={cone(2.4, 16)} fill={url(`${id}g`)} opacity={0.22} />
      <ellipse cx={L[0]} cy={L[1]} rx={64} ry={13} fill={url(`${id}p`)} />
      {motes ? <path d={motes} fill={beam} opacity={0.45} /> : null}
      {/* the fixture: hanger, yoke and head */}
      <path d={P`M${S[0]} ${0}V${S[1] - 18}`} stroke={shade(c.primary, 0.2)} strokeWidth={3} />
      <path d={P`M${S[0] - 12} ${S[1] - 18}H${S[0] + 12}V${S[1] - 4}M${S[0] - 12} ${S[1] - 18}V${S[1] - 4}`} stroke={mix(c.primary, c.surface, 0.3)} strokeWidth={2.4} fill="none" />
      <path d={P`M${hx + nx * 9} ${hy + ny * 9}L${S[0] + nx * 8} ${S[1] + ny * 8}L${S[0] - nx * 8} ${S[1] - ny * 8}L${hx - nx * 9} ${hy - ny * 9}Z`} fill={mix(c.primary, c.surface, 0.18)} stroke={p.light.rim} strokeWidth={0.8} strokeOpacity={0.5} />
      <circle cx={S[0]} cy={S[1]} r={8} fill={url(`${id}l`)} opacity={0.85} />
    </KitSvg>
  );
}

// ─────────────────────────── ScreenRing ───────────────────────────

/** The motion graphic on the screen (220×220): a dashed outer ring, three bright arcs, ticks and a playhead dot, turning slowly round the monogram. */
function ScreenRing(p: DrawProps) {
  const { w, colors: c } = p;
  const cx = w / 2;
  const glow = tint(c.accent, 0.2);
  const ticks = Array.from({ length: 24 }, (_, k) => {
    const [x, y] = dir15(k);
    const r0 = k % 6 === 0 ? 82 : 86;
    return P`M${cx + x * r0} ${cx + y * r0}L${cx + x * 91} ${cx + y * 91}`;
  }).join('');
  const [px, py] = dir15(5);
  return (
    <KitSvg p={p}>
      <circle cx={cx} cy={cx} r={104} fill="none" stroke={glow} strokeWidth={1.2} strokeDasharray="2 7" opacity={0.45} />
      <path d={arc15(cx, cx, 97, 0, 5) + arc15(cx, cx, 97, 8, 13) + arc15(cx, cx, 97, 16, 21)} stroke={glow} strokeWidth={2.6} opacity={0.8} fill="none" />
      <path d={ticks} stroke={glow} strokeWidth={1} opacity={0.45} />
      <circle cx={cx} cy={cx} r={76} fill="none" stroke={glow} strokeWidth={0.8} opacity={0.3} />
      <circle cx={cx + px * 97} cy={cx + py * 97} r={4} fill="#ffffff" opacity={0.9} />
    </KitSvg>
  );
}

// ─────────────────────────── Proscenium (back plane) ───────────────────────────

/**
 * The proscenium wall (696×898, world x 252–948, y −98–800, at d 2210) with the
 * stage opening cut through it (even-odd, world x 280–920 from y 190 down):
 * acoustic panels, a slim metal reveal round the opening and a soft LED cove
 * along its head. Wholly tone-on-tone above the eye line, where the words sit.
 */
function Proscenium(p: DrawProps) {
  const { w, h, colors: c } = p;
  const id = kitId(p, 'pros');
  const eye = p.eyeLine ?? 0;
  const ox0 = 28;
  const ox1 = w - 28;
  const oy = 288;
  const wallC = mix(mix(c.primary, c.surface, 0.1), '#000000', 0.18);
  const seam = shade(wallC, 0.22);
  const reveal = mix(wallC, c.secondary, 0.22);
  const panels = Array.from({ length: 11 }, (_, i) => 6 + i * 63.2);
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}w`} stops={[[0, shade(wallC, 0.25)], [Math.min(0.95, eye / h), wallC], [1, shade(wallC, 0.1)]]} x1={0} y1={0} x2={0} y2={h} />
        <Lin id={`${id}c`} stops={[[0, c.accent, 0], [0.5, c.accent, 0.3], [1, c.accent, 0]]} x1={ox0} y1={0} x2={ox1} y2={0} />
      </defs>
      <path d={P`M0 0H${w}V${h}H0Z` + P`M${ox0} ${oy}V${h}H${ox1}V${oy}Z`} fill={url(`${id}w`)} fillRule="evenodd" />
      <path d={panels.map((x) => P`M${x} ${8}V${oy - 18}`).join('') + P`M0 ${oy - 96}H${w}M0 ${oy - 190}H${w}`} stroke={seam} strokeWidth={1.4} opacity={0.6} fill="none" />
      <path d={P`M${ox0 - 8} ${h}V${oy - 8}H${ox1 + 8}V${h}`} stroke={reveal} strokeWidth={6} fill="none" />
      <path d={P`M${ox0} ${oy + 3}H${ox1}`} stroke={url(`${id}c`)} strokeWidth={5} />
      <path d={P`M${ox0 + 1} ${h}V${oy}H${ox1 - 1}V${h}`} stroke={p.light.rim} strokeWidth={1} opacity={0.18} fill="none" />
    </KitSvg>
  );
}

// ─────────────────────────── the house: ceiling and side walls ───────────────────────────

/**
 * The house ceiling (a ceiling plane, x from its x0, y from its near edge): black-blue acoustic plaster, rows of small
 * downlights only over the seats at either side, and a soft blue cove where it meets each wall, warming toward the
 * stage. Nothing runs along or across the middle: in perspective a ceiling's lines are rays and rules through the words.
 */
function HouseCeiling(p: DrawProps) {
  const { w, h, colors: c } = p;
  const id = kitId(p, 'hc');
  const g = p.plane;
  const x0 = g?.x0 ?? 0;
  const fx = (x: number) => r2(x - x0);
  const base = mix(c.primary, '#000000', 0.3);
  const cove = mix(c.secondary, c.accent, 0.4);
  const lamp = tint(c.accent, 0.55);
  const pitch = 260;
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}b`} stops={[[0, shade(base, 0.25)], [0.7, base], [1, mix(base, c.secondary, 0.16)]]} x1={0} y1={0} x2={0} y2={h} />
        <Lin id={`${id}c`} stops={[[0, cove, 0.3], [0.07, cove, 0.08], [0.16, cove, 0], [0.84, cove, 0], [0.93, cove, 0.08], [1, cove, 0.3]]} x1={0} y1={0} x2={w} y2={0} />
        <Glow id={`${id}g`} color={c.accent} core="#ffffff" a={0.7} />
        <pattern id={`${id}d`} width={w} height={pitch} patternUnits="userSpaceOnUse">
          {[fx(300), fx(355), fx(845), fx(900)].map((x) => (
            <g key={x}>
              <circle cx={x} cy={pitch / 2} r={16} fill={url(`${id}g`)} opacity={0.6} />
              <circle cx={x} cy={pitch / 2} r={3.6} fill={lamp} />
            </g>
          ))}
        </pattern>
      </defs>
      <rect width={w} height={h} fill={url(`${id}b`)} />
      <rect width={w} height={h} fill={url(`${id}d`)} />
      <rect width={w} height={h} fill={url(`${id}c`)} />
    </KitSvg>
  );
}

/**
 * The house's side walls: the kit's acoustic wall, its slatted dado taken down into the dark (its wood reads lilac in a
 * blue house), and blue wall-wash uplights rising in scallops from the dado in every bay, the way a venue lights its
 * walls before a keynote. The wall's x runs from its near edge (d = dNear); the bays' pitch is the kit's (350).
 */
function houseWall(dNear: number) {
  const acoustic = drawWith(Wall, { variant: 'acoustic' });
  return (p: DrawProps) => {
    const { w, h, colors: c } = p;
    const id = kitId(p, 'hw');
    const y0 = p.plane?.y0 ?? 800 - h;
    const Y = (wy: number) => r2(wy - y0);
    const wash = mix(c.secondary, c.accent, 0.35);
    const bays = Array.from({ length: Math.floor(w / 350) }, (_, i) => i * 350 + 175).filter((x) => x + dNear > 250);
    const foot = Y(650);
    const top = Y(330);
    const scallops = bays.map((x) => P`M${x - 16} ${foot}C${x - 30} ${foot - 120} ${x - 95} ${top + 70} ${x - 80} ${top + 20}Q${x} ${top - 26} ${x + 80} ${top + 20}C${x + 95} ${top + 70} ${x + 30} ${foot - 120} ${x + 16} ${foot}Z`).join('');
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        {acoustic(p)}
        <svg viewBox={`0 0 ${r2(w)} ${r2(h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
          <defs>
            <Lin id={`${id}w`} stops={[[0, wash, 0], [0.55, wash, 0.13], [1, wash, 0.34]]} x1={0} y1={top - 26} x2={0} y2={foot} />
          </defs>
          <rect x={0} y={foot} width={r2(w)} height={r2(Y(778) - foot)} fill={mix(c.primary, '#000000', 0.45)} opacity={0.55} />
          <path d={scallops} fill={url(`${id}w`)} />
          <path d={bays.map((x) => P`M${x - 7} ${foot - 2}h14v4h-14Z`).join('')} fill={tint(wash, 0.6)} opacity={0.85} />
        </svg>
      </div>
    );
  };
}

// ─────────────────────────── the set ───────────────────────────

export const auditorium: StageSetFactory = (ctx) => {
  const c = ctx.colors;
  const accent = c.accent;
  const rows: Piece[] = [700, 1000, 1350, 1700].flatMap((d) =>
    (['left', 'right'] as const).map(
      (side): Piece => ({
        kind: 'prop',
        id: `row-${side[0]}-${d}`,
        art: 'seatRow',
        role: 'prop',
        ...billboard({ x: side === 'left' ? 390 : 810, d, w: 260, h: 150 }),
        draw: (p) => <SeatRow {...p} aisle={side === 'left' ? 'right' : 'left'} />,
        ...(d > 700 ? { buildIn: 'rise' as const } : {}),
      }),
    ),
  );
  const aisleLights = [1000, 1350, 1700].flatMap((d) => [
    { x: 516, d: d + 6, r: 46, color: accent },
    { x: 684, d: d + 6, r: 46, color: accent },
  ]);
  return {
    name: 'auditorium',
    sky: `radial-gradient(ellipse 20% 15% at 50% 53%, ${mix(c.secondary, c.primary, 0.55)} 0%, ${mix(c.primary, '#000000', 0.3)} 60%, transparent 100%), linear-gradient(180deg, ${mix(c.primary, '#000000', 0.6)} 0%, ${mix(c.primary, '#000000', 0.42)} 52%, ${mix(c.primary, '#000000', 0.55)} 100%)`,
    light: { from: 'far', color: '#9ad4ff', rim: '#cfe4ff' },
    fog: { color: '#10141f', near: 1200, far: 2800, max: 0.5 },
    veil: 0.35,
    focus: { x: 600, y: 560, z: -2300 },
    pieces: [
      { kind: 'plane', id: 'ceiling', art: 'ceiling:house', role: 'architecture', quiet: true, plane: ceiling({ x0: 250, x1: 950, y: -100, dNear: -1150, dFar: 2600 }), draw: HouseCeiling },
      { kind: 'plane', id: 'wall-l', art: 'wall:acoustic', role: 'architecture', plane: wall('left', { x: 250, yTop: -100, dNear: -200, dFar: 2600 }), draw: houseWall(-200) },
      { kind: 'plane', id: 'wall-r', art: 'wall:acoustic', role: 'architecture', plane: wall('right', { x: 950, yTop: -100, dNear: -200, dFar: 2600 }), draw: houseWall(-200) },
      {
        kind: 'plane',
        id: 'floor',
        art: 'floor:carpet',
        role: 'architecture',
        plane: floor({ x0: 250, x1: 950, dNear: -200, dFar: 2600 }),
        draw: drawWith(Floor, {
          variant: 'carpet',
          runner: true,
          pools: [{ x: 600, d: 2180, r: 300, color: WARM }, { x: 600, d: 1950, r: 420, color: accent }, ...aisleLights],
        }),
      },
      { kind: 'plane', id: 'proscenium', art: 'proscenium', role: 'architecture', quiet: true, plane: back({ x0: 252, x1: 948, yTop: -98, d: 2210 }), draw: Proscenium },
      ...rows,
      { kind: 'prop', id: 'stage', art: 'keynoteStage', role: 'focal', ...billboard({ x: 600, d: 2300, w: 680, h: 560 }), draw: (p) => <KeynoteStage {...p} monogram={ctx.monogram} /> },
      { kind: 'prop', id: 'screen-ring', art: 'screenRing', role: 'prop', ...hang({ x: 600, d: 2290, w: 220, h: 220, top: 276 }), draw: ScreenRing, motion: { kind: 'spin', amp: 1, period: 40 }, buildIn: 'bloom' },
      { kind: 'prop', id: 'drape-l', art: 'curtainDrape', role: 'architecture', ...billboard({ x: 315, d: 2240, w: 110, h: 600 }), draw: (p) => <CurtainDrape {...p} side="left" /> },
      { kind: 'prop', id: 'drape-r', art: 'curtainDrape', role: 'architecture', ...billboard({ x: 885, d: 2240, w: 110, h: 600 }), draw: (p) => <CurtainDrape {...p} side="right" /> },
      { kind: 'prop', id: 'valance', art: 'valance', role: 'architecture', quiet: true, ...hang({ x: 600, d: 2232, w: 600, h: 80, top: 196 }), draw: Valance },
      { kind: 'prop', id: 'beam-l', art: 'stageBeam', role: 'light', ...hang({ x: 475, d: 1590, w: 410, h: 700, top: -60 }), draw: (p) => <StageBeam {...p} side="left" />, motion: { kind: 'sway', amp: 2.2, period: 8 }, buildIn: 'fade' },
      { kind: 'prop', id: 'beam-r', art: 'stageBeam', role: 'light', ...hang({ x: 725, d: 1610, w: 410, h: 700, top: -60 }), draw: (p) => <StageBeam {...p} side="right" />, motion: { kind: 'sway', amp: 2.2, period: 8, phase: 0.5 }, buildIn: 'fade' },
      { kind: 'light', id: 'glow-screen', art: 'glow', role: 'light', at: { x: 600, y: 400, z: -2330 }, r: 260, color: accent, strength: 0.55, bloom: true, motion: { kind: 'pulse', amp: 0.15, period: 5 }, buildIn: 'light' },
      { kind: 'light', id: 'glow-foot', art: 'glow', role: 'light', at: { x: 600, y: 760, z: -2200 }, r: 200, color: WARM, strength: 0.35, buildIn: 'light' },
    ],
    covers: { gate: 'campus', door: 'ballroom', silk: 'velvet', card: 'trifold' },
    particles: { count: 0, dNear: 700, dFar: 2300 },
  };
};
