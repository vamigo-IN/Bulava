import {
  Alex_Brush,
  Cinzel,
  Cormorant_Garamond,
  Great_Vibes,
  Italiana,
  Marcellus,
  Montserrat,
  Noto_Sans,
  Noto_Sans_Devanagari,
  Noto_Serif,
  Noto_Serif_Devanagari,
  Parisienne,
  Pinyon_Script,
  Playfair_Display,
  Poppins,
  Rozha_One,
  Tiro_Devanagari_Hindi,
  Yatra_One,
  Yeseva_One,
} from 'next/font/google';

/**
 * Every family a template may reference (FONT_FAMILIES in @bulava/template-schema),
 * exposed as the CSS variables the template engine expects (FONT_CSS_VARS).
 * Fonts are self-hosted by Next.js. Only the interface's own faces (Noto Sans
 * for text, Cormorant Garamond for headings) are preloaded; the template
 * families load when text uses them. Preloading all of them sent a `Link`
 * header of about 5 KB on every dynamic page (over the 4 KB proxy header
 * buffer of a stock Nginx, which answered 502) and made browsers download
 * dozens of font files they never used.
 */
const notoSans = Noto_Sans({ subsets: ['latin'], variable: '--font-noto-sans', display: 'swap' });
const notoSerif = Noto_Serif({ subsets: ['latin'], variable: '--font-noto-serif', display: 'swap', preload: false });
const notoDevanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], weight: ['400', '600', '700'], variable: '--font-noto-devanagari', display: 'swap', preload: false });
const notoSerifDevanagari = Noto_Serif_Devanagari({ subsets: ['devanagari'], weight: ['400', '600', '700'], variable: '--font-noto-serif-devanagari', display: 'swap', preload: false });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap', preload: false });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-cormorant', display: 'swap' });
const greatVibes = Great_Vibes({ subsets: ['latin'], weight: '400', variable: '--font-great-vibes', display: 'swap', preload: false });
const poppins = Poppins({ subsets: ['latin', 'devanagari'], weight: ['400', '500', '600', '700'], variable: '--font-poppins', display: 'swap', preload: false });
const tiro = Tiro_Devanagari_Hindi({ subsets: ['devanagari', 'latin'], weight: '400', variable: '--font-tiro-devanagari', display: 'swap', preload: false });
const cinzel = Cinzel({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-cinzel', display: 'swap', preload: false });
const pinyon = Pinyon_Script({ subsets: ['latin'], weight: '400', variable: '--font-pinyon', display: 'swap', preload: false });
const parisienne = Parisienne({ subsets: ['latin'], weight: '400', variable: '--font-parisienne', display: 'swap', preload: false });
const alexBrush = Alex_Brush({ subsets: ['latin'], weight: '400', variable: '--font-alex-brush', display: 'swap', preload: false });
const marcellus = Marcellus({ subsets: ['latin'], weight: '400', variable: '--font-marcellus', display: 'swap', preload: false });
const montserrat = Montserrat({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-montserrat', display: 'swap', preload: false });
const italiana = Italiana({ subsets: ['latin'], weight: '400', variable: '--font-italiana', display: 'swap', preload: false });
const yeseva = Yeseva_One({ subsets: ['latin'], weight: '400', variable: '--font-yeseva', display: 'swap', preload: false });
const rozha = Rozha_One({ subsets: ['latin', 'devanagari'], weight: '400', variable: '--font-rozha', display: 'swap', preload: false });
const yatra = Yatra_One({ subsets: ['latin', 'devanagari'], weight: '400', variable: '--font-yatra', display: 'swap', preload: false });

export const fontVariables = [
  notoSans,
  notoSerif,
  notoDevanagari,
  notoSerifDevanagari,
  playfair,
  cormorant,
  greatVibes,
  poppins,
  tiro,
  cinzel,
  pinyon,
  parisienne,
  alexBrush,
  marcellus,
  montserrat,
  italiana,
  yeseva,
  rozha,
  yatra,
]
  .map((f) => f.variable)
  .join(' ');
