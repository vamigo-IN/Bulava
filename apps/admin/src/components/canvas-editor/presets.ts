import { FRAME_SIZED, ILLUSTRATION_ASPECT } from '@bulava/template-engine';
import { ILLUSTRATIONS, type Artboard, type ArtboardInput, type ColorRef, type IconName, type IllustrationName, type LayerInput, type OrnamentLayerName, type SceneLayer, type SHAPES } from '@bulava/template-schema';

/**
 * Starting points for new layers: each lands centred on the artboard at a size
 * that reads well on a 390-wide phone, scaled for wider boards.
 */

export type LayerPreset =
  | { group: 'text'; key: 'heading' | 'names' | 'eyebrow' | 'paragraph' | 'date' }
  | { group: 'image'; key: 'library' | 'cover' | 'photo' }
  | { group: 'shape'; key: (typeof SHAPES)[number] }
  | { group: 'ornament'; key: OrnamentLayerName }
  | { group: 'scene'; key: SceneLayer['scene'] }
  | { group: 'icon'; key: IconName }
  | { group: 'widget'; key: 'countdown' | 'button' | 'details' };

let counter = 0;
export function layerId(prefix: string, taken: Set<string>): string {
  let id = prefix;
  while (taken.has(id)) id = `${prefix}-${++counter}`;
  return id;
}

const centred = (board: Pick<Artboard, 'width' | 'height'>, w: number, h: number) => ({ x: Math.round((board.width - w) / 2), y: Math.round((board.height - h) / 2), w, h });

const ILLUSTRATION_NAMES = new Set<string>(ILLUSTRATIONS);
export const isIllustration = (name: OrnamentLayerName): name is IllustrationName => ILLUSTRATION_NAMES.has(name);

/** The colour an illustration starts with: its main colour (henna, leaves, an ivory elephant…); others take the palette's secondary. */
export function illustrationTint(name: IllustrationName): ColorRef {
  const tints: Partial<Record<IllustrationName, ColorRef>> = {
    elephant: 'accent',
    royalPeacock: 'accent',
    mehendiHand: '#8a3a17',
    bananaLeaf: '#3d7f3e',
    roseCluster: '#6b8f6e',
    floralGarland: '#6b8f6e',
    arabesque: 'primary',
    coupleHindu: 'primary',
    coupleVarmala: 'primary',
    coupleSikh: 'primary',
    coupleNikah: 'primary',
    coupleSouth: 'primary',
    coupleChristian: 'accent',
    coupleBengali: 'primary',
    coupleElder: 'primary',
    kidBoy: 'primary',
    kidGirl: 'primary',
    babyCradle: 'accent',
    momToBe: 'primary',
    brideBust: 'primary',
    groomBust: 'primary',
    stork: 'accent',
    teddyBear: 'primary',
    unicorn: 'accent',
    dino: '#5cb85c',
    rocket: 'primary',
    cupcake: 'primary',
    doli: 'primary',
    dhol: 'primary',
    champagne: '#f3d38a',
  };
  return tints[name] ?? 'secondary';
}

/** An illustration's starting frame: at its own proportions, or across the board for garlands, strings and frames. */
function illustrationFrame(name: IllustrationName, board: Pick<Artboard, 'width' | 'height'>, u: (n: number) => number) {
  if (name === 'ornateFrame') return { x: u(12), y: u(12), w: board.width - 2 * u(12), h: board.height - 2 * u(12) };
  if (name === 'jasmineStrand') return centred(board, u(30), u(300));
  if (FRAME_SIZED.has(name)) return { x: 0, y: 0, w: board.width, h: u(110) };
  const aspect = ILLUSTRATION_ASPECT[name];
  const w = aspect >= 1 ? u(240) : Math.round(u(260) * aspect);
  return centred(board, w, Math.round(w / aspect));
}

export function newLayer(preset: LayerPreset, board: Pick<Artboard, 'width' | 'height'>, taken: Set<string>, assetId?: string): LayerInput {
  // Everything is designed in phone units; wider boards get the same proportions.
  const s = Math.max(1, board.width / 390);
  const u = (n: number) => Math.round(n * s);
  switch (preset.group) {
    case 'text': {
      const id = layerId(preset.key, taken);
      switch (preset.key) {
        case 'names':
          return { id, kind: 'text', frame: centred(board, u(330), u(120)), content: { template: '{{couple.partnerOne}} & {{couple.partnerTwo}}', fallback: { binding: 'honoree.name', fallback: { binding: 'event.title' } } }, style: { font: 'script', size: u(48), color: 'primary', lineHeight: 1.05 }, overflow: 'shrink' };
        case 'heading':
          return { id, kind: 'text', frame: centred(board, u(310), u(60)), content: { literal: 'Heading' }, style: { font: 'heading', size: u(30), weight: 600, color: 'text' }, overflow: 'shrink' };
        case 'eyebrow':
          return { id, kind: 'text', frame: centred(board, u(310), u(20)), content: { t: 'template.joinUs' }, style: { font: 'body', size: u(11), weight: 600, color: 'muted', letterSpacing: 0.26, transform: 'upper' }, overflow: 'shrink' };
        case 'date':
          return { id, kind: 'text', frame: centred(board, u(330), u(26)), content: { binding: 'event.startDate', format: 'dateWithWeekday' }, style: { font: 'heading', size: u(16), weight: 600, color: 'text', letterSpacing: 0.06, transform: 'upper' }, overflow: 'shrink' };
        default:
          return { id, kind: 'text', frame: centred(board, u(310), u(80)), content: { literal: 'Your text here' }, style: { font: 'body', size: u(15), color: 'text', lineHeight: 1.45 }, overflow: 'wrap' };
      }
    }
    case 'image': {
      const id = layerId('image', taken);
      if (preset.key === 'library') return { id, kind: 'image', frame: centred(board, u(240), u(240)), source: { type: 'asset', assetId: assetId ?? '00000000-0000-4000-8000-000000000000' }, fit: 'cover', mask: 'rounded', radius: u(18) };
      return { id, kind: 'image', frame: centred(board, u(240), u(320)), source: { type: 'binding', binding: preset.key === 'cover' ? 'photo.cover' : 'photos[0]' }, fit: 'cover', mask: 'arch', border: { width: u(4), color: 'surface' }, shadow: true, alt: '' };
    }
    case 'shape': {
      const id = layerId(preset.key, taken);
      if (preset.key === 'line') return { id, kind: 'shape', shape: 'line', frame: centred(board, u(120), u(2)), fill: { type: 'color', color: 'secondary' }, stroke: { width: 1, color: 'secondary' } };
      const size = preset.key === 'arch' ? [u(240), u(320)] : preset.key === 'scallop' ? [u(390), u(120)] : [u(200), u(200)];
      return { id, kind: 'shape', shape: preset.key, frame: centred(board, size[0]!, size[1]!), fill: { type: 'color', color: preset.key === 'rect' ? 'surface' : 'accent' }, radius: preset.key === 'rect' ? u(20) : 0, shadow: preset.key === 'rect' || preset.key === 'arch' };
    }
    case 'ornament': {
      const id = layerId(preset.key, taken);
      if (isIllustration(preset.key)) return { id, kind: 'ornament', ornament: preset.key, frame: illustrationFrame(preset.key, board, u), color: illustrationTint(preset.key) };
      const wide = new Set<OrnamentLayerName>(['toran', 'templeBorder', 'seaWaves', 'archFrame']);
      const tall = new Set<OrnamentLayerName>(['marigoldStrand', 'lantern', 'diya', 'kalash', 'gateLeaf']);
      const frame = wide.has(preset.key) ? { x: 0, y: 0, w: board.width, h: u(90) } : tall.has(preset.key) ? centred(board, u(80), u(200)) : centred(board, u(220), u(220));
      return { id, kind: 'ornament', ornament: preset.key, frame, color: 'secondary' };
    }
    case 'scene': {
      // Scenes are drawn on a 3:2 canvas anchored at the bottom centre: across the board, at the bottom.
      const h = Math.min(board.height, Math.round((board.width * 2) / 3));
      return { id: layerId(preset.key, taken), kind: 'scene', scene: preset.key, frame: { x: 0, y: board.height - h, w: board.width, h }, sky: true };
    }
    case 'icon':
      return { id: layerId(preset.key, taken), kind: 'icon', icon: preset.key, frame: centred(board, u(44), u(44)), color: 'primary', circle: 'accent' };
    case 'widget': {
      const id = layerId(preset.key, taken);
      if (preset.key === 'countdown') return { id, kind: 'widget', frame: centred(board, u(330), u(76)), widget: { type: 'countdown', variant: 'boxes', size: u(24), color: 'primary', labelColor: 'muted', boxColor: 'surface', font: 'heading' } };
      if (preset.key === 'details') return { id, kind: 'widget', frame: centred(board, u(318), u(190)), widget: { type: 'details', rows: ['date', 'time', 'venue'], icons: true, iconColor: 'primary', iconCircle: 'accent', labelColor: 'muted', valueColor: 'text', labelSize: u(9), valueSize: u(15), font: 'body', dividers: true, dividerColor: 'muted' } };
      return { id, kind: 'widget', frame: centred(board, u(180), u(46)), widget: { type: 'button', label: { t: 'template.getDirections' }, action: 'directions', icon: 'navigation', fill: 'primary', color: 'background', size: u(13), weight: 600, font: 'body', radius: u(40), shadow: true } };
    }
    default:
      return { id: layerId('text', taken), kind: 'text', frame: centred(board, u(310), u(60)), content: { literal: 'Text' } };
  }
}

/** A fresh canvas section: an empty phone artboard on the template's background colour. */
export function emptyCanvas(): { mobile: ArtboardInput; desktopMaxWidth: number; repeatPerFunction: boolean } {
  return { mobile: { width: 390, height: 844, background: { type: 'color', color: 'background' }, effect: 'none', layers: [] }, desktopMaxWidth: 480, repeatPerFunction: false };
}

/**
 * A desktop artboard to start from: the phone design scaled to the desktop
 * height and centred, so nothing has to be rebuilt from nothing.
 */
export function desktopFromMobile(mobile: Artboard): Artboard {
  const height = 900;
  const width = 1440;
  const s = height / mobile.height;
  const dx = (width - mobile.width * s) / 2;
  const scaleLayer = (layer: Artboard['layers'][number]): Artboard['layers'][number] => {
    const frame = { ...layer.frame, x: Math.round(layer.frame.x * s + dx), y: Math.round(layer.frame.y * s), w: Math.round(layer.frame.w * s), h: Math.round(layer.frame.h * s) };
    switch (layer.kind) {
      case 'text':
        return { ...layer, frame, style: { ...layer.style, size: Math.round(layer.style.size * s) } };
      case 'image':
        return { ...layer, frame, radius: Math.round(layer.radius * s), border: layer.border ? { ...layer.border, width: Math.round(layer.border.width * s) } : undefined };
      case 'shape':
        return { ...layer, frame, radius: Math.round(layer.radius * s), stroke: layer.stroke ? { ...layer.stroke, width: Math.round(layer.stroke.width * s) || 1 } : undefined };
      case 'widget':
        if (layer.widget.type === 'countdown') return { ...layer, frame, widget: { ...layer.widget, size: Math.round(layer.widget.size * s) } };
        if (layer.widget.type === 'button') return { ...layer, frame, widget: { ...layer.widget, size: Math.round(layer.widget.size * s), radius: Math.min(500, Math.round(layer.widget.radius * s)) } };
        return { ...layer, frame, widget: { ...layer.widget, labelSize: Math.round(layer.widget.labelSize * s), valueSize: Math.round(layer.widget.valueSize * s) } };
      default:
        return { ...layer, frame };
    }
  };
  return { ...mobile, width, height, layers: mobile.layers.map(scaleLayer) };
}
