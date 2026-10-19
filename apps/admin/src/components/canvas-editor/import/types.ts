import type { BLEND_MODES, ColorRef, Frame, LayerInput, PALETTE_KEYS } from '@bulava/template-schema';

/**
 * Designs from other software, read in the browser (docs/template-studio.md#imports):
 * each importer turns a file into pages of layers in the file's own units
 * (pixels, points…), bottom to top. Words become text layers and simple
 * shapes shape layers, so they stay editable; everything else becomes
 * pictures, uploaded as licensed assets when the import is placed.
 */

/** A picture an import found or drew, uploaded when the import is placed. */
export interface Raster {
  blob: Blob;
  width: number;
  height: number;
}

export type BlendMode = (typeof BLEND_MODES)[number];

/** One layer as the file had it. */
export type DraftLayer =
  | { type: 'layer'; layer: LayerInput & { frame: Frame } }
  | {
      type: 'raster';
      name: string;
      raster: Raster;
      frame: Frame;
      opacity?: number;
      blend?: BlendMode;
      group?: string;
      locked?: boolean;
      flipX?: boolean;
      flipY?: boolean;
      mask?: 'rounded' | 'circle' | 'ellipse';
      radius?: number;
      /** How the picture fills its frame (contain: whole, as most files place pictures). */
      fit?: 'cover' | 'contain';
    };

export interface ImportedPage {
  name: string;
  width: number;
  height: number;
  /** The page's own colour, when it is one plain colour. */
  background?: ColorRef;
  layers: DraftLayer[];
}

export type ImportFormat = 'svg' | 'pdf' | 'psd' | 'pptx' | 'image' | 'board';

export interface ImportResult {
  format: ImportFormat;
  pages: ImportedPage[];
  /** What could not come across, for the designer (translated). */
  warnings: string[];
}

export type Palette = Record<(typeof PALETTE_KEYS)[number], string>;

export interface ImportOptions {
  /** The template's colours: a colour close to one of them takes its name, so it follows the host's colour choices. */
  palette: Palette | null;
  /** The template's font families by role: words set in one of them take that role. */
  fonts: { heading: string; body: string; script: string };
  /** false: words are drawn into the pictures too (the exact look, nothing to retype). */
  editableText: boolean;
}

/** Reads a file into pages, or throws an `Error` whose message is for the designer. */
export type Importer = (file: File, options: ImportOptions) => Promise<ImportResult>;
