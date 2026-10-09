import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { CardDesign } from '@bulava/template-schema';
import { CardRenderFrame } from '@/components/cards/render-frame';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * One card for the export renderer (the media worker's Chromium): the design
 * at its own size and nothing else. The token is short-lived and signed; Nginx
 * refuses this path from outside, and the API checks the token again.
 */
export default async function CardRenderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}\.\d{1,12}\.[A-Za-z0-9_-]{20,100}$/.test(token)) notFound();
  const data = await serverApi<{ design: CardDesign; photos: Record<string, string>; watermark: string | null }>(`/public/cards/render/${token}`, { revalidate: false });
  if (!data) notFound();
  return <CardRenderFrame design={data.design} photos={data.photos} watermark={data.watermark} />;
}
