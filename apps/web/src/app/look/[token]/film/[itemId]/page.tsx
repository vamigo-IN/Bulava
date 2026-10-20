import type { Metadata } from 'next';
import { LookNotFound, loadLook, loadLookPart } from '@/components/previews/look-data';
import { LookFilm, type LookFilmData } from '@/components/previews/look-parts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your video invitation preview',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

/** A preview's film (ADR-076): played in the browser with the watermark; the MP4 comes once it is theirs. */
export default async function LookFilmRoute({ params }: { params: Promise<{ token: string; itemId: string }> }) {
  const { token, itemId } = await params;
  const [view, film] = await Promise.all([loadLook(token), loadLookPart<LookFilmData>(token, 'films', itemId)]);
  if (!view || !film) return <LookNotFound />;
  return <LookFilm token={token} view={view} film={film} />;
}
