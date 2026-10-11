import { DARK_SCENE_NAMES, type CameraMove, type EffectName, type SceneNameValue, type TemplateDefinitionInput, type ThemeColors, type Value } from '@bulava/template-schema';
import { fontsFor, INVOCATION, palette, TITLE, type CatalogEntry, type CatalogMeta, type FontPreset } from './builder';

type Recipe = 'royal' | 'modern' | 'festive' | 'photo' | 'film' | 'premium';
type Ornament = 'mandala' | 'paisley' | 'floral' | 'geometric' | 'confetti' | 'lotus' | 'peacock' | 'stars' | 'laurel';

/**
 * Films: every scene is filmed inside an illustrated scene (the same artwork
 * as the website heroes), with a camera move and drifting particles.
 */
interface FilmSpec {
  /** The illustrated scene for each part of the film. */
  opening: SceneNameValue;
  names: SceneNameValue;
  couple?: SceneNameValue;
  functions: SceneNameValue;
  closing: SceneNameValue;
  /** Camera for the opening; toran and mandap hang from the top edge, so they push rather than rise. */
  openingCamera?: CameraMove;
  particles: { opening: EffectName; names: EffectName; closing: EffectName };
  /** Names as a script flourish or as grand spaced capitals. */
  nameStyle: 'script' | 'caps';
  /** A couple ("A weds B") or one host or honoree (birthdays, pujas). */
  people: 'couple' | 'one';
  /** Ornament over each function card. */
  motif: string;
  /** Premium films: the ornament that blooms behind the opening and the couple (default mandala). */
  halo?: Ornament;
  /** Premium films: "&" between the names instead of "weds". */
  joiner?: 'weds' | 'and';
  /** Premium films: the couple's photo in a gold arch or circle, or in the backdrop's own medallion (noir). */
  portrait?: 'arch' | 'circle' | 'backdrop';
  /** Premium films: a camera for each part (the opening's is `openingCamera`). */
  cameras?: Partial<Record<'names' | 'couple' | 'functions' | 'closing', CameraMove>>;
}

interface VideoSpec extends Omit<CatalogMeta, 'sortOrder'> {
  recipe: Recipe;
  colors: ThemeColors;
  fonts: FontPreset;
  ornament: Ornament;
  invocation?: string;
  eyebrow: Value;
  card?: boolean;
  film?: FilmSpec;
  /** Particles over the ornament recipes. */
  particles?: EffectName;
  presets?: Array<{ name: string; colors: ThemeColors }>;
  /** Card backdrop (DIGITAL_CARD). */
  backdrop?: SceneNameValue;
}

const W = 1080;
const H = 1920;
const b = (binding: string, format?: 'date' | 'dateWithWeekday' | 'time' | 'upper'): Value => (format ? { binding, format } : { binding });
const t = (key: string): Value => ({ t: key });
const lit = (literal: string): Value => ({ literal });

type Style = Partial<{
  font: 'heading' | 'body' | 'script';
  fontSize: number;
  fontWeight: number;
  color: string;
  letterSpacing: number;
  lineHeight: number;
  opacity: number;
  fill: string;
  radius: number;
  align: 'left' | 'center' | 'right';
  shadow: 'soft' | 'glow';
  mask: 'arch' | 'circle';
  border: string;
}>;

function text(id: string, y: number, h: number, content: Value, style: Style, anim: { type: string; delaySec?: number; durationSec?: number } = { type: 'fadeUp' }) {
  return { id, kind: 'text' as const, frame: { x: 90, y, w: 900, h }, content, style: { align: 'center' as const, ...style }, overflow: 'shrink' as const, animation: { in: { durationSec: 0.9, delaySec: 0, ...anim } } };
}

function ornament(id: string, name: string, x: number, y: number, size: number, color: string, opacity: number, anim = 'zoomIn', delaySec = 0) {
  return { id, kind: 'ornament' as const, frame: { x, y, w: size, h: size }, content: lit(name), style: { color, opacity }, animation: { in: { type: anim, durationSec: 1.4, delaySec } } };
}

const PARTNER_ONE: Value = { binding: 'couple.partnerOne', fallback: { binding: 'honoree.name', fallback: { binding: 'event.title' } } };

/** Text inks for a scene: light type on dark scenes, the palette's deep colours on light ones. */
function inks(scene: SceneNameValue) {
  const dark = DARK_SCENE_NAMES.includes(scene);
  return dark
    ? { head: 'accent', body: 'background', soft: 'accent', shadow: 'glow' as const, softShadow: 'soft' as const, card: 'primary' }
    : { head: 'primary', body: 'text', soft: 'secondary', shadow: undefined, softShadow: undefined, card: 'surface' };
}

/** Scenes with a toran, drape or flower arch along the top start their text lower. */
const TEXT_DROP: Partial<Record<SceneNameValue, number>> = { toran: 190, mandap: 210, floral: 170 };
/** Scenes whose art frames the sides keep text narrower (the flower arch). */
const TEXT_INSET: Partial<Record<SceneNameValue, number>> = { floral: 150 };

function drop<T extends { kind: string; frame: { x: number; y: number; w: number } }>(scene: SceneNameValue, elements: T[], opts: { inset?: boolean } = {}): T[] {
  const dy = TEXT_DROP[scene] ?? 0;
  const inset = opts.inset === false ? 0 : (TEXT_INSET[scene] ?? 0);
  if (!dy && !inset) return elements;
  return elements.map((el) => {
    const narrow = inset && el.kind === 'text';
    return { ...el, frame: { ...el.frame, y: el.frame.y + dy, ...(narrow ? { x: el.frame.x + inset, w: el.frame.w - inset * 2 } : {}) } };
  });
}

function filmScenes(spec: VideoSpec, film: FilmSpec) {
  const { invocation, eyebrow } = spec;
  const script = film.nameStyle === 'script';
  const nameStyle = (size: number, color: string, shadow?: 'glow'): Style =>
    script ? { font: 'script', fontSize: size, color, lineHeight: 1.05, shadow } : { font: 'heading', fontSize: Math.round(size * 0.75), letterSpacing: 10, color, lineHeight: 1.05, shadow };

  // Opening: the blessing and "The wedding of", as the scene rises into view.
  const o = inks(film.opening);
  const opening = {
    id: 'opening',
    durationSec: 4.5,
    backdrop: { scene: film.opening, camera: film.openingCamera ?? 'descend', intensity: 1.2 },
    particles: film.particles.opening,
    elements: drop(film.opening, [
      ornament('halo', 'mandala', 290, 120, 500, o.soft, 0.22, 'bloom'),
      ...(invocation ? [text('invocation', 250, 90, lit(invocation), { font: 'body', fontSize: 46, color: o.soft, shadow: o.shadow }, { type: 'blurIn', delaySec: 0.3, durationSec: 1.4 })] : []),
      text('eyebrow', 400, 110, eyebrow, { font: 'heading', fontSize: 58, letterSpacing: 8, color: o.body, shadow: o.shadow }, { type: 'tracking', delaySec: 1, durationSec: 2 }),
    ]),
  };

  // Names: each name shines in turn.
  const n = inks(film.names);
  const names = {
    id: 'names',
    durationSec: 6.5,
    backdrop: { scene: film.names, camera: 'push' as const, intensity: 1 },
    particles: film.particles.names,
    elements: drop(
      film.names,
      film.people === 'couple'
        ? [
            text('families', 150, 70, t('template.film.families'), { font: 'body', fontSize: 36, letterSpacing: 3, color: n.body, opacity: 0.9, shadow: n.softShadow }, { type: 'fade', delaySec: 0.2 }),
            text('partner-one', 245, 190, script ? PARTNER_ONE : { ...PARTNER_ONE, format: 'upper' }, nameStyle(150, n.head, n.shadow), { type: 'shine', delaySec: 0.5, durationSec: 2.2 }),
            text('weds', 440, 80, t('template.weds'), { font: 'heading', fontSize: 54, color: n.soft, shadow: n.shadow }, { type: 'blurIn', delaySec: 1.4, durationSec: 1 }),
            text('partner-two', 525, 190, script ? b('couple.partnerTwo') : b('couple.partnerTwo', 'upper'), nameStyle(150, n.head, n.shadow), { type: 'shine', delaySec: 1.9, durationSec: 2.2 }),
            text('date', 740, 75, b('event.startDate', 'date'), { font: 'heading', fontSize: 54, color: n.body, shadow: n.softShadow }, { type: 'fadeUp', delaySec: 2.9 }),
            text('city', 818, 60, b('venue.city', 'upper'), { font: 'body', fontSize: 34, letterSpacing: 12, color: n.soft, shadow: n.softShadow }, { type: 'tracking', delaySec: 3.3, durationSec: 1.6 }),
          ]
        : [
            text('eyebrow-2', 170, 80, eyebrow, { font: 'body', fontSize: 38, letterSpacing: 8, color: n.body, shadow: n.softShadow }, { type: 'tracking', delaySec: 0.2, durationSec: 1.4 }),
            text('title', 270, 360, script ? TITLE : { ...TITLE, fallback: { binding: 'honoree.name', format: 'upper', fallback: { binding: 'event.title', format: 'upper' } } }, nameStyle(170, n.head, n.shadow), { type: 'shine', delaySec: 0.6, durationSec: 2.4 }),
            text('date', 660, 80, b('event.startDate', 'dateWithWeekday'), { font: 'heading', fontSize: 54, color: n.body, shadow: n.softShadow }, { type: 'fadeUp', delaySec: 2 }),
            text('city', 745, 60, b('venue.city', 'upper'), { font: 'body', fontSize: 34, letterSpacing: 12, color: n.soft, shadow: n.softShadow }, { type: 'tracking', delaySec: 2.4, durationSec: 1.6 }),
          ],
    ),
  };

  const scenes: unknown[] = [opening, names];

  // The couple's photo in a gold jharokha arch (a mandala halo stands in when there is no photo).
  if (film.couple) {
    const c = inks(film.couple);
    scenes.push({
      id: 'couple',
      durationSec: 5,
      backdrop: { scene: film.couple, camera: 'panRight' as const, intensity: 1, veil: 0.35 },
      particles: film.particles.names,
      elements: drop(film.couple, [
        ornament('halo', 'mandala', 170, 150, 740, c.soft, 0.35, 'bloom'),
        {
          id: 'portrait',
          kind: 'photo' as const,
          frame: { x: 310, y: 200, w: 460, h: 600 },
          content: { binding: 'photo.cover', fallback: b('photos[0]') },
          style: { opacity: 1, radius: 24, mask: 'arch' as const, border: 'accent' },
          animation: { in: { type: 'zoomIn', durationSec: 1.4, delaySec: 0.3 } },
        },
        text('couple-names', 830, 130, TITLE, { font: script ? 'script' : 'heading', fontSize: script ? 96 : 64, letterSpacing: script ? 0 : 5, color: c.head, shadow: c.shadow }, { type: 'fadeUp', delaySec: 1 }),
      ]),
    });
  }

  // One card per function.
  const f = inks(film.functions);
  scenes.push({
    id: 'function',
    durationSec: 4.5,
    repeatPerFunction: true,
    backdrop: { scene: film.functions, camera: 'panLeft' as const, intensity: 1, veil: 0.3 },
    elements: drop(film.functions, [
      { id: 'fn-card', kind: 'shape' as const, frame: { x: 110, y: 190, w: 860, h: 760 }, style: { fill: f.card, opacity: 0.62, radius: 56 }, animation: { in: { type: 'fade', durationSec: 0.8 } } },
      ornament('fn-motif', film.motif, 440, 230, 200, f.soft, 0.9, 'bloom'),
      text('fn-name', 460, 150, b('function.name'), { font: 'heading', fontSize: 104, color: f.head, shadow: f.shadow }, { type: 'reveal', delaySec: 0.3, durationSec: 1 }),
      text('fn-date', 625, 75, b('function.date', 'dateWithWeekday'), { font: 'body', fontSize: 46, color: f.body }, { type: 'fadeUp', delaySec: 0.7 }),
      text('fn-time', 702, 65, b('function.time', 'time'), { font: 'body', fontSize: 42, color: f.soft }, { type: 'fadeUp', delaySec: 0.9 }),
      text('fn-venue', 780, 130, b('function.venue.name'), { font: 'heading', fontSize: 52, color: f.body }, { type: 'fadeUp', delaySec: 1.1 }),
    ], { inset: false }),
  });

  // Closing: an invitation to join, as the camera pulls back.
  const e = inks(film.closing);
  scenes.push({
    id: 'closing',
    durationSec: 5.5,
    backdrop: { scene: film.closing, camera: 'pull' as const, intensity: 1.1 },
    particles: film.particles.closing,
    elements: drop(film.closing, [
      text('join', 220, 220, t('template.joinUs'), { font: 'script', fontSize: 124, color: e.head, shadow: e.shadow }, { type: 'shine', delaySec: 0.3, durationSec: 2 }),
      text('thanks', 470, 170, t('template.footer.thanks'), { font: 'heading', fontSize: 52, color: e.body, shadow: e.softShadow }, { type: 'fadeUp', delaySec: 1 }),
      text('closing-title', 680, 90, TITLE, { font: 'heading', fontSize: 44, letterSpacing: 6, color: e.soft, shadow: e.softShadow }, { type: 'tracking', delaySec: 1.6, durationSec: 1.6 }),
    ]),
  });
  return scenes;
}

/**
 * The premium film recipe: the same illustrated scenes and camera, with a
 * more cinematic cut. A halo blooms behind the opening's blessing and a gold
 * rule settles under the eyebrow; the names shine in turn with an "&" coming
 * into focus between them; the couple's photo sits in a gold arch, a gold
 * ring or the noir medallion; each function is a glass card between two gold
 * rules; the close invites the guest in script.
 */
/** Any film element, for lists that mix kinds. */
type FilmElement = { id: string; kind: string; frame: { x: number; y: number; w: number; h: number }; [key: string]: unknown };

function premiumFilmScenes(spec: VideoSpec, film: FilmSpec) {
  const { invocation, eyebrow } = spec;
  const script = film.nameStyle === 'script';
  const halo = film.halo ?? 'mandala';
  const cams = { names: 'pull' as CameraMove, couple: 'panRight' as CameraMove, functions: 'panLeft' as CameraMove, closing: 'push' as CameraMove, ...film.cameras };
  const nameStyle = (size: number, color: string, shadow?: 'glow'): Style =>
    script ? { font: 'script', fontSize: size, color, lineHeight: 1.05, shadow } : { font: 'heading', fontSize: Math.round(size * 0.7), letterSpacing: 9, color, lineHeight: 1.1, shadow };
  const rule = (id: string, y: number, width: number, color: string, delaySec: number) => ({
    id,
    kind: 'shape' as const,
    frame: { x: (W - width) / 2, y, w: width, h: 3 },
    style: { fill: color, opacity: 0.9, radius: 2 },
    animation: { in: { type: 'fade', durationSec: 1.2, delaySec } },
  });

  const o = inks(film.opening);
  const opening = {
    id: 'opening',
    durationSec: 5,
    backdrop: { scene: film.opening, camera: film.openingCamera ?? 'push', intensity: 1.2 },
    particles: film.particles.opening,
    elements: drop(film.opening, [
      ornament('halo', halo, 210, 130, 660, o.soft, DARK_SCENE_NAMES.includes(film.opening) ? 0.28 : 0.45, 'bloom'),
      ...(invocation ? [text('invocation', 320, 90, lit(invocation), { font: 'body', fontSize: 46, color: o.soft, shadow: o.shadow }, { type: 'blurIn', delaySec: 0.3, durationSec: 1.4 })] : []),
      text('eyebrow', 440, 130, eyebrow, { font: 'heading', fontSize: film.people === 'couple' ? 64 : 54, letterSpacing: film.people === 'couple' ? 8 : 5, color: o.body, shadow: o.shadow }, { type: 'tracking', delaySec: 0.9, durationSec: 2 }),
      rule('rule', 600, 260, o.soft, 1.8),
    ]),
  };

  const n = inks(film.names);
  const joiner = film.joiner === 'and' ? lit('&') : t('template.weds');
  const names = {
    id: 'names',
    durationSec: 6.5,
    backdrop: { scene: film.names, camera: cams.names, intensity: 1 },
    particles: film.particles.names,
    elements: drop(
      film.names,
      film.people === 'couple'
        ? [
            text('families', 160, 70, t('template.film.families'), { font: 'body', fontSize: 36, letterSpacing: 3, color: n.body, opacity: 0.9, shadow: n.softShadow }, { type: 'fade', delaySec: 0.2 }),
            text('partner-one', 250, 200, script ? PARTNER_ONE : { ...PARTNER_ONE, format: 'upper' }, nameStyle(156, n.head, n.shadow), { type: 'shine', delaySec: 0.5, durationSec: 2.2 }),
            text('weds', 452, 110, joiner, film.joiner === 'and' ? { font: 'script', fontSize: 110, color: n.soft, shadow: n.shadow } : { font: 'heading', fontSize: 54, color: n.soft, shadow: n.shadow }, { type: 'blurIn', delaySec: 1.4, durationSec: 1.1 }),
            text('partner-two', 566, 200, script ? b('couple.partnerTwo') : b('couple.partnerTwo', 'upper'), nameStyle(156, n.head, n.shadow), { type: 'shine', delaySec: 1.9, durationSec: 2.2 }),
            rule('rule', 790, 220, n.soft, 2.7),
            text('date', 812, 76, b('event.startDate', 'date'), { font: 'heading', fontSize: 54, color: n.body, shadow: n.softShadow }, { type: 'fadeUp', delaySec: 2.9 }),
            text('city', 890, 62, b('venue.city', 'upper'), { font: 'body', fontSize: 34, letterSpacing: 12, color: n.soft, shadow: n.softShadow }, { type: 'tracking', delaySec: 3.3, durationSec: 1.6 }),
          ]
        : [
            text('eyebrow-2', 180, 80, eyebrow, { font: 'body', fontSize: 38, letterSpacing: 8, color: n.body, shadow: n.softShadow }, { type: 'tracking', delaySec: 0.2, durationSec: 1.4 }),
            text('title', 280, 380, script ? TITLE : { ...TITLE, fallback: { binding: 'honoree.name', format: 'upper', fallback: { binding: 'event.title', format: 'upper' } } }, nameStyle(170, n.head, n.shadow), { type: 'shine', delaySec: 0.6, durationSec: 2.4 }),
            rule('rule', 690, 220, n.soft, 1.8),
            text('date', 712, 80, b('event.startDate', 'dateWithWeekday'), { font: 'heading', fontSize: 54, color: n.body, shadow: n.softShadow }, { type: 'fadeUp', delaySec: 2 }),
            text('city', 796, 60, b('venue.city', 'upper'), { font: 'body', fontSize: 34, letterSpacing: 12, color: n.soft, shadow: n.softShadow }, { type: 'tracking', delaySec: 2.4, durationSec: 1.6 }),
          ],
    ),
  };

  const scenes: unknown[] = [opening, names];

  if (film.couple) {
    const c = inks(film.couple);
    const portrait = film.portrait ?? 'arch';
    const photoFrame = portrait === 'circle' ? { x: 300, y: 230, w: 480, h: 480 } : { x: 300, y: 190, w: 480, h: 620 };
    scenes.push({
      id: 'couple',
      durationSec: 5,
      backdrop: { scene: film.couple, camera: cams.couple, intensity: 1, veil: 0.35 },
      particles: film.particles.names,
      elements: drop<FilmElement>(
        film.couple,
        portrait === 'backdrop'
          ? [
              ornament('halo', halo, 240, 170, 600, c.soft, 0.3, 'bloom'),
              text('couple-families', 300, 70, t('template.film.families'), { font: 'body', fontSize: 36, letterSpacing: 3, color: c.body, shadow: c.softShadow }, { type: 'fade', delaySec: 0.3 }),
              text('couple-names', 390, 260, TITLE, script ? { font: 'script', fontSize: 120, color: c.head, lineHeight: 1.05, shadow: c.shadow } : { font: 'heading', fontSize: 84, letterSpacing: 6, color: c.head, lineHeight: 1.1, shadow: c.shadow }, { type: 'shine', delaySec: 0.6, durationSec: 2.2 }),
              rule('rule', 690, 220, c.soft, 1.6),
            ]
          : [
              ornament('halo', halo, 160, 140, 760, c.soft, 0.32, 'bloom'),
              {
                id: 'portrait',
                kind: 'photo' as const,
                frame: photoFrame,
                content: { binding: 'photo.cover', fallback: b('photos[0]') },
                style: { opacity: 1, radius: 24, mask: portrait, border: 'accent' },
                animation: { in: { type: 'zoomIn', durationSec: 1.4, delaySec: 0.3 } },
              },
              text('couple-names', portrait === 'circle' ? 760 : 850, 130, TITLE, { font: script ? 'script' : 'heading', fontSize: script ? 100 : 66, letterSpacing: script ? 0 : 5, color: c.head, shadow: c.shadow }, { type: 'fadeUp', delaySec: 1 }),
            ],
      ),
    });
  }

  const f = inks(film.functions);
  scenes.push({
    id: 'function',
    durationSec: 4.5,
    repeatPerFunction: true,
    backdrop: { scene: film.functions, camera: cams.functions, intensity: 1, veil: 0.3 },
    elements: drop(film.functions, [
      { id: 'fn-card', kind: 'shape' as const, frame: { x: 100, y: 190, w: 880, h: 800 }, style: { fill: f.card, opacity: 0.6, radius: 48 }, animation: { in: { type: 'fade', durationSec: 0.8 } } },
      rule('fn-rule-top', 236, 200, f.soft, 0.2),
      ornament('fn-motif', film.motif, 450, 270, 180, f.soft, 0.9, 'bloom'),
      text('fn-name', 460, 150, b('function.name'), { font: script ? 'script' : 'heading', fontSize: script ? 120 : 96, color: f.head, shadow: f.shadow }, { type: 'reveal', delaySec: 0.3, durationSec: 1 }),
      text('fn-date', 626, 74, b('function.date', 'dateWithWeekday'), { font: 'body', fontSize: 44, color: f.body }, { type: 'fadeUp', delaySec: 0.7 }),
      text('fn-time', 702, 64, b('function.time', 'time'), { font: 'body', fontSize: 40, letterSpacing: 4, color: f.soft }, { type: 'tracking', delaySec: 0.9, durationSec: 1.2 }),
      text('fn-venue', 780, 130, b('function.venue.name'), { font: 'heading', fontSize: 52, color: f.body }, { type: 'fadeUp', delaySec: 1.1 }),
      rule('fn-rule-bottom', 940, 200, f.soft, 1.3),
    ], { inset: false }),
  });

  const e = inks(film.closing);
  scenes.push({
    id: 'closing',
    durationSec: 5.5,
    backdrop: { scene: film.closing, camera: cams.closing, intensity: 1.1 },
    particles: film.particles.closing,
    elements: drop(film.closing, [
      text('join', 230, 220, t('template.joinUs'), { font: 'script', fontSize: 132, color: e.head, shadow: e.shadow }, { type: 'shine', delaySec: 0.3, durationSec: 2 }),
      text('thanks', 470, 170, t('template.footer.thanks'), { font: 'heading', fontSize: 52, color: e.body, shadow: e.softShadow }, { type: 'fadeUp', delaySec: 1 }),
      rule('rule', 666, 220, e.soft, 1.4),
      text('closing-title', 690, 90, TITLE, { font: 'heading', fontSize: 44, letterSpacing: 6, color: e.soft, shadow: e.softShadow }, { type: 'tracking', delaySec: 1.6, durationSec: 1.6 }),
      ornament('closing-motif', film.motif, 470, 820, 140, e.soft, 0.85, 'bloom', 2),
    ]),
  });
  return scenes;
}

function scenes(spec: VideoSpec) {
  const { recipe, invocation, eyebrow } = spec;
  if (recipe === 'film' && spec.film) return filmScenes(spec, spec.film);
  if (recipe === 'premium' && spec.film) return premiumFilmScenes(spec, spec.film);
  const orn = spec.ornament;
  const particles = spec.particles ?? 'none';
  const intro = {
    id: 'intro',
    durationSec: 4,
    background: 'primary',
    particles,
    elements: [
      ornament('medallion', orn, 190, 330, 700, 'secondary', 0.4, 'bloom'),
      ...(invocation ? [text('invocation', 980, 90, lit(invocation), { font: 'body', fontSize: 46, color: 'accent' }, { type: 'blurIn', delaySec: 0.4 })] : []),
      text('eyebrow', 1090, 90, eyebrow, { font: 'body', fontSize: 40, letterSpacing: 10, color: 'background' }, { type: 'tracking', delaySec: 0.8, durationSec: 1.4 }),
    ],
  };
  const names = {
    id: 'names',
    durationSec: 5,
    background: recipe === 'festive' ? 'surface' : 'background',
    particles: particles === 'lanterns' ? 'goldDust' : particles,
    elements: [
      ...(recipe === 'festive'
        ? [ornament('confetti-top', 'confetti', 40, 120, 1000, 'primary', 1, 'fadeDown'), ornament('confetti-bottom', 'confetti', 40, 1300, 1000, 'secondary', 1, 'fadeUp')]
        : [ornament('corner', orn === 'confetti' ? 'floral' : orn, 60, 90, 360, 'secondary', 0.55, 'fade')]),
      text('title', 560, 520, TITLE, { font: 'script', fontSize: recipe === 'modern' ? 120 : 150, color: 'primary' }, { type: 'shine', delaySec: 0.2, durationSec: 2 }),
      text('date', 1150, 90, b('event.startDate', 'date'), { font: 'heading', fontSize: 58, color: 'text' }, { type: 'fadeUp', delaySec: 1.2 }),
      text('city', 1250, 80, b('venue.city', 'upper'), { font: 'body', fontSize: 38, letterSpacing: 12, color: 'muted' }, { type: 'tracking', delaySec: 1.6, durationSec: 1.4 }),
    ],
  };
  const fn = {
    id: 'function',
    durationSec: 3.5,
    background: 'surface',
    repeatPerFunction: true,
    elements: [
      ornament('fn-orn', orn === 'confetti' ? 'geometric' : orn, 390, 420, 300, 'secondary', 0.6, 'bloom'),
      text('fn-name', 780, 160, b('function.name'), { font: 'heading', fontSize: 110, color: 'primary' }, { type: 'reveal' }),
      text('fn-date', 970, 80, b('function.date', 'dateWithWeekday'), { font: 'body', fontSize: 50, color: 'text' }, { type: 'fadeUp', delaySec: 0.3 }),
      text('fn-time', 1050, 80, b('function.time', 'time'), { font: 'body', fontSize: 46, color: 'muted' }, { type: 'fadeUp', delaySec: 0.5 }),
      text('fn-venue', 1150, 140, b('function.venue.name'), { font: 'heading', fontSize: 54, color: 'text' }, { type: 'fadeUp', delaySec: 0.7 }),
    ],
  };
  const outro = {
    id: 'outro',
    durationSec: 4,
    background: 'primary',
    particles,
    elements: [
      text('join', 700, 200, t('template.joinUs'), { font: 'script', fontSize: 120, color: 'accent' }, { type: 'shine', durationSec: 1.8 }),
      text('thanks', 960, 160, t('template.footer.thanks'), { font: 'heading', fontSize: 52, color: 'background' }, { type: 'fadeUp', delaySec: 0.6 }),
      ornament('outro-orn', orn, 390, 1250, 300, 'secondary', 0.5, 'fade'),
    ],
  };

  if (recipe === 'photo') {
    const photo = {
      id: 'photo',
      durationSec: 5,
      background: 'primary',
      particles,
      elements: [
        { id: 'photo', kind: 'photo' as const, frame: { x: 0, y: 0, w: W, h: H }, content: { binding: 'photo.cover', fallback: b('photos[0]') }, style: { opacity: 1 }, animation: { in: { type: 'zoomOut', durationSec: 5 } } },
        { id: 'shade', kind: 'shape' as const, frame: { x: 0, y: 1100, w: W, h: 820 }, style: { fill: 'primary', opacity: 0.75 }, animation: { in: { type: 'fade', durationSec: 1 } } },
        text('std', 1200, 100, eyebrow, { font: 'body', fontSize: 42, letterSpacing: 12, color: 'accent' }, { type: 'tracking', delaySec: 0.5, durationSec: 1.4 }),
        text('std-names', 1310, 300, TITLE, { font: 'script', fontSize: 120, color: 'background' }, { type: 'blurIn', delaySec: 0.9, durationSec: 1.4 }),
        text('std-date', 1640, 90, b('event.startDate', 'date'), { font: 'heading', fontSize: 58, color: 'background' }, { type: 'fadeUp', delaySec: 1.3 }),
      ],
    };
    return [photo, fn, outro];
  }
  if (spec.card && spec.backdrop) {
    // An illustrated card: the text sits in the sky, the scene below.
    const k = inks(spec.backdrop);
    return [
      {
        id: 'card',
        durationSec: 1,
        transition: 'none',
        backdrop: { scene: spec.backdrop, camera: 'still' },
        elements: [
          ...(invocation ? [text('card-inv', 60, 60, lit(invocation), { font: 'body', fontSize: 34, color: k.soft, shadow: k.shadow }, { type: 'none' })] : []),
          text('card-eyebrow', 130, 60, eyebrow, { font: 'heading', fontSize: 34, letterSpacing: 8, color: k.body }, { type: 'none' }),
          text('card-title', 200, 240, TITLE, { font: 'script', fontSize: 120, color: k.head, shadow: k.shadow }, { type: 'none' }),
          text('card-date', 450, 70, b('event.startDate', 'dateWithWeekday'), { font: 'heading', fontSize: 44, color: k.body }, { type: 'none' }),
          text('card-venue', 525, 90, b('venue.name'), { font: 'body', fontSize: 34, color: k.soft }, { type: 'none' }),
        ],
      },
    ];
  }
  if (spec.card) {
    return [
      {
        id: 'card',
        durationSec: 1,
        background: 'background',
        transition: 'none',
        elements: [
          { id: 'frame', kind: 'shape' as const, frame: { x: 50, y: 50, w: 980, h: 1250 }, style: { fill: 'surface', radius: 28, opacity: 1 }, animation: {} },
          ornament('card-orn', orn, 340, 110, 400, 'secondary', 0.5, 'none'),
          ...(invocation ? [text('card-inv', 520, 70, lit(invocation), { font: 'body', fontSize: 34, color: 'secondary' }, { type: 'none' })] : []),
          text('card-eyebrow', 590, 70, eyebrow, { font: 'body', fontSize: 30, letterSpacing: 8, color: 'muted' }, { type: 'none' }),
          text('card-title', 670, 330, TITLE, { font: 'script', fontSize: 110, color: 'primary' }, { type: 'none' }),
          text('card-date', 1020, 80, b('event.startDate', 'dateWithWeekday'), { font: 'heading', fontSize: 46, color: 'text' }, { type: 'none' }),
          text('card-venue', 1100, 120, b('venue.name'), { font: 'body', fontSize: 38, color: 'muted' }, { type: 'none' }),
        ],
      },
    ];
  }
  return [intro, names, fn, outro];
}

function video(spec: VideoSpec, sortOrder: number): CatalogEntry {
  const film = spec.recipe === 'film' || spec.recipe === 'premium';
  const photos = spec.recipe === 'photo' || (film && !!spec.film?.couple);
  const def: TemplateDefinitionInput = {
    schemaVersion: 1,
    templateKey: spec.key,
    type: spec.card ? 'DIGITAL_CARD' : 'VIDEO',
    name: spec.name,
    description: spec.description,
    eventTypes: spec.eventTypes,
    languages: ['en', 'hi', 'hi-Latn'],
    theme: { colors: spec.colors, radius: 20, ornament: spec.ornament === 'confetti' ? 'confetti' : spec.ornament, pattern: 'none' },
    fonts: fontsFor(spec.fonts),
    capabilities: {
      // Films can be redrawn scene by scene in the film's canvas editor (ADR-059); image cards cannot.
      editable: { colors: true, fonts: film, music: true, background: false, layout: !spec.card, photos, text: false, animation: false },
      colorPresets: spec.presets ?? [],
      textSlots: [],
      maxPhotos: photos ? 1 : 0,
      photoSlots: photos ? ['cover'] : [],
    },
    music: { allowCustomerChoice: true },
    canvas: spec.card ? { width: W, height: 1350, fps: 30 } : { width: W, height: H, fps: 30 },
    scenes: scenes(spec) as never,
  };
  const { recipe: _r, colors: _c, fonts: _f, ornament: _o, invocation: _i, eyebrow: _e, card: _card, film: _film, particles: _p, presets: _presets, backdrop: _b, ...meta } = spec;
  return { meta: { ...meta, sortOrder }, definition: def };
}

const SPECS: VideoSpec[] = [
  // ───────────── Illustrated films ─────────────
  {
    key: 'bansuri-video', name: 'The Divine Flute', category: 'Wedding', style: 'Divine', tier: 'PREMIUM', badge: 'NEW', featured: true,
    description: 'A heritage film set in moonlit Vrindavan: the kadamba tree, the Yamuna, a golden flute and peacock plumes. Fireflies rise as your names appear in gold, then each function and a blessing to close.',
    tags: ['signature', 'hindu', 'krishna', 'video', 'illustrated'], eventTypes: ['WEDDING'], recipe: 'film', ornament: 'peacock', fonts: 'regal', invocation: INVOCATION.krishna, eyebrow: t('template.weddingOf'),
    colors: palette('#0b3d5c', '#1f8a70', '#e9c46a', '#f5fbf8', '#e6f2ee', '#10262f', '#557079'),
    presets: [
      { name: 'Peacock Night', colors: palette('#0b3d5c', '#1f8a70', '#e9c46a', '#f5fbf8', '#e6f2ee', '#10262f', '#557079') },
      { name: 'Yamuna Dusk', colors: palette('#2a1f5c', '#7b4fa0', '#f2c572', '#f8f6fc', '#ece8f6', '#1d1733', '#6a6283') },
      { name: 'Tulsi Green', colors: palette('#0f4a3a', '#2f8f5b', '#eed27a', '#f5faf6', '#e5f1e9', '#12261e', '#58705f') },
    ],
    film: {
      opening: 'vrindavan', names: 'vrindavan', couple: 'vrindavan', functions: 'vrindavan', closing: 'vrindavan',
      particles: { opening: 'fireflies', names: 'goldDust', closing: 'petals' }, nameStyle: 'script', motif: 'peacockFeather', people: 'couple',
    },
  },
  {
    key: 'kanjeevaram-video', name: 'Temple Dawn', category: 'Wedding', style: 'Temple', tier: 'PREMIUM', badge: 'NEW', featured: true,
    description: 'Sunrise over a South Indian temple: the camera glides through carved pillars to the gopuram as bells and marigolds frame your names. Each function follows under the mandap.',
    tags: ['south-indian', 'tamil', 'telugu', 'video', 'illustrated'], eventTypes: ['WEDDING'], recipe: 'film', ornament: 'mandala', fonts: 'grand', invocation: INVOCATION.tamil, eyebrow: t('template.weddingOf'),
    colors: palette('#8a0f1f', '#b8862c', '#f0c75e', '#fdf6e7', '#fbecd0', '#2d1a0f', '#7d6248'),
    presets: [
      { name: 'Temple Red', colors: palette('#8a0f1f', '#b8862c', '#f0c75e', '#fdf6e7', '#fbecd0', '#2d1a0f', '#7d6248') },
      { name: 'Peacock Silk', colors: palette('#0b4f6c', '#b8862c', '#f0c75e', '#f4f9f8', '#e6f0ee', '#10262f', '#557079') },
    ],
    film: {
      opening: 'gopuram', names: 'gopuram', couple: 'lotus', functions: 'mandap', closing: 'gopuram',
      particles: { opening: 'marigold', names: 'goldDust', closing: 'marigold' }, nameStyle: 'caps', motif: 'bell', people: 'couple',
    },
  },
  {
    key: 'royal-reveal-video', name: 'Royal Reveal', category: 'Wedding', style: 'Royal', tier: 'PREMIUM', badge: 'BESTSELLER', featured: true,
    description: 'A Rajasthani palace on the lake at night: sky lanterns drift up as the camera glides over the water, your names shine in gold, and each function unfolds beneath marigold torans.',
    tags: ['hindu', 'royal', 'rajasthani', 'video', 'illustrated'], eventTypes: ['WEDDING'], recipe: 'film', ornament: 'mandala', fonts: 'royal', invocation: INVOCATION.hindu, eyebrow: t('template.weddingOf'),
    colors: palette('#5a0f1f', '#b8892b', '#f1d9a0', '#fbf6ec', '#fffdf8', '#2b1b17', '#7a6558'),
    presets: [
      { name: 'Maroon & Gold', colors: palette('#5a0f1f', '#b8892b', '#f1d9a0', '#fbf6ec', '#fffdf8', '#2b1b17', '#7a6558') },
      { name: 'Royal Indigo', colors: palette('#1e2a5a', '#c29b3c', '#efd9a0', '#f8f6f0', '#ffffff', '#1a1d2e', '#5d6380') },
    ],
    film: {
      opening: 'palace', names: 'palace', couple: 'arches', functions: 'toran', closing: 'palace', openingCamera: 'rise',
      particles: { opening: 'lanterns', names: 'goldDust', closing: 'lanterns' }, nameStyle: 'script', motif: 'diya', people: 'couple',
    },
  },
  {
    key: 'nikah-noor-video', name: 'Noor Arches', category: 'Wedding', style: 'Royal', tier: 'PREMIUM', badge: 'NEW',
    description: 'Emerald arches receding into golden light: the camera walks through the jharokhas with Bismillah, your names in gold, and every function to follow.',
    tags: ['muslim', 'nikah', 'video', 'illustrated'], eventTypes: ['WEDDING'], recipe: 'film', ornament: 'geometric', fonts: 'regal', invocation: INVOCATION.muslim, eyebrow: t('template.weddingOf'),
    colors: palette('#064e3b', '#c9a227', '#f3e3a3', '#f8f5ec', '#fffdf5', '#10231c', '#5b6f65'),
    presets: [
      { name: 'Emerald', colors: palette('#064e3b', '#c9a227', '#f3e3a3', '#f8f5ec', '#fffdf5', '#10231c', '#5b6f65') },
      { name: 'Midnight Blue', colors: palette('#0f1e3d', '#c9a227', '#f3e3a3', '#f5f6f8', '#ffffff', '#101828', '#5b6478') },
    ],
    film: {
      opening: 'arches', names: 'arches', couple: 'arches', functions: 'arches', closing: 'arches', openingCamera: 'push',
      particles: { opening: 'goldDust', names: 'lanterns', closing: 'goldDust' }, nameStyle: 'script', motif: 'crescent', people: 'couple',
    },
  },
  {
    key: 'anand-karaj-video', name: 'Golden Sarovar', category: 'Wedding', style: 'Traditional', tier: 'PREMIUM',
    description: 'Golden domes mirrored in still water under a starry sky, opening with Ik Onkar: a serene film for Anand Karaj.',
    tags: ['sikh', 'video', 'illustrated'], eventTypes: ['WEDDING'], recipe: 'film', ornament: 'geometric', fonts: 'grand', invocation: INVOCATION.sikh, eyebrow: t('template.weddingOf'),
    colors: palette('#1e3a8a', '#e07b00', '#fbbf24', '#fffaf2', '#fff3de', '#172033', '#5b6478'),
    film: {
      opening: 'sarovar', names: 'sarovar', couple: 'sarovar', functions: 'sarovar', closing: 'sarovar',
      particles: { opening: 'goldDust', names: 'goldDust', closing: 'petals' }, nameStyle: 'caps', motif: 'diya', people: 'couple',
    },
  },
  {
    key: 'marigold-mahal-film', name: 'Marigold Mahal Film', category: 'Wedding', style: 'Heritage', tier: 'PREMIUM', badge: 'NEW', featured: true,
    description: 'Marigold torans, a turning rangoli and a row of diyas in crimson and saffron: a joyful heritage film that matches the Marigold Mahal website.',
    tags: ['hindu', 'heritage', 'north-indian', 'video', 'illustrated'], eventTypes: ['WEDDING'], recipe: 'film', ornament: 'mandala', fonts: 'desi', invocation: INVOCATION.hindu, eyebrow: t('template.weddingOf'),
    colors: palette('#a3123a', '#e8891d', '#f6c343', '#fff8ec', '#fdf0d8', '#3b1410', '#7c4a3c'),
    presets: [
      { name: 'Crimson & Marigold', colors: palette('#a3123a', '#e8891d', '#f6c343', '#fff8ec', '#fdf0d8', '#3b1410', '#7c4a3c') },
      { name: 'Rani Pink', colors: palette('#b0145f', '#f08c1f', '#f9c74f', '#fff6f3', '#fde9e4', '#3a0f22', '#7d4a5c') },
      { name: 'Haldi Sunset', colors: palette('#9a3412', '#dd6b20', '#fbd05d', '#fffaf0', '#fdefd0', '#3a1a08', '#7a5335') },
    ],
    film: {
      opening: 'toran', names: 'toran', couple: 'toran', functions: 'mandap', closing: 'toran', openingCamera: 'push',
      particles: { opening: 'marigold', names: 'marigold', closing: 'petals' }, nameStyle: 'caps', motif: 'kalash', people: 'couple',
    },
  },
  {
    key: 'kerala-kasavu-film', name: 'Kasavu Backwaters', category: 'Wedding', style: 'Minimal', tier: 'STANDARD', badge: 'NEW',
    description: 'Coconut palms, a houseboat at sunset and a kasavu-gold border: a calm film for Kerala weddings.',
    tags: ['south-indian', 'kerala', 'malayali', 'video', 'illustrated'], eventTypes: ['WEDDING'], recipe: 'film', ornament: 'lotus', fonts: 'elegant', eyebrow: t('template.weddingOf'),
    colors: palette('#6b5a1e', '#2f6b3f', '#e9c46a', '#fbf9f2', '#f3efe0', '#2a2618', '#7a7258'),
    film: {
      opening: 'backwaters', names: 'backwaters', couple: 'lotus', functions: 'backwaters', closing: 'backwaters',
      particles: { opening: 'none', names: 'goldDust', closing: 'petals' }, nameStyle: 'script', motif: 'lotus', people: 'couple',
    },
  },
  {
    key: 'blush-and-bloom-film', name: 'Blush & Bloom Film', category: 'Wedding', style: 'Floral', tier: 'STANDARD', badge: 'NEW',
    description: 'Layered rose arches and drifting petals in blush and sage: a romantic film for weddings, engagements and receptions.',
    tags: ['floral', 'pastel', 'video', 'illustrated'], eventTypes: ['WEDDING', 'ENGAGEMENT'], recipe: 'film', ornament: 'floral', fonts: 'romantic', eyebrow: t('template.weddingOf'),
    colors: palette('#9d4d5e', '#8fa98a', '#f4c2c2', '#fdf8f7', '#fbeeee', '#3a2328', '#86666c'),
    presets: [
      { name: 'Blush', colors: palette('#9d4d5e', '#8fa98a', '#f4c2c2', '#fdf8f7', '#fbeeee', '#3a2328', '#86666c') },
      { name: 'Lavender', colors: palette('#6b4f8f', '#8fa98a', '#e4d3f5', '#fbf9fe', '#f3edfb', '#2a2138', '#76698a') },
    ],
    film: {
      opening: 'floral', names: 'floral', couple: 'floral', functions: 'floral', closing: 'floral', openingCamera: 'push',
      particles: { opening: 'petals', names: 'petals', closing: 'petals' }, nameStyle: 'script', motif: 'floral', people: 'couple',
    },
  },
  {
    key: 'birthday-bash-video', name: 'Birthday Bash', category: 'Birthday', style: 'Party', tier: 'STANDARD',
    description: 'Balloons float up, confetti falls and the name lands in big bright type: a fun video invite for birthday parties.',
    tags: ['birthday', 'party', 'video', 'illustrated'], eventTypes: ['BIRTHDAY'], recipe: 'film', ornament: 'confetti', fonts: 'modern', eyebrow: t('template.birthdayOf'),
    colors: palette('#db2777', '#2563eb', '#fde047', '#fff7fb', '#ffffff', '#1f1330', '#6b5a80'),
    film: {
      opening: 'balloons', names: 'balloons', functions: 'balloons', closing: 'balloons',
      particles: { opening: 'confetti', names: 'confetti', closing: 'confetti' }, nameStyle: 'caps', motif: 'confetti', people: 'one',
    },
  },
  {
    key: 'griha-pravesh-video', name: 'Griha Pravesh Blessings', category: 'Housewarming', style: 'Traditional', tier: 'FREE',
    description: 'The sacred fire, kalash and marigolds of the griha pravesh puja, with blessings and the puja timings.',
    tags: ['housewarming', 'hindu', 'video', 'illustrated'], eventTypes: ['HOUSEWARMING'], recipe: 'film', ornament: 'floral', fonts: 'heritage', invocation: INVOCATION.hindu, eyebrow: t('template.joinUs'),
    colors: palette('#166534', '#ea580c', '#fde68a', '#fbfdf7', '#ffffff', '#15261a', '#5f7063'),
    film: {
      opening: 'mandap', names: 'mandap', functions: 'mandap', closing: 'mandap', openingCamera: 'push',
      particles: { opening: 'marigold', names: 'none', closing: 'marigold' }, nameStyle: 'caps', motif: 'kalash', people: 'one',
    },
  },
  {
    key: 'lotus-blessings-video', name: 'Lotus Blessings Film', category: 'Puja & Ceremonies', style: 'Serene', tier: 'STANDARD',
    description: 'A lotus pond with floating diyas at dawn: a calm film for pujas, griha pravesh and naming ceremonies.',
    tags: ['signature', 'puja', 'video', 'illustrated'], eventTypes: ['RELIGIOUS', 'HOUSEWARMING', 'NAMING_CEREMONY', 'THREAD_CEREMONY'], recipe: 'film', ornament: 'lotus', fonts: 'heritage', invocation: INVOCATION.om, eyebrow: t('template.blessings'),
    colors: palette('#9a3412', '#d97706', '#fcd9a8', '#fffaf3', '#ffffff', '#2f1a0d', '#86684f'),
    film: {
      opening: 'lotus', names: 'lotus', functions: 'lotus', closing: 'lotus',
      particles: { opening: 'petals', names: 'goldDust', closing: 'petals' }, nameStyle: 'caps', motif: 'lotus', people: 'one',
    },
  },
  // ───────────── Premium films ─────────────
  {
    key: 'maharani-film', name: 'Maharani Film', category: 'Wedding', style: 'Royal', tier: 'PREMIUM', badge: 'NEW', featured: true,
    description: 'A royal wedding film in maroon and gold: your monogram glows in a gold medallion, the camera moves into a mandap lit by the sacred fire as your names shine, your photo appears in the medallion, each function unfolds under glowing arches and the fire closes the film.',
    tags: ['hindu', 'royal', 'north-indian', 'cinematic', 'video', 'illustrated'], eventTypes: ['WEDDING'], recipe: 'premium', ornament: 'mandala', fonts: 'royal', invocation: INVOCATION.hindu, eyebrow: t('template.weddingOf'),
    colors: palette('#5a0f28', '#c9a24a', '#f2dca6', '#fbf5ec', '#fffdf8', '#2a0712', '#7a5a52'),
    presets: [
      { name: 'Maroon & Gold', colors: palette('#5a0f28', '#c9a24a', '#f2dca6', '#fbf5ec', '#fffdf8', '#2a0712', '#7a5a52') },
      { name: 'Emerald & Gold', colors: palette('#0d3b2e', '#c9a24a', '#f0dda8', '#f6f4ec', '#ffffff', '#04201a', '#5c6f66') },
      { name: 'Midnight & Gold', colors: palette('#16224a', '#c9a24a', '#efddb0', '#f5f5f2', '#ffffff', '#080e24', '#5b6478') },
    ],
    film: {
      opening: 'noir', names: 'mandap', couple: 'noir', functions: 'arches', closing: 'mandap', openingCamera: 'push',
      particles: { opening: 'goldDust', names: 'marigold', closing: 'goldDust' }, nameStyle: 'script', motif: 'kalash', people: 'couple',
      halo: 'mandala', joiner: 'and', portrait: 'backdrop', cameras: { names: 'pull', couple: 'push', functions: 'panLeft', closing: 'pull' },
    },
  },
  {
    key: 'ring-ceremony-film', name: 'Ring Ceremony Film', category: 'Engagement', style: 'Romantic', tier: 'STANDARD', badge: 'NEW', featured: true,
    description: 'A rose-gold film for an engagement: dawn over a lotus pond, your names in flowing script under glowing arches, your photo in a gold ring, every function on a glass card and a blessing to close.',
    tags: ['engagement', 'ring-ceremony', 'romantic', 'cinematic', 'video', 'illustrated'], eventTypes: ['ENGAGEMENT', 'WEDDING'], recipe: 'premium', ornament: 'laurel', fonts: 'romantic', eyebrow: t('template.engagementOf'),
    colors: palette('#5b2a4a', '#c99a6a', '#f3d6c8', '#fbf3f1', '#fffaf8', '#2e1424', '#7f6474'),
    presets: [
      { name: 'Plum & Rose Gold', colors: palette('#5b2a4a', '#c99a6a', '#f3d6c8', '#fbf3f1', '#fffaf8', '#2e1424', '#7f6474') },
      { name: 'Sage & Gold', colors: palette('#3f5a46', '#c2a46a', '#dfe8d8', '#f4f6f0', '#ffffff', '#16211a', '#6b776c') },
    ],
    film: {
      opening: 'lotus', names: 'arches', couple: 'lotus', functions: 'arches', closing: 'lotus', openingCamera: 'rise',
      particles: { opening: 'petals', names: 'goldDust', closing: 'petals' }, nameStyle: 'script', motif: 'laurel', people: 'couple',
      halo: 'laurel', joiner: 'and', portrait: 'circle', cameras: { names: 'push', couple: 'pull', functions: 'panRight', closing: 'pull' },
    },
  },
  {
    key: 'midnight-deco-film', name: 'Midnight Deco Film', category: 'Reception', style: 'Glamour', tier: 'PREMIUM', badge: 'NEW', featured: true,
    description: 'A black-tie reception film in midnight and gold: the lake palace by night with sky lanterns rising, your monogram in a gold medallion as your names land in tall gold capitals, your photo in a gold arch and every function under the palace lights.',
    tags: ['reception', 'sangeet', 'art-deco', 'night', 'cinematic', 'video', 'illustrated'], eventTypes: ['WEDDING'], recipe: 'premium', ornament: 'geometric', fonts: 'editorial', eyebrow: t('template.reception'),
    colors: palette('#0e1a2b', '#d4b26a', '#ecdcb0', '#f6f4ef', '#ffffff', '#05090f', '#5b6474'),
    presets: [
      { name: 'Midnight & Gold', colors: palette('#0e1a2b', '#d4b26a', '#ecdcb0', '#f6f4ef', '#ffffff', '#05090f', '#5b6474') },
      { name: 'Onyx & Champagne', colors: palette('#1a1a1a', '#d9c08a', '#efe3c2', '#f5f4f1', '#ffffff', '#050505', '#5f5f5f') },
    ],
    film: {
      opening: 'palace', names: 'noir', couple: 'arches', functions: 'palace', closing: 'noir', openingCamera: 'rise',
      particles: { opening: 'lanterns', names: 'goldDust', closing: 'goldDust' }, nameStyle: 'caps', motif: 'geometric', people: 'couple',
      halo: 'geometric', joiner: 'and', portrait: 'arch', cameras: { names: 'push', couple: 'pull', functions: 'panRight', closing: 'pull' },
    },
  },
  {
    key: 'deepotsav-film', name: 'Deepotsav Film', category: 'Festival', style: 'Festive', tier: 'STANDARD', badge: 'NEW',
    description: 'A Diwali film in indigo and saffron gold: a marigold toran over a rangoli of diyas, sky lanterns rising over the palace as your evening is announced, the programme on glass cards under glowing arches, and a warm wish to close.',
    tags: ['festival', 'diwali', 'cinematic', 'video', 'illustrated'], eventTypes: ['FESTIVAL', 'COMMUNITY'], recipe: 'premium', ornament: 'mandala', fonts: 'grand', invocation: '॥ शुभ दीपावली ॥', eyebrow: t('template.celebrateWith'),
    colors: palette('#1f1b4d', '#f2a93b', '#ffd27a', '#fbf7ef', '#fffdf8', '#0d0b24', '#6b6780'),
    presets: [
      { name: 'Indigo & Saffron', colors: palette('#1f1b4d', '#f2a93b', '#ffd27a', '#fbf7ef', '#fffdf8', '#0d0b24', '#6b6780') },
      { name: 'Aubergine & Gold', colors: palette('#3b0f3f', '#e8a33d', '#ffd98a', '#fbf6f8', '#ffffff', '#1a051c', '#76607a') },
    ],
    film: {
      opening: 'toran', names: 'palace', functions: 'arches', closing: 'toran', openingCamera: 'push',
      particles: { opening: 'marigold', names: 'lanterns', closing: 'goldDust' }, nameStyle: 'script', motif: 'diya', people: 'one',
      halo: 'mandala', cameras: { names: 'rise', functions: 'panLeft', closing: 'pull' },
    },
  },
  // ───────────── Ornament films ─────────────
  {
    key: 'lantern-night-video', name: 'Lantern Night Film', category: 'Wedding', style: 'Royal', tier: 'PREMIUM', badge: 'NEW',
    description: 'A starlit 9:16 film in indigo and saffron gold with sky lanterns rising: your names, every function and a glowing close, set to your music.',
    tags: ['signature', 'hindu', 'video'], eventTypes: ['WEDDING'], recipe: 'royal', ornament: 'stars', fonts: 'royal', invocation: INVOCATION.hindu, eyebrow: t('template.weddingOf'), particles: 'lanterns',
    colors: palette('#1b1f4b', '#e0a030', '#f7d58b', '#fbf7ef', '#fffdf8', '#1d1a2e', '#6b6780'),
  },
  {
    key: 'celestial-vows-video', name: 'Celestial Vows Film', category: 'Wedding', style: 'Celestial', tier: 'PREMIUM',
    description: 'Stars and moonlight in a modern motion invite for evening weddings, sangeet and cocktails.',
    tags: ['signature', 'night', 'video'], eventTypes: ['WEDDING', 'ENGAGEMENT'], recipe: 'modern', ornament: 'stars', fonts: 'royal', eyebrow: t('template.weddingOf'), particles: 'goldDust',
    colors: palette('#141a3a', '#9aa6d6', '#e8e3c8', '#f5f6fb', '#ffffff', '#141a30', '#5d6480'),
  },
  {
    key: 'cathedral-grace-video', name: 'Cathedral Grace Film', category: 'Wedding', style: 'Heritage', tier: 'PREMIUM',
    description: 'Laurel, navy and antique gold with a verse to open and petals falling: a graceful video invitation for church weddings.',
    tags: ['signature', 'christian', 'video'], eventTypes: ['WEDDING'], recipe: 'royal', ornament: 'laurel', fonts: 'editorial', invocation: INVOCATION.christian, eyebrow: t('template.weddingOf'), particles: 'petals',
    colors: palette('#1f2a44', '#b8955a', '#e7d3a8', '#f8f6f1', '#ffffff', '#1a2030', '#606879'),
  },
  {
    key: 'save-the-date-video', name: 'Save the Date Film', category: 'Save the Date', style: 'Modern', tier: 'STANDARD', badge: 'POPULAR',
    description: 'Your favourite photo with a slow zoom, falling petals, your names and date. The perfect first announcement.',
    tags: ['save-the-date', 'photo', 'video'], eventTypes: ['WEDDING', 'ENGAGEMENT'], recipe: 'photo', ornament: 'floral', fonts: 'classic', eyebrow: t('template.saveTheDate'), particles: 'petals',
    colors: palette('#3a2328', '#b76e79', '#f3d1d6', '#fdf8f8', '#ffffff', '#3a2328', '#86666c'),
  },
  {
    key: 'festive-greetings-video', name: 'Festive Greetings', category: 'Festival', style: 'Festive', tier: 'STANDARD',
    description: 'Purple and gold sparkle with rising lanterns for Diwali, Eid and festival gatherings.',
    tags: ['festival', 'diwali', 'video'], eventTypes: ['FESTIVAL', 'COMMUNITY'], recipe: 'festive', ornament: 'mandala', fonts: 'royal', eyebrow: t('template.celebrateWith'), particles: 'lanterns',
    colors: palette('#3b0764', '#f59e0b', '#fde68a', '#fbf7ff', '#ffffff', '#1e0833', '#6b5a80'),
  },
  {
    key: 'corporate-invite-video', name: 'Keynote', category: 'Corporate', style: 'Modern', tier: 'STANDARD',
    description: 'A clean motion invite for launches, conferences and company celebrations.',
    tags: ['corporate', 'video'], eventTypes: ['CORPORATE'], recipe: 'modern', ornament: 'geometric', fonts: 'modern', eyebrow: t('invitation.youAreInvited'),
    colors: palette('#1e3a8a', '#0ea5e9', '#bae6fd', '#f8fafc', '#ffffff', '#0f172a', '#64748b'),
  },
  // ───────────── Image cards ─────────────
  {
    key: 'royal-card', name: 'Royal Card', category: 'Wedding', style: 'Royal', tier: 'STANDARD', card: true, backdrop: 'palace',
    description: 'A 4:5 illustrated card of your invitation, a palace on the lake at night, for WhatsApp, Instagram and printing.',
    tags: ['hindu', 'card', 'illustrated'], eventTypes: ['WEDDING', 'ENGAGEMENT'], recipe: 'royal', ornament: 'mandala', fonts: 'royal', invocation: INVOCATION.hindu, eyebrow: t('template.weddingOf'),
    colors: palette('#5a0f1f', '#b8892b', '#f1d9a0', '#fbf6ec', '#fffdf8', '#2b1b17', '#7a6558'),
  },
  {
    key: 'temple-card', name: 'Temple Card', category: 'Wedding', style: 'Temple', tier: 'STANDARD', card: true, backdrop: 'gopuram', badge: 'NEW',
    description: 'A 4:5 illustrated card with a temple gopuram at sunrise, for South Indian weddings.',
    tags: ['south-indian', 'card', 'illustrated'], eventTypes: ['WEDDING', 'ENGAGEMENT'], recipe: 'royal', ornament: 'mandala', fonts: 'grand', invocation: INVOCATION.tamil, eyebrow: t('template.weddingOf'),
    colors: palette('#8a0f1f', '#b8862c', '#f0c75e', '#fdf6e7', '#fbecd0', '#2d1a0f', '#7d6248'),
  },
  {
    key: 'ivory-card', name: 'Ivory Card', category: 'Any Event', style: 'Minimal', tier: 'FREE', card: true,
    description: 'A timeless ivory image card for any occasion.',
    tags: ['minimal', 'card'], eventTypes: [], recipe: 'royal', ornament: 'floral', fonts: 'classic', eyebrow: t('invitation.youAreInvited'),
    colors: palette('#44403c', '#b8892b', '#f1e3c4', '#fcfaf6', '#ffffff', '#1c1917', '#78716c'),
  },
];

export const VIDEO_TEMPLATES: CatalogEntry[] = SPECS.map((spec, i) => video(spec, 100 + i));
