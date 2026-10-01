import { INVOCATION, palette, type WebsiteSpec } from './builder';

const W = ['WEDDING'];

/**
 * The Signature collection: cinematic "experience" invitations. Each opens with
 * its own animation (lanterns, gates, a wax seal, a scratch card…), plays the
 * host's chosen music, and carries a verse and the celebration menu. The
 * scene-based flagships (Marigold Mahal, Divine Gopuram, Rajwada Royale…) are
 * listed with the other weddings in website.ts.
 */
export const SIGNATURE_SPECS: WebsiteSpec[] = [
  {
    key: 'lantern-night', name: 'Lantern Night', category: 'Wedding', style: 'Royal', tier: 'PREMIUM', badge: 'NEW', featured: true,
    description: 'Guests release glowing lanterns into a midnight sky to open your invitation. Indigo, saffron light and gold, with your music.',
    tags: ['signature', 'hindu', 'royal', 'night'], eventTypes: W, layout: 'signature-wedding',
    colors: palette('#1b1f4b', '#e0a030', '#f7d58b', '#fbf7ef', '#f3eee2', '#1d1a2e', '#6b6780'),
    presets: [
      { name: 'Indigo & Saffron', colors: palette('#1b1f4b', '#e0a030', '#f7d58b', '#fbf7ef', '#f3eee2', '#1d1a2e', '#6b6780') },
      { name: 'Maroon Night', colors: palette('#4a0d1e', '#e0a030', '#f7d58b', '#fcf6ef', '#f6ece0', '#2a1218', '#7a5d63') },
    ],
    look: 'royal', effect: 'lanterns', heroTone: 'dark', fonts: 'royal', ornament: 'stars', pattern: 'none',
    hero: 'lantern', timeline: 'timeline', couple: 'arch', gallery: 'mosaic', countdown: 'flip', intro: 'lanterns', invocation: INVOCATION.hindu, music: true,
  },
  {
    key: 'curtain-call', name: 'Curtain Call', category: 'Wedding', style: 'Theatre', tier: 'PREMIUM', badge: 'BESTSELLER', featured: true,
    description: 'Velvet curtains part on a gilded stage and your monogram takes the spotlight; more curtains wait to reveal your story. A theatre-style wedding.',
    tags: ['signature', 'royal', 'theatre'], eventTypes: W, layout: 'signature-wedding',
    colors: palette('#7a0f1f', '#c9a24a', '#f3dfa2', '#fbf6ee', '#f5ebdc', '#2a1216', '#7c5d5f'),
    look: 'royal', effect: 'goldDust', heroTone: 'dark', fonts: 'regal', ornament: 'laurel', pattern: 'none',
    hero: 'monogram', timeline: 'tickets', couple: 'arch', gallery: 'stack', story: 'curtain', countdown: 'flip', intro: 'curtain', music: true,
  },
  {
    key: 'golden-secret', name: 'The Golden Secret', category: 'Wedding', style: 'Luxury', tier: 'PREMIUM', featured: true,
    description: 'A gold-foil card your guests scratch to discover the date, before a champagne-and-ivory invitation unfolds.',
    tags: ['signature', 'luxury', 'interactive'], eventTypes: W, layout: 'signature-wedding',
    colors: palette('#5c4a1e', '#c8a24a', '#f2e2b6', '#fdfaf3', '#f6efdf', '#2b2416', '#7d725a'),
    look: 'classic', effect: 'goldDust', fonts: 'elegant', ornament: 'laurel', pattern: 'none',
    hero: 'monogram', timeline: 'timeline', couple: 'flip', gallery: 'polaroid', countdown: 'flip', intro: 'scratch', music: true,
  },
  {
    key: 'cathedral-grace', name: 'Cathedral Grace', category: 'Wedding', style: 'Heritage', tier: 'PREMIUM', featured: true,
    description: 'A wax-sealed letter opens onto a cathedral arch and rose window. Navy, ivory and antique gold for church weddings.',
    tags: ['signature', 'christian', 'church', 'heritage'], eventTypes: W, layout: 'signature-wedding',
    colors: palette('#1f2a44', '#b8955a', '#e7d3a8', '#f8f6f1', '#eeeae0', '#1a2030', '#606879'),
    look: 'royal', effect: 'petals', fonts: 'editorial', ornament: 'laurel', pattern: 'none',
    hero: 'cathedral', timeline: 'timeline', couple: 'flip', gallery: 'polaroid', story: 'polaroid', intro: 'seal', invocation: INVOCATION.christian, music: true,
  },
  {
    key: 'seaside-promise', name: 'Seaside Promise', category: 'Wedding', style: 'Destination', tier: 'PREMIUM',
    description: 'Sun, sea and a shower of petals for beach and destination weddings in Goa, Kerala or the Andamans.',
    tags: ['signature', 'destination', 'beach'], eventTypes: W, layout: 'signature-wedding',
    colors: palette('#0e4d64', '#2a9d8f', '#f4d8b0', '#f6fbfb', '#e8f3f2', '#12303a', '#5b7680'),
    look: 'garden', effect: 'petals', fonts: 'romantic', ornament: 'none', pattern: 'none',
    hero: 'seaside', timeline: 'tickets', couple: 'default', gallery: 'polaroid', story: 'polaroid', intro: 'petals', music: true,
  },
  {
    key: 'celestial-vows', name: 'Celestial Vows', category: 'Wedding', style: 'Celestial', tier: 'PREMIUM', featured: true,
    description: 'A night-sky invitation from top to bottom: stars, a silver crescent and fireflies for evening weddings, sangeet and cocktails.',
    tags: ['signature', 'night', 'modern'], eventTypes: ['WEDDING', 'ENGAGEMENT'], layout: 'signature-wedding',
    colors: palette('#141a3a', '#8b94c9', '#e8e3c8', '#070a1f', '#0f1433', '#eef0fb', '#a4a9c9'),
    look: 'noir', effect: 'fireflies', heroTone: 'dark', fonts: 'royal', ornament: 'stars', pattern: 'none',
    hero: 'celestial', timeline: 'timeline', couple: 'profile', gallery: 'stack', countdown: 'flip', intro: 'celestial', music: true,
  },
  {
    key: 'bansuri', name: 'Bansuri', category: 'Wedding', style: 'Divine', tier: 'PREMIUM', badge: 'NEW',
    description: 'Moonlit Vrindavan in layered 3D: the kadamba tree, the Yamuna, a golden flute and peacock plumes. A Krishna-inspired invitation in peacock blue and gold, with fireflies and a petal shower. Pairs with The Divine Flute film.',
    tags: ['signature', 'hindu', 'krishna', 'traditional'], eventTypes: W, layout: 'signature-wedding',
    colors: palette('#0b3d5c', '#1f8a70', '#e9c46a', '#f5fbf8', '#e6f2ee', '#10262f', '#557079'),
    look: 'heritage', effect: 'fireflies', fonts: 'regal', ornament: 'peacock', pattern: 'none',
    hero: 'vrindavan', timeline: 'diya', couple: 'arch', gallery: 'mosaic', countdown: 'flip', intro: 'petals', invocation: INVOCATION.krishna, music: true,
  },
  {
    key: 'vintage-voyage', name: 'Vintage Voyage', category: 'Wedding', style: 'Vintage', tier: 'STANDARD',
    description: 'A sepia love letter under a wax seal, with polaroid memories: classic type and a timeless feel for destination and heritage-hotel weddings.',
    tags: ['signature', 'destination', 'vintage'], eventTypes: W, layout: 'signature-wedding',
    colors: palette('#5b3a29', '#a67c52', '#e8d5b5', '#f6efe3', '#ede2cf', '#2e2219', '#7a6553'),
    look: 'modern', effect: 'none', fonts: 'editorial', ornament: 'laurel', pattern: 'none',
    hero: 'minimal', timeline: 'timeline', couple: 'profile', gallery: 'polaroid', story: 'polaroid', intro: 'seal', music: true,
  },
  {
    key: 'sapphire-soiree', name: 'Sapphire Soirée', category: 'Sangeet & Reception', style: 'Glam', tier: 'PREMIUM',
    description: 'Sapphire and silver with a scratch-to-reveal card and an editorial layout: made for sangeet nights, cocktails and receptions.',
    tags: ['signature', 'sangeet', 'reception', 'modern'], eventTypes: ['WEDDING', 'ENGAGEMENT', 'ANNIVERSARY'], layout: 'signature-celebration',
    colors: palette('#0f2557', '#c0c7d8', '#e3e8f5', '#f4f6fb', '#e8edf7', '#101a33', '#5a6480'),
    look: 'modern', effect: 'goldDust', heroTone: 'dark', fonts: 'editorial', ornament: 'stars', pattern: 'none',
    hero: 'monogram', timeline: 'tiles', gallery: 'stack', countdown: 'flip', intro: 'scratch', music: true,
  },
  {
    key: 'deepavali-nights', name: 'Deepavali Nights', category: 'Festival', style: 'Festive', tier: 'STANDARD', badge: 'NEW',
    description: 'Floating lanterns, a starry sky and rangoli bands for Diwali parties, Lakshmi puja and festive office celebrations.',
    tags: ['signature', 'diwali', 'festival'], eventTypes: ['FESTIVAL', 'RELIGIOUS', 'CORPORATE'], layout: 'signature-celebration',
    colors: palette('#3b1a5a', '#f2a23a', '#ffd98a', '#fdf8f2', '#f5ecde', '#24142f', '#6f5a78'),
    look: 'heritage', effect: 'lanterns', heroTone: 'dark', fonts: 'royal', ornament: 'lotus', pattern: 'none',
    hero: 'lantern', timeline: 'tickets', gallery: 'mosaic', countdown: 'flip', intro: 'lanterns', invocation: INVOCATION.om, music: true,
  },
  {
    key: 'starlit-birthday', name: 'Starlit Birthday', category: 'Birthday', style: 'Dreamy', tier: 'STANDARD',
    description: 'A night sky of wishes for milestone birthdays: stars, a crescent moon, confetti bands and a flip-clock countdown to the party.',
    tags: ['signature', 'birthday', 'milestone'], eventTypes: ['BIRTHDAY'], layout: 'signature-celebration',
    colors: palette('#1e1b4b', '#f0abfc', '#fde68a', '#f8f7ff', '#efedff', '#1c1a3a', '#625f86'),
    look: 'celebration', effect: 'goldDust', heroTone: 'dark', fonts: 'classic', ornament: 'stars', pattern: 'none',
    hero: 'celestial', timeline: 'tiles', gallery: 'polaroid', countdown: 'flip', intro: 'celestial', music: true,
  },
  {
    key: 'lotus-blessings', name: 'Lotus Blessings', category: 'Puja & Ceremonies', style: 'Serene', tier: 'FREE',
    description: 'A lotus pond with floating diyas and a petal shower in calm saffron tones for pujas, griha pravesh and naming ceremonies.',
    tags: ['signature', 'puja', 'griha-pravesh', 'traditional'], eventTypes: ['RELIGIOUS', 'HOUSEWARMING', 'NAMING_CEREMONY', 'THREAD_CEREMONY'], layout: 'signature-celebration',
    colors: palette('#9a3412', '#2a7f86', '#fcd9a8', '#fffaf3', '#fbeedd', '#2f1a0d', '#86684f'),
    look: 'garden', effect: 'petals', fonts: 'heritage', ornament: 'lotus', pattern: 'none',
    hero: 'lotus', timeline: 'diya', gallery: 'polaroid', intro: 'petals', invocation: INVOCATION.om, music: true,
  },
];
