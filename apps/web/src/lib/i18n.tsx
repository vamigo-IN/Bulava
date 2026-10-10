'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createTranslator, getLanguage, type MessageKey, type Translator } from '@bulava/localization';
import { ApiError } from './api';
import { isPlanLimit, planLimitMessage } from './plan-limits';

interface I18nValue {
  language: string;
  direction: 'ltr' | 'rtl';
  t: Translator;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ language, children }: { language: string; children: ReactNode }) {
  const value = useMemo<I18nValue>(
    () => ({ language, direction: getLanguage(language).direction, t: createTranslator(language) }),
    [language],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

export function useT(): Translator {
  return useI18n().t;
}

const ENGLISH = createTranslator('en');

/** The surrounding I18nProvider's translator, or English where there is none (marketing pages share some form fields). */
export function useOptionalT(): Translator {
  return useContext(I18nContext)?.t ?? ENGLISH;
}

/** Map an API error code to a translated message, falling back to the generic error. */
export function errorMessage(t: Translator, error: unknown): string {
  // Plan limits in their own words (how many the plan allows), never "upgrade".
  if (isPlanLimit(error)) return planLimitMessage(t, error);
  if (error instanceof ApiError) {
    const key = `error.${error.code}` as MessageKey;
    const translated = t(key);
    if (translated !== key) return translated;
    // A refusal says so, never "something went wrong".
    if (error.status === 403) return t('error.FORBIDDEN');
    if (error.status < 500) return error.message;
  }
  return t('common.error');
}
