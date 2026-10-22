import type { ReactNode } from 'react';
import { frameAt, onCubic, shade, tint, type Segment } from '../../art/kit';
import { r2 } from '../../art/motifs';
import { mix } from '../../theme';
import { Ceiling, drawWith, Floor } from '../kit';
import { aroundEllipse, bodyStops, faces, FlameAt, FlameDef, Glow, kitId, KitSvg, Lin, marigoldOf, metalLit, P, Rim } from '../kit/architecture';
import { billboard, ceiling, floor, hang, wall } from '../planes';
import type { DrawProps, Piece, StageSetFactory } from '../types';

/**
 * T12 · Thousand Pillars (`thousand-pillars`, final.md §5.3): the `mandapam` stage.
 * A granite mandapam on an upanayanam morning. Tall carved pillars march in two
 * rows down a polished granite hall under its stone beams, open to a bright
 * courtyard at the sides; brass temple bells hang near overhead, kuthuvilakku
 * burn either side of a rice-flour kolam path, and at the far end the homam
 * fire rises from a stepped stone vedi, two kalash at its corners, framed by a
 * gilt prabhavali arch. Morning sun comes from the left and lies in pools on
 * the floor between the pillars.
 *
 * Set-local piece (§6.4): HomamVedi (the stepped vedi with its kund, garland
 * and two kalash). The pillars are the kit's granite pillar drawn the full
 * height of the hall (floor to beams) and quiet above the eye line, so the hall
 * reads as one structure; the sky is the set's CSS gradient (the beams and the
 * pillars hide most of a sky plane).
 */

// ─────────────────────────── geometry ───────────────────────────

const CEIL = -40;
const VEDI = { d: 2150, w: 440, h: 260 };
/** The vedi's top face (box units from its top): the kund pit's rim, where the flames rise. */
const VEDI_TOP = 138;
const FIRE = { w: 150, h: 170 };

// ─────────────────────────── HomamVedi ───────────────────────────

/** Points along a sagging swag from (x0, y) to (x1, y), `sag` deep at the middle (onCubic samples, no trigonometry). */
function swag(x0: number, x1: number, y: number, sag: number, n: number) {
  const seg: Segment = [
    [x0, y],
    [x0 + (x1 - x0) * 0.25, y + sag * 1.33],
    [x0 + (x1 - x0) * 0.75, y + sag * 1.33],
    [x1, y],
  ];
  return Array.from({ length: n + 1 }, (_, i) => onCubic(seg, i / n));
}

/** A brass kalash: the pot, a sacred thread on its neck, five mango leaves and a coconut. Drawn with its base at (x, y), `s` = 1 for 64 wide. */
function Kalash({ p, id, x, y, s }: { p: DrawProps; id: string; x: number; y: number; s: number }) {
  const n = p.nature;
  const c = p.colors;
  const k = s;
  const leaf = (dx: number, lean: number, len: number, tone: string, i: number) => {
    const bx = x + dx * k;
    const by = y - 76 * k;
    const tx = bx + lean * len * k;
    const ty = by - len * 0.62 * k;
    return <path key={i} d={P`M${bx} ${by}Q${(bx + tx) / 2 - lean * 9 * k} ${by - len * 0.5 * k} ${tx} ${ty}Q${(bx + tx) / 2 + lean * 6 * k} ${by - len * 0.08 * k} ${bx} ${by}Z`} fill={tone} />;
  };
  const coir = mix(n.clayDark, c.text, 0.25);
  return (
    <g>
      {/* Mango leaves fanning out of the mouth (real leaves: NATURE). */}
      {leaf(-6, -1, 38, n.leafDark, 0)}
      {leaf(6, 1, 38, n.leafDark, 1)}
      {leaf(-4, -0.55, 42, n.leaf, 2)}
      {leaf(4, 0.55, 42, n.leaf, 3)}
      {leaf(0, -0.08, 30, n.leafLight, 4)}
      {/* The coconut with its tuft. */}
      <ellipse cx={r2(x)} cy={r2(y - 92 * k)} rx={r2(15 * k)} ry={r2(19 * k)} fill={`url(#${id}co)`} />
      <path d={P`M${x - 4 * k} ${y - 109 * k}Q${x} ${y - 122 * k} ${x + 5 * k} ${y - 110 * k}`} fill="none" stroke={coir} strokeWidth={r2(2.2 * k)} strokeLinecap="round" />
      {/* The pot: a round belly, a waisted neck and a flared lip, in lit brass. */}
      <path
        d={P`M${x - 13 * k} ${y - 70 * k}C${x - 14 * k} ${y - 62 * k} ${x - 33 * k} ${y - 52 * k} ${x - 32 * k} ${y - 30 * k}C${x - 31 * k} ${y - 10 * k} ${x - 18 * k} ${y - 2 * k} ${x - 9 * k} ${y}H${x + 9 * k}C${x + 18 * k} ${y - 2 * k} ${x + 31 * k} ${y - 10 * k} ${x + 32 * k} ${y - 30 * k}C${x + 33 * k} ${y - 52 * k} ${x + 14 * k} ${y - 62 * k} ${x + 13 * k} ${y - 70 * k}Z`}
        fill={`url(#${id}br)`}
      />
      <path d={P`M${x - 18 * k} ${y - 74 * k}H${x + 18 * k}L${x + 14 * k} ${y - 69 * k}H${x - 14 * k}Z`} fill={`url(#${id}br)`} />
      {/* A white-and-red thread wound round the neck, and kumkum dots on the belly. */}
      <path d={P`M${x - 15 * k} ${y - 60 * k}Q${x} ${y - 55 * k} ${x + 15 * k} ${y - 60 * k}M${x - 18 * k} ${y - 56 * k}Q${x} ${y - 51 * k} ${x + 18 * k} ${y - 56 * k}`} fill="none" stroke={n.ivory} strokeWidth={r2(1.6 * k)} />
      <path d={P`M${x - 16.5 * k} ${y - 58 * k}Q${x} ${y - 53 * k} ${x + 16.5 * k} ${y - 58 * k}`} fill="none" stroke={mix(c.primary, n.clay, 0.4)} strokeWidth={r2(1.4 * k)} />
      <ellipse cx={r2(x - 10 * k)} cy={r2(y - 40 * k)} rx={r2(7 * k)} ry={r2(12 * k)} fill="#ffffff" opacity={0.28} />
      {[-12, 0, 12].map((dx) => (
        <circle key={dx} cx={r2(x + dx * k)} cy={r2(y - 34 * k + Math.abs(dx) * 0.2 * k)} r={r2(2.4 * k)} fill={mix(c.primary, n.clay, 0.45)} />
      ))}
      <circle cx={r2(x)} cy={r2(y - 26 * k)} r={r2(1.6 * k)} fill={n.flame} />
    </g>
  );
}

/**
 * The focal piece: a stepped granite homa vedi, its three tiers carved with a
 * lotus-petal moulding and a kolam band, a marigold garland swagged across the
 * top tier, small diyas along the middle ledge, the kund's mouth open on the
 * top face (the HomaFire stands just behind it and shows through) and a brass
 * kalash on each front corner.
 */
function HomamVedi(p: DrawProps) {
  const { w, colors: c, nature: n } = p;
  const id = kitId(p, 'hv');
  const full = p.detail === 'full';
  const stone = mix(c.muted, c.surface, 0.45);
  const line = shade(stone, 0.4);
  const hi = tint(stone, 0.35);
  const marigold = marigoldOf(p);
  const copper = mix(c.secondary, n.clay, 0.45);
  // Tiers: [x inset, top y, bottom y].
  const tiers: Array<[number, number, number]> = [
    [0, 212, 260],
    [24, 178, 212],
    [50, 152, 178],
  ];
  const topBack = VEDI_TOP - 16;
  const pit = { x0: w / 2 - 58, x1: w / 2 + 58, y: 150, bx0: w / 2 - 50, bx1: w / 2 + 50, by: topBack + 3 };
  // The top face of the top tier, with the kund's mouth cut out (even-odd): the fire behind shows through.
  const topFace =
    P`M${50} ${152}L${66} ${topBack}H${w - 66}L${w - 50} ${152}Z` + P`M${pit.x0} ${pit.y}L${pit.bx0} ${pit.by}H${pit.bx1}L${pit.x1} ${pit.y}Z`;
  const petals = (x0: number, x1: number, y: number, size: number) => {
    const count = Math.max(4, Math.round((x1 - x0) / size));
    const pw = (x1 - x0) / count;
    return Array.from({ length: count }, (_, i) => {
      const a = x0 + i * pw;
      return P`M${a} ${y}C${a} ${y - size * 0.7} ${a + pw} ${y - size * 0.7} ${a + pw} ${y}`;
    }).join('');
  };
  const garlandD = swag(56, w - 56, 157, 13, 24).map((pt, i) => `${i ? 'L' : 'M'}${r2(pt.x)} ${r2(pt.y)}`).join('');
  const diyas = [74, 150, w - 150, w - 74];
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}s`} stops={bodyStops(stone, p.light.from)} x1={0} x2={w} />
        <Lin id={`${id}t`} stops={[[0, tint(stone, 0.22)], [1, tint(stone, 0.04)]]} y1={topBack} y2={152} />
        <Lin id={`${id}br`} stops={metalLit(c.secondary, p.light.from)} x1={0} y1={0} x2={w} y2={20} />
        <Lin id={`${id}cu`} stops={metalLit(copper, p.light.from, false)} x1={0} x2={w} />
        <radialGradient id={`${id}co`} cx="38%" cy="30%" r="75%">
          <stop offset="0" stopColor={mix(n.clay, n.clayDark, 0.3)} />
          <stop offset="1" stopColor={shade(n.clayDark, 0.25)} />
        </radialGradient>
        <Glow id={`${id}g`} color={n.flame} core={n.flameCore} a={0.55} />
        <FlameDef id={`${id}f`} p={p} seed={p.seed} small />
        <g id={`${id}k`}>
          <Kalash p={p} id={id} x={0} y={0} s={1} />
        </g>
      </defs>
      {/* Fire light washing the top face and the ledges. */}
      <ellipse cx={r2(w / 2)} cy={r2(VEDI_TOP + 6)} rx={r2(w * 0.42)} ry={44} fill={`url(#${id}g)`} />
      {/* The tiers: front faces with their side returns. */}
      {tiers.map(([inset, y0, y1], i) => (
        <g key={i}>
          <rect x={r2(inset)} y={r2(y0)} width={r2(w - 2 * inset)} height={r2(y1 - y0)} fill={`url(#${id}s)`} stroke={line} strokeWidth={0.9} />
          <rect x={r2(inset)} y={r2(y0)} width={r2(w - 2 * inset)} height={2.4} fill={hi} opacity={0.85} />
        </g>
      ))}
      {/* The base: a lotus-petal (padma) moulding and a beaded fillet. */}
      <path d={petals(4, w - 4, 252, 22)} fill="none" stroke={line} strokeWidth={1.1} />
      {full ? <path d={P`M${6} ${226}H${w - 6}`} stroke={line} strokeWidth={2.4} strokeDasharray="2 3.2" opacity={0.7} /> : null}
      {/* The middle tier: a kolam band of rice-flour dots and loops. */}
      <path d={P`M${30} ${183}H${w - 30}M${30} ${207}H${w - 30}`} stroke={n.ivory} strokeWidth={1.1} opacity={0.85} />
      {full ? (
        <path
          d={Array.from({ length: 11 }, (_, i) => {
            const cx = 40 + i * ((w - 80) / 10);
            return P`M${cx - 6} ${195}Q${cx} ${186} ${cx + 6} ${195}Q${cx} ${204} ${cx - 6} ${195}Z`;
          }).join('')}
          fill="none"
          stroke={n.ivory}
          strokeWidth={1}
          opacity={0.85}
        />
      ) : null}
      {/* The top face, the kund's copper lip around its open mouth. */}
      <path d={topFace} fill={`url(#${id}t)`} fillRule="evenodd" stroke={line} strokeWidth={0.8} />
      <path d={P`M${pit.x0 - 6} ${pit.y + 1}L${pit.bx0 - 5} ${pit.by - 2}H${pit.bx1 + 5}L${pit.x1 + 6} ${pit.y + 1}Z` + P`M${pit.x0} ${pit.y}L${pit.bx0} ${pit.by}H${pit.bx1}L${pit.x1} ${pit.y}Z`} fill={`url(#${id}cu)`} fillRule="evenodd" />
      {/* The marigold garland across the top tier. */}
      <path d={garlandD} fill="none" stroke={shade(marigold, 0.2)} strokeWidth={6.4} strokeLinecap="round" />
      {full ? <path d={garlandD} fill="none" stroke={marigold} strokeWidth={6} strokeLinecap="round" strokeDasharray="0 5.2" /> : null}
      {full ? <path d={garlandD} fill="none" stroke={n.ivory} strokeWidth={4} strokeLinecap="round" strokeDasharray="0 31.2" /> : null}
      {/* Diyas along the middle ledge. */}
      {diyas.map((x) => (
        <g key={x}>
          <path d={P`M${x - 7} ${178}Q${x} ${186} ${x + 7} ${178}Z`} fill={mix(n.clay, c.secondary, 0.3)} />
          <FlameAt href={`${id}f`} x={x} y={178} s={11} />
        </g>
      ))}
      <Rim p={p} x0={0} x1={w} y0={212} y1={260} />
      <Rim p={p} x0={50} x1={w - 50} y0={152} y1={178} />
      {/* A brass kalash on each front corner of the top tier. */}
      <use href={`#${id}k`} x={88} y={150} />
      <use href={`#${id}k`} x={r2(w - 88)} y={150} />
    </KitSvg>
  );
}

// ─────────────────────────── Prabhavali and Kuthuvilakku ───────────────────────────

/**
 * The gilt prabhavali (tiruvachi) behind the vedi, in a 300×420 drawing: a ring
 * of flames round a round arch, its band set with jewels, a kalasam finial at
 * the crown, makara scrolls where the arch springs and slim pillars below; a
 * warm sanctum glow fills the arch (no idol). Flames and jewels are each drawn
 * once and placed round the arch (the `prabhavali` illustration weighs 20 KB).
 */
function Prabhavali(p: DrawProps) {
  const { colors: c, nature: n } = p;
  const id = kitId(p, 'pv');
  const full = p.detail === 'full';
  const gold = c.secondary;
  const line = shade(gold, 0.45);
  const light = tint(gold, 0.55);
  const cx = 150;
  const cy = 200;
  const ring = (r: number, count: number, from = 0.25, to = 0.75) =>
    Array.from({ length: count }, (_, i) => {
      const pt = aroundEllipse(cx, cy, r, r, from + ((to - from) * i) / (count - 1));
      const nx = (pt.x - cx) / r;
      const ny = (pt.y - cy) / r;
      return frameAt({ x: pt.x, y: pt.y, tx: nx, ty: ny });
    });
  const flames = ring(104, 19);
  const jewels = ring(92, 15, 0.27, 0.73);
  return (
    <svg viewBox="0 0 300 420" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <Lin id={`${id}m`} stops={metalLit(gold, p.light.from)} x1={0} y1={0} x2={300} y2={60} />
        <radialGradient id={`${id}f`} cx="50%" cy="90%" r="80%">
          <stop offset="0" stopColor={n.flameCore} />
          <stop offset="0.55" stopColor={tint(gold, 0.35)} />
          <stop offset="1" stopColor={gold} />
        </radialGradient>
        <Glow id={`${id}g`} color={n.flame} core={n.flameCore} a={0.7} cy="62%" />
        <path id={`${id}t`} d="M0 2C-7 -2 -8 -10 -2 -16C-3 -11 0 -9 1 -12C1 -18 4 -22 0 -30C9 -22 9 -9 6 -4C5 -1 3 1 0 2Z" fill={`url(#${id}f)`} stroke={line} strokeWidth="0.6" />
        <g id={`${id}j`}>
          <path d="M0 -6C3.6 -3 3.6 2 0 6C-3.6 2 -3.6 -3 0 -6Z" fill={c.accent} stroke={line} strokeWidth="0.5" />
          <circle cx="0" cy="0" r="1.4" fill={n.pearl} />
        </g>
        <g id={`${id}s`}>
          <path d="M46 202C30 200 20 210 22 222C24 234 40 236 44 226C47 218 40 211 34 215C30 218 33 224 37 222" fill="none" stroke={`url(#${id}m)`} strokeWidth="3" strokeLinecap="round" />
          <path d="M44 226C40 238 30 244 18 244" fill="none" stroke={`url(#${id}m)`} strokeWidth="2" strokeLinecap="round" />
        </g>
      </defs>
      {/* The sanctum's glow inside the arch. */}
      <ellipse cx={cx} cy={250} rx={92} ry={150} fill={`url(#${id}g)`} />
      {/* The flame ring. */}
      {flames.map((t, i) => (
        <use key={i} href={`#${id}t`} transform={t} />
      ))}
      {/* The band, its jewels and the inner bead. */}
      <path d="M48 200A102 102 0 0 1 252 200L232 200A82 82 0 0 0 68 200Z" fill={`url(#${id}m)`} stroke={line} strokeWidth="0.8" />
      {full ? jewels.map((t, i) => <use key={i} href={`#${id}j`} transform={t} />) : null}
      <path d="M70 200A80 80 0 0 1 230 200" fill="none" stroke={light} strokeWidth="1.2" />
      {/* The kalasam finial. */}
      <path d="M150 66C141 62 132 63 126 68C134 71 142 70 150 66ZM150 66C159 62 168 63 174 68C166 71 158 70 150 66Z" fill={n.leaf} />
      <path d="M134 96C127 87 131 74 150 72C169 74 173 87 166 96Z" fill={`url(#${id}m)`} stroke={line} strokeWidth="0.8" />
      <path d="M141 66C142 54 147 44 150 32C153 44 158 54 159 66Z" fill={`url(#${id}m)`} stroke={line} strokeWidth="0.8" />
      <circle cx="150" cy="29" r="3" fill={`url(#${id}m)`} />
      <circle cx="150" cy="86" r="3.2" fill={c.accent} stroke={line} strokeWidth="0.5" />
      {/* The pillars, the makara scrolls and the plinth. */}
      {[44, 230].map((a) => (
        <g key={a}>
          <rect x={a} y="212" width="26" height="164" fill={`url(#${id}m)`} stroke={line} strokeWidth="0.8" />
          <path d={`M${a - 6} 212H${a + 32}L${a + 28} 204H${a - 2}Z`} fill={`url(#${id}m)`} stroke={line} strokeWidth="0.8" />
          <path d={`M${a + 8} 222V366M${a + 18} 222V366`} stroke={line} strokeWidth="0.8" opacity="0.7" />
          <circle cx={a + 13} cy="292" r="4" fill={c.accent} stroke={line} strokeWidth="0.6" />
        </g>
      ))}
      <use href={`#${id}s`} />
      <use href={`#${id}s`} transform="translate(300 0) scale(-1 1)" />
      <rect x="22" y="376" width="256" height="30" rx="2" fill={`url(#${id}m)`} stroke={line} strokeWidth="0.8" />
      <path d="M30 384H270" stroke={light} strokeWidth="0.8" opacity="0.8" />
    </svg>
  );
}

/** One kuthuvilakku's box. */
const LAMP_BOX = { w: 60, h: 150 };

/**
 * Brass kuthuvilakku (each 60×150): a stepped round foot, a slender turned
 * stem, the five-wick dish with three flames seen from the front and a bud
 * finial, the brass bright toward the key light. One lamp is drawn once and
 * placed at both ends of the box (a pair either side of the aisle is one piece).
 */
function Kuthuvilakku(p: DrawProps) {
  const { w, h, colors: c } = p;
  const id = kitId(p, 'kv');
  const lw = LAMP_BOX.w;
  const k = h / LAMP_BOX.h;
  const cx = lw / 2;
  const line = shade(c.secondary, 0.5);
  const m = `url(#${id}m)`;
  const dishY = 40 * k;
  const xs = w > lw * 1.5 ? [0, w - lw * k] : [(w - lw * k) / 2];
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}m`} stops={metalLit(c.secondary, p.light.from)} x1={0} x2={lw * k} />
        <FlameDef id={`${id}f`} p={p} seed={p.seed} small />
        <Glow id={`${id}g`} color={p.nature.flame} core={p.nature.flameCore} a={0.5} />
        <g id={`${id}l`}>
          <ellipse cx={r2(cx * k)} cy={r2(dishY - 8 * k)} rx={r2(30 * k)} ry={r2(16 * k)} fill={`url(#${id}g)`} />
          {/* Foot: stepped rings; a stem with turned knops. */}
          <path d={P`M${(cx - 26) * k} ${h}H${(cx + 26) * k}L${(cx + 22) * k} ${h - 7 * k}H${(cx - 22) * k}ZM${(cx - 17) * k} ${h - 7 * k}H${(cx + 17) * k}L${(cx + 11) * k} ${h - 15 * k}H${(cx - 11) * k}Z`} fill={m} stroke={line} strokeWidth={r2(0.5 * k)} />
          <rect x={r2((cx - 2.6) * k)} y={r2(dishY)} width={r2(5.2 * k)} height={r2(h - 15 * k - dishY)} fill={m} />
          {[0.42, 0.62, 0.8].map((t) => (
            <ellipse key={t} cx={r2(cx * k)} cy={r2(h * t)} rx={r2(6 * k)} ry={r2(3.4 * k)} fill={m} stroke={line} strokeWidth={r2(0.4 * k)} />
          ))}
          {/* The dish and its lip; the bud finial. */}
          <path d={P`M${(cx - 24) * k} ${dishY - 6 * k}Q${cx * k} ${dishY + 10 * k} ${(cx + 24) * k} ${dishY - 6 * k}Z`} fill={m} stroke={line} strokeWidth={r2(0.5 * k)} />
          <ellipse cx={r2(cx * k)} cy={r2(dishY - 6 * k)} rx={r2(24 * k)} ry={r2(2.4 * k)} fill={tint(c.secondary, 0.4)} />
          <path d={P`M${(cx - 1.6) * k} ${dishY - 6 * k}V${14 * k}H${(cx + 1.6) * k}V${dishY - 6 * k}Z`} fill={m} />
          <path d={P`M${cx * k} ${2 * k}C${(cx + 6) * k} ${8 * k} ${(cx + 5) * k} ${14 * k} ${cx * k} ${16 * k}C${(cx - 5) * k} ${14 * k} ${(cx - 6) * k} ${8 * k} ${cx * k} ${2 * k}Z`} fill={m} stroke={line} strokeWidth={r2(0.4 * k)} />
          {[-18, 0, 18].map((dx) => (
            <FlameAt key={dx} href={`${id}f`} x={(cx + dx) * k} y={dishY - 7 * k} s={(dx ? 12 : 14) * k} skew={dx * -0.3} />
          ))}
        </g>
      </defs>
      {xs.map((x) => (
        <use key={x} href={`#${id}l`} x={r2(x)} />
      ))}
    </KitSvg>
  );
}

// ─────────────────────────── HomaFire ───────────────────────────

/**
 * The homam fire rising out of the vedi's kund (150×170, the kund's mouth at
 * 64% of the height, where the vedi's top face cuts it): crossed samidha sticks
 * on glowing embers and five licking tongues of flame round a tall centre one,
 * with a few sparks. The kit's SacredFire draws its own copper kund, which the
 * vedi hides here, so this keeps only what shows (markup budget).
 */
function HomaFire(p: DrawProps) {
  const { w, h, colors: c, nature: n } = p;
  const id = kitId(p, 'hf');
  const kt = h * 0.64;
  const cx = w / 2;
  const fireH = kt - 4;
  const tongues: Array<[number, number, number, number, number]> = [
    [-0.24, 0.46, -1.4, -9, 0],
    [0.24, 0.5, 1.4, 9, 1],
    [-0.11, 0.78, 1.6, -4, 1],
    [0.12, 0.82, -1.6, 4, 0],
    [0, 1, 1.8, 1, 1],
  ];
  return (
    <KitSvg p={p}>
      <defs>
        <Glow id={`${id}h`} color={n.flame} core={n.flameCore} a={0.6} cy="64%" />
        <FlameDef id={`${id}f0`} p={p} seed={p.seed * 7} />
        <FlameDef id={`${id}f1`} p={p} seed={p.seed * 7 + 1} />
      </defs>
      <ellipse cx={r2(cx)} cy={r2(kt * 0.66)} rx={r2(w * 0.5)} ry={r2(h * 0.48)} fill={`url(#${id}h)`} />
      <path d={P`M${cx - 40} ${kt + 6}L${cx + 26} ${kt - 14}M${cx + 40} ${kt + 6}L${cx - 26} ${kt - 14}M${cx - 24} ${kt + 8}L${cx + 34} ${kt - 6}`} stroke={mix(n.clayDark, c.text, 0.3)} strokeWidth={4.6} strokeLinecap="round" />
      <ellipse cx={r2(cx)} cy={r2(kt + 4)} rx={46} ry={7} fill={n.flame} opacity={0.85} />
      {tongues.map(([dx, f, wide, sk, s], i) => (
        <FlameAt key={i} href={`${id}f${s}`} x={cx + dx * w} y={kt + 4} s={fireH * f} wide={wide} skew={sk} />
      ))}
      <path d={P`M${cx - 30} ${kt + 2}h60`} stroke={n.flameCore} strokeWidth={4} strokeLinecap="round" opacity={0.8} />
      {p.detail === 'full' ? <path d={P`M${cx - 30} ${kt * 0.3}h2.4M${cx + 22} ${kt * 0.16}h2M${cx + 8} ${kt * 0.05}h2`} stroke={n.flameCore} strokeWidth={2.4} strokeLinecap="round" /> : null}
    </KitSvg>
  );
}

// ─────────────────────────── TemplePillar ───────────────────────────

/**
 * A Dravidian granite pillar the full height of the hall (84×840): a moulded
 * plinth, an octagonal shaft (three faces, the one away from the key light 25%
 * darker) between square blocks carved with lotus medallions and a diamond
 * band, a lotus-and-pot capital, a plank and a pothigai bracket with hanging
 * buds under the beam. The kit's granite pillar in this hall's proportions,
 * drawn with each carved block defined once (markup budget); quiet above the
 * eye line.
 */
function TemplePillar(p: DrawProps) {
  const { w, h, colors: c } = p;
  const id = kitId(p, 'tp');
  const full = p.detail === 'full';
  const k = w / 70;
  const stone = mix(c.muted, c.surface, 0.42);
  const line = shade(stone, 0.42);
  const hi = tint(stone, 0.32);
  const [fl, ff, fr] = faces(stone, p.light.from);
  const sx0 = w * 0.15;
  const sw = w * 0.7;
  const cf = sw * 0.22;
  const baseTop = h - 40 * k;
  const capBot = 66 * k;
  const q = sw * 1.05;
  const eye = p.eyeLine ?? 0;
  const sk = r2(0.7 * k);
  const blocks: Array<[number, 'r' | 'b']> = [
    [capBot, 'r'],
    [capBot + (baseTop - capBot) * 0.36 - q / 2, 'b'],
    [capBot + (baseTop - capBot) * 0.64 - q / 2, 'r'],
    [baseTop - q, 'b'],
  ];
  const m = `url(#${id}f)`;
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}f`} stops={bodyStops(stone, p.light.from)} x1={0} x2={w} />
        <Lin id={`${id}q`} stops={[[0, stone, 0.7], [0.8, stone, 0.5], [1, stone, 0]]} y1={0} y2={Math.max(eye, 1)} />
        <g id={`${id}r`}>
          <rect x={r2(sx0 - 2 * k)} y={0} width={r2(sw + 4 * k)} height={r2(q)} fill={m} stroke={line} strokeWidth={sk} />
          {full ? <rect x={r2(sx0 + 2 * k)} y={r2(3 * k)} width={r2(sw - 4 * k)} height={r2(q - 6 * k)} fill="none" stroke={hi} strokeWidth={r2(0.6 * k)} opacity={0.7} /> : null}
          <circle cx={r2(w / 2)} cy={r2(q / 2)} r={r2(sw * 0.3)} fill={shade(stone, 0.1)} stroke={line} strokeWidth={r2(0.8 * k)} />
          {full ? <circle cx={r2(w / 2)} cy={r2(q / 2)} r={r2(sw * 0.19)} fill="none" stroke={line} strokeWidth={r2(sw * 0.12)} strokeDasharray={`${r2(2.4 * k)} ${r2(1.5 * k)}`} opacity={0.75} /> : null}
          <circle cx={r2(w / 2)} cy={r2(q / 2)} r={r2(sw * 0.07)} fill={line} />
        </g>
        <g id={`${id}b`}>
          <rect x={r2(sx0 - 2 * k)} y={0} width={r2(sw + 4 * k)} height={r2(q)} fill={m} stroke={line} strokeWidth={sk} />
          <path d={P`M${w / 2} ${5 * k}L${sx0 + sw - 5 * k} ${q / 2}L${w / 2} ${q - 5 * k}L${sx0 + 5 * k} ${q / 2}Z`} fill={shade(stone, 0.1)} stroke={line} strokeWidth={sk} />
          <circle cx={r2(w / 2)} cy={r2(q / 2)} r={r2(3 * k)} fill={hi} stroke={line} strokeWidth={r2(0.6 * k)} />
        </g>
      </defs>
      {/* The octagonal shaft: three faces. */}
      <rect x={r2(sx0)} y={r2(capBot)} width={r2(cf)} height={r2(baseTop - capBot)} fill={fl} />
      <rect x={r2(sx0 + cf)} y={r2(capBot)} width={r2(sw - 2 * cf)} height={r2(baseTop - capBot)} fill={ff} />
      <rect x={r2(sx0 + sw - cf)} y={r2(capBot)} width={r2(cf)} height={r2(baseTop - capBot)} fill={fr} />
      {blocks.map(([y, kind]) => (
        <use key={y} href={`#${id}${kind}`} y={r2(y)} />
      ))}
      <Rim p={p} x0={sx0} x1={sx0 + sw} y0={capBot} y1={baseTop} k={k} />
      {/* The base: plinth, step and the rounded kumuda moulding. */}
      <rect x={0} y={r2(h - 14 * k)} width={r2(w)} height={r2(14 * k)} fill={m} stroke={line} strokeWidth={sk} />
      <rect x={r2(3 * k)} y={r2(h - 26 * k)} width={r2(w - 6 * k)} height={r2(12 * k)} fill={m} stroke={line} strokeWidth={sk} />
      <rect x={r2(6 * k)} y={r2(baseTop)} width={r2(w - 12 * k)} height={r2(14 * k)} rx={r2(6 * k)} fill={m} stroke={line} strokeWidth={sk} />
      {/* The capital: neck, inverted lotus, pot, plank and the pothigai with its buds. */}
      <path d={P`M${w * 0.2} ${capBot}L${w * 0.11} ${capBot - 16 * k}H${w * 0.89}L${w * 0.8} ${capBot}Z`} fill={m} stroke={line} strokeWidth={sk} />
      <path d={P`M${w * 0.16} ${capBot - 16 * k}C${w * 0.02} ${capBot - 22 * k} ${w * 0.08} ${capBot - 34 * k} ${w * 0.18} ${capBot - 36 * k}H${w * 0.82}C${w * 0.92} ${capBot - 34 * k} ${w * 0.98} ${capBot - 22 * k} ${w * 0.84} ${capBot - 16 * k}Z`} fill={m} stroke={line} strokeWidth={sk} />
      <rect x={r2(w * 0.03)} y={r2(capBot - 48 * k)} width={r2(w * 0.94)} height={r2(10 * k)} fill={m} stroke={line} strokeWidth={sk} />
      <path d={P`M0 0H${w}V${8 * k}C${w} ${13 * k} ${w * 0.8} ${17 * k} ${w * 0.72} ${19 * k}H${w * 0.28}C${w * 0.2} ${17 * k} 0 ${13 * k} 0 ${8 * k}Z`} fill={m} stroke={line} strokeWidth={sk} />
      <path d={P`M${3.5 * k} ${8 * k}q${2.6 * k} ${3 * k} 0 ${7 * k}q${-2.6 * k} ${-4 * k} 0 ${-7 * k}M${w - 3.5 * k} ${8 * k}q${2.6 * k} ${3 * k} 0 ${7 * k}q${-2.6 * k} ${-4 * k} 0 ${-7 * k}`} fill={m} stroke={line} strokeWidth={r2(0.6 * k)} />
      {eye > 0 ? <rect x={r2(sx0 - 2 * k)} y={r2(capBot)} width={r2(sw + 4 * k)} height={r2(Math.min(eye, h) - capBot)} fill={`url(#${id}q)`} /> : null}
    </KitSvg>
  );
}

// ─────────────────────────── FarCourt ───────────────────────────

/** The courtyard beyond the hall's end: a billboard far behind the focal (box units; the horizon is at the eye, y 330). */
const COURT = { d: 2900, w: 1600, h: 900 };

/**
 * What the guest sees through the far end of the hall (quiet, hazed by
 * distance): the sunlit outer courtyard, its compound wall in the temple's
 * red-ochre and lime stripes, coconut palms, and on the axis the gopuram, its
 * tiers of niches catching the morning sun on the left. It rises just above the
 * prabhavali's crown, so the eye runs down the hall, through the fire, to the
 * tower.
 */
function FarCourt(p: DrawProps) {
  const { w, h, colors: c, nature: n } = p;
  const id = kitId(p, 'fc');
  const yh = 330 - (800 - COURT.h);
  const cx = w / 2;
  const sand = mix(c.surface, c.accent, 0.18);
  const lime = mix(c.surface, '#ffffff', 0.3);
  const ochre = mix(n.clay, c.primary, 0.25);
  const tower = mix(c.surface, c.muted, 0.22);
  const shadow = shade(tower, 0.16);
  const line = shade(tower, 0.22);
  const tiers = 6;
  const baseW = 330;
  const topW = 150;
  const tierH = 38;
  const top = yh - 96 - tiers * tierH;
  // Coconut palms: far silhouettes, so a trunk and fronds as round-capped strokes (light markup).
  const palm = (x: number, lean: number, tall: number) => {
    const ty = yh - tall;
    const tx = x + lean;
    const fronds = [
      [-80, 30],
      [-58, 62],
      [-30, 78],
      [80, 32],
      [60, 64],
      [32, 80],
      [-40, -24],
      [40, -26],
    ]
      .map(([dx, dy]) => P`M${tx} ${ty}Q${tx + dx! * 0.5} ${ty - 24} ${tx + dx!} ${ty + dy!}`)
      .join('');
    return (
      <g key={x}>
        <path d={P`M${x} ${yh}Q${x + lean * 0.2} ${yh - tall * 0.6} ${tx} ${ty}`} fill="none" stroke={mix(n.clayDark, c.muted, 0.5)} strokeWidth={6} />
        <path d={fronds} fill="none" stroke={mix(n.leaf, c.muted, 0.35)} strokeWidth={7} strokeLinecap="round" />
      </g>
    );
  };
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}g`} stops={[[0, tint(sand, 0.25)], [1, sand]]} y1={yh} y2={h} />
        <pattern id={`${id}s`} patternUnits="userSpaceOnUse" x={0} y={0} width={36} height={20}>
          <rect width={18} height={20} fill={ochre} />
          <rect x={18} width={18} height={20} fill={lime} />
        </pattern>
        <pattern id={`${id}k`} patternUnits="userSpaceOnUse" x={cx} y={top + 96} width={30} height={tierH}>
          <path d={P`M9 ${tierH - 6}V${tierH * 0.45}Q15 ${tierH * 0.12} 21 ${tierH * 0.45}V${tierH - 6}Z`} fill={shadow} />
          <path d={P`M0 3H30`} stroke={line} strokeWidth={2} />
        </pattern>
      </defs>
      {/* The outer courtyard and its striped compound wall. */}
      <rect x={0} y={r2(yh - 2)} width={w} height={r2(h - yh + 2)} fill={`url(#${id}g)`} />
      <rect x={0} y={r2(yh - 64)} width={w} height={64} fill={`url(#${id}s)`} />
      <rect x={0} y={r2(yh - 72)} width={w} height={10} fill={lime} />
      {palm(cx - 470, -26, 300)}
      {palm(cx - 380, 18, 250)}
      {palm(cx + 420, 30, 290)}
      {/* The gopuram: a stone base with its dark doorway, the tiers of niches, the shala roof and five kalasams. */}
      <path d={P`M${cx - baseW / 2 - 20} ${yh}V${yh - 96}H${cx + baseW / 2 + 20}V${yh}Z`} fill={tower} />
      <path d={P`M${cx - 26} ${yh}V${yh - 56}Q${cx} ${yh - 76} ${cx + 26} ${yh - 56}V${yh}Z`} fill={shade(tower, 0.2)} />
      {Array.from({ length: tiers }, (_, i) => {
        const y1 = yh - 96 - i * tierH;
        const w0 = baseW - ((baseW - topW) * i) / tiers;
        const w1 = baseW - ((baseW - topW) * (i + 1)) / tiers;
        const face = P`M${cx - w0 / 2} ${y1}L${cx - w1 / 2} ${y1 - tierH}H${cx + w1 / 2}L${cx + w0 / 2} ${y1}Z`;
        return (
          <g key={i}>
            <path d={face} fill={tower} />
            <path d={face} fill={`url(#${id}k)`} opacity={0.75} />
            <path d={P`M${cx + w0 * 0.22} ${y1}L${cx + w1 * 0.22} ${y1 - tierH}H${cx + w1 / 2}L${cx + w0 / 2} ${y1}Z`} fill={shadow} opacity={0.7} />
            <path d={P`M${cx - w0 / 2 - 6} ${y1}H${cx + w0 / 2 + 6}`} stroke={line} strokeWidth={4} />
          </g>
        );
      })}
      <path d={P`M${cx - topW / 2 - 10} ${top}C${cx - topW / 2 - 10} ${top - 40} ${cx + topW / 2 + 10} ${top - 40} ${cx + topW / 2 + 10} ${top}Z`} fill={tower} stroke={line} strokeWidth={2} />
      {[-2, -1, 0, 1, 2].map((i) => (
        <path key={i} d={P`M${cx + i * 26 - 6} ${top - 24 + Math.abs(i) * 6}C${cx + i * 26 - 7} ${top - 36 + Math.abs(i) * 6} ${cx + i * 26 + 7} ${top - 36 + Math.abs(i) * 6} ${cx + i * 26 + 6} ${top - 24 + Math.abs(i) * 6}ZM${cx + i * 26 - 1.5} ${top - 34 + Math.abs(i) * 6}V${top - 48 + Math.abs(i) * 6}H${cx + i * 26 + 1.5}V${top - 34 + Math.abs(i) * 6}Z`} fill={mix(c.secondary, tower, 0.35)} />
      ))}
    </KitSvg>
  );
}

// ─────────────────────────── BellCluster ───────────────────────────

/**
 * A cluster of brass temple bells hanging from a beam (100×100): a linked chain
 * to a lotus ring, then a large bell and two small ones on their own chains,
 * each with a flared lip, a bright band toward the key light and a clapper.
 * (The `templeBells` illustration weighs 29 KB of markup; this draws the same
 * idea in about 3 KB, so the set stays inside its markup budget.)
 */
function BellCluster(p: DrawProps) {
  const { w, colors: c } = p;
  const id = kitId(p, 'bl');
  const s = w / 100;
  const brass = c.secondary;
  const dark = shade(brass, 0.5);
  const bell = (cx: number, top: number, bw: number, bh: number, key: number) => {
    const l = cx - bw / 2;
    const r = cx + bw / 2;
    return (
      <g key={key}>
        <path d={P`M${cx} ${top - 4 * s}V${top + 2 * s}`} stroke={dark} strokeWidth={r2(1.6 * s)} />
        <circle cx={r2(cx)} cy={r2(top - 1 * s)} r={r2(2.4 * s)} fill={`url(#${id}m)`} />
        <path
          d={P`M${cx - bw * 0.18} ${top + 2 * s}C${cx - bw * 0.36} ${top + 3 * s} ${cx - bw * 0.36} ${top + bh * 0.5} ${l + bw * 0.06} ${top + bh * 0.82}C${l} ${top + bh * 0.9} ${l - 2 * s} ${top + bh} ${l} ${top + bh}H${r}C${r + 2 * s} ${top + bh} ${r} ${top + bh * 0.9} ${r - bw * 0.06} ${top + bh * 0.82}C${cx + bw * 0.36} ${top + bh * 0.5} ${cx + bw * 0.36} ${top + 3 * s} ${cx + bw * 0.18} ${top + 2 * s}Z`}
          fill={`url(#${id}m)`}
          stroke={dark}
          strokeWidth={r2(0.6 * s)}
        />
        <path d={P`M${l + bw * 0.08} ${top + bh * 0.8}H${r - bw * 0.08}`} stroke={dark} strokeWidth={r2(1.1 * s)} opacity={0.6} />
        <path d={P`M${l + 1 * s} ${top + bh - 0.6 * s}H${r - 1 * s}`} stroke={tint(brass, 0.55)} strokeWidth={r2(1 * s)} opacity={0.8} />
        <circle cx={r2(cx)} cy={r2(top + bh + 3 * s)} r={r2(bw * 0.09)} fill={dark} />
      </g>
    );
  };
  const links = (x0: number, y0: number, x1: number, y1: number) => P`M${x0} ${y0}L${x1} ${y1}`;
  return (
    <KitSvg p={p}>
      <defs>
        <Lin id={`${id}m`} stops={metalLit(brass, p.light.from)} x1={0} y1={0} x2={w} y2={8 * s} />
      </defs>
      {/* Chains: one from the beam to the lotus ring, three from the ring to the bells. */}
      <path d={links(50 * s, 0, 50 * s, 30 * s) + links(50 * s, 34 * s, 24 * s, 50 * s) + links(50 * s, 34 * s, 76 * s, 50 * s) + links(50 * s, 34 * s, 50 * s, 56 * s)} stroke={dark} strokeWidth={r2(1.8 * s)} strokeDasharray={`${r2(2.6 * s)} ${r2(1.4 * s)}`} fill="none" />
      <path d={P`M${42 * s} ${32 * s}Q${50 * s} ${24 * s} ${58 * s} ${32 * s}Q${50 * s} ${38 * s} ${42 * s} ${32 * s}Z`} fill={`url(#${id}m)`} stroke={dark} strokeWidth={r2(0.6 * s)} />
      {bell(24 * s, 54 * s, 20 * s, 22 * s, 0)}
      {bell(76 * s, 54 * s, 20 * s, 22 * s, 1)}
      {bell(50 * s, 60 * s, 30 * s, 32 * s, 2)}
    </KitSvg>
  );
}

// ─────────────────────────── PillarRow ───────────────────────────

/** The hall's length (it runs back behind the rest eye, so the far pose and pull-aways stay inside it) and the outer rows' pillars: every 200 units, in step with the inner rows (1000, 1400, 1800). */
const ROW = { dNear: -1300, dFar: 2800, step: 200, first: -1200, w: 62 };

/**
 * An outer row of the hall (a wall plane, content left = near): granite pillars
 * every 200 units on a moulded plinth under a carved architrave, the bays
 * between them open to the bright courtyard (left unpainted, so the stage's sky
 * shows through; the sun through them lies on the floor, see SunlitFloor). Pillars are simplified from the kit's granite pillar (square
 * blocks, octagonal shafts, a pothigai bracket) and drawn quiet above the eye.
 */
function pillarRow(side: 'left' | 'right') {
  return function PillarRow(p: DrawProps) {
    const { w, h, colors: c } = p;
    const id = kitId(p, `pr${side}`);
    const full = p.detail === 'full';
    const stone = mix(c.muted, c.surface, 0.42);
    const line = shade(stone, 0.4);
    const hi = tint(stone, 0.3);
    // The left row's faces turn away from the sun; the right row's face it.
    const face = side === 'left' ? shade(stone, 0.16) : tint(stone, 0.1);
    const eye = p.eyeLine ?? 0;
    const beamH = 44;
    const plinth = 36;
    const pw = ROW.w;
    const xs: number[] = [];
    for (let d = ROW.first; d < ROW.dFar - 40; d += ROW.step) xs.push(d - ROW.dNear);
    const quietTone = mix(stone, c.surface, 0.3);
    const pillar = (x: number, i: number) => {
      const x0 = x - pw / 2;
      const x1 = x + pw / 2;
      const base = h - plinth;
      const blocks: Array<[number, number]> = [
        [base - 92, base - 30],
        [h * 0.52 - 30, h * 0.52 + 30],
        [beamH + 58, beamH + 112],
      ];
      return (
        <g key={i}>
          <rect x={r2(x0)} y={beamH} width={pw} height={r2(base - beamH)} fill={face} />
          <rect x={r2(x0)} y={beamH} width={pw} height={r2(base - beamH)} fill={`url(#${id}c)`} />
          {blocks.map(([y0, y1], j) => (
            <g key={j}>
              <rect x={r2(x0 - 3)} y={r2(y0)} width={pw + 6} height={r2(y1 - y0)} fill={face} stroke={line} strokeWidth={0.9} />
              {full ? <rect x={r2(x0 + 3)} y={r2(y0 + 4)} width={pw - 6} height={r2(y1 - y0 - 8)} fill="none" stroke={hi} strokeWidth={0.8} opacity={0.7} /> : null}
              <path d={j === 1 ? P`M${x} ${y0 + 6}L${x1 - 6} ${(y0 + y1) / 2}L${x} ${y1 - 6}L${x0 + 6} ${(y0 + y1) / 2}Z` : P`M${x - 12} ${(y0 + y1) / 2}a12 12 0 1 0 24 0a12 12 0 1 0 -24 0`} fill={shade(face, 0.1)} stroke={line} strokeWidth={0.8} />
            </g>
          ))}
          <path d={P`M${x0 + 10} ${beamH}V${base}M${x1 - 10} ${beamH}V${base}`} stroke={line} strokeWidth={0.7} opacity={0.5} />
          {/* The base mouldings and the pothigai bracket under the beam. */}
          <rect x={r2(x0 - 8)} y={r2(base - 18)} width={pw + 16} height={18} rx={6} fill={face} stroke={line} strokeWidth={0.9} />
          <rect x={r2(x0 - 3)} y={beamH} width={pw + 6} height={r2(Math.min(eye, base) - beamH)} fill={`url(#${id}q)`} />
          {/* The pothigai: a stepped corbel each way, ending in a hanging lotus bud. */}
          <path d={P`M${x0 - 30} ${beamH}H${x1 + 30}V${beamH + 9}H${x1 + 14}C${x1 + 8} ${beamH + 9} ${x1 + 4} ${beamH + 16} ${x1} ${beamH + 24}H${x0}C${x0 - 4} ${beamH + 16} ${x0 - 8} ${beamH + 9} ${x0 - 14} ${beamH + 9}H${x0 - 30}Z`} fill={quietTone} stroke={line} strokeWidth={0.8} strokeOpacity={0.5} />
          {[x0 - 24, x1 + 24].map((bx) => (
            <path key={bx} d={P`M${bx - 5} ${beamH + 9}Q${bx} ${beamH + 24} ${bx + 5} ${beamH + 9}Z`} fill={quietTone} stroke={line} strokeWidth={0.7} strokeOpacity={0.5} />
          ))}
          <path d={P`M${x0 - 5} ${beamH + 30}H${x1 + 5}L${x1} ${beamH + 37}H${x0}Z`} fill={quietTone} stroke={line} strokeWidth={0.7} strokeOpacity={0.5} />
        </g>
      );
    };
    return (
      <KitSvg p={p}>
        <defs>
          <Lin id={`${id}c`} stops={side === 'left' ? [[0, '#000000', 0.12], [0.5, '#ffffff', 0.1], [1, '#000000', 0.18]] : [[0, '#ffffff', 0.18], [0.6, '#ffffff', 0.04], [1, '#000000', 0.12]]} bbox x1={0} x2={1} />
          <Lin id={`${id}q`} stops={[[0, quietTone, 0.6], [0.7, quietTone, 0.45], [1, quietTone, 0]]} y1={beamH} y2={Math.max(eye, beamH + 1)} />
          <g id={`${id}p`}>{pillar(0, 0)}</g>
        </defs>
        {/* The architrave with its carved fillet, and the plinth. */}
        <rect x={0} y={0} width={r2(w)} height={beamH} fill={face} />
        <path d={P`M0 ${beamH - 8}H${w}M0 ${beamH - 1}H${w}`} stroke={line} strokeWidth={1} opacity={0.7} />
        {full ? <path d={P`M0 ${beamH - 4.5}H${w}`} stroke={line} strokeWidth={3} strokeDasharray="2.4 4" opacity={0.5} /> : null}
        {xs.map((x) => (
          <use key={x} href={`#${id}p`} x={r2(x)} />
        ))}
        <rect x={0} y={r2(h - plinth)} width={r2(w)} height={plinth} fill={face} stroke={line} strokeWidth={0.9} />
        <path d={P`M0 ${h - plinth + 5}H${w}`} stroke={hi} strokeWidth={1.6} opacity={0.8} />
        {full ? <path d={P`M0 ${h - 14}H${w}`} stroke={line} strokeWidth={4} strokeDasharray="3 3" opacity={0.45} /> : null}
        {/* Above the eye the architrave is tone-on-tone too. */}
        <rect x={0} y={0} width={r2(w)} height={beamH} fill={quietTone} opacity={0.55} />
      </KitSvg>
    );
  };
}

// ─────────────────────────── SunlitFloor ───────────────────────────

/**
 * The kit's polished granite floor with the morning sun laid over it: through
 * each bay of the left row the sun falls across the floor as a slanting patch,
 * bright at the row and fading toward the aisle (drawn in plan, world-aligned).
 */
function sunlitFloor(base: (p: DrawProps) => ReactNode) {
  return function SunlitFloor(p: DrawProps) {
    const g = p.plane;
    if (!g) return base(p);
    const id = kitId(p, 'sun');
    const fx = (x: number) => x - g.x0;
    const fy = (d: number) => g.dFar - d;
    const x0 = 146;
    const len = 300;
    const slant = 0.32;
    const half = (ROW.step - ROW.w) / 2 - 6;
    const patches: string[] = [];
    for (let dc = ROW.first + ROW.step / 2; dc < ROW.dFar - 100; dc += ROW.step) {
      const a = dc - half;
      const b = dc + half;
      patches.push(P`M${fx(x0)} ${fy(a)}L${fx(x0)} ${fy(b)}L${fx(x0 + len)} ${fy(b - len * slant)}L${fx(x0 + len)} ${fy(a - len * slant)}Z`);
    }
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {base(p)}
        <svg viewBox={`0 0 ${r2(p.w)} ${r2(p.h)}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
          <defs>
            <Lin id={`${id}g`} stops={[[0, p.light.color, 0.42], [0.55, p.light.color, 0.2], [1, p.light.color, 0]]} x1={fx(x0)} x2={fx(x0 + len)} />
          </defs>
          <path d={patches.join('')} fill={`url(#${id}g)`} />
        </svg>
      </div>
    );
  };
}

// ─────────────────────────── the set ───────────────────────────

export const mandapam: StageSetFactory = (ctx) => {
  const c = ctx.colors;
  const SUN = '#fff3d0';
  const LAMP = '#ffcf7a';
  const FIREC = '#ffb35a';
  const pieces: Piece[] = [];

  // Planes: the polished granite hall with its kolam path, and the stone beams overhead.
  pieces.push({
    kind: 'plane',
    id: 'floor',
    art: 'floor:granite',
    role: 'architecture',
    plane: floor({ x0: 110, x1: 1090, dNear: ROW.dNear, dFar: COURT.d }),
    draw: sunlitFloor(drawWith(Floor, {
      variant: 'granite',
      kolam: 'path',
      pools: [
        { x: 600, d: VEDI.d - 40, r: 260, color: FIREC },
        { x: 490, d: 1200, r: 90, color: LAMP },
        { x: 710, d: 1200, r: 90, color: LAMP },
      ],
    })),
  });
  pieces.push({
    kind: 'plane',
    id: 'beams',
    art: 'ceiling:graniteBeams',
    role: 'architecture',
    plane: ceiling({ x0: 110, x1: 1090, y: CEIL, dNear: ROW.dNear, dFar: 2800 }),
    draw: drawWith(Ceiling, { variant: 'graniteBeams' }),
  });

  // The pillars: two rows of carved granite, floor to beams, quiet above the eye line.
  for (const [i, x, d] of [
    [0, 360, 1000],
    [1, 840, 1000],
    [2, 360, 1400],
    [3, 840, 1400],
    [4, 360, 1800],
    [5, 840, 1800],
  ] as const)
    pieces.push({
      kind: 'prop',
      id: `pillar-${i}`,
      art: 'templePillar',
      role: 'architecture',
      quiet: true,
      ...billboard({ x, d, w: 84, h: 800 - CEIL }),
      draw: TemplePillar,
      buildIn: 'rise',
    });

  // Near, overhead: brass temple bells hanging from the beams.
  for (const [i, x] of [
    [0, 522],
    [1, 678],
  ] as const)
    pieces.push({
      kind: 'prop',
      id: `bells-${i}`,
      art: 'templeBells',
      role: 'hanging',
      // Near and short-chained: the rest eye looks up 4°, and the clusters stay in the crown band at the rig's extremes.
      ...hang({ x, d: 450, w: 92, h: 84, top: CEIL }),
      draw: BellCluster,
      motion: { kind: 'sway', amp: 2.5, period: 4.5, phase: i * 0.4 },
      buildIn: 'drop',
    });

  // The aisle: kuthuvilakku either side of the kolam path, the near pair lit.
  pieces.push({ kind: 'prop', id: 'lamps-near', art: 'kuthuvilakku', role: 'prop', ...billboard({ x: 600, d: 1200, w: 220 + LAMP_BOX.w, h: LAMP_BOX.h }), draw: Kuthuvilakku });
  pieces.push({ kind: 'prop', id: 'lamps-far', art: 'kuthuvilakku', role: 'prop', ...billboard({ x: 600, d: 1700, w: 220 + LAMP_BOX.w, h: LAMP_BOX.h }), draw: Kuthuvilakku });
  for (const [i, x] of [
    [0, 490],
    [1, 710],
  ] as const)
    pieces.push({
      kind: 'light',
      id: `lamp-glow-${i}`,
      art: 'glow',
      role: 'light',
      at: { x, y: 676, z: -1198 },
      r: 48,
      color: LAMP,
      strength: 0.55,
      motion: { kind: 'flicker', amp: 0.35, period: 1.7, phase: i * 0.45 },
      buildIn: 'light',
    });

  // The outer rows: more pillars receding on both sides, open to the courtyard (desktops; phones far down the hall).
  for (const side of ['left', 'right'] as const)
    pieces.push({
      kind: 'plane',
      id: `row-${side}`,
      art: 'pillarRow',
      role: 'architecture',
      plane: wall(side, { x: side === 'left' ? 140 : 1060, yTop: CEIL, dNear: ROW.dNear, dFar: ROW.dFar }),
      draw: pillarRow(side),
    });

  // Far: the outer courtyard and the gopuram, seen through the hall's end.
  pieces.push({ kind: 'prop', id: 'far-court', art: 'farCourt', role: 'architecture', quiet: true, ...billboard({ x: 600, d: COURT.d, w: COURT.w, h: COURT.h }), draw: FarCourt });

  // Focal: the prabhavali arch, the vedi before it and the homam fire rising from its kund.
  pieces.push({ kind: 'prop', id: 'prabhavali', art: 'prabhavali', role: 'focal', ...billboard({ x: 600, d: VEDI.d + 200, w: 336, h: 470 }), draw: Prabhavali });
  pieces.push({ kind: 'prop', id: 'vedi', art: 'homamVedi', role: 'focal', ...billboard({ x: 600, d: VEDI.d, w: VEDI.w, h: VEDI.h }), draw: HomamVedi });
  const kundY = 800 - VEDI.h + VEDI_TOP - 6;
  pieces.push({
    kind: 'prop',
    id: 'fire',
    art: 'homaFire',
    role: 'focal',
    ...hang({ x: 600, d: VEDI.d + 10, w: FIRE.w, h: FIRE.h, top: kundY - FIRE.h * 0.64 }),
    draw: HomaFire,
    motion: { kind: 'flicker', amp: 1, period: 1.5 },
    buildIn: 'bloom',
  });
  pieces.push({
    kind: 'light',
    id: 'fire-glow',
    art: 'glow',
    role: 'light',
    at: { x: 600, y: 650, z: -(VEDI.d - 30) },
    r: 200,
    color: FIREC,
    strength: 0.8,
    bloom: true,
    motion: { kind: 'pulse', amp: 0.6, period: 2.4 },
  });

  const bright = mix('#fffaf0', c.background, 0.35);
  return {
    name: 'mandapam',
    sky: [
      `radial-gradient(ellipse 34% 20% at 50% 58%, ${mix('#fff4dc', c.accent, 0.12)}, transparent 70%)`,
      `radial-gradient(ellipse 55% 45% at 4% 46%, rgba(255, 251, 236, 0.95), rgba(255, 251, 236, 0) 70%)`,
      `linear-gradient(180deg, ${mix(mix('#d9e6ea', c.background, 0.45), c.primary, 0.05)} 0%, ${bright} 46%, ${mix('#fff2d6', c.accent, 0.15)} 55%, ${mix(c.surface, c.accent, 0.22)} 64%, ${mix(c.surface, c.muted, 0.28)} 100%)`,
    ].join(', '),
    light: { from: 'left', color: SUN, rim: '#fffaf0' },
    fog: { color: '#efe6d6', near: 1400, far: 3000, max: 0.35 },
    // A little more veil than most: the gold eyebrow reads over carved granite.
    veil: 0.32,
    // Looking up 4°: the prabhavali and the fire sit below the words (a tagline included), the beams and bells above.
    poses: { rest: { x: 600, y: 330, z: 0, yaw: 0, pitch: -4, roll: 0, fov: 60 } },
    focus: { x: 600, y: 620, z: -VEDI.d },
    pieces,
    covers: { gate: 'torana', door: 'temple', silk: 'temple', card: 'patra' },
    particles: { count: 16, dNear: 1000, dFar: 2300 },
  };
};
