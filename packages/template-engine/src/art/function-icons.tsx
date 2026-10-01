import type { ReactElement } from 'react';

/**
 * A small motif for each kind of function, chosen from the function's name
 * (English, Hinglish and Hindi spellings). Line art in currentColor. Unknown
 * names get a neutral sparkle, so any event type works without configuration.
 */

type Motif = 'haldi' | 'mehendi' | 'sangeet' | 'baraat' | 'wedding' | 'reception' | 'engagement' | 'puja' | 'cocktail' | 'nikah' | 'church' | 'birthday' | 'music' | 'meal' | 'sparkle';

const RULES: Array<[RegExp, Motif]> = [
  [/haldi|pithi|ubtan|हल्दी/i, 'haldi'],
  [/mehe?n?di|mehndi|henna|मेहंदी|मेंहदी/i, 'mehendi'],
  [/sangeet|garba|dandiya|ladies|संगीत/i, 'sangeet'],
  [/baraat|barat|ghodi|बारात/i, 'baraat'],
  [/nikah|walima|निकाह/i, 'nikah'],
  [/church|holy|mass|chapel/i, 'church'],
  [/reception|recepti|स्वागत/i, 'reception'],
  [/engage|sagai|roka|ring|सगाई|रोका/i, 'engagement'],
  [/birthday|janamdin|bday|जन्मदिन/i, 'birthday'],
  [/wedding|vivah|vivaah|shaadi|shadi|pheras?|lagan|muhurtham|kalyanam|anand karaj|विवाह|शादी|फेरे/i, 'wedding'],
  [/puja|pooja|havan|katha|griha|satsang|tilak|पूजा|हवन|तिलक/i, 'puja'],
  [/cocktail|party|after ?party/i, 'cocktail'],
  [/dj|concert|night|music/i, 'music'],
  [/lunch|brunch|breakfast|bhoj|dinner|भोज/i, 'meal'],
];

export function motifFor(name: string): Motif {
  for (const [re, motif] of RULES) if (re.test(name)) return motif;
  return 'sparkle';
}

// Built on first use, not at import: the video renderer defines React only after its modules load.
const paths = (): Record<Motif, ReactElement> => ({
  haldi: (
    <>
      <path d="M8 24 H40 C40 34 33 40 24 40 C15 40 8 34 8 24Z" />
      <path d="M12 24 C16 20 32 20 36 24" />
      <circle cx="18" cy="15" r="3" />
      <circle cx="26" cy="12" r="2.5" />
      <path d="M31 17 C33 13 36 12 38 13" />
    </>
  ),
  mehendi: (
    <>
      <path d="M17 42 V26 L13 18 C12 15 15 13 17 15 L20 20 V9 C20 6 24 6 24 9 V19 V7 C24 4 28 4 28 7 V19 V9 C28 6 32 6 32 9 V20 V13 C32 10 36 10 36 13 V30 C36 37 32 42 26 42Z" />
      <circle cx="28" cy="29" r="3.5" />
      <path d="M28 25.5 V23 M28 35 V32.5 M24.5 29 H22 M34 29 H31.5" />
    </>
  ),
  sangeet: (
    <>
      <path d="M10 16 C10 12 38 12 38 16 V32 C38 36 10 36 10 32Z" />
      <ellipse cx="24" cy="16" rx="14" ry="4" />
      <path d="M13 18 L22 33 M35 18 L26 33" />
      <path d="M40 8 L34 14 M8 8 L14 14" />
    </>
  ),
  baraat: (
    <>
      <path d="M24 6 V12 M10 20 C10 12 38 12 38 20Z" />
      <path d="M24 20 V26" />
      <path d="M14 42 L16 32 C12 30 12 24 18 24 H30 C34 24 36 28 34 32 L36 42" />
      <path d="M30 24 C31 20 35 19 37 22" />
      <path d="M12 20 V24 M36 20 V24" />
    </>
  ),
  wedding: (
    <>
      <path d="M24 8 C28 14 30 18 24 24 C18 18 20 14 24 8Z" />
      <path d="M24 16 C26 19 26 21 24 23 C22 21 22 19 24 16Z" />
      <path d="M10 30 H38 L34 40 H14Z" />
      <path d="M8 30 H40" />
      <path d="M17 26 L15 30 M31 26 L33 30" />
    </>
  ),
  reception: (
    <>
      <path d="M14 8 H22 L21 18 C21 22 15 22 15 18Z" />
      <path d="M26 8 H34 L33 18 C33 22 27 22 27 18Z" />
      <path d="M18 22 V36 M30 22 V36 M13 36 H23 M25 36 H35" />
      <path d="M20 4 L24 1 L28 4" />
    </>
  ),
  engagement: (
    <>
      <circle cx="19" cy="28" r="10" />
      <circle cx="29" cy="28" r="10" />
      <path d="M26 14 L29 9 L32 14 L29 18Z" />
    </>
  ),
  puja: (
    <>
      <path d="M8 32 C12 40 36 40 40 32 C32 35 16 35 8 32Z" />
      <path d="M24 14 C28 20 28 24 24 29 C20 24 20 20 24 14Z" />
      <path d="M8 32 C16 30 32 30 40 32" />
      <path d="M24 42 V46" />
    </>
  ),
  cocktail: (
    <>
      <path d="M10 10 H38 L24 26Z" />
      <path d="M24 26 V40 M16 40 H32" />
      <circle cx="33" cy="8" r="4" />
    </>
  ),
  nikah: (
    <>
      <path d="M30 8 A14 14 0 1 0 38 30 A11 11 0 1 1 30 8Z" />
      <path d="M36 12 L37.5 15.5 L41 16 L38.5 18.5 L39 22 L36 20 L33 22 L33.5 18.5 L31 16 L34.5 15.5Z" />
    </>
  ),
  church: (
    <>
      <path d="M24 4 V14 M19 9 H29" />
      <path d="M14 42 V24 L24 14 L34 24 V42Z" />
      <path d="M20 42 V33 C20 29 28 29 28 33 V42" />
    </>
  ),
  birthday: (
    <>
      <path d="M10 26 H38 V40 H10Z" />
      <path d="M10 32 C14 35 18 29 22 32 C26 35 30 29 34 32 C36 33 37 33 38 32" />
      <path d="M17 26 V20 M24 26 V20 M31 26 V20" />
      <path d="M17 17 C18 15 16 14 17 12 M24 17 C25 15 23 14 24 12 M31 17 C32 15 30 14 31 12" />
    </>
  ),
  music: (
    <>
      <path d="M18 34 V12 L36 8 V30" />
      <circle cx="14" cy="34" r="4" />
      <circle cx="32" cy="30" r="4" />
    </>
  ),
  meal: (
    <>
      <circle cx="24" cy="26" r="12" />
      <circle cx="24" cy="26" r="7" />
      <path d="M6 12 V22 C6 24 10 24 10 22 V12 M8 24 V40 M42 12 C38 14 38 22 42 24 V40" />
    </>
  ),
  sparkle: (
    <>
      <path d="M24 6 L27 21 L42 24 L27 27 L24 42 L21 27 L6 24 L21 21Z" />
      <path d="M38 8 L39 12 L43 13 L39 14 L38 18 L37 14 L33 13 L37 12Z" />
    </>
  ),
});
let cache: Record<Motif, ReactElement> | undefined;

export function FunctionMotif({ name, className }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(cache ??= paths())[motifFor(name)]}
    </svg>
  );
}
