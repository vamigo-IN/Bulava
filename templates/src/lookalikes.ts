/**
 * Lookalikes retired from the catalog on 2026-10-09: each was another
 * template's design for the same occasion in a different colourway (the same
 * illustrations in the same places, designLook in @bulava/template-schema),
 * or, for Rajwada Jharokha, a factory copy of a hand-made card. Each maps to
 * the template kept, which takes the retired one's colours as a preset, so no
 * colourway is lost. The seed soft-deletes these keys (RETIRED_TEMPLATE_KEYS);
 * events and cards already made with one keep working. Designs shared by
 * different occasions stay (each has its own wording), and galleries show
 * them once.
 */
export const LOOKALIKES: Readonly<Record<string, string>> = {
  // Bandhani Mehfil (Wedding)
  'gulabi-kali-invite': 'bandhani-mehfil-invite',
  'mayur-pal-invite': 'bandhani-mehfil-invite',
  // Cake & Candles (Birthday)
  'fiesta-cake-invite': 'cake-candles-card',
  'rangeela-dhamaal-invite': 'cake-candles-card',
  // Chandni Lamhe (Wedding)
  'kohinoor-chamak-invite': 'chandni-lamhe-invite',
  'panna-pal-invite': 'chandni-lamhe-invite',
  // Chandni Raat (Wedding)
  'neelam-sharad-invite': 'chandni-raat-invite',
  // Chandni Rekha (Wedding)
  'kohinoor-noor-invite': 'chandni-rekha-invite',
  'neelam-moti-invite': 'chandni-rekha-invite',
  'panna-sutra-invite': 'chandni-rekha-invite',
  'rajwada-moti-invite': 'chandni-rekha-invite',
  // Gulaab Ada (Wedding)
  'hariyali-jhula-invite': 'gulaab-ada-invite',
  // Gulabi Jharna (Wedding)
  'bandhani-chundadi-invite': 'gulabi-jharna-invite',
  // Hariyali Bagh (Wedding)
  'lavanya-bloom-invite': 'hariyali-bagh-invite',
  // Hariyali Hara (Wedding)
  'lavanya-shaanti-invite': 'hariyali-hara-invite',
  // Hariyali Kunj (Wedding)
  'gulaab-kunj-invite': 'hariyali-kunj-invite',
  // Hariyali Mausam (Wedding)
  'lavanya-khwab-invite': 'hariyali-mausam-invite',
  // Hariyali Patta (Wedding)
  'lavanya-megh-invite': 'hariyali-patta-invite',
  // Haven Home (Housewarming)
  'dehleez-chaukhat-invite': 'haven-home-invite',
  // Heena Haath (Mehendi)
  'mehendi-rang-card': 'heena-haath-invite',
  // Kerala Thali (Wedding)
  'kanchi-kumkum-invite': 'kerala-thali-invite',
  // Kohinoor Raat (Wedding)
  'panna-chandni-invite': 'kohinoor-raat-invite',
  'rajwada-chandni-invite': 'kohinoor-raat-invite',
  // Kovil Mani (Wedding)
  'kanchi-deepa-invite': 'kovil-mani-card',
  // Mayur Kunj (Wedding)
  'bandhani-phool-invite': 'mayur-kunj-invite',
  'gulabi-bagicha-invite': 'mayur-kunj-invite',
  // Mayur Mahal (Wedding)
  'paithani-wada-invite': 'mayur-mahal-invite',
  // Mayur Pankh (Wedding)
  'paithani-mor-invite': 'mayur-pankh-invite',
  // Mehtab Darwaza (Wedding)
  'zardozi-darbar-invite': 'mehtab-darwaza-invite',
  // Mehtab Jharokha (Wedding)
  'zardozi-haveli-invite': 'mehtab-jharokha-invite',
  // Mehtab Qubool (Wedding)
  'zardozi-mubarak-invite': 'mehtab-qubool-invite',
  // Mehtab Raat (Wedding)
  'zardozi-shab-invite': 'mehtab-raat-invite',
  // Mudrika Vachan (Engagement)
  'mangni-sutra-invite': 'mudrika-vachan-invite',
  // Panna Mehrab (Wedding)
  'chandni-mehrab-invite': 'panna-mehrab-invite',
  'kohinoor-mehrab-invite': 'panna-mehrab-invite',
  // Rajwada Mandap (Wedding)
  'kohinoor-mahal-invite': 'rajwada-mandap-invite',
  'panna-mandap-invite': 'rajwada-mandap-invite',
  // Rajwada Milan (Wedding)
  'kohinoor-heera-invite': 'rajwada-milan-invite',
  'panna-raas-invite': 'rajwada-milan-invite',
  // Rajwada Roop (Wedding)
  'kohinoor-ratna-invite': 'rajwada-roop-invite',
  'panna-shringar-invite': 'rajwada-roop-invite',
  // Rangeela Masti (Birthday)
  'nanha-muskaan-invite': 'rangeela-masti-invite',
  // Rosewood Arbour (Wedding)
  'lily-arch-invite': 'rosewood-arbour-invite',
  // Rosewood Garden (Wedding)
  'lily-bouquet-invite': 'rosewood-garden-invite',
  // Shahi Gajraj (Wedding)
  'rajwada-jharokha-invite': 'shahi-gajraj-card',
  // Sona Sutra (Wedding)
  'bandhani-kanku-invite': 'sona-sutra-invite',
  'gulaab-pankhudi-invite': 'sona-sutra-invite',
  'gulabi-pankhuri-invite': 'sona-sutra-invite',
  'mayur-sutra-invite': 'sona-sutra-invite',
  // Swagat Jashn (Reception)
  'velvet-soiree-invite': 'swagat-jashn-invite',
  // Swagat Pal (Reception)
  'velvet-glow-invite': 'swagat-pal-invite',
  // Tara Shine (Birthday)
  'fiesta-snapshot-invite': 'tara-shine-invite',
  // Teddy Bear (Birthday)
  'nanha-taara-invite': 'teddy-bear-invite',
  // Zardozi Zari (Wedding)
  'mehtab-sitara-invite': 'zardozi-zari-invite',
};
