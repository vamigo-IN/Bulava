'use client';

import { History, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useOptionalT } from '@/lib/i18n';
import { recentCards, storedOrders, type StoredOrder } from '@/lib/card-store';

/**
 * A template picked from the gallery: the funnel's first step is recorded as
 * the link is followed (keepalive, so leaving the page does not cancel it).
 */
export function CardTemplateLink({ href, templateKey, category, className, ariaLabel, children }: { href: string; templateKey: string; category: string; className?: string; ariaLabel?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      onClick={() => {
        try {
          void fetch('/api/v1/public/cards/events', {
            method: 'POST',
            keepalive: true,
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json', 'x-bulava-csrf': '1' },
            body: JSON.stringify({ type: 'TEMPLATE_SELECTED', templateKey, meta: { category } }),
          }).catch(() => undefined);
        } catch {
          // Counting never stands in the way of opening the editor.
        }
      }}
    >
      {children}
    </Link>
  );
}

/** Cards started and bought on this device: pick up where you left off, or open a purchase again. */
export function RecentCards() {
  const t = useOptionalT();
  const [recent, setRecent] = useState<Array<{ templateKey: string; templateName: string; savedAt: number }>>([]);
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  useEffect(() => {
    setRecent(recentCards().slice(0, 4));
    setOrders(storedOrders().slice(0, 4));
  }, []);
  if (!recent.length && !orders.length) return null;
  return (
    <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2">
      {recent.length ? (
        <div className="clay rounded-3xl p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <History aria-hidden className="size-4 text-brand-700" /> {t('cards.gallery.continue')}
          </p>
          <ul className="mt-2 space-y-1">
            {recent.map((r) => (
              <li key={r.templateKey}>
                <Link href={`/cards/editor/${r.templateKey}`} className="block truncate rounded-lg px-2 py-1.5 text-sm text-brand-700 hover:bg-white/70">
                  {r.templateName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {orders.length ? (
        <div className="clay rounded-3xl p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Receipt aria-hidden className="size-4 text-brand-700" /> {t('cards.gallery.purchases')}
          </p>
          <ul className="mt-2 space-y-1">
            {orders.map((o) => (
              <li key={o.orderToken}>
                <a href={`/cards/order#${o.orderToken}`} className="flex justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-brand-700 hover:bg-white/70">
                  <span className="truncate">{o.templateName}</span>
                  <span className="shrink-0 text-xs text-stone-500">{o.reference}</span>
                </a>
              </li>
            ))}
          </ul>
          <Link href="/cards/recover" className="mt-1 inline-block px-2 text-xs font-semibold text-stone-600 hover:underline">
            {t('cards.gallery.findPurchase')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
