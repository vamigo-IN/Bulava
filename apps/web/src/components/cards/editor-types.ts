import type { Translator } from '@bulava/localization';
import type { CardDesign, CardFormat, Layer, RenderContext, TemplateDefinition } from '@bulava/template-schema';
import type { CardConfig } from '@/lib/cards';

export interface CardTemplateInfo {
  key: string;
  name: string;
  category: string;
  definition: TemplateDefinition;
  eventTypes: string[];
  tags: string[];
}

/** What the editor's panels and inspector work with. */
export interface CardEditorApi {
  design: CardDesign;
  template: CardTemplateInfo;
  config: CardConfig | null;
  /** The editor's own words (English). */
  t: Translator;
  /** The card's language: its translated wording and dates. */
  cardT: Translator;
  /** The card's data, with its photos' links (what the download draws). */
  ctx: RenderContext;
  selectedId: string | null;
  select: (id: string | null) => void;
  /** Applies a change as one undo step; changes with the same `merge` key in quick succession (typing) share a step. */
  change: (fn: (design: CardDesign) => CardDesign, merge?: string) => void;
  changeLayer: (id: string, fn: (layer: Layer) => Layer, merge?: string) => void;
  addLayer: (layer: Layer) => void;
  removeLayer: (id: string) => void;
  /** Uploads a photo to the card; resolves to its upload id, or null when it failed (the error is shown). */
  uploadPhoto: (file: File) => Promise<string | null>;
  uploading: boolean;
  /** Links of the card's uploaded photos, by upload id. */
  photoUrls: Record<string, string>;
  setFormat: (format: CardFormat) => void;
  /** The template's design again, for this occasion (details kept). */
  restart: (eventType?: string) => void;
  /** Puts the cursor in a text layer's box (after a double click on the canvas). */
  focusText: (id: string) => void;
}
