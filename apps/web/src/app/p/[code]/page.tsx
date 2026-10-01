import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/server-api';
import { UploadRoom, type RoomInfo } from '@/components/photos/upload-room';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Share your photos',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function PhotoRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Za-z0-9]{6,20}$/.test(code)) notFound();
  const room = await serverApi<RoomInfo>(`/public/media-rooms/${code}`, { revalidate: false });
  if (!room) notFound();
  return <UploadRoom code={code} room={room} />;
}
