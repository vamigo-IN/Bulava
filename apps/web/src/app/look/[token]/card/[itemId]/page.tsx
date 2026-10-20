import type { Metadata } from 'next';
import { LookNotFound, loadLook, loadLookPart } from '@/components/previews/look-data';
import { LookCard, type LookCardData } from '@/components/previews/look-parts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your card preview',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

/** A preview's card (ADR-076): the only way a preview card is seen, always with the watermark. */
export default async function LookCardRoute({ params }: { params: Promise<{ token: string; itemId: string }> }) {
  const { token, itemId } = await params;
  const [view, card] = await Promise.all([loadLook(token), loadLookPart<LookCardData>(token, 'cards', itemId)]);
  if (!view || !card) return <LookNotFound />;
  return <LookCard token={token} view={view} card={card} />;
}
