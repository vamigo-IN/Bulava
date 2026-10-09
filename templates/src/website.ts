import { INVOCATION, palette, website, type CatalogEntry, type WebsiteSpec } from './builder';
import { SIGNATURE_SPECS } from './signature';
import { LOOKALIKES } from './lookalikes';

const W = ['WEDDING'];
const WE = ['WEDDING', 'ENGAGEMENT'];

/**
 * Every website template in the catalog. Order = default display order.
 * Each template has its own design language (look), so templates differ all
 * the way down the page, not only in the hero. Illustrated 3D scene heroes
 * (gopuram, palace, toran, arches, lotus, mandap, noir, floral, sarovar,
 * backwaters, balloons) carry the flagship designs.
 */
const SPECS: WebsiteSpec[] = [
  // ───────────── Weddings: the flagship scene collection ─────────────
  {
    key: 'marigold-mahal', name: 'Marigold Mahal', category: 'Wedding', style: 'Heritage', tier: 'PREMIUM', badge: 'NEW', featured: true,
    description: 'Marigold torans, brass bells and flickering diyas over crimson and saffron bands. A joyful North Indian wedding invitation that opens behind a velvet curtain.',
    tags: ['signature', 'hindu', 'north-indian', 'heritage', 'traditional'], eventTypes: W, layout: 'signature-wedding',
    colors: palette('#a3123a', '#e8891d', '#f6c343', '#fff8ec', '#fdf0d8', '#3b1410', '#7c4a3c'),
    presets: [
      { name: 'Crimson & Marigold', colors: palette('#a3123a', '#e8891d', '#f6c343', '#fff8ec', '#fdf0d8', '#3b1410', '#7c4a3c') },
      { name: 'Rani Pink', colors: palette('#b0145f', '#f08c1f', '#f9c74f', '#fff6f3', '#fde9e4', '#3a0f22', '#7d4a5c') },
      { name: 'Haldi Sunset', colors: palette('#9a3412', '#dd6b20', '#fbd05d', '#fffaf0', '#fdefd0', '#3a1a08', '#7a5335') },
    ],
    look: 'heritage', effect: 'marigold', heroTone: 'dark', fonts: 'grand', ornament: 'mandala', pattern: 'none',
    hero: 'toran', timeline: 'diya', couple: 'arch', gallery: 'mosaic', story: 'curtain', countdown: 'flip',
    intro: 'curtain', invocation: INVOCATION.hindu, music: true,
  },
  {
    key: 'kanjeevaram-gold', name: 'Divine Gopuram', category: 'Wedding', style: 'Temple', tier: 'PREMIUM', badge: 'POPULAR', featured: true,
    description: 'A sunrise temple gopuram with carved pillars, bells and marigold strands in layered 3D. Temple red and zari gold for Tamil, Telugu and Kannada weddings.',
    tags: ['signature', 'south-indian', 'tamil', 'telugu', 'traditional'], eventTypes: W, layout: 'signature-wedding',
    colors: palette('#8a0f1f', '#b8862c', '#f0c75e', '#fdf6e7', '#fbecd0', '#2d1a0f', '#7d6248'),
    presets: [
      { name: 'Temple Red', colors: palette('#8a0f1f', '#b8862c', '#f0c75e', '#fdf6e7', '#fbecd0', '#2d1a0f', '#7d6248') },
      { name: 'Peacock Silk', colors: palette('#0b4f6c', '#b8862c', '#f0c75e', '#f4f9f8', '#e6f0ee', '#10262f', '#557079') },
    ],
    look: 'heritage', effect: 'marigold', fonts: 'grand', ornament: 'mandala', pattern: 'none',
    hero: 'gopuram', timeline: 'tickets', couple: 'arch', gallery: 'mosaic', story: 'polaroid', countdown: 'flip',
    intro: 'envelope', invocation: INVOCATION.tamil, music: true,
  },
  {
    key: 'rajwada-royale', name: 'Rajwada Royale', category: 'Wedding', style: 'Royal', tier: 'PREMIUM', badge: 'BESTSELLER', featured: true,
    description: 'A lakeside palace by moonlight, lanterns rising over the water. Maroon, ivory and antique gold for grand Rajasthani and destination weddings.',
    tags: ['signature', 'hindu', 'rajasthani', 'royal', 'destination'], eventTypes: W, layout: 'signature-wedding',
    colors: palette('#5a0f1f', '#b8892b', '#f1d9a0', '#fbf6ec', '#fffdf8', '#2b1b17', '#7a6558'),
    presets: [
      { name: 'Maroon & Gold', colors: palette('#5a0f1f', '#b8892b', '#f1d9a0', '#fbf6ec', '#fffdf8', '#2b1b17', '#7a6558') },
      { name: 'Emerald Durbar', colors: palette('#0f3d2e', '#b8892b', '#e9d8a6', '#f7f4ea', '#fffdf6', '#1c2420', '#5f6f66') },
      { name: 'Royal Indigo', colors: palette('#1e2a5a', '#c29b3c', '#efd9a0', '#f8f6f0', '#ffffff', '#1a1d2e', '#5d6380') },
    ],
    look: 'royal', effect: 'lanterns', heroTone: 'dark', fonts: 'regal', ornament: 'mandala', pattern: 'jaali',
    hero: 'palace', timeline: 'tickets', couple: 'arch', gallery: 'mosaic', story: 'curtain', countdown: 'flip',
    intro: 'gates', invocation: INVOCATION.hindu, music: true,
  },
  {
    key: 'noor-e-nikah', name: 'Noor-e-Nikah', category: 'Wedding', style: 'Royal', tier: 'PREMIUM', badge: 'NEW', featured: true,
    description: 'Walk through receding palace arches toward the light: emerald and gold, gold dust in the air, beginning with Bismillah. For Nikah, Walima and Mehndi.',
    tags: ['signature', 'muslim', 'nikah', 'royal'], eventTypes: W, layout: 'signature-wedding',
    colors: palette('#064e3b', '#c9a227', '#f3e3a3', '#f8f5ec', '#fffdf5', '#10231c', '#5b6f65'),
    presets: [
      { name: 'Emerald', colors: palette('#064e3b', '#c9a227', '#f3e3a3', '#f8f5ec', '#fffdf5', '#10231c', '#5b6f65') },
      { name: 'Midnight Blue', colors: palette('#0f1e3d', '#c9a227', '#f3e3a3', '#f5f6f8', '#ffffff', '#101828', '#5b6478') },
    ],
    look: 'royal', effect: 'goldDust', heroTone: 'dark', fonts: 'romantic', ornament: 'geometric', pattern: 'jaali',
    hero: 'arches', timeline: 'cards', couple: 'flip', gallery: 'stack', story: 'polaroid', countdown: 'flip',
    intro: 'doors', invocation: INVOCATION.muslim, music: true,
  },
  {
    key: 'anand-karaj', name: 'Anand Karaj', category: 'Wedding', style: 'Traditional', tier: 'PREMIUM', featured: true,
    description: 'Golden domes over a still sarovar at dusk, diyas along the water. Royal blue and kesari saffron for the Sikh wedding ceremony, opening with Ik Onkar.',
    tags: ['signature', 'sikh', 'punjabi', 'traditional'], eventTypes: W, layout: 'signature-wedding',
    colors: palette('#1e3a8a', '#e07b00', '#fbbf24', '#fffaf2', '#fff3de', '#172033', '#5b6478'),
    look: 'royal', effect: 'goldDust', heroTone: 'dark', fonts: 'grand', ornament: 'geometric', pattern: 'jaali',
    hero: 'sarovar', timeline: 'diya', couple: 'arch', gallery: 'stack', story: 'default', countdown: 'flip',
    intro: 'doors', invocation: INVOCATION.sikh, music: true,
  },
  {
    key: 'mangal-mandap', name: 'Mangal Mandap', category: 'Wedding', style: 'Traditional', tier: 'PREMIUM', badge: 'POPULAR',
    description: 'Under the mandap: draped canopy, marigold strands, kalash and the sacred fire. Sindoor red and marigold for the pheras.',
    tags: ['signature', 'hindu', 'north-indian', 'traditional'], eventTypes: W, layout: 'signature-wedding',
    colors: palette('#9b1c1c', '#e8891d', '#fcd34d', '#fff8ee', '#fdeed6', '#3b1a12', '#8a5a44'),
    look: 'heritage', effect: 'petals', fonts: 'heritage', ornament: 'mandala', pattern: 'none',
    hero: 'mandap', timeline: 'diya', couple: 'flip', gallery: 'polaroid', story: 'polaroid', countdown: 'flip',
    intro: 'curtain', invocation: INVOCATION.hindu, music: true,
  },
  {
    key: 'midnight-gold', name: 'Midnight Gold', category: 'Wedding', style: 'Modern', tier: 'PREMIUM', badge: 'NEW', featured: true,
    description: 'Black-tie luxury: a spotlit gold medallion, floating light and a spinning vinyl for your song. Onyx and champagne for city weddings and receptions.',
    tags: ['signature', 'modern', 'luxury', 'reception'], eventTypes: WE, layout: 'signature-wedding',
    colors: palette('#12100e', '#8a6d3b', '#d4af6a', '#0f0e0d', '#181614', '#f3ede2', '#a39a8c'),
    presets: [
      { name: 'Onyx & Champagne', colors: palette('#12100e', '#8a6d3b', '#d4af6a', '#0f0e0d', '#181614', '#f3ede2', '#a39a8c') },
      { name: 'Velvet Wine', colors: palette('#2a0c16', '#8c5a6a', '#e3b37a', '#140a0e', '#1e1116', '#f6ece8', '#b39aa2') },
      { name: 'Ink Blue', colors: palette('#0b1426', '#5f7aa8', '#e2c48e', '#0a0f1c', '#121a2c', '#eef1f7', '#9aa6bd') },
    ],
    look: 'noir', effect: 'goldDust', fonts: 'romantic', ornament: 'geometric', pattern: 'none',
    hero: 'noir', timeline: 'tickets', couple: 'profile', gallery: 'stack', story: 'curtain', countdown: 'flip',
    intro: 'curtain', music: true,
  },
  {
    key: 'blush-and-bloom', name: 'Blush & Bloom', category: 'Wedding', style: 'Floral', tier: 'STANDARD', badge: 'POPULAR',
    description: 'A layered arch of roses in blush and sage, butterflies and a drift of petals. Romantic and modern for any tradition.',
    tags: ['floral', 'modern', 'pastel', 'romantic'], eventTypes: WE, layout: 'wedding',
    colors: palette('#9d4d5e', '#8fa98a', '#f4c2c2', '#fdf8f7', '#fbeeee', '#3a2328', '#86666c'),
    presets: [
      { name: 'Blush', colors: palette('#9d4d5e', '#8fa98a', '#f4c2c2', '#fdf8f7', '#fbeeee', '#3a2328', '#86666c') },
      { name: 'Lavender', colors: palette('#6b4f8f', '#8fa98a', '#e4d3f5', '#fbf9fe', '#f3edfb', '#2a2138', '#76698a') },
    ],
    look: 'garden', effect: 'petals', fonts: 'romantic', ornament: 'floral', pattern: 'none',
    hero: 'floral', timeline: 'timeline', couple: 'flip', gallery: 'polaroid', story: 'polaroid', countdown: 'flip', intro: 'petals',
  },
  {
    key: 'shubho-bibaho', name: 'Shubho Bibaho', category: 'Wedding', style: 'Traditional', tier: 'STANDARD',
    description: 'A lotus pond with floating diyas, in alta red and white with alpana-style bands. Made for Bengali weddings.',
    tags: ['bengali', 'traditional'], eventTypes: W, layout: 'wedding',
    colors: palette('#b91c1c', '#3d7f7a', '#f5c451', '#fffdf9', '#fdf1ec', '#2b1310', '#7f5a4f'),
    look: 'heritage', effect: 'petals', fonts: 'royal', ornament: 'lotus', pattern: 'none',
    hero: 'lotus', timeline: 'cards', couple: 'arch', gallery: 'mosaic', countdown: 'flip', invocation: INVOCATION.bengali,
  },
  {
    key: 'kerala-kasavu', name: 'Kerala Kasavu', category: 'Wedding', style: 'Minimal', tier: 'STANDARD',
    description: 'Backwaters at golden hour, coconut palms and a houseboat, finished with a kasavu gold border. Serene ivory and leaf green for Malayali weddings.',
    tags: ['south-indian', 'malayali', 'minimal', 'destination'], eventTypes: W, layout: 'wedding',
    colors: palette('#6b5a1e', '#2f6b3f', '#e9c46a', '#fbf9f2', '#f3efe0', '#2a2618', '#7a7258'),
    look: 'classic', effect: 'none', fonts: 'editorial', ornament: 'floral', pattern: 'none',
    hero: 'backwaters', timeline: 'timeline', couple: 'default', gallery: 'polaroid', story: 'polaroid', invocation: INVOCATION.tamil,
  },
  {
    key: 'paithani-grace', name: 'Paithani Grace', category: 'Wedding', style: 'Traditional', tier: 'STANDARD',
    description: 'Paithani purple and parrot green with swaying peacock feathers and gold filigree frames for Marathi weddings.',
    tags: ['marathi', 'traditional'], eventTypes: W, layout: 'wedding',
    colors: palette('#4c1d6f', '#2f7d32', '#d4af37', '#fbf8fd', '#f4ecf9', '#221530', '#6b5a7a'),
    look: 'royal', effect: 'goldDust', heroTone: 'dark', fonts: 'heritage', ornament: 'paisley', pattern: 'none',
    hero: 'peacock', timeline: 'cards', couple: 'arch', gallery: 'mosaic', countdown: 'flip', invocation: INVOCATION.marathi,
  },
  {
    key: 'bandhani-bliss', name: 'Bandhani Bliss', category: 'Wedding', style: 'Festive', tier: 'STANDARD',
    description: 'Bandhani pink and haldi orange, marigold torans and confetti bands for vibrant Gujarati and garba-filled weddings.',
    tags: ['gujarati', 'festive'], eventTypes: W, layout: 'wedding',
    colors: palette('#be185d', '#ea580c', '#fde047', '#fff7f9', '#ffeef3', '#3a0f22', '#835469'),
    look: 'celebration', effect: 'confetti', heroTone: 'dark', fonts: 'desi', ornament: 'paisley', pattern: 'dots',
    hero: 'toran', timeline: 'tickets', couple: 'flip', gallery: 'mosaic', invocation: INVOCATION.gujarati,
  },
  {
    key: 'chapel-vows', name: 'Chapel Vows', category: 'Wedding', style: 'Floral', tier: 'STANDARD',
    description: 'Ivory, sage and blush florals for church weddings, with your portrait in an arch and a verse to open.',
    tags: ['christian', 'floral', 'church'], eventTypes: W, layout: 'wedding',
    colors: palette('#4d5b3f', '#b89b72', '#e8c7c8', '#fbfaf6', '#f3f1ea', '#252a20', '#6e7566'),
    look: 'garden', effect: 'petals', fonts: 'elegant', ornament: 'floral', pattern: 'none',
    hero: 'split', timeline: 'timeline', couple: 'default', gallery: 'polaroid', invocation: INVOCATION.christian,
  },
  {
    key: 'shaadi-simple', name: 'Shaadi Simple', category: 'Wedding', style: 'Minimal', tier: 'FREE',
    description: 'A clean, readable one-page wedding invitation with schedule, venue and RSVP. Free forever.',
    tags: ['minimal', 'hindu', 'free'], eventTypes: W, layout: 'wedding-lite',
    colors: palette('#7c2d12', '#b45309', '#fcd9a8', '#fffbf5', '#fbf1e4', '#292018', '#766555'),
    look: 'classic', fonts: 'classic', ornament: 'none', pattern: 'none', hero: 'classic', timeline: 'cards', invocation: INVOCATION.hindu,
  },

  // ───────────── Pre-wedding & functions ─────────────
  {
    key: 'golden-hour-save-the-date', name: 'Golden Hour', category: 'Save the Date', style: 'Modern', tier: 'FREE', badge: 'POPULAR',
    description: 'A single-screen save-the-date with your photo and a flip-clock countdown. Send it months before the invitations.',
    tags: ['save-the-date', 'modern'], eventTypes: WE, layout: 'save-the-date',
    colors: palette('#7a4b16', '#d4a24c', '#f6e3b8', '#fdf9f1', '#f7eedd', '#2a1d0e', '#7c6a52'),
    look: 'modern', effect: 'goldDust', fonts: 'editorial', ornament: 'none', pattern: 'none', hero: 'photo', timeline: 'cards', countdown: 'flip',
  },
  {
    key: 'haldi-sunshine', name: 'Haldi Sunshine', category: 'Haldi', style: 'Festive', tier: 'STANDARD',
    description: 'Turmeric yellow and fresh-leaf green under a marigold toran, with petals in the air for Haldi and Pithi.',
    tags: ['haldi', 'hindu', 'festive'], eventTypes: W, layout: 'pre-wedding',
    colors: palette('#a16207', '#16a34a', '#fde047', '#fffbeb', '#fdf3c7', '#3b2a05', '#7a6a3a'),
    look: 'celebration', effect: 'marigold', heroTone: 'dark', fonts: 'desi', ornament: 'floral', pattern: 'dots', hero: 'toran', timeline: 'tickets',
  },
  {
    key: 'mehendi-leaf', name: 'Mehendi Leaf', category: 'Mehendi', style: 'Festive', tier: 'STANDARD', badge: 'NEW',
    description: 'Henna green and terracotta florals in a layered garden arch for Mehendi afternoons.',
    tags: ['mehendi', 'festive'], eventTypes: W, layout: 'pre-wedding',
    colors: palette('#3f6212', '#c2410c', '#fcd9a8', '#f9faf3', '#eef2e1', '#1f2a10', '#687252'),
    look: 'garden', effect: 'petals', fonts: 'romantic', ornament: 'paisley', pattern: 'none', hero: 'floral', timeline: 'tickets',
  },
  {
    key: 'sangeet-soiree', name: 'Sangeet Soirée', category: 'Sangeet', style: 'Party', tier: 'STANDARD',
    description: 'Jewel purple and gold with a spotlight, floating lights and confetti for a night of music, dance and dhol.',
    tags: ['sangeet', 'party'], eventTypes: W, layout: 'pre-wedding',
    colors: palette('#2e1065', '#eab308', '#f472b6', '#140b24', '#1f1236', '#f7f1ff', '#b6a6d1'),
    look: 'noir', effect: 'confetti', fonts: 'modern', ornament: 'confetti', pattern: 'none', hero: 'noir', timeline: 'tickets',
  },
  {
    key: 'champagne-reception', name: 'Champagne Reception', category: 'Reception', style: 'Elegant', tier: 'STANDARD',
    description: 'Champagne, ivory and black in an editorial layout for an elegant evening reception.',
    tags: ['reception', 'elegant'], eventTypes: W, layout: 'wedding-lite',
    colors: palette('#1c1917', '#b69567', '#ecdcc0', '#faf8f4', '#f1ece3', '#1c1917', '#6b645c'),
    look: 'modern', effect: 'goldDust', fonts: 'editorial', ornament: 'none', pattern: 'none', hero: 'minimal', timeline: 'timeline',
  },
  {
    key: 'ring-ceremony', name: 'Ring Ceremony', category: 'Engagement', style: 'Romantic', tier: 'STANDARD',
    description: 'Rose gold and ivory with flip-over portraits for engagements and roka ceremonies.',
    tags: ['engagement', 'roka', 'romantic'], eventTypes: ['ENGAGEMENT'], layout: 'engagement',
    colors: palette('#8c4a5a', '#b76e79', '#f3d1d6', '#fdf8f8', '#f9ecee', '#3a2328', '#86666c'),
    look: 'garden', effect: 'petals', fonts: 'romantic', ornament: 'floral', pattern: 'none', hero: 'split', timeline: 'cards', couple: 'flip', gallery: 'stack', countdown: 'flip',
  },

  // ───────────── Birthdays, anniversaries, family ceremonies ─────────────
  {
    key: 'tiny-treasures', name: 'Tiny Treasures', category: 'Birthday', style: 'Kids', tier: 'FREE', badge: 'POPULAR',
    description: 'Glossy 3D balloons and confetti for first birthdays and kids’ parties.',
    tags: ['kids', 'first-birthday', 'pastel'], eventTypes: ['BIRTHDAY'], layout: 'birthday',
    colors: palette('#2563eb', '#f472b6', '#fbbf24', '#f8fbff', '#eef4ff', '#1e293b', '#64748b'),
    look: 'celebration', effect: 'confetti', fonts: 'modern', ornament: 'confetti', pattern: 'dots', hero: 'balloons', timeline: 'cards', gallery: 'polaroid', radius: 24,
  },
  {
    key: 'neon-night', name: 'Neon Night', category: 'Birthday', style: 'Party', tier: 'STANDARD',
    description: 'Dark mode with neon pink and electric cyan, a spotlit medallion and confetti for milestone birthday parties.',
    tags: ['party', 'modern'], eventTypes: ['BIRTHDAY'], layout: 'birthday',
    colors: palette('#3b0a2a', '#06b6d4', '#f472b6', '#0b0b12', '#16161f', '#f5f5f7', '#a1a1b5'),
    look: 'noir', effect: 'confetti', fonts: 'modern', ornament: 'confetti', pattern: 'none', hero: 'noir', timeline: 'tiles', gallery: 'stack', countdown: 'flip',
  },
  {
    key: 'golden-milestone', name: 'Golden Milestone', category: 'Birthday', style: 'Elegant', tier: 'STANDARD',
    description: 'Black and gold with a laurel crest and gold filigree frames for 50th, 60th (Shashtiabdapoorthi) and 75th birthdays.',
    tags: ['milestone', 'elegant', 'elders'], eventTypes: ['BIRTHDAY', 'ANNIVERSARY'], layout: 'birthday',
    colors: palette('#1f1a12', '#c9a227', '#f3e3a3', '#faf8f2', '#f3eee0', '#1f1a12', '#6d6556'),
    look: 'royal', effect: 'goldDust', heroTone: 'dark', fonts: 'regal', ornament: 'laurel', pattern: 'none', hero: 'monogram', timeline: 'cards', gallery: 'mosaic',
  },
  {
    key: 'silver-jubilee', name: 'Silver Jubilee', category: 'Anniversary', style: 'Elegant', tier: 'STANDARD',
    description: 'Silver and midnight blue with polaroid memories for 25th and 50th wedding anniversaries.',
    tags: ['anniversary', 'elegant'], eventTypes: ['ANNIVERSARY'], layout: 'anniversary',
    colors: palette('#1e293b', '#94a3b8', '#e2e8f0', '#f8fafc', '#eef2f7', '#0f172a', '#64748b'),
    look: 'classic', effect: 'goldDust', heroTone: 'dark', fonts: 'elegant', ornament: 'floral', pattern: 'none', hero: 'split', timeline: 'timeline', story: 'polaroid', gallery: 'polaroid',
  },
  {
    key: 'godh-bharai-blossoms', name: 'Godh Bharai Blossoms', category: 'Baby Shower', style: 'Pastel', tier: 'FREE',
    description: 'A soft flower arch in mint, butter yellow and blush for Godh Bharai, Seemantham and baby showers.',
    tags: ['baby-shower', 'pastel', 'godh-bharai'], eventTypes: ['BABY_SHOWER'], layout: 'family-ceremony',
    colors: palette('#0f766e', '#f59e0b', '#fbcfe8', '#fbfdfb', '#eef8f5', '#1f2e2b', '#667873'),
    look: 'garden', effect: 'petals', fonts: 'romantic', ornament: 'floral', pattern: 'dots', hero: 'floral', timeline: 'cards', radius: 24,
  },
  {
    key: 'namkaran-lullaby', name: 'Namkaran Lullaby', category: 'Naming Ceremony', style: 'Pastel', tier: 'FREE',
    description: 'A starry lullaby sky in soft blue and gold for Namkaran and Naamkaran ceremonies.',
    tags: ['naming-ceremony', 'pastel', 'hindu'], eventTypes: ['NAMING_CEREMONY'], layout: 'family-ceremony',
    colors: palette('#1d4ed8', '#d4a24c', '#fde68a', '#f7faff', '#eaf1ff', '#172554', '#5b6b8c'),
    look: 'garden', effect: 'fireflies', heroTone: 'dark', fonts: 'classic', ornament: 'stars', pattern: 'none', hero: 'celestial', timeline: 'cards', invocation: INVOCATION.hindu,
  },
  {
    key: 'mundan-mangal', name: 'Mundan Mangal', category: 'Mundan', style: 'Traditional', tier: 'FREE',
    description: 'Saffron bands under a marigold toran with diyas for Mundan and Chudakarana ceremonies.',
    tags: ['mundan', 'hindu', 'traditional'], eventTypes: ['MUNDAN'], layout: 'family-ceremony',
    colors: palette('#c2410c', '#ca8a04', '#fde68a', '#fffaf2', '#fdefd6', '#3a1d0a', '#7f5f47'),
    look: 'heritage', effect: 'marigold', heroTone: 'dark', fonts: 'heritage', ornament: 'mandala', pattern: 'none', hero: 'toran', timeline: 'diya', invocation: INVOCATION.hindu,
  },
  {
    key: 'janeu-sanskar', name: 'Upanayanam', category: 'Thread Ceremony', style: 'Traditional', tier: 'STANDARD',
    description: 'A sunrise temple gopuram in ochre and gold for Upanayanam, Janeu and Munji.',
    tags: ['thread-ceremony', 'hindu', 'south-indian'], eventTypes: ['THREAD_CEREMONY'], layout: 'family-ceremony',
    colors: palette('#9a3412', '#b8892b', '#fed7aa', '#fffaf3', '#fdeedc', '#351a0c', '#7c5e49'),
    look: 'heritage', effect: 'none', fonts: 'grand', ornament: 'mandala', pattern: 'dots', hero: 'gopuram', timeline: 'diya', invocation: INVOCATION.om,
  },

  // ───────────── Home, faith, festivals ─────────────
  {
    key: 'griha-pravesh', name: 'Griha Pravesh', category: 'Housewarming', style: 'Traditional', tier: 'FREE', badge: 'POPULAR',
    description: 'A mango-leaf and marigold toran over the doorway, with diyas lit for Griha Pravesh and housewarming pujas.',
    tags: ['housewarming', 'hindu', 'puja'], eventTypes: ['HOUSEWARMING'], layout: 'housewarming',
    colors: palette('#166534', '#ea580c', '#fde68a', '#fbfdf7', '#eff6e6', '#15261a', '#5f7063'),
    look: 'heritage', effect: 'marigold', heroTone: 'dark', fonts: 'heritage', ornament: 'floral', pattern: 'none', hero: 'toran', timeline: 'cards', invocation: INVOCATION.hindu,
  },
  {
    key: 'new-nest', name: 'New Nest', category: 'Housewarming', style: 'Modern', tier: 'FREE',
    description: 'A modern, minimal housewarming party invite for your new home.',
    tags: ['housewarming', 'modern'], eventTypes: ['HOUSEWARMING'], layout: 'housewarming',
    colors: palette('#334155', '#0ea5e9', '#bae6fd', '#f8fafc', '#eef3f8', '#0f172a', '#64748b'),
    look: 'modern', fonts: 'modern', ornament: 'none', pattern: 'none', hero: 'minimal', timeline: 'tiles',
  },
  {
    key: 'satyanarayan-katha', name: 'Satyanarayan Katha', category: 'Puja', style: 'Traditional', tier: 'STANDARD',
    description: 'Lotus blooms and floating diyas on still water, in saffron and deep red for Satyanarayan Katha and home pujas.',
    tags: ['puja', 'hindu', 'religious'], eventTypes: ['RELIGIOUS'], layout: 'religious',
    colors: palette('#991b1b', '#2a7f86', '#fcd34d', '#fffaf1', '#fdefd8', '#351410', '#7f5a4d'),
    look: 'heritage', effect: 'petals', fonts: 'heritage', ornament: 'lotus', pattern: 'none', hero: 'lotus', timeline: 'diya', invocation: INVOCATION.hindu,
  },
  {
    key: 'gurpurab-langar', name: 'Gurpurab Sewa', category: 'Religious', style: 'Traditional', tier: 'FREE',
    description: 'Golden domes over the sarovar in kesari and blue for Akhand Path, Sukhmani Sahib path and Gurpurab langar.',
    tags: ['sikh', 'religious'], eventTypes: ['RELIGIOUS'], layout: 'religious',
    colors: palette('#1e3a8a', '#ea8a00', '#fde68a', '#fffaf2', '#fff1dc', '#172033', '#5b6478'),
    look: 'royal', effect: 'none', heroTone: 'dark', fonts: 'classic', ornament: 'geometric', pattern: 'none', hero: 'sarovar', timeline: 'cards', invocation: INVOCATION.sikh,
  },
  {
    key: 'deepotsav', name: 'Deepotsav', category: 'Festival', style: 'Festive', tier: 'STANDARD', badge: 'NEW',
    description: 'A toran of marigolds, rows of diyas and sky lanterns rising: royal purple and gold for Diwali parties and Lakshmi puja.',
    tags: ['diwali', 'festival', 'party'], eventTypes: ['FESTIVAL'], layout: 'festival',
    colors: palette('#3b0764', '#f59e0b', '#fde68a', '#fbf7ff', '#f3eafd', '#1e0833', '#6b5a80'),
    look: 'heritage', effect: 'lanterns', heroTone: 'dark', fonts: 'grand', ornament: 'mandala', pattern: 'dots', hero: 'toran', timeline: 'tickets',
  },
  {
    key: 'eid-gathering', name: 'Eid Gathering', category: 'Festival', style: 'Elegant', tier: 'FREE',
    description: 'Receding arches and moonlit gold on emerald for Eid dinners and iftar gatherings.',
    tags: ['eid', 'muslim', 'festival'], eventTypes: ['FESTIVAL'], layout: 'festival',
    colors: palette('#065f46', '#d4af37', '#fef3c7', '#f7faf8', '#eaf3ee', '#0f231c', '#5b6f65'),
    look: 'royal', effect: 'goldDust', heroTone: 'dark', fonts: 'romantic', ornament: 'geometric', pattern: 'jaali', hero: 'arches', timeline: 'cards',
  },
  {
    key: 'utsav-community', name: 'Utsav', category: 'Community', style: 'Festive', tier: 'FREE',
    description: 'Vermilion and marigold with confetti bands for Ganesh Utsav, Durga Puja pandals and society celebrations.',
    tags: ['community', 'festival', 'ganesh-utsav', 'durga-puja'], eventTypes: ['COMMUNITY', 'FESTIVAL'], layout: 'community',
    colors: palette('#b91c1c', '#f59e0b', '#fde68a', '#fffaf3', '#fdefd9', '#2f120c', '#7f5a4d'),
    look: 'celebration', effect: 'marigold', heroTone: 'dark', fonts: 'desi', ornament: 'mandala', pattern: 'dots', hero: 'toran', timeline: 'timeline', invocation: INVOCATION.hindu,
  },

  // ───────────── Work, school, milestones ─────────────
  {
    key: 'corporate-summit', name: 'Summit', category: 'Corporate', style: 'Modern', tier: 'STANDARD',
    description: 'A crisp navy editorial invite with agenda, venue and registration for conferences and offsites.',
    tags: ['corporate', 'conference', 'modern'], eventTypes: ['CORPORATE'], layout: 'corporate',
    colors: palette('#1e3a8a', '#0ea5e9', '#bae6fd', '#f8fafc', '#eef3f9', '#0f172a', '#64748b'),
    look: 'modern', fonts: 'modern', ornament: 'none', pattern: 'none', hero: 'minimal', timeline: 'timeline', radius: 12,
  },
  {
    key: 'launch-night', name: 'Launch Night', category: 'Corporate', style: 'Modern', tier: 'PREMIUM',
    description: 'A spotlit stage, drifting light and glass cards for product launches, galas and award nights.',
    tags: ['corporate', 'launch', 'gala'], eventTypes: ['CORPORATE'], layout: 'corporate',
    colors: palette('#1b1650', '#8b5cf6', '#f59e0b', '#0b0b14', '#15152a', '#f5f5fa', '#a5a7c4'),
    look: 'noir', effect: 'goldDust', fonts: 'modern', ornament: 'geometric', pattern: 'none', hero: 'noir', timeline: 'tickets', radius: 12,
  },
  {
    key: 'annual-day', name: 'Annual Day', category: 'School & College', style: 'Playful', tier: 'FREE',
    description: 'Balloons and bright confetti bands for school annual days, sports days and college fests.',
    tags: ['school', 'college', 'playful'], eventTypes: ['SCHOOL_COLLEGE'], layout: 'school',
    colors: palette('#1d4ed8', '#f59e0b', '#fde68a', '#f8fbff', '#ecf2ff', '#172554', '#5b6b8c'),
    look: 'celebration', effect: 'confetti', fonts: 'modern', ornament: 'confetti', pattern: 'none', hero: 'balloons', timeline: 'cards', radius: 20,
  },
  {
    key: 'farewell-memories', name: 'Farewell Memories', category: 'School & College', style: 'Nostalgic', tier: 'FREE',
    description: 'Scattered polaroids and warm editorial type for farewells, alumni meets and reunions.',
    tags: ['farewell', 'reunion', 'college'], eventTypes: ['SCHOOL_COLLEGE', 'RETIREMENT'], layout: 'school',
    colors: palette('#7c2d12', '#d97706', '#fed7aa', '#fffaf5', '#f9ede0', '#2c1a10', '#7b6454'),
    look: 'modern', fonts: 'editorial', ornament: 'none', pattern: 'none', hero: 'classic', timeline: 'timeline', gallery: 'polaroid', story: 'polaroid',
  },
  {
    key: 'retirement-toast', name: 'Retirement Toast', category: 'Retirement', style: 'Elegant', tier: 'FREE',
    description: 'Honour a lifetime of work with a classic, readable invite, easy on older eyes.',
    tags: ['retirement', 'elegant', 'elders'], eventTypes: ['RETIREMENT'], layout: 'retirement',
    colors: palette('#134e4a', '#b8892b', '#e9d8a6', '#f8faf9', '#edf3f1', '#132a28', '#5d706d'),
    look: 'classic', fonts: 'classic', ornament: 'floral', pattern: 'none', hero: 'split', timeline: 'cards', story: 'polaroid',
  },
  {
    key: 'classic-ivory', name: 'Classic Ivory', category: 'Any Event', style: 'Minimal', tier: 'FREE',
    description: 'A timeless ivory-and-gold invitation that suits any occasion.',
    tags: ['minimal', 'any'], eventTypes: [], layout: 'festival',
    colors: palette('#44403c', '#b8892b', '#f1e3c4', '#fcfaf6', '#f4efe6', '#1c1917', '#78716c'),
    look: 'classic', fonts: 'classic', ornament: 'none', pattern: 'none', hero: 'classic', timeline: 'cards',
  },
];

/**
 * Templates removed from the catalog because they looked too much like
 * others. The seed switches them off (soft delete) wherever they exist;
 * events already using one keep their pinned version and keep working.
 */
export const RETIRED_TEMPLATE_KEYS: readonly string[] = [
  // Card designs that were another design's colourway (their colours are its presets now).
  ...Object.keys(LOOKALIKES),
  'walima-nights',
  'phulkari-phere',
  'heritage-haveli',
  'coastal-vows',
  'crest-and-crown',
  'golden-gateway',
  'rose-petal',
  'sterling-heirloom',
  'baraat-royale',
  // Videos
  'crest-and-crown-video',
];

/** Flagships first (their order above), then the rest of the Signature collection. */
export const WEBSITE_TEMPLATES: CatalogEntry[] = [...SPECS, ...SIGNATURE_SPECS].map((spec, i) => website(spec, i));
