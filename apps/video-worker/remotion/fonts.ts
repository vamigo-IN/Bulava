import { loadFont as alexBrush } from '@remotion/google-fonts/AlexBrush';
import { loadFont as cinzel } from '@remotion/google-fonts/Cinzel';
import { loadFont as cormorant } from '@remotion/google-fonts/CormorantGaramond';
import { loadFont as greatVibes } from '@remotion/google-fonts/GreatVibes';
import { loadFont as italiana } from '@remotion/google-fonts/Italiana';
import { loadFont as marcellus } from '@remotion/google-fonts/Marcellus';
import { loadFont as montserrat } from '@remotion/google-fonts/Montserrat';
import { loadFont as notoSans } from '@remotion/google-fonts/NotoSans';
import { loadFont as notoSansDevanagari } from '@remotion/google-fonts/NotoSansDevanagari';
import { loadFont as notoSerif } from '@remotion/google-fonts/NotoSerif';
import { loadFont as notoSerifDevanagari } from '@remotion/google-fonts/NotoSerifDevanagari';
import { loadFont as parisienne } from '@remotion/google-fonts/Parisienne';
import { loadFont as pinyon } from '@remotion/google-fonts/PinyonScript';
import { loadFont as playfair } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as poppins } from '@remotion/google-fonts/Poppins';
import { loadFont as rozha } from '@remotion/google-fonts/RozhaOne';
import { loadFont as tiro } from '@remotion/google-fonts/TiroDevanagariHindi';
import { loadFont as yatra } from '@remotion/google-fonts/YatraOne';
import { loadFont as yeseva } from '@remotion/google-fonts/YesevaOne';

/**
 * Fonts referenced by template definitions (FONT_FAMILIES in @bulava/template-schema).
 * Loaded under their real family names so the engine's font stacks resolve.
 */
export function loadTemplateFonts(): void {
  const load = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      console.warn('Font load failed', error);
    }
  };
  load(() => playfair('normal', { weights: ['400', '600', '700'], subsets: ['latin'] }));
  load(() => cormorant('normal', { weights: ['400', '600', '700'], subsets: ['latin'] }));
  load(() => greatVibes('normal', { weights: ['400'], subsets: ['latin'] }));
  load(() => poppins('normal', { weights: ['400', '600', '700'], subsets: ['latin', 'devanagari'] }));
  load(() => notoSans('normal', { weights: ['400', '600', '700'], subsets: ['latin'] }));
  load(() => notoSerif('normal', { weights: ['400', '600', '700'], subsets: ['latin'] }));
  load(() => notoSansDevanagari('normal', { weights: ['400', '600', '700'], subsets: ['devanagari', 'latin'] }));
  load(() => notoSerifDevanagari('normal', { weights: ['400', '600', '700'], subsets: ['devanagari', 'latin'] }));
  load(() => tiro('normal', { weights: ['400'], subsets: ['devanagari', 'latin'] }));
  // Font pairings (FONT_PAIRINGS): display serifs and scripts.
  load(() => cinzel('normal', { weights: ['400', '600', '700'], subsets: ['latin'] }));
  load(() => pinyon('normal', { weights: ['400'], subsets: ['latin'] }));
  load(() => parisienne('normal', { weights: ['400'], subsets: ['latin'] }));
  load(() => alexBrush('normal', { weights: ['400'], subsets: ['latin'] }));
  load(() => marcellus('normal', { weights: ['400'], subsets: ['latin'] }));
  load(() => montserrat('normal', { weights: ['400', '600', '700'], subsets: ['latin'] }));
  load(() => italiana('normal', { weights: ['400'], subsets: ['latin'] }));
  load(() => yeseva('normal', { weights: ['400'], subsets: ['latin'] }));
  load(() => rozha('normal', { weights: ['400'], subsets: ['devanagari', 'latin'] }));
  load(() => yatra('normal', { weights: ['400'], subsets: ['devanagari', 'latin'] }));
}
