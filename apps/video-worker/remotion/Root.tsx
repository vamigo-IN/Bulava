import { Composition } from 'remotion';
import { COMPOSITION_ID, TemplateVideo, templateVideoMetadata, type TemplateVideoProps } from '@bulava/video-engine';
import { loadTemplateFonts } from './fonts';

loadTemplateFonts();

const EMPTY: TemplateVideoProps = {
  definition: {
    schemaVersion: 1,
    templateKey: 'empty',
    type: 'VIDEO',
    name: 'Empty',
    description: '',
    eventTypes: [],
    languages: ['en'],
    theme: { colors: { primary: '#000000', secondary: '#888888', accent: '#cccccc', background: '#ffffff', surface: '#ffffff', text: '#000000', muted: '#666666' }, radius: 16, ornament: 'none', pattern: 'none', heroTone: 'light', look: 'classic', effect: 'none' },
    fonts: { heading: { family: 'Playfair Display', scripts: ['Latn'], fallbacks: {} }, body: { family: 'Noto Sans', scripts: ['Latn'], fallbacks: {} } },
    capabilities: { editable: { colors: false, fonts: false, music: false, background: false, layout: false, photos: false, text: false, animation: false }, colorPresets: [], textSlots: [], maxPhotos: 0, photoSlots: [] },
    assets: [],
    canvas: { width: 1080, height: 1920, fps: 30 },
    scenes: [],
  },
  context: {
    event: { title: '', description: null, typeKey: 'CUSTOM', startDate: null, endDate: null, language: 'en', timezone: 'Asia/Kolkata' },
    functions: [],
    gallery: { images: [] },
    photos: [],
    custom: {},
  },
  customization: null,
  language: 'en',
  watermark: false,
  musicUrl: null,
};

export function Root() {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={TemplateVideo}
      defaultProps={EMPTY}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={30}
      calculateMetadata={({ props }) => templateVideoMetadata(props)}
    />
  );
}
