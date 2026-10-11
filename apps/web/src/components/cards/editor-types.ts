import type { Translator } from '@bulava/localization';
import type { Artboard, CardDesign, CardFormat, Fonts, Layer, RenderContext, TemplateDefinition, ThemeColors } from '@bulava/template-schema';
import type { CardConfig } from '@/lib/cards';

export interface CardTemplateInfo {
  key: string;
  name: string;
  category: string;
  definition: TemplateDefinition;
  eventTypes: string[];
  tags: string[];
}

/**
 * What a board editor draws: one artboard, the palette and fonts it is drawn
 * with, its language, and the photo in each photo spot (binding → photo id).
 * A card design is one; the invitation's canvas editor shows each canvas
 * section of the website as one.
 */
export interface BoardDesign {
  board: Artboard;
  colors: ThemeColors;
  fonts: Fonts;
  language: string;
  photos: Partial<Record<string, string>>;
}

/** What the panels and the inspector work with, in the card editor and the invitation's canvas editor. */
export interface BoardEditorApi<D extends BoardDesign = BoardDesign> {
  /** "card": a digital card to download; "website": a section of the event's invitation website; "film": a scene of a video invitation. */
  kind: 'card' | 'website' | 'film';
  design: D;
  /** The editor's own words (English). */
  t: Translator;
  /** The design's language: its translated wording and dates. */
  cardT: Translator;
  /** The data the design is drawn with, with its photos' links. */
  ctx: RenderContext;
  selectedId: string | null;
  select: (id: string | null) => void;
  /** Applies a change as one undo step; changes with the same `merge` key in quick succession (typing) share a step. */
  change: (fn: (design: D) => D, merge?: string) => void;
  changeLayer: (id: string, fn: (layer: Layer) => Layer, merge?: string) => void;
  addLayer: (layer: Layer) => void;
  removeLayer: (id: string) => void;
  /** Uploads a photo; resolves to its id, or null when it failed (the error is shown). */
  uploadPhoto: (file: File) => Promise<string | null>;
  uploading: boolean;
  /** Links of the design's photos, by photo id. */
  photoUrls: Record<string, string>;
  /** Puts the cursor in a text layer's box (after a double click on the canvas). */
  focusText: (id: string) => void;
}

/** The card editor's: a board editor with the card's template, formats and starting over. */
export interface CardEditorApi extends BoardEditorApi<CardDesign> {
  template: CardTemplateInfo;
  config: CardConfig | null;
  setFormat: (format: CardFormat) => void;
  /** The template's design again, for this occasion (details kept). */
  restart: (eventType?: string) => void;
}
