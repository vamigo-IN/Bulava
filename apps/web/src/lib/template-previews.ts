import manifest from './template-previews.json';

/**
 * Pre-rendered template previews (apps/web/public/template-previews), made by
 * infrastructure/scripts/template-previews.mjs from the live renderer. Galleries
 * show these images instead of rendering every template's sections and art,
 * which made the home page about 30,000 elements and 5 MB of HTML. A template
 * without an image falls back to the live preview.
 *
 * `card`: the top of a website (390 × 780 CSS px, as phone thumbnails crop it).
 * `full`: a long scroll for the home page's hero phone.
 * `poster`: a film's or card's scene with its title, at the gallery card's size.
 * Values are content hashes, so URLs change whenever an image does.
 */
const previews = manifest as {
  card: Record<string, string>;
  full: Record<string, { v: string; height: number }>;
  poster?: Record<string, string>;
};

/** Width of the phone viewport the previews were taken at, in CSS pixels. */
export const PREVIEW_VIEWPORT_WIDTH = 390;

/** The size of a gallery card's phone screen, which posters are pre-rendered at (CSS pixels). */
export const POSTER_WIDTH = 220;
export const POSTER_HEIGHT = 400;

export function cardPreview(key: string): string | null {
  const v = previews.card[key];
  return v ? `/template-previews/${key}.webp?v=${v}` : null;
}

/** `width` and `height` are the CSS size the image was taken at. */
export function fullPreview(key: string): { src: string; width: number; height: number } | null {
  const entry = previews.full[key];
  return entry ? { src: `/template-previews/${key}-full.webp?v=${entry.v}`, width: PREVIEW_VIEWPORT_WIDTH, height: entry.height } : null;
}

/** Only for a poster shown at POSTER_WIDTH × POSTER_HEIGHT; other sizes are drawn live. */
export function posterPreview(key: string): string | null {
  const v = previews.poster?.[key];
  return v ? `/template-previews/${key}-poster.webp?v=${v}` : null;
}
