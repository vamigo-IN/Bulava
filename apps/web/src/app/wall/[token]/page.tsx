import type { Metadata } from 'next';
import { LiveWall } from '@/components/wall/live-wall';

// A private screen link: never indexed, never leaks the URL onwards.
export const metadata: Metadata = {
  title: 'Live photo wall',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default async function WallPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <LiveWall token={token} />;
}
