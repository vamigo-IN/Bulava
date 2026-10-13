/**
 * Lookalikes retired from the catalog: each was another template's design for
 * the same occasion in a different colourway or on the other stock (the same
 * illustrations in the same places; designLook and heroSimilarity in
 * @bulava/template-schema), or a factory copy of a hand-made card. Each maps to
 * the template kept, which takes the retired one's colours as a preset, so no
 * colourway is lost. The seed soft-deletes these keys (RETIRED_TEMPLATE_KEYS);
 * events and cards already made with one keep working, and a film made from
 * one stays (canvas.ts retiredCanvasDesigns). Designs shared by different
 * occasions stay (each has its own wording), and galleries show them once.
 */
export const LOOKALIKES: Readonly<Record<string, string>> = {
  // Retired on 2026-10-09: the same art in the same places in another colourway (designLook).
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
  'panna-chandni-invite': 'chandni-raat-invite',
  'rajwada-chandni-invite': 'chandni-raat-invite',
  // Gudiya Muskaan (Birthday)
  'fiesta-snapshot-invite': 'gudiya-muskaan-invite',
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
  // Mudrika Vachan (Engagement)
  'mangni-sutra-invite': 'mudrika-vachan-invite',
  // Noor Mahal (Wedding)
  'zardozi-shab-invite': 'noor-mahal-card',
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
  'kohinoor-noor-invite': 'sona-sutra-invite',
  'mayur-sutra-invite': 'sona-sutra-invite',
  'neelam-moti-invite': 'sona-sutra-invite',
  'panna-sutra-invite': 'sona-sutra-invite',
  'rajwada-moti-invite': 'sona-sutra-invite',
  // Swagat Jashn (Reception)
  'velvet-soiree-invite': 'swagat-jashn-invite',
  // Swagat Pal (Reception)
  'velvet-glow-invite': 'swagat-pal-invite',
  // Teddy Bear (Birthday)
  'nanha-taara-invite': 'teddy-bear-invite',
  // Zardozi Zari (Wedding)
  'mehtab-sitara-invite': 'zardozi-zari-invite',

  // Retired on 2026-10-13: a hero as alike as HERO_LOOKALIKE or more to one kept for the occasion (heroSimilarity).
  // Bandhani Mehfil (Wedding)
  'rajwada-yaad-invite': 'bandhani-mehfil-invite',
  // Chandni Lamhe (Wedding)
  'sona-pal-invite': 'chandni-lamhe-invite',
  // Chandni Raat (Wedding)
  'kohinoor-raat-invite': 'chandni-raat-invite',
  // Chandni Saath (Wedding)
  'sona-jodi-invite': 'chandni-saath-invite',
  // Dehleez Swagat (Housewarming)
  'haven-doorway-invite': 'dehleez-swagat-invite',
  // Gudiya Muskaan (Birthday)
  'tara-shine-invite': 'gudiya-muskaan-invite',
  // Gudiya Rani (Birthday)
  'tara-glow-invite': 'gudiya-rani-invite',
  // Gulabi Jharna (Wedding)
  'mitti-diya-invite': 'gulabi-jharna-invite',
  'rajwada-darbar-invite': 'gulabi-jharna-invite',
  // Gulabi Rang (Wedding)
  'mayur-neel-invite': 'gulabi-rang-invite',
  // Gulal Abeer (Festival)
  'navrang-shakti-invite': 'gulal-abeer-invite',
  // Gulal Masti (Festival)
  'navrang-raas-invite': 'gulal-masti-invite',
  // Hariyali Bagh (Wedding)
  'gulaab-ishq-invite': 'hariyali-bagh-invite',
  // Hariyali Mausam (Wedding)
  'gulaab-mohabbat-invite': 'hariyali-mausam-invite',
  // Hariyali Patta (Wedding)
  'gulaab-phool-invite': 'hariyali-patta-invite',
  // Hariyali Saawan (Wedding)
  'gulaab-pyaar-invite': 'hariyali-saawan-invite',
  'lavanya-sapna-invite': 'hariyali-saawan-invite',
  // Haven Home (Housewarming)
  'vastu-deep-invite': 'haven-home-invite',
  // Haven Keys (Housewarming)
  'dehleez-sapna-invite': 'haven-keys-invite',
  // Heena Bel (Mehendi)
  'mehfil-mehrab-invite': 'heena-bel-invite',
  // Kanchi Kalyanam (Wedding)
  'kerala-mangalyam-invite': 'kanchi-kalyanam-invite',
  // Kanchi Malli (Wedding)
  'kerala-mullapoo-invite': 'kanchi-malli-invite',
  // Katha Mangal (Puja & Ceremonies)
  'aarti-om-invite': 'katha-mangal-invite',
  // Kerala Ormakal (Wedding)
  'kanchi-pattu-invite': 'kerala-ormakal-invite',
  // Kerala Pookalam (Wedding)
  'kanchi-muhurtham-invite': 'kerala-pookalam-invite',
  // Kerala Thali (Wedding)
  'paithani-nath-invite': 'kerala-thali-invite',
  // Kerala Vilakku (Wedding)
  'kanchi-kolam-invite': 'kerala-vilakku-invite',
  // Kesariya Aangan (Wedding)
  'bandhani-pol-invite': 'kesariya-aangan-invite',
  // Kesariya Utsav (Wedding)
  'bandhani-garba-invite': 'kesariya-utsav-invite',
  // Lily Moment (Wedding)
  'rosewood-forever-invite': 'lily-moment-invite',
  // Lily Veil (Wedding)
  'rosewood-ivory-invite': 'lily-veil-invite',
  // Mangni Gokh (Engagement)
  'sagai-haveli-invite': 'mangni-gokh-invite',
  // Mangni Pal (Engagement)
  'sagai-rasm-invite': 'mangni-pal-invite',
  // Mangni Toran (Engagement)
  'sagai-tilak-invite': 'mangni-toran-invite',
  // Mayur Kunj (Wedding)
  'kesariya-genda-invite': 'mayur-kunj-invite',
  'mitti-patte-invite': 'mayur-kunj-invite',
  'paithani-bel-invite': 'mayur-kunj-invite',
  // Mayur Mahal (Wedding)
  'panna-jharokha-invite': 'mayur-mahal-invite',
  // Mayur Rang (Wedding)
  'kesariya-saathi-invite': 'mayur-rang-invite',
  // Mehfil Noor (Mehendi)
  'heena-bootah-invite': 'mehfil-noor-invite',
  // Mehfil Shaam (Mehendi)
  'heena-rang-invite': 'mehfil-shaam-invite',
  // Neelam Yamuna (Wedding)
  'banaras-yaadein-invite': 'neelam-yamuna-invite',
  // Panna Mehrab (Wedding)
  'sona-kamaan-invite': 'panna-mehrab-invite',
  // Raja Beta (Birthday)
  'amrit-ashirwad-invite': 'raja-beta-invite',
  // Rajat Gulab (Anniversary)
  'humsafar-mausam-invite': 'rajat-gulab-invite',
  // Rajat Jayanti (Anniversary)
  'humsafar-safar-invite': 'rajat-jayanti-invite',
  // Rajat Lamhe (Anniversary)
  'humsafar-kahani-invite': 'rajat-lamhe-invite',
  // Rajwada Mandap (Wedding)
  'gulabi-hawa-invite': 'rajwada-mandap-invite',
  // Rajwada Milan (Wedding)
  'gulabi-shaam-invite': 'rajwada-milan-invite',
  'mayur-bagh-invite': 'rajwada-milan-invite',
  'neelam-raas-invite': 'rajwada-milan-invite',
  // Rajwada Roop (Wedding)
  'gulabi-rani-invite': 'rajwada-roop-invite',
  // Rajwada Varmala (Wedding)
  'panna-varmala-invite': 'rajwada-varmala-invite',
  // Rangeela Masti (Birthday)
  'blossom-grace-invite': 'rangeela-masti-invite',
  'glow-selfie-invite': 'rangeela-masti-invite',
  // Rosewood Chapel (Wedding)
  'lily-aisle-invite': 'rosewood-chapel-invite',
  // Rosewood Vows (Wedding)
  'lily-ever-after-invite': 'rosewood-vows-invite',
  // Shahi Gajraj (Wedding)
  'gulabi-mahal-invite': 'shahi-gajraj-card',
  'kohinoor-taj-invite': 'shahi-gajraj-card',
  // Sindoor Rajanigandha (Wedding)
  'kerala-thamara-invite': 'sindoor-rajanigandha-invite',
  // Sona Saath (Wedding)
  'chandni-taara-invite': 'sona-saath-invite',
  // Sona Sutra (Wedding)
  'chandni-rekha-invite': 'sona-sutra-invite',
  // Stork Dreams (Baby Shower)
  'lori-taare-invite': 'stork-dreams-invite',
  // Swagat Shaam (Reception)
  'velvet-gala-invite': 'swagat-shaam-invite',
  // Swagat Toast (Reception)
  'velvet-noir-invite': 'swagat-toast-invite',
  // Swarna Sutra (Anniversary)
  'manik-moti-invite': 'swarna-sutra-invite',
  // Tara Dreamer (Birthday)
  'fiesta-buddy-invite': 'tara-dreamer-invite',
  // Tara Wish (Birthday)
  'fiesta-hooray-invite': 'tara-wish-invite',
  // Teddy Hugs (Birthday)
  'cupcake-candy-invite': 'teddy-hugs-invite',
  'dino-dreams-invite': 'teddy-hugs-invite',
  'galaxy-orbit-invite': 'teddy-hugs-invite',
  'nanha-chanda-invite': 'teddy-hugs-invite',
  'tara-moon-invite': 'teddy-hugs-invite',
  'unicorn-dreams-invite': 'teddy-hugs-invite',
  // Valaikappu Kumkum (Baby Shower)
  'godh-nanhi-invite': 'valaikappu-kumkum-invite',
};
