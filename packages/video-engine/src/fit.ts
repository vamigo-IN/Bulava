let measureContext: CanvasRenderingContext2D | null | undefined;

/** Width of a line in a given CSS font, measured by the browser that renders the video; null outside a browser. */
function measureLine(text: string, font: string): number | null {
  if (measureContext === undefined) measureContext = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!measureContext) return null;
  measureContext.font = font;
  return measureContext.measureText(text).width;
}

/**
 * Shrink text until it fits its box: lines are word-wrapped the way the
 * browser will wrap them, measured in the real font (fonts are loaded before
 * frames render). Without a browser it falls back to an estimate.
 */
export function fitFontSize(
  text: string,
  fontSize: number,
  lineHeight: number,
  w: number,
  h: number,
  opts: { letterSpacing?: number; family?: string; weight?: number } = {},
): number {
  const spacing = opts.letterSpacing ?? 0;
  const caps = text === text.toLocaleUpperCase() && /\p{Lu}/u.test(text);
  const width = (line: string, size: number) =>
    (opts.family ? measureLine(line, `${opts.weight ?? 400} ${size}px ${opts.family}`) : null) ?? line.length * size * (caps ? 0.72 : 0.55);
  const lineWidth = (line: string, size: number) => width(line, size) + spacing * line.length;
  const limit = w * 0.97;
  let size = fontSize;
  for (let i = 0; i < 40; i++) {
    let lines = 0;
    let fits = true;
    for (const paragraph of text.split('\n')) {
      let current = '';
      lines++;
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (lineWidth(word, size) > limit) fits = false;
        const candidate = current ? `${current} ${word}` : word;
        if (current && lineWidth(candidate, size) > limit) {
          lines++;
          current = word;
        } else current = candidate;
      }
    }
    if (fits && lines * size * lineHeight <= h) break;
    size *= 0.93;
  }
  return Math.max(12, size);
}
