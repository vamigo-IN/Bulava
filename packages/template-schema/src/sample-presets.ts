import { faithFromTags, seedNumber, type Faith } from './faith';

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

/**
 * Realistic preview content per event category (Template Studio, catalog
 * thumbnails, template tests). Names are placeholders filled by `samplePreset`
 * for each template: {one} and {two} are the couple (the bride first),
 * {name} the person celebrated, {family} a family name.
 */
export const SAMPLE_PRESETS: Record<string, SamplePreset> = {
  WEDDING: {
    title: '{one} & {two}',
    longTitle: 'The Wedding Celebrations of {longOne} & {longTwo}',
    description: 'Together with our families, we invite you to celebrate our wedding.',
    tagline: 'Two hearts, one journey',
    hashtag: '#{two}Weds{one}',
    functions: ['Haldi', 'Sangeet', 'Wedding', 'Reception'],
    couple: ['{one}', '{two}'],
  },
  ENGAGEMENT: {
    title: '{one} & {two}',
    longTitle: 'The Engagement Ceremony of {longOne} & {longTwo}',
    description: 'Join us as we exchange rings and begin a new chapter.',
    tagline: 'She said yes!',
    hashtag: '#{two}Meets{one}',
    functions: ['Ring Ceremony', 'Dinner'],
    couple: ['{one}', '{two}'],
  },
  ANNIVERSARY: {
    title: '{one} & {two}',
    longTitle: 'Celebrating 50 Golden Years of {one} & {two} {family}',
    description: 'Celebrating 25 beautiful years together.',
    tagline: '25 years of love',
    hashtag: '#SilverJubilee',
    functions: ['Celebration', 'Dinner'],
    couple: ['{one}', '{two}'],
  },
  BIRTHDAY: {
    title: '{name} turns {age}',
    longTitle: 'The Grand Birthday Celebration of {longName}',
    description: 'Come celebrate with cake, games and lots of love.',
    tagline: 'A year of wonder',
    hashtag: '#{name}Turns{age}',
    functions: ['Cake Cutting', 'Dinner & Games'],
    honoree: '{name}',
  },
  BABY_SHOWER: {
    title: '{name}’s Godh Bharai',
    longTitle: 'Godh Bharai Ceremony of {longName}',
    description: 'Bless the mother-to-be at our Godh Bharai.',
    tagline: 'A little miracle on the way',
    hashtag: '#Baby{family}',
    functions: ['Godh Bharai', 'Lunch'],
    honoree: '{name}',
  },
  NAMING_CEREMONY: {
    title: 'Namkaran of Baby {family}',
    longTitle: 'Namkaran Sanskar of the Beloved Son of {parents}',
    description: 'Join us to bless our little one as we announce the name.',
    tagline: 'Welcome, little one',
    hashtag: '#NamkaranSanskar',
    functions: ['Namkaran Puja', 'Lunch'],
    honoree: 'Baby {family}',
  },
  MUNDAN: {
    title: '{name}’s Mundan',
    longTitle: 'Mundan Sanskar of Chiranjeev {longName}',
    description: 'Seeking your blessings for our son’s Mundan Sanskar.',
    tagline: 'Blessings for our little one',
    hashtag: '#{name}Mundan',
    functions: ['Mundan Ceremony', 'Bhoj'],
    honoree: '{name}',
  },
  THREAD_CEREMONY: {
    title: 'Upanayanam of {name}',
    longTitle: 'Upanayanam of Chiranjeevi {longName}',
    description: 'With divine grace, we invite you to the Upanayanam of our son.',
    tagline: 'A sacred beginning',
    hashtag: '#{name}Upanayanam',
    functions: ['Upanayanam', 'Lunch'],
    honoree: '{name}',
  },
  HOUSEWARMING: {
    title: 'The {family}s’ Griha Pravesh',
    longTitle: 'Griha Pravesh Puja of Our New Home at Whitefield, Bengaluru',
    description: 'We have a new home! Join us for the Griha Pravesh puja and lunch.',
    tagline: 'Home sweet home',
    hashtag: '#{family}Niwas',
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
    title: 'Celebrating Mr. {family}',
    longTitle: 'Celebrating 35 Remarkable Years of Service: Mr. {longName}',
    description: 'Join us to honour a lifetime of dedication.',
    tagline: 'Here’s to the next chapter',
    hashtag: '#HappyRetirement',
    functions: ['Farewell Lunch'],
    honoree: 'Mr. {family}',
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
  gurpurab: {
    title: 'Gurpurab 2026',
    longTitle: 'Prakash Purab: Akhand Path, Kirtan and Guru Ka Langar',
    description: 'Join the sangat for kirtan, ardas and langar.',
    tagline: 'Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh',
    hashtag: '#Gurpurab',
    functions: ['Akhand Path Sahib', 'Kirtan & Langar'],
  },
};

/**
 * Wording for occasions whose sample is one tradition's rite (a Godh Bharai, a
 * Namkaran, a Griha Pravesh, a katha) when the template is another faith's.
 */
const FAITH_VARIANTS: Partial<Record<string, Partial<Record<Faith, Partial<SamplePreset>>>>> = {
  BABY_SHOWER: Object.fromEntries(
    (['muslim', 'sikh', 'christian'] as const).map((f) => [
      f,
      { title: '{name}’s Baby Shower', longTitle: 'A Baby Shower for {longName}', description: 'Bless the mother-to-be at our baby shower.', functions: ['Baby Shower', 'Lunch'] },
    ]),
  ),
  NAMING_CEREMONY: {
    muslim: { title: 'Aqiqah of Baby {family}', longTitle: 'Aqiqah of the Beloved Son of {parents}', hashtag: '#Aqiqah', functions: ['Aqiqah', 'Dawat'] },
    sikh: { title: 'Naam Karan of Baby {family}', longTitle: 'Naam Karan of the Beloved Son of {parents}', hashtag: '#NaamKaran', functions: ['Ardas & Naam Karan', 'Langar'] },
    christian: { title: 'Baptism of Baby {family}', longTitle: 'Holy Baptism of the Beloved Son of {parents}', hashtag: '#Baptism', functions: ['Holy Baptism', 'Lunch'] },
  },
  HOUSEWARMING: {
    muslim: { title: 'The {family}s’ Housewarming', description: 'We have a new home! Join us for a Quran Khwani and dawat.', functions: ['Quran Khwani', 'Dawat'] },
    sikh: { title: 'The {family}s’ Housewarming', description: 'We have a new home! Join us for the Sukhmani Sahib path and langar.', functions: ['Sukhmani Sahib Path', 'Langar'] },
    christian: { title: 'The {family}s’ Housewarming', description: 'We have a new home! Join us for the house blessing and lunch.', functions: ['House Blessing', 'Lunch'] },
  },
  RELIGIOUS: {
    muslim: { title: 'Quran Khwani', longTitle: 'Quran Khwani and Dua for Our Family at Our Residence', description: 'Please join us for the Quran Khwani, dua and niyaz.', tagline: 'With Allah’s blessings', hashtag: '#QuranKhwani', functions: ['Quran Khwani', 'Dua & Niyaz'] },
    sikh: {
      title: 'Sukhmani Sahib Path',
      longTitle: 'Shri Sukhmani Sahib Path, Kirtan and Guru Ka Langar at Our Residence',
      description: 'Please join us for the path, kirtan, ardas and langar.',
      tagline: 'With the Guru’s blessings',
      hashtag: '#SukhmaniSahib',
      functions: ['Path & Kirtan', 'Ardas & Langar'],
    },
    christian: { title: 'Thanksgiving Mass', longTitle: 'A Thanksgiving Mass and Fellowship Lunch for Our Family', description: 'Please join us for the Holy Mass and lunch.', tagline: 'Give thanks to the Lord', hashtag: '#Thanksgiving', functions: ['Holy Mass', 'Fellowship Lunch'] },
  },
};

/** Occasions that are Hindu rites: their samples are always a Hindu family's. */
const HINDU_RITES = new Set(['MUNDAN', 'THREAD_CEREMONY']);

// ─────────────────────────── Names ───────────────────────────

/** A couple: the bride's name first, as `couple.partnerOne`. */
type Couple = readonly [string, string];
type Region = 'south' | 'kerala' | 'bengali' | 'marathi' | 'gujarati';

/**
 * Sample couples by faith, and for Hindu designs of one region, by region.
 * Each template shows one couple, chosen by its key, so a gallery shows many.
 */
const COUPLES: Record<Faith, Couple[]> = {
  hindu: [
    ['Ananya', 'Vihaan'],
    ['Diya', 'Arjun'],
    ['Kavya', 'Rohan'],
    ['Ishita', 'Aditya'],
    ['Aditi', 'Varun'],
    ['Shreya', 'Siddharth'],
    ['Pooja', 'Karan'],
    ['Nisha', 'Abhinav'],
  ],
  muslim: [
    ['Zoya', 'Ayaan'],
    ['Sana', 'Imran'],
    ['Aisha', 'Rehan'],
    ['Mehreen', 'Faizan'],
    ['Alina', 'Zayed'],
    ['Noor', 'Arsalan'],
    ['Hiba', 'Saif'],
    ['Inaya', 'Adnan'],
  ],
  sikh: [
    ['Simran', 'Harjot'],
    ['Jasleen', 'Gurpreet'],
    ['Navneet', 'Arjan'],
    ['Harleen', 'Jaskaran'],
    ['Gurleen', 'Amritpal'],
    ['Prabhleen', 'Manveer'],
    ['Kirandeep', 'Sukhman'],
    ['Mehtab', 'Angad'],
  ],
  christian: [
    ['Grace', 'Daniel'],
    ['Sarah', 'Joel'],
    ['Anita', 'Samuel'],
    ['Rachel', 'Thomas'],
    ['Merin', 'Jacob'],
    ['Hannah', 'Stephen'],
    ['Teresa', 'Francis'],
    ['Leah', 'Nathan'],
  ],
};

const REGIONAL_COUPLES: Record<Region, Couple[]> = {
  south: [
    ['Meenakshi', 'Karthik'],
    ['Lakshmi', 'Arvind'],
    ['Nandini', 'Raghav'],
    ['Sowmya', 'Vignesh'],
    ['Harini', 'Srinivas'],
  ],
  kerala: [
    ['Anjali', 'Vishnu'],
    ['Gayathri', 'Hari'],
    ['Parvathy', 'Arjun'],
    ['Devika', 'Govind'],
  ],
  bengali: [
    ['Ananya', 'Arnab'],
    ['Sudeshna', 'Arindam'],
    ['Moumita', 'Sayan'],
    ['Rituparna', 'Abhik'],
  ],
  marathi: [
    ['Tanvi', 'Omkar'],
    ['Gauri', 'Sanket'],
    ['Rutuja', 'Aniket'],
    ['Mrunal', 'Chinmay'],
  ],
  gujarati: [
    ['Riddhi', 'Parth'],
    ['Krupa', 'Hardik'],
    ['Dhara', 'Jay'],
    ['Hetal', 'Chirag'],
  ],
};

/** Couples who have shared a lifetime (anniversaries). */
const ELDER_COUPLES: Record<Faith, Couple[]> = {
  hindu: [
    ['Sunita', 'Rajesh'],
    ['Kamala', 'Suresh'],
    ['Usha', 'Prakash'],
  ],
  muslim: [
    ['Shabana', 'Javed'],
    ['Rukhsana', 'Anwar'],
    ['Farida', 'Salim'],
  ],
  sikh: [
    ['Kulwant', 'Gurdev'],
    ['Manjit', 'Harbhajan'],
    ['Paramjit', 'Balwinder'],
  ],
  christian: [
    ['Mary', 'Joseph'],
    ['Elizabeth', 'George'],
    ['Lucy', 'Anthony'],
  ],
};

/** Long names for the test matrix's long-name case (and Template Studio's toggle). */
const LONG_COUPLES: Record<Faith, Couple> = {
  hindu: ['Aishwarya Venkataraman', 'Siddharth Chaturvedi'],
  muslim: ['Mehrunnisa Siddiqui', 'Mohammed Arsalan Qureshi'],
  sikh: ['Jasleen Kaur Randhawa', 'Gurpreet Singh Dhillon'],
  christian: ['Rebecca Elizabeth Fernandes', 'Samuel Joseph D’Souza'],
};

/** The people celebrated on their own: children, mothers-to-be and grown-ups, by faith. */
const PEOPLE: Record<Faith, { boys: string[]; girls: string[]; women: string[]; men: string[] }> = {
  hindu: { boys: ['Aarav', 'Reyansh', 'Ishaan', 'Vivaan'], girls: ['Anika', 'Myra', 'Saanvi', 'Kiara'], women: ['Priya', 'Neha', 'Shruti'], men: ['Rahul', 'Vikram', 'Manish'] },
  muslim: { boys: ['Ayaan', 'Zayan', 'Rayyan', 'Arham'], girls: ['Inaya', 'Aliza', 'Zara', 'Mahira'], women: ['Sana', 'Huma', 'Nazia'], men: ['Farhan', 'Imran', 'Junaid'] },
  sikh: { boys: ['Fateh', 'Ekamjot', 'Gurbaaz', 'Agam'], girls: ['Gurnoor', 'Seerat', 'Jasnoor', 'Amrit'], women: ['Harpreet', 'Navjot', 'Rupinder'], men: ['Manveer', 'Jaspal', 'Kanwar'] },
  christian: { boys: ['Aaron', 'Ethan', 'Joshua', 'Ryan'], girls: ['Hannah', 'Joanna', 'Ruth', 'Alicia'], women: ['Priscilla', 'Shirley', 'Anne'], men: ['Peter', 'Vincent', 'Roshan'] },
};

const LONG_PEOPLE: Record<Faith, string> = {
  hindu: 'Venkataraman Subramaniam',
  muslim: 'Mohammed Ayaan Siddiqui',
  sikh: 'Ekamjot Singh Randhawa',
  christian: 'Aaron Joseph Fernandes',
};

/** Family names, and each faith's honorifics for the family's blessings. */
const FAMILIES: Record<Faith, string[]> = {
  hindu: ['Sharma', 'Kapoor', 'Agarwal', 'Mehta', 'Joshi', 'Malhotra'],
  muslim: ['Siddiqui', 'Khan', 'Qureshi', 'Ansari', 'Mirza', 'Hussain'],
  sikh: ['Dhillon', 'Randhawa', 'Gill', 'Sandhu', 'Grewal', 'Sidhu'],
  christian: ['D’Souza', 'Fernandes', 'Thomas', 'Mathew', 'Pinto', 'Rodrigues'],
};
const REGIONAL_FAMILIES: Record<Region, string[]> = {
  south: ['Iyer', 'Raghavan', 'Subramanian', 'Reddy'],
  kerala: ['Nair', 'Menon', 'Pillai', 'Warrier'],
  bengali: ['Banerjee', 'Chatterjee', 'Sen', 'Mukherjee'],
  marathi: ['Kulkarni', 'Deshpande', 'Patil', 'Joshi'],
  gujarati: ['Patel', 'Shah', 'Desai', 'Mehta'],
};

/** Parents' first names: [father, mother] pairs. Sikh parents carry Singh and Kaur. */
const PARENTS: Record<Faith, Couple[]> = {
  hindu: [
    ['Rajesh', 'Sunita'],
    ['Anil', 'Meena'],
    ['Suresh', 'Kavita'],
    ['Vinod', 'Rekha'],
  ],
  muslim: [
    ['Javed', 'Shabana'],
    ['Arif', 'Nasreen'],
    ['Salim', 'Farida'],
    ['Tariq', 'Rubina'],
  ],
  sikh: [
    ['Harjit Singh', 'Manjit Kaur'],
    ['Gurdev Singh', 'Kulwant Kaur'],
    ['Balwinder Singh', 'Paramjit Kaur'],
    ['Jaswant Singh', 'Surinder Kaur'],
  ],
  christian: [
    ['Joseph', 'Mary'],
    ['George', 'Elizabeth'],
    ['Anthony', 'Lucy'],
    ['Philip', 'Susan'],
  ],
};

/**
 * Grandparents: [grandmother, grandfather]. Printed cards ask the elders'
 * blessings (the couple's parents are named under each partner), so the
 * sample blessings name them, in each tradition's words and order.
 */
const GRANDPARENTS: Record<Faith, Couple[]> = {
  hindu: [
    ['Kamla Devi', 'Ramnath'],
    ['Savitri Devi', 'Harishchandra'],
    ['Shanti Devi', 'Mohanlal'],
    ['Pushpa Devi', 'Krishnakant'],
  ],
  muslim: [
    ['Zubeida', 'Abdul Rashid'],
    ['Hamida', 'Mohammed Yusuf'],
    ['Sakina', 'Abdul Karim'],
    ['Amina', 'Ghulam Rasool'],
  ],
  sikh: [
    ['Gurbachan Kaur', 'Kartar Singh'],
    ['Pritam Kaur', 'Joginder Singh'],
    ['Harbans Kaur', 'Mohinder Singh'],
    ['Amar Kaur', 'Daljit Singh'],
  ],
  christian: [
    ['Margaret', 'Francis'],
    ['Agnes', 'Lawrence'],
    ['Philomena', 'Sebastian'],
    ['Rosamma', 'Varghese'],
  ],
};
const REGIONAL_GRANDPARENTS: Record<Region, Couple[]> = {
  south: [
    ['Janaki', 'Venkataraman'],
    ['Kamakshi', 'Subramanian'],
  ],
  kerala: [
    ['Saraswathi', 'Narayanan'],
    ['Lakshmikutty', 'Gopalan'],
  ],
  bengali: [
    ['Annapurna', 'Haripada'],
    ['Sarojini', 'Bimal'],
  ],
  marathi: [
    ['Sushila', 'Vasant'],
    ['Kusum', 'Madhav'],
  ],
  gujarati: [
    ['Kokila', 'Ramniklal'],
    ['Hansa', 'Jayantilal'],
  ],
};

/** Functions of a wedding in each tradition. */
const WEDDING_FUNCTIONS: Record<Faith, string[]> = {
  hindu: ['Haldi', 'Sangeet', 'Wedding', 'Reception'],
  muslim: ['Mehndi', 'Nikah', 'Walima'],
  sikh: ['Mehndi', 'Anand Karaj', 'Reception'],
  christian: ['Mehendi', 'Holy Matrimony', 'Reception'],
};

/** A verse each tradition sets on its invitations (the Signature collection's quote section). */
export const SAMPLE_VERSES: Record<Faith | 'any', { quote: string; by: string }> = {
  any: { quote: 'Two souls with but a single thought, two hearts that beat as one.', by: 'Traditional' },
  hindu: { quote: 'With these seven steps, be my friend for life.', by: 'The Saptapadi vow' },
  muslim: {
    quote: 'And among His signs is that He created for you mates from among yourselves, that you may find tranquillity in them; and He placed between you affection and mercy.',
    by: 'Qur’an 30:21',
  },
  sikh: {
    quote: 'They are not said to be husband and wife who merely sit together. They alone are called husband and wife who have one light in two bodies.',
    by: 'Sri Guru Granth Sahib, Ang 788',
  },
  christian: { quote: 'Love is patient, love is kind. It always protects, always trusts, always hopes, always perseveres.', by: '1 Corinthians 13:4, 7' },
};

/** The region of a Hindu design, from its tags. */
function regionOf(tags: readonly string[]): Region | null {
  if (tags.some((t) => t === 'kerala' || t === 'malayali')) return 'kerala';
  if (tags.some((t) => t === 'south-indian' || t === 'tamil' || t === 'telugu' || t === 'kannada' || t === 'seemantham' || t === 'valaikappu' || t === 'upanayanam')) return 'south';
  if (tags.includes('bengali')) return 'bengali';
  if (tags.some((t) => t === 'marathi' || t === 'maharashtrian')) return 'marathi';
  if (tags.includes('gujarati')) return 'gujarati';
  return null;
}

const pick = <T>(list: readonly T[], n: number): T => list[n % list.length]!;
const ALL_FAITHS = ['hindu', 'muslim', 'sikh', 'christian'] as const;

/** The birthday's age from the template's tags (a first birthday unless it is a grown-up's). */
function ageOf(tags: readonly string[]): number {
  for (const [tag, age] of [
    ['first-birthday', 1],
    ['30th', 30],
    ['40th', 40],
    ['50th', 50],
    ['60th', 60],
    ['75th', 75],
    ['teen', 18],
    ['adult', 40],
  ] as const) {
    if (tags.includes(tag)) return age;
  }
  return 1;
}

export interface SampleOptions {
  /** Seeds the choice of names: catalog previews pass the template key, so each template shows its own. */
  seed?: string;
  /** The design's tradition; read from the tags when not given (null: suits every family). */
  faith?: Faith | null;
}

/** The people of a sample invitation: the couple or the person celebrated, their families and their parents. */
export interface SamplePeople {
  /** The template's faith (null: a design for every family, whose sample family is of `family`'s tradition). */
  faith: Faith | null;
  /** The tradition the sample family belongs to (the template's, or for designs that suit everyone, one chosen by the key). */
  tradition: Faith;
  couple: Couple;
  longCouple: Couple;
  person: string;
  longPerson: string;
  family: string;
  /** The bride's (partner one's) and the groom's (partner two's) parents: [father, mother], full names. */
  partnerOneParents: Couple;
  partnerTwoParents: Couple;
  /** "With the blessings of …" in the tradition's honorifics, two lines. */
  blessings: string;
  guest: string;
}

/**
 * Who a sample invitation is for, chosen by the template's faith, region and
 * key (deterministic): a faith template shows a family of its faith, a design
 * for every family one of any faith, a template without a key the first.
 */
export function samplePeople(typeKey: string, tags: readonly string[] = [], options: SampleOptions = {}): SamplePeople {
  const faith = HINDU_RITES.has(typeKey) ? 'hindu' : options.faith !== undefined ? options.faith : faithFromTags(tags);
  const n = options.seed ? seedNumber(options.seed) : 0;
  const region = !faith || faith === 'hindu' ? regionOf(tags) : null;
  const tradition: Faith = faith ?? (region ? 'hindu' : pick(ALL_FAITHS, n >>> 3));
  const couple = pick(typeKey === 'ANNIVERSARY' ? ELDER_COUPLES[tradition] : region ? REGIONAL_COUPLES[region] : COUPLES[tradition], n);
  const families = region ? REGIONAL_FAMILIES[region] : FAMILIES[tradition];
  const family = pick(families, n >>> 2);
  const inLaws = pick(families, (n >>> 2) + 1);
  const people = PEOPLE[tradition];
  const adult = typeKey === 'BIRTHDAY' && ageOf(tags) >= 18;
  const gendered = (girls: string[], boys: string[]) => (tags.includes('girl') ? girls : tags.includes('boy') ? boys : [...boys, ...girls]);
  const person =
    typeKey === 'BABY_SHOWER'
      ? pick(people.women, n)
      : typeKey === 'RETIREMENT'
        ? pick(people.men, n)
        : adult
          ? pick(gendered(people.women, people.men), n)
          : typeKey === 'BIRTHDAY'
            ? pick(gendered(people.girls, people.boys), n)
            : pick(people.boys, n);
  const [fatherOne, motherOne] = pick(PARENTS[tradition], n >>> 4);
  const [fatherTwo, motherTwo] = pick(PARENTS[tradition], (n >>> 4) + 1);
  const partnerOneParents: Couple = [`${fatherOne} ${family}`, `${motherOne} ${family}`];
  const partnerTwoParents: Couple = [`${fatherTwo} ${inLaws}`, `${motherTwo} ${inLaws}`];
  // The elders' blessings: each side's grandparents. Muslim and Christian families name the
  // grandfather first, Hindu and Sikh ones the grandmother (as with the parents: mothersFirst in context.ts).
  const elders = region ? REGIONAL_GRANDPARENTS[region] : GRANDPARENTS[tradition];
  const [grandmaOne, grandpaOne] = pick(elders, n >>> 6);
  const [grandmaTwo, grandpaTwo] = pick(elders, (n >>> 6) + 1);
  const blessings = {
    hindu: `With the blessings of Smt. ${grandmaOne} & Shri ${grandpaOne} ${family}\nand Smt. ${grandmaTwo} & Shri ${grandpaTwo} ${inLaws}`,
    sikh: `With the blessings of Sardarni ${grandmaOne} & S. ${grandpaOne} ${family}\nand Sardarni ${grandmaTwo} & S. ${grandpaTwo} ${inLaws}`,
    muslim: `With the blessings of Janab ${grandpaOne} & Mohtarma ${grandmaOne} ${family}\nand Janab ${grandpaTwo} & Mohtarma ${grandmaTwo} ${inLaws}`,
    christian: `With the blessings of Mr. & Mrs. ${grandpaOne} ${family}\nand Mr. & Mrs. ${grandpaTwo} ${inLaws}`,
  }[tradition];
  return {
    faith,
    tradition,
    couple,
    longCouple: LONG_COUPLES[tradition],
    person,
    longPerson: LONG_PEOPLE[tradition],
    family,
    partnerOneParents,
    partnerTwoParents,
    blessings,
    guest: pick(people.men, (n >>> 5) + 1),
  };
}

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);

/**
 * The preset for an event type, with its names chosen for the template (its
 * faith and key), its wording for the family's tradition, and adjusted for a
 * festival the template is tagged with.
 */
export function samplePreset(typeKey: string, tags: readonly string[] = [], options: SampleOptions = {}): SamplePreset {
  const people = samplePeople(typeKey, tags, options);
  const base = { ...(SAMPLE_PRESETS[typeKey] ?? SAMPLE_PRESETS.CUSTOM!), ...FAITH_VARIANTS[typeKey]?.[people.tradition] };
  const variant = tags.map((t) => SAMPLE_VARIANTS[t]).find(Boolean);
  const [one, two] = people.couple;
  const values = {
    one,
    two,
    longOne: people.longCouple[0],
    longTwo: people.longCouple[1],
    name: people.person,
    longName: people.longPerson,
    family: people.family,
    parents: `${people.partnerOneParents[1]} & ${people.partnerOneParents[0]}`,
    age: String(ageOf(tags)),
  };
  const filled: SamplePreset = {
    title: fill(base.title, values),
    longTitle: fill(base.longTitle, values),
    description: base.description,
    tagline: base.tagline,
    hashtag: fill(base.hashtag, values).replace(/[^#\p{L}\p{N}]/gu, ''),
    functions: typeKey === 'WEDDING' ? WEDDING_FUNCTIONS[people.tradition] : base.functions,
    ...(base.couple ? { couple: [one, two] as [string, string] } : {}),
    ...(base.honoree ? { honoree: fill(base.honoree, values) } : {}),
  };
  return variant ? { ...filled, ...variant } : filled;
}
