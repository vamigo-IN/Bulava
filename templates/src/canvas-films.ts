import { bindingsIn, fitBoard, TemplateDefinitionSchema, type Artboard, type EffectName, type TemplateDefinitionInput } from '@bulava/template-schema';
import type { CatalogEntry } from './builder';

/**
 * Canvas films (ADR-058): canvas invitations as video invitations. Each film
 * is drawn from its invitation's own canvases: the opening, fitted to 9:16,
 * with its layers coming in one after another while the camera drifts; the
 * function card once for each function; and the art with the names to close.
 * The video engine films them (`scene.canvas`), so a film always matches the
 * invitation it comes from.
 */

/** The invitations filmed: the strongest designs across traditions and occasions. */
export const CANVAS_FILM_SOURCES = [
  'shahi-gajraj-card',
  'mor-pankh-card',
  'kovil-mani-card',
  'noor-mahal-card',
  'kerala-kayal-invite',
  'mehtab-raat-invite',
  'laavan-karaj-invite',
  'heena-haath-invite',
  'ghungroo-mehfil-invite',
  'swagat-shaam-invite',
  'raja-beta-invite',
  'godh-bharai-invite',
  'vastu-shanti-invite',
  'jyoti-raat-invite',
  // The stationery collection (premium-cards.ts); Midnight Deco has its own film.
  'royal-maroon-gold',
  'kalyana-zari',
  'phulkari-anand-karaj',
  'mehrab-nikah',
  'lal-paar-bengali',
  'champagne-wreath',
  'genda-phool-haldi',
  'sangeet-sandhya',
] as const;

/** 9:16, the shape phones play films in (1080 × 1920 is 2.4 times this). */
const STORY = { width: 450, height: 800 } as const;
/** Words that name the people or the event: what the closing keeps. */
const NAMES = /^(couple\.|honoree\.|event\.title$)/;

export const canvasFilmKey = (sourceKey: string) => `${sourceKey.replace(/-(card|invite)$/, '')}-film`;

/** Long enough for every layer to come in (staggered) and to be read, rounded to half seconds. */
function sceneSeconds(board: Artboard, stagger: number, hold: number, min: number, max: number): number {
  const moving = board.layers.filter((l) => !l.hidden).length;
  return Math.min(max, Math.max(min, Math.round((0.35 + moving * stagger + 1 + hold) * 2) / 2));
}

/** The closing: the art, the photo and the names, without the date and the details. */
function closingBoard(board: Artboard): Artboard | null {
  const names = board.layers.filter((l) => l.kind === 'text' && bindingsIn(l.content).some((b) => NAMES.test(b)));
  if (!names.length) return null;
  const kept = board.layers.filter((l) => (l.kind === 'text' ? names.includes(l) : l.kind !== 'widget'));
  return { ...board, layers: kept };
}

function film(source: CatalogEntry, sortOrder: number): CatalogEntry {
  const parsed = TemplateDefinitionSchema.parse(source.definition);
  const sections = parsed.website?.pages[0]?.sections ?? [];
  const first = sections[0];
  const hero = first?.section === 'canvas' ? first.canvas : undefined;
  if (!hero) throw new Error(`${source.meta.key}: a canvas film needs a canvas opening`);
  const card = sections.find((s) => s.section === 'canvas' && s.canvas?.repeatPerFunction)?.canvas;
  const opening = fitBoard(hero.mobile, STORY.width, STORY.height);
  const closing = closingBoard(opening);
  const festive = source.meta.eventTypes.some((e) => ['BIRTHDAY', 'BABY_SHOWER', 'NAMING_CEREMONY'].includes(e));
  const particles: EffectName = hero.mobile.effect !== 'none' ? hero.mobile.effect : festive ? 'confetti' : 'goldDust';
  const key = canvasFilmKey(source.meta.key);
  const name = `${source.meta.name} Film`;
  const description = `The ${source.meta.name} invitation as a film: its art and words come in one by one as the camera drifts, then a card for each function and your names to close.`;

  const definition: TemplateDefinitionInput = {
    schemaVersion: 1,
    templateKey: key,
    type: 'VIDEO',
    name,
    description,
    eventTypes: parsed.eventTypes,
    languages: parsed.languages,
    theme: parsed.theme,
    fonts: parsed.fonts,
    capabilities: {
      editable: { colors: true, fonts: true, music: true, background: false, layout: true, photos: parsed.capabilities.editable.photos, text: false, animation: false },
      colorPresets: parsed.capabilities.colorPresets,
      textSlots: parsed.capabilities.textSlots,
      maxPhotos: parsed.capabilities.maxPhotos,
      photoSlots: parsed.capabilities.photoSlots,
    },
    assets: parsed.assets,
    music: { allowCustomerChoice: true },
    canvas: { width: 1080, height: 1920, fps: 30 },
    scenes: [
      { id: 'opening', durationSec: sceneSeconds(opening, 0.14, 2.5, 6, 10), transition: 'fade', particles, canvas: { board: opening, stagger: 0.14, camera: 'push', intensity: 0.7 }, elements: [] },
      ...(card
        ? [{ id: 'function', durationSec: 5, transition: 'fade' as const, repeatPerFunction: true, particles: 'none' as const, canvas: { board: fitBoard(card.mobile, STORY.width, STORY.height), stagger: 0.1, camera: 'pull' as const, intensity: 0.5 }, elements: [] }]
        : []),
      ...(closing ? [{ id: 'closing', durationSec: 5, transition: 'fade' as const, particles, canvas: { board: closing, stagger: 0.2, camera: 'pull' as const, intensity: 0.6 }, elements: [] }] : []),
    ],
  };
  return {
    meta: {
      key,
      name,
      description,
      category: source.meta.category,
      style: source.meta.style,
      // A film is at least a Standard design.
      tier: source.meta.tier === 'FREE' ? 'STANDARD' : source.meta.tier,
      badge: 'NEW',
      featured: false,
      tags: [...new Set([...source.meta.tags, 'video', 'film', 'canvas'])],
      eventTypes: source.meta.eventTypes,
      sortOrder,
    },
    definition,
  };
}

/** The canvas films, from the catalog's canvas invitations (sorted after the other films). */
export function canvasFilms(catalog: readonly CatalogEntry[], firstSortOrder: number): CatalogEntry[] {
  const byKey = new Map(catalog.map((e) => [e.meta.key, e]));
  return CANVAS_FILM_SOURCES.map((sourceKey, i) => {
    const source = byKey.get(sourceKey);
    if (!source) throw new Error(`Canvas film source ${sourceKey} is not in the catalog`);
    return film(source, firstSortOrder + i);
  });
}
