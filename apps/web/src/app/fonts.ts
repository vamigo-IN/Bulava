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
 * Fonts are self-hosted by Next.js, and browsers only download a font file
 * when text actually uses it, so unused families cost nothing.
 */
const notoSans = Noto_Sans({ subsets: ['latin'], variable: '--font-noto-sans', display: 'swap' });
const notoSerif = Noto_Serif({ subsets: ['latin'], variable: '--font-noto-serif', display: 'swap' });
const notoDevanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], weight: ['400', '600', '700'], variable: '--font-noto-devanagari', display: 'swap' });
const notoSerifDevanagari = Noto_Serif_Devanagari({ subsets: ['devanagari'], weight: ['400', '600', '700'], variable: '--font-noto-serif-devanagari', display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-cormorant', display: 'swap' });
const greatVibes = Great_Vibes({ subsets: ['latin'], weight: '400', variable: '--font-great-vibes', display: 'swap' });
const poppins = Poppins({ subsets: ['latin', 'devanagari'], weight: ['400', '500', '600', '700'], variable: '--font-poppins', display: 'swap' });
const tiro = Tiro_Devanagari_Hindi({ subsets: ['devanagari', 'latin'], weight: '400', variable: '--font-tiro-devanagari', display: 'swap' });
const cinzel = Cinzel({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-cinzel', display: 'swap' });
const pinyon = Pinyon_Script({ subsets: ['latin'], weight: '400', variable: '--font-pinyon', display: 'swap' });
const parisienne = Parisienne({ subsets: ['latin'], weight: '400', variable: '--font-parisienne', display: 'swap' });
const alexBrush = Alex_Brush({ subsets: ['latin'], weight: '400', variable: '--font-alex-brush', display: 'swap' });
const marcellus = Marcellus({ subsets: ['latin'], weight: '400', variable: '--font-marcellus', display: 'swap' });
const montserrat = Montserrat({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-montserrat', display: 'swap' });
const italiana = Italiana({ subsets: ['latin'], weight: '400', variable: '--font-italiana', display: 'swap' });
const yeseva = Yeseva_One({ subsets: ['latin'], weight: '400', variable: '--font-yeseva', display: 'swap' });
const rozha = Rozha_One({ subsets: ['latin', 'devanagari'], weight: '400', variable: '--font-rozha', display: 'swap' });
const yatra = Yatra_One({ subsets: ['latin', 'devanagari'], weight: '400', variable: '--font-yatra', display: 'swap' });

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
