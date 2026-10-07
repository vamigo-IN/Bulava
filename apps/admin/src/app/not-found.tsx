import Link from 'next/link';
import { t } from '@/lib/i18n';

/** An address the console doesn't have (a mistyped or outdated link). */
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-stone-100 p-6">
      <div className="max-w-sm text-center">
        <p className="font-display text-6xl font-semibold text-brand-700">404</p>
        <h1 className="mt-3 text-xl font-semibold text-stone-900">{t('notFound.title')}</h1>
        <p className="mt-2 text-sm text-stone-600">{t('notFound.body')}</p>
        <Link href="/" className="mt-6 inline-flex min-h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-900">
          {t('errorPage.overview')}
        </Link>
      </div>
    </main>
  );
}
