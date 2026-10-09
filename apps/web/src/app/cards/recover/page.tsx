import type { Metadata } from 'next';
import { createTranslator } from '@bulava/localization';
import { RecoverForm } from '@/components/cards/recover-form';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';

const t = createTranslator('en');

export const metadata: Metadata = {
  title: 'Find a card you bought',
  description: 'Get the links to the invitation cards you bought, by email.',
  alternates: { canonical: '/cards/recover' },
};

export default function CardRecoverPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-dvh">
        <section data-header-tone="light" className="mx-auto max-w-lg px-4 pt-12 pb-24 sm:pt-16">
          <div className="text-center">
            <p className="eyebrow text-brand-700">{t('cards.recover.eyebrow')}</p>
            <h1 className="mt-3 font-display text-4xl text-ink">{t('cards.recover.title')}</h1>
            <p className="mt-3 text-stone-600">{t('cards.recover.body')}</p>
          </div>
          <div className="clay mt-8 rounded-[2rem] p-5 sm:p-8">
            <RecoverForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
