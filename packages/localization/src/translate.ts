import { en, type Catalog, type MessageKey } from './catalogs/en';
import { hi } from './catalogs/hi';
import { hiLatn } from './catalogs/hi-Latn';
import { fallbackChain } from './languages';

const bundled: Record<string, Catalog> = {
  en,
  hi,
  'hi-Latn': hiLatn,
};

export type TranslateParams = Record<string, string | number>;
export type Translator = (key: MessageKey, params?: TranslateParams) => string;

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/**
 * Build a translator for a language. `overrides` are DB-managed translations
 * (Translation table) keyed by locale, layered on top of bundled catalogs.
 */
export function createTranslator(
  language: string,
  overrides: Record<string, Catalog> = {},
): Translator {
  const chain = fallbackChain(language);
  return (key, params) => {
    for (const code of chain) {
      const value = overrides[code]?.[key] ?? bundled[code]?.[key];
      if (value !== undefined) return interpolate(value, params);
    }
    return interpolate(en[key] ?? key, params);
  };
}

export function hasBundledCatalog(language: string): boolean {
  return language in bundled;
}
