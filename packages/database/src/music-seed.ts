import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ObjectStorage } from '@bulava/storage';
import type { PrismaClient } from '../generated/client';

/**
 * Bulava's own music: tracks generated in-house (infrastructure/scripts/demo-music.mjs),
 * so the platform owns them outright. The audio files live in seed-assets/music.
 */
export const ORIGINAL_TRACKS = [
  { slug: 'original-shubh-aarambh', file: 'shubh-aarambh.m4a', title: 'Shubh Aarambh (Tanpura & Bansuri)', artist: 'Bulava Originals', durationSeconds: 48 },
] as const;

export interface OriginalMusicResult {
  uploaded: number;
  created: number;
}

/**
 * Put the original tracks in object storage and the music library, approved.
 * Idempotent: an object already in storage is not uploaded again, and a track
 * already in the library (the same storage key, or the same title in the
 * ORIGINAL collection, e.g. added by demo-music.mjs) is left alone.
 */
export async function seedOriginalMusic(prisma: PrismaClient, storage: ObjectStorage, assetsDir = path.resolve(__dirname, '../seed-assets/music')): Promise<OriginalMusicResult> {
  let uploaded = 0;
  let created = 0;
  for (const track of ORIGINAL_TRACKS) {
    const storageKey = `music/${track.slug}.m4a`;
    const existing = await prisma.music.findFirst({ where: { OR: [{ storageKey }, { title: track.title, collection: 'ORIGINAL' }] }, select: { id: true } });
    if (existing) continue;
    if (!(await storage.head(storageKey))) {
      await storage.put(storageKey, readFileSync(path.join(assetsDir, track.file)), 'audio/mp4');
      uploaded++;
    }
    const music = await prisma.$transaction(async (tx) => {
      const license = await tx.assetLicense.create({
        data: { licenseType: 'Original work', provider: 'Bulava (generated in-house)', commercialUse: true, onDemandUse: true, socialMediaUse: true, attributionRequired: false, verifiedAt: new Date() },
      });
      return tx.music.create({
        data: { title: track.title, artist: track.artist, durationSeconds: track.durationSeconds, storageKey, collection: 'ORIGINAL', licenseId: license.id, status: 'APPROVED' },
      });
    });
    await prisma.auditLog.create({ data: { actorType: 'SYSTEM', action: 'music.seeded', targetType: 'Music', targetId: music.id, metadata: { title: track.title } } });
    created++;
  }
  return { uploaded, created };
}
