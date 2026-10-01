import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TeamJoin } from '@/components/team/team-join';

// Rendered per request so the page carries its own CSP nonce (see src/middleware.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Join the team',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function TeamJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  return <TeamJoin token={token} />;
}
