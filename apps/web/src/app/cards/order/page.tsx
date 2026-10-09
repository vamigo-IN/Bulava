import type { Metadata } from 'next';
import { createTranslator } from '@bulava/localization';
import { OrderFromLink } from '@/components/cards/order-page';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { getSiteConfig } from '@/lib/site-config';

// A paid card's page: its token is after the # (never sent to a server), the order is read in the browser.
export const dynamic = 'force-dynamic';

const t = createTranslator('en');

export const metadata: Metadata = { title: 'Your invitation card', robots: { index: false, follow: false } };

export default async function CardOrderPage() {
  const { site } = await getSiteConfig();
  return (
    <>
      <SiteHeader />
      <main className="min-h-dvh">
        <section data-header-tone="light" className="mx-auto max-w-xl px-4 pt-10 pb-24 sm:pt-14">
          <h1 className="sr-only">{t('cards.order.title')}</h1>
          <div className="clay rounded-[2rem] p-5 sm:p-8">
            <OrderFromLink siteName={site.name} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
