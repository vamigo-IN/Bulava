'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useOptionalT } from '@/lib/i18n';
import { OrderStatus } from './order-status';

/** The order page reads its token from the link's #, so it never reaches a server log. */
export function OrderFromLink({ siteName }: { siteName: string }) {
  const t = useOptionalT();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.replace(/^#/, '');
      setToken(/^[A-Za-z0-9_-]{43}$/.test(hash) ? hash : null);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  if (token === undefined) return null;
  if (!token) {
    return (
      <div className="space-y-3 text-center">
        <p className="font-display text-2xl text-ink">{t('cards.order.noLink')}</p>
        <p className="text-sm text-stone-600">{t('cards.order.noLinkBody')}</p>
        <Link href="/cards/recover" className="btn-3d min-h-11 rounded-xl px-5 text-sm">
          {t('cards.recover.title')}
        </Link>
      </div>
    );
  }
  return <OrderStatus orderToken={token} siteName={siteName} />;
}
