export type TextDirection = 'ltr' | 'rtl';

export interface LanguageDefinition {
  /** BCP 47 code used everywhere in Bulava (DB, URLs, catalogs). */
  code: string;
  name: string;
  nativeName: string;
  /** ISO 15924 script code; drives font selection. */
  script: string;
  direction: TextDirection;
  /** Locale passed to Intl for dates/numbers. */
  intlLocale: string;
  /** Intl numbering system for native digits, if the script has them. */
  nativeNumberingSystem?: string;
  /** Catalog to fall back to before English. */
  fallback?: string;
}

/**
 * Initial language registry. The DB `languages` table is seeded from this list
 * and is the runtime source of truth for enabling/disabling languages; adding a
 * language means adding a catalog + a row, not changing application code.
 */
export const LANGUAGES: readonly LanguageDefinition[] = [
  { code: 'en', name: 'English', nativeName: 'English', script: 'Latn', direction: 'ltr', intlLocale: 'en-IN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', script: 'Deva', direction: 'ltr', intlLocale: 'hi-IN', nativeNumberingSystem: 'deva' },
  { code: 'hi-Latn', name: 'Hinglish', nativeName: 'Hinglish', script: 'Latn', direction: 'ltr', intlLocale: 'en-IN', fallback: 'en' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', script: 'Deva', direction: 'ltr', intlLocale: 'mr-IN', nativeNumberingSystem: 'deva', fallback: 'hi' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', script: 'Gujr', direction: 'ltr', intlLocale: 'gu-IN', nativeNumberingSystem: 'gujr' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', script: 'Guru', direction: 'ltr', intlLocale: 'pa-IN', nativeNumberingSystem: 'guru' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', script: 'Beng', direction: 'ltr', intlLocale: 'bn-IN', nativeNumberingSystem: 'beng' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', script: 'Taml', direction: 'ltr', intlLocale: 'ta-IN', nativeNumberingSystem: 'tamldec' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', script: 'Telu', direction: 'ltr', intlLocale: 'te-IN', nativeNumberingSystem: 'telu' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', script: 'Knda', direction: 'ltr', intlLocale: 'kn-IN', nativeNumberingSystem: 'knda' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', script: 'Mlym', direction: 'ltr', intlLocale: 'ml-IN', nativeNumberingSystem: 'mlym' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', script: 'Orya', direction: 'ltr', intlLocale: 'or-IN', nativeNumberingSystem: 'orya' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', script: 'Beng', direction: 'ltr', intlLocale: 'as-IN', nativeNumberingSystem: 'beng', fallback: 'bn' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', script: 'Arab', direction: 'rtl', intlLocale: 'ur-IN', nativeNumberingSystem: 'arabext', fallback: 'hi' },
];

export const DEFAULT_LANGUAGE = 'en';

const byCode = new Map(LANGUAGES.map((l) => [l.code, l]));

export function getLanguage(code: string | null | undefined): LanguageDefinition {
  return (code && byCode.get(code)) || byCode.get(DEFAULT_LANGUAGE)!;
}

export function isSupportedLanguage(code: string): boolean {
  return byCode.has(code);
}

/** Fallback chain for a language, ending in English. e.g. mr -> hi -> en */
export function fallbackChain(code: string): string[] {
  const chain: string[] = [];
  let current: string | undefined = code;
  while (current && !chain.includes(current)) {
    chain.push(current);
    current = byCode.get(current)?.fallback;
  }
  if (!chain.includes(DEFAULT_LANGUAGE)) chain.push(DEFAULT_LANGUAGE);
  return chain;
}
