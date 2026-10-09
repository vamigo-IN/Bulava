export interface SamplePreset {
  title: string;
  longTitle: string;
  description: string;
  tagline: string;
  hashtag: string;
  functions: string[];
  couple?: [string, string];
  honoree?: string;
}

/** Realistic preview content per event category (Template Studio, catalog thumbnails, template tests). */
export const SAMPLE_PRESETS: Record<string, SamplePreset> = {
  WEDDING: {
    title: 'Riya & Aman',
    longTitle: 'The Wedding Celebrations of Aishwarya Venkataraman & Siddharth Chaturvedi',
    description: 'Together with our families, we invite you to celebrate our wedding.',
    tagline: 'Two hearts, one journey',
    hashtag: '#AmanWedsRiya',
    functions: ['Haldi', 'Sangeet', 'Wedding', 'Reception'],
    couple: ['Riya', 'Aman'],
  },
  ENGAGEMENT: {
    title: 'Meera & Kabir',
    longTitle: 'The Engagement Ceremony of Meenakshi Sundaram & Kabir Malhotra',
    description: 'Join us as we exchange rings and begin a new chapter.',
    tagline: 'She said yes!',
    hashtag: '#KabirMeetsMeera',
    functions: ['Ring Ceremony', 'Dinner'],
    couple: ['Meera', 'Kabir'],
  },
  ANNIVERSARY: {
    title: 'Sunita & Rajesh',
    longTitle: 'Celebrating 50 Golden Years of Sunita & Rajesh Khandelwal',
    description: 'Celebrating 25 beautiful years together.',
    tagline: '25 years of love',
    hashtag: '#SilverJubilee',
    functions: ['Celebration', 'Dinner'],
    couple: ['Sunita', 'Rajesh'],
  },
  BIRTHDAY: {
    title: 'Aarav turns 1',
    longTitle: 'The Grand First Birthday Celebration of Aarav Venkataraman',
    description: 'Our little prince turns one! Come celebrate with cake, games and lots of love.',
    tagline: 'One year of wonder',
    hashtag: '#AaravTurnsOne',
    functions: ['Cake Cutting', 'Dinner & Games'],
    honoree: 'Aarav',
  },
  BABY_SHOWER: {
    title: 'Priya’s Godh Bharai',
    longTitle: 'Godh Bharai Ceremony of Priyadarshini Raghavan',
    description: 'Bless the mother-to-be at our Godh Bharai.',
    tagline: 'A little miracle on the way',
    hashtag: '#BabySharma',
    functions: ['Godh Bharai', 'Lunch'],
    honoree: 'Priya',
  },
  NAMING_CEREMONY: {
    title: 'Namkaran of Baby Sharma',
    longTitle: 'Namkaran Sanskar of the Beloved Son of Neha & Rohit Sharma',
    description: 'Join us to bless our little one as we announce the name.',
    tagline: 'Welcome, little one',
    hashtag: '#NamkaranSanskar',
    functions: ['Namkaran Puja', 'Lunch'],
    honoree: 'Baby Sharma',
  },
  MUNDAN: {
    title: 'Vihaan’s Mundan',
    longTitle: 'Mundan Sanskar of Chiranjeev Vihaan Agarwal',
    description: 'Seeking your blessings for our son’s Mundan Sanskar.',
    tagline: 'Blessings for our little one',
    hashtag: '#VihaanMundan',
    functions: ['Mundan Ceremony', 'Bhoj'],
    honoree: 'Vihaan',
  },
  THREAD_CEREMONY: {
    title: 'Upanayanam of Aditya',
    longTitle: 'Upanayanam of Chiranjeevi Aditya Subramanian',
    description: 'With divine grace, we invite you to the Upanayanam of our son.',
    tagline: 'A sacred beginning',
    hashtag: '#AdityaUpanayanam',
    functions: ['Upanayanam', 'Lunch'],
    honoree: 'Aditya',
  },
  HOUSEWARMING: {
    title: 'The Sharmas’ Griha Pravesh',
    longTitle: 'Griha Pravesh Puja of Our New Home at Whitefield, Bengaluru',
    description: 'We have a new home! Join us for the Griha Pravesh puja and lunch.',
    tagline: 'Home sweet home',
    hashtag: '#SharmaNiwas',
    functions: ['Griha Pravesh Puja', 'Lunch'],
  },
  RELIGIOUS: {
    title: 'Satyanarayan Katha',
    longTitle: 'Shri Satyanarayan Katha and Maha Prasad at Our Residence',
    description: 'Please join us for the katha, aarti and prasad.',
    tagline: 'With divine blessings',
    hashtag: '#Katha',
    functions: ['Katha', 'Aarti & Prasad'],
  },
  FESTIVAL: {
    title: 'Diwali Night 2026',
    longTitle: 'Deepotsav: A Diwali Evening of Lights, Music and Mithai',
    description: 'Lights, sweets, cards and good company. Dress: festive.',
    tagline: 'Shubh Deepavali',
    hashtag: '#DiwaliNight',
    functions: ['Lakshmi Puja', 'Dinner & Cards'],
  },
  CORPORATE: {
    title: 'Leadership Summit 2026',
    longTitle: 'Annual Leadership Summit 2026: Building India’s Next Decade',
    description: 'A day of keynotes, panels and networking with industry leaders.',
    tagline: 'Ideas that move India',
    hashtag: '#Summit2026',
    functions: ['Registration & Breakfast', 'Keynote', 'Panel Discussion', 'Networking Dinner'],
  },
  SCHOOL_COLLEGE: {
    title: 'Annual Day 2026',
    longTitle: 'Annual Day Celebrations 2026: Delhi Public School, R. K. Puram',
    description: 'Performances, prize distribution and more.',
    tagline: 'Celebrating our stars',
    hashtag: '#AnnualDay',
    functions: ['Cultural Programme', 'Prize Distribution'],
  },
  COMMUNITY: {
    title: 'Ganesh Utsav 2026',
    longTitle: 'Sarvajanik Ganeshotsav 2026: Green Park Residents’ Association',
    description: 'Ten days of aarti, bhajans and cultural programmes. All are welcome.',
    tagline: 'Ganpati Bappa Morya',
    hashtag: '#GaneshUtsav',
    functions: ['Sthapana', 'Maha Aarti', 'Visarjan'],
  },
  RETIREMENT: {
    title: 'Celebrating Mr. Iyer',
    longTitle: 'Celebrating 35 Remarkable Years of Service: Mr. Ramachandran Iyer',
    description: 'Join us to honour a lifetime of dedication.',
    tagline: 'Here’s to the next chapter',
    hashtag: '#HappyRetirement',
    functions: ['Farewell Lunch'],
    honoree: 'Mr. Iyer',
  },
  CUSTOM: {
    title: 'Our Celebration',
    longTitle: 'A Very Long Celebration Title To Test How Templates Handle Overflow Gracefully',
    description: 'Join us for a special day.',
    tagline: 'Let’s celebrate',
    hashtag: '#Celebrate',
    functions: ['Celebration'],
  },
};

/**
 * Preview content for templates made for one festival (by tag), so a gallery's
 * Eid or Christmas design is not shown with a Diwali title.
 */
export const SAMPLE_VARIANTS: Record<string, Partial<SamplePreset>> = {
  eid: {
    title: 'Eid Milan 2026',
    longTitle: 'Eid ul-Fitr Dawat: An Evening with Family and Friends',
    description: 'Sheer khurma, biryani and good company. Join us!',
    tagline: 'Eid Mubarak',
    hashtag: '#EidMubarak',
    functions: ['Eid Namaz', 'Dawat'],
  },
  holi: {
    title: 'Holi Hai 2026',
    longTitle: 'Rang Barse: Holi Celebration at Green Park Society',
    description: 'Colours, thandai and gujiya. Wear white!',
    tagline: 'Bura na mano, Holi hai',
    hashtag: '#HoliHai',
    functions: ['Holika Dahan', 'Rangwali Holi'],
  },
  christmas: {
    title: 'Christmas Eve 2026',
    longTitle: 'Christmas Eve Dinner and Carol Night with the D’Souzas',
    description: 'Carols, plum cake and a dinner to remember.',
    tagline: 'Merry Christmas',
    hashtag: '#MerryChristmas',
    functions: ['Carol Service', 'Christmas Dinner'],
  },
  navratri: {
    title: 'Garba Night 2026',
    longTitle: 'Navratri Garba and Dandiya Raas: Nine Nights of Celebration',
    description: 'Nine nights of garba, dandiya and aarti. Come in chaniya choli!',
    tagline: 'Jai Mata Di',
    hashtag: '#GarbaNight',
    functions: ['Aarti', 'Garba & Dandiya'],
  },
  pongal: {
    title: 'Pongal 2026',
    longTitle: 'Thai Pongal: A Harvest Celebration with Family and Friends',
    description: 'Sweet pongal, sugarcane and a kolam at the door. Join us!',
    tagline: 'Pongalo Pongal',
    hashtag: '#HappyPongal',
    functions: ['Pongal Puja', 'Lunch'],
  },
};

/** The preset for an event type, adjusted for a festival a template is tagged with. */
export function samplePreset(typeKey: string, tags: readonly string[] = []): SamplePreset {
  const base = SAMPLE_PRESETS[typeKey] ?? SAMPLE_PRESETS.CUSTOM!;
  const variant = tags.map((t) => SAMPLE_VARIANTS[t]).find(Boolean);
  return variant ? { ...base, ...variant } : base;
}
