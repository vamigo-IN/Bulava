import { createTranslator, en, type MessageKey } from '@bulava/localization';
import { textInk } from '@bulava/template-engine';
import {
  ADDED_SECTION_WIDTH,
  ArtboardSchema,
  BINDINGS,
  PALETTE_KEYS,
  VALUE_FORMATS,
  resolveValue,
  type Artboard,
  type ColorRef,
  type LayerInput,
  type RenderContext,
  type SectionInstance,
  type ThemeColors,
  type Value,
} from '@bulava/template-schema';

/**
 * A template section made the host's own (ADR-065), read from the page in the
 * editor's phone frame: the section stays exactly as the template draws it (a
 * section layer behind, its words hidden), and every run of words in it
 * becomes a text layer where it stands, in its font, size, colour and glow.
 * Words that come from the event's details stay bound to them, the template's
 * own headings stay translatable, and a directions link becomes a button.
 * Photos, ornaments and a ticking countdown stay part of the drawing.
 */

export interface SectionSnapshot {
  board: Artboard;
  /** The layer under the click, to choose it. */
  pick: string | null;
}

interface SnapshotEnv {
  ctx: RenderContext;
  colors: ThemeColors;
  language: string;
  /** The template's own text slots (custom.*), which words may come from too. */
  slots: readonly string[];
}

/** Never the host's words: drawings, frames, controls and the live countdown. */
const SKIP = 'svg, script, style, noscript, iframe, textarea, input, select, button, a, [data-live]';
/** A board holds at most 120 layers; a section with more words than this stays the template's. */
const MAX_RUNS = 100;
const W = ADDED_SECTION_WIDTH;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
const round = (n: number) => Math.round(n * 10) / 10;
const firstFamily = (stack: string) =>
  (stack.split(',')[0] ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .toLowerCase();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Any CSS colour as #rrggbb (or #rrggbbaa), through a one-pixel canvas; null when it is transparent. */
function colorReader(doc: Document): (css: string) => string | null {
  const canvas = doc.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const cache = new Map<string, string | null>();
  const hex2 = (n: number) => n.toString(16).padStart(2, '0');
  return (css) => {
    const known = cache.get(css);
    if (known !== undefined) return known;
    let out: string | null = null;
    if (g && css && css !== 'transparent') {
      g.clearRect(0, 0, 1, 1);
      g.fillStyle = '#000000';
      g.fillStyle = css;
      g.fillRect(0, 0, 1, 1);
      const [r = 0, gr = 0, b = 0, a = 0] = g.getImageData(0, 0, 1, 1).data;
      if (a > 0) out = `#${hex2(r)}${hex2(gr)}${hex2(b)}${a < 255 ? hex2(a) : ''}`;
    }
    cache.set(css, out);
    return out;
  };
}

/** The palette name a colour is, when it is exactly one. */
function paletteKeyOf(hex: string, colors: ThemeColors): ColorRef | null {
  for (const key of PALETTE_KEYS) if (colors[key].toLowerCase() === hex) return key;
  return null;
}

/**
 * The colour a text layer needs to draw exactly this ink on this backdrop: a
 * palette name when the engine would arrive at the same ink from it (so the
 * host's colour choices still reach it), else the ink itself.
 */
function inkRef(hex: string, backdrop: string[], colors: ThemeColors): { color: ColorRef; contrast: boolean } {
  for (const key of PALETTE_KEYS) {
    if (textInk(key, backdrop, colors, true).toLowerCase() === hex) return { color: key, contrast: true };
    if (textInk(key, backdrop, colors, false).toLowerCase() === hex) return { color: key, contrast: false };
  }
  return { color: hex, contrast: false };
}

/** The value a run of words came from: the section's own words, the event's details, the template's headings, else the words. */
function valueMatcher(section: SectionInstance, env: SnapshotEnv): (text: string) => Value {
  const t = createTranslator(env.language);
  const opts = { t, language: env.language, timeZone: env.ctx.event.timezone };
  const exact = new Map<string, Value>();
  const subs: Array<[string, string]> = [];
  const add = (shown: unknown, value: Value) => {
    if (typeof shown !== 'string' && typeof shown !== 'number') return;
    const key = norm(String(shown));
    if (key && !exact.has(key)) exact.set(key, value);
  };
  for (const v of Object.values(section.props)) add(resolveValue(v, env.ctx, opts), v);
  const details: Array<[string, Value]> = [];
  for (const [binding, def] of Object.entries(BINDINGS)) {
    // The page has no current function; aliases resolve to the names already listed.
    if (binding.startsWith('function') || binding === 'couple.brideName' || binding === 'couple.groomName') continue;
    if (def.type === 'text') details.push([binding, { binding }]);
    if (def.type === 'datetime') for (const format of VALUE_FORMATS) if (format !== 'upper' && format !== 'lower' && format !== 'initial') details.push([`${binding}|${format}`, { binding, format }]);
  }
  for (const slot of env.slots) details.push([`custom.${slot}`, { binding: `custom.${slot}` }]);
  for (const [token, value] of details) {
    const shown = resolveValue(value, env.ctx, opts);
    add(shown, value);
    if (typeof shown === 'string' && shown.trim().length >= 3) subs.push([shown.trim(), `{{${token}}}`]);
  }
  for (const key of Object.keys(en)) {
    if (!key.startsWith('template.')) continue;
    const shown = t(key as MessageKey);
    if (!/\{\w+\}/.test(shown)) add(shown, { t: key });
  }
  // Longest first, so a full name is matched before a part of it.
  subs.sort((a, b) => b[0].length - a[0].length);
  return (text) => {
    const hit = exact.get(norm(text));
    if (hit) return hit;
    let out = text;
    const tokens: string[] = [];
    for (const [shown, token] of subs) {
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(shown)}(?=$|[^\\p{L}\\p{N}])`, 'gu');
      out = out.replace(re, (_m, pre: string) => {
        tokens.push(token);
        return `${pre}\uE000${tokens.length - 1}\uE001`;
      });
    }
    if (!tokens.length) return { literal: text.slice(0, 2000) };
    return { template: out.replace(/\uE000(\d+)\uE001/g, (_m, i: string) => tokens[Number(i)]!).slice(0, 2000) };
  };
}

/** The first detail a template of words reads, to show it only while that detail is there. */
function firstBinding(value: Value): string | null {
  if (!('template' in value)) return null;
  const m = /\{\{([a-zA-Z][\w.[\]]*)/.exec(value.template);
  return m?.[1] ?? null;
}

interface Run {
  block: Element;
  nodes: Text[];
  parts: string[];
}

/**
 * Shadows to the canvas's names: an even glow, a hard offset, or a soft drop.
 * A near-white halo (words kept clear of a pale painted sky) has no dark
 * counterpart, so it is left out rather than drawn as a dark shadow.
 */
function shadowOf(css: string, color: (css: string) => string | null): 'none' | 'soft' | 'hard' | 'glow' {
  if (!css || css === 'none') return 'none';
  const shadows = css.split(/,(?![^(]*\))/);
  let kind: 'none' | 'soft' | 'hard' = 'none';
  for (const s of shadows) {
    const paint = /(rgba?|hsla?|color|oklch|oklab|lab|lch)\([^)]*\)|#[0-9a-f]{3,8}\b/i.exec(s)?.[0];
    const hex = paint ? color(paint) : null;
    const light = hex ? (Number.parseInt(hex.slice(1, 3), 16) * 299 + Number.parseInt(hex.slice(3, 5), 16) * 587 + Number.parseInt(hex.slice(5, 7), 16) * 114) / 1000 > 230 : false;
    const px = (paint ? s.replace(paint, '') : s).match(/-?[\d.]+px/g)?.map((v) => Number.parseFloat(v)) ?? [];
    const [x = 0, y = 0, blur = 0] = px;
    if (x === 0 && y === 0 && blur > 0 && !light) return 'glow';
    if (light) continue;
    kind = blur === 0 && (x !== 0 || y !== 0) ? 'hard' : 'soft';
  }
  return kind;
}

/**
 * The section under `root` (the element holding it on the page) as a board of
 * the host's: the template's section behind, its words as layers. Null when
 * it cannot be read (then the section is redrawn from its description).
 */
export function snapshotSection(root: HTMLElement, section: SectionInstance, env: SnapshotEnv, click?: { x: number; y: number }): SectionSnapshot | null {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  if (!win) return null;
  const box = root.getBoundingClientRect();
  if (box.width < 100 || box.height < 20) return null;
  const k = W / box.width;
  const H = Math.round(Math.min(2400, Math.max(120, box.height * k)));
  const css = (el: Element) => win.getComputedStyle(el);
  const color = colorReader(doc);
  const page = css(root.closest('.bulava-template') ?? root);
  const families = { heading: firstFamily(page.getPropertyValue('--t-heading')), script: firstFamily(page.getPropertyValue('--t-script')), body: firstFamily(page.getPropertyValue('--t-body')) };

  // The board's own colour is the section's (its words' contrast is checked against it).
  const sectionEl = root.firstElementChild ?? root;
  const sectionBg = color(css(sectionEl).backgroundColor);
  const bgHex = sectionBg && sectionBg.length === 7 ? sectionBg : env.colors.background.toLowerCase();
  const background: ColorRef = paletteKeyOf(bgHex, env.colors) ?? bgHex;
  const backdrop = [bgHex];

  // ── Runs of words: text in one block, unbroken by another block ──
  const runs: Run[] = [];
  let current: Run | null = null;
  const visit = (el: Element, block: Element) => {
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 3) {
        const node = child as Text;
        if (!node.data.trim()) {
          if (current && current.block === block && node.data.length) current.parts.push(' ');
          continue;
        }
        if (!current || current.block !== block) {
          current = { block, nodes: [], parts: [] };
          runs.push(current);
        }
        current.nodes.push(node);
        current.parts.push(node.data.replace(/\s+/g, ' '));
        continue;
      }
      if (child.nodeType !== 1) continue;
      const e = child as Element;
      if (e.tagName === 'BR') {
        if (current && current.block === block) current.parts.push('\n');
        continue;
      }
      if (e.matches(SKIP)) {
        current = null;
        continue;
      }
      const s = css(e);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      if (s.display === 'inline' || s.display === 'contents') visit(e, block);
      else {
        current = null;
        visit(e, e);
        current = null;
      }
    }
  };
  visit(root, root);

  const match = valueMatcher(section, env);
  const layers: LayerInput[] = [];
  let n = 0;
  for (const run of runs) {
    const rects: DOMRect[] = [];
    for (const node of run.nodes) {
      const range = doc.createRange();
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) if (r.width > 1 && r.height > 1) rects.push(r);
    }
    // Read-aloud-only words (sr-only) have no size.
    if (!rects.length) continue;
    const text = run.parts
      .join('')
      .split('\n')
      .map((line) => line.replace(/ +/g, ' ').trim())
      .join('\n')
      .trim();
    if (!text) continue;
    if (++n > MAX_RUNS) return null;
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    const lineTops: number[] = [];
    for (const r of [...rects].sort((a, b) => a.top - b.top)) if (!lineTops.some((y) => Math.abs(y - r.top) < r.height / 2)) lineTops.push(r.top);
    const lines = lineTops.length;

    const st = css(run.nodes[0]!.parentElement ?? run.block);
    const bs = css(run.block);
    const br = run.block.getBoundingClientRect();
    const px = (v: string) => Number.parseFloat(v) || 0;
    // The words' block: its content box, never narrower than the words.
    let x0 = Math.min(left, br.left + px(bs.paddingLeft) + px(bs.borderLeftWidth));
    let x1 = Math.max(right, br.right - px(bs.paddingRight) - px(bs.borderRightWidth));
    const fontPx = px(st.fontSize) || 16;
    const lineHeight = st.lineHeight === 'normal' ? 1.2 : px(st.lineHeight) / fontPx;
    const rectH = rects.reduce((sum, r) => sum + r.height, 0) / rects.length;
    const pad = Math.max(0, fontPx * lineHeight - rectH) / 2;
    let align: 'left' | 'center' | 'right';
    if (lines === 1) {
      const gapL = left - x0;
      const gapR = x1 - right;
      align = Math.abs(gapL - gapR) <= 4 ? 'center' : gapL < gapR ? 'left' : 'right';
      // A line's room is the section's column around it (a longer name fits there), never a neighbour's half.
      let col: Element = run.block;
      while (col !== root && col.parentElement && col.getBoundingClientRect().width < box.width * 0.6) col = col.parentElement;
      const cs = css(col);
      const cr = col.getBoundingClientRect();
      const colL = Math.min(left, cr.left + px(cs.paddingLeft) + px(cs.borderLeftWidth));
      const colR = Math.max(right, cr.right - px(cs.paddingRight) - px(cs.borderRightWidth));
      if (align === 'center') {
        const c = (left + right) / 2;
        const half = Math.max((right - left) / 2, Math.min(c - colL, colR - c));
        x0 = c - half;
        x1 = c + half;
      } else if (align === 'left') x1 = Math.max(x1, colR);
      else x0 = Math.min(x0, colL);
    } else align = bs.textAlign === 'center' ? 'center' : bs.textAlign === 'right' || bs.textAlign === 'end' ? 'right' : 'left';

    const fam = firstFamily(st.fontFamily);
    const font = fam === families.heading ? 'heading' : fam === families.script ? 'script' : 'body';
    const fill = st.webkitTextFillColor && st.webkitTextFillColor !== st.color && color(st.webkitTextFillColor) ? st.webkitTextFillColor : st.color;
    const ink = color(fill) ?? env.colors.text.toLowerCase();
    const { color: inkColor, contrast } = inkRef(ink, backdrop, env.colors);
    let opacity = 1;
    for (let el: Element | null = run.nodes[0]!.parentElement; el && el !== root.parentElement; el = el.parentElement) opacity *= Number.parseFloat(css(el).opacity) || 1;
    const content = match(text);
    const bound = firstBinding(content);
    const transform = st.textTransform === 'uppercase' ? 'upper' : st.textTransform === 'lowercase' ? 'lower' : st.textTransform === 'capitalize' ? 'capitalize' : 'none';
    layers.push({
      id: `words-${n}`,
      kind: 'text',
      frame: { x: round((x0 - box.left) * k), y: round((top - pad - box.top) * k), w: round((x1 - x0) * k), h: round((bottom - top + pad * 2) * k) },
      content,
      ...(bound ? { visibleWhen: { exists: bound } } : {}),
      ...(opacity < 0.99 ? { opacity: Math.max(0, Math.round(opacity * 100) / 100) } : {}),
      style: {
        font,
        size: Math.min(600, Math.max(6, round(fontPx * k))),
        weight: Math.min(900, Math.max(100, Math.round((Number.parseInt(st.fontWeight, 10) || 400) / 100) * 100)),
        italic: st.fontStyle === 'italic' || st.fontStyle.startsWith('oblique'),
        color: inkColor,
        contrast,
        align,
        valign: lines === 1 ? 'middle' : 'top',
        letterSpacing: st.letterSpacing === 'normal' ? 0 : Math.min(1, Math.max(-0.2, Math.round((px(st.letterSpacing) / fontPx) * 1000) / 1000)),
        lineHeight: Math.min(3, Math.max(0.7, Math.round(lineHeight * 100) / 100)),
        transform,
        shadow: shadowOf(st.textShadow, color),
      },
      overflow: lines === 1 ? 'shrink' : 'wrap',
    });
  }

  // ── The way to the venue: a button of the host's ──
  const venue = env.ctx.venue;
  for (const a of Array.from(root.querySelectorAll('a'))) {
    if (a.closest('svg') || !venue) continue;
    const href = a.getAttribute('href') ?? '';
    if (href !== venue.mapUrl && !href.startsWith('https://www.google.com/maps/')) continue;
    const r = a.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    const st = css(a);
    const fillHex = color(st.backgroundColor);
    const solid = fillHex && fillHex.length === 7 ? fillHex : null;
    const label = (a.textContent ?? '').replace(/\s+/g, ' ').trim();
    const fam = firstFamily(st.fontFamily);
    layers.push({
      id: `button-${++n}`,
      kind: 'widget',
      frame: { x: round((r.left - box.left) * k), y: round((r.top - box.top) * k), w: round(r.width * k), h: round(r.height * k) },
      widget: {
        type: 'button',
        label: label ? match(label) : { t: 'template.getDirections' },
        action: 'directions',
        fill: solid ? (paletteKeyOf(solid, env.colors) ?? solid) : 'primary',
        color: solid ? inkRef(color(st.color) ?? '#ffffff', [solid], env.colors).color : 'background',
        font: fam === families.heading ? 'heading' : fam === families.script ? 'script' : 'body',
        size: Math.min(120, Math.max(8, round((Number.parseFloat(st.fontSize) || 14) * k))),
        weight: Math.min(900, Math.max(100, Math.round((Number.parseInt(st.fontWeight, 10) || 600) / 100) * 100)),
        radius: Math.min(999, round(Math.min(Number.parseFloat(st.borderTopLeftRadius) || 0, r.height / 2) * k)),
        shadow: st.boxShadow !== 'none',
      },
    });
  }

  const parsed = ArtboardSchema.safeParse({
    width: W,
    height: H,
    background: { type: 'color', color: background },
    layers: [{ id: 'section', kind: 'section', section: section.id, frame: { x: 0, y: 0, w: W, h: H }, hideText: true }, ...layers],
  });
  if (!parsed.success) return null;
  const board = parsed.data;

  // What was clicked: the smallest of the host's layers under the point.
  let pick: string | null = null;
  if (click) {
    const x = click.x * k;
    const y = click.y * k;
    let area = Infinity;
    for (const layer of board.layers) {
      if (layer.kind === 'section') continue;
      const f = layer.frame;
      if (x >= f.x - 4 && x <= f.x + f.w + 4 && y >= f.y - 4 && y <= f.y + f.h + 4 && f.w * f.h < area) {
        area = f.w * f.h;
        pick = layer.id;
      }
    }
  }
  return { board, pick };
}
