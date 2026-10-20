import Link from 'next/link';
import { createTranslator } from '@bulava/localization';
import { LOOK_HEADER, LOOK_TOKEN, type LookView } from '@/lib/previews';
import { serverApi } from '@/lib/server-api';

const t = createTranslator('en');

/** A preview page's data, read on the server (the token goes to the API in a header); null when the link is not valid. */
export function loadLook(token: string): Promise<LookView | null> {
  if (!LOOK_TOKEN.test(token)) return Promise.resolve(null);
  return serverApi<LookView>('/public/looks', { revalidate: false, headers: { [LOOK_HEADER]: token } });
}

/** One card or film of a preview page, read on the server. */
export function loadLookPart<T>(token: string, part: 'cards' | 'films', itemId: string): Promise<T | null> {
  if (!LOOK_TOKEN.test(token) || !/^[0-9a-f-]{36}$/.test(itemId)) return Promise.resolve(null);
  return serverApi<T>(`/public/looks/${part}/${itemId}`, { revalidate: false, headers: { [LOOK_HEADER]: token } });
}

/** A link that was replaced, mistyped or never existed. */
export function LookNotFound() {
  return (
    <main className="paper flex min-h-dvh items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-4xl text-brand-700">{t('look.notFound.title')}</h1>
        <p className="mt-3 leading-relaxed text-stone-600">{t('look.notFound.body')}</p>
        <Link href="/get-preview" className="btn-3d mt-7 inline-flex min-h-12 items-center rounded-full px-6">
          {t('look.ended.cta')}
        </Link>
      </div>
    </main>
  );
}
