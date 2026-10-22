import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ObjectStorage } from '@bulava/storage';
import type { PrismaClient } from '../generated/client';

/**
 * Bulava's own music: tracks composed and synthesised in-house, so the platform
 * owns them outright. The audio files live in seed-assets/music: the first came from
 * infrastructure/scripts/demo-music.mjs, the collection from compose-music.mjs
 * (deterministic; re-run it to regenerate them). Templates name a track by its slug
 * (`music.defaultTrack`); it is seeded under `music/<slug>.m4a`, unless the library
 * already held a track of its title in the ORIGINAL collection, which then stands for
 * it (the API's findDefaultTrack looks up the key, then the title).
 */
export const ORIGINAL_TRACKS = [
  { slug: 'original-shubh-aarambh', file: 'shubh-aarambh.m4a', title: 'Shubh Aarambh (Tanpura & Bansuri)', artist: 'Bulava Originals', durationSeconds: 48 },
  { slug: 'original-shehnai-darbar', file: 'original-shehnai-darbar.m4a', title: 'Shehnai Darbar', artist: 'Bulava Originals', durationSeconds: 72 },
  { slug: 'original-mehfil-santoor', file: 'original-mehfil-santoor.m4a', title: 'Mehfil-e-Santoor', artist: 'Bulava Originals', durationSeconds: 72 },
  { slug: 'original-anand-dawn', file: 'original-anand-dawn.m4a', title: 'Anand Dawn', artist: 'Bulava Originals', durationSeconds: 72 },
  { slug: 'original-processional', file: 'original-processional.m4a', title: 'Processional', artist: 'Bulava Originals', durationSeconds: 71 },
  { slug: 'original-promise-strings', file: 'original-promise-strings.m4a', title: 'A Promise in Strings', artist: 'Bulava Originals', durationSeconds: 71 },
  { slug: 'original-carnival-tumble', file: 'original-carnival-tumble.m4a', title: 'Carnival Tumble', artist: 'Bulava Originals', durationSeconds: 64 },
  { slug: 'original-ballroom-waltz', file: 'original-ballroom-waltz.m4a', title: 'Ballroom Waltz', artist: 'Bulava Originals', durationSeconds: 66 },
  { slug: 'original-lori-music-box', file: 'original-lori-music-box.m4a', title: 'Lori (Music Box)', artist: 'Bulava Originals', durationSeconds: 71 },
  { slug: 'original-prabhat-bansuri', file: 'original-prabhat-bansuri.m4a', title: 'Prabhat Bansuri', artist: 'Bulava Originals', durationSeconds: 72 },
  { slug: 'original-ganga-bells', file: 'original-ganga-bells.m4a', title: 'Ganga Bells', artist: 'Bulava Originals', durationSeconds: 60 },
  { slug: 'original-gayatri-drone', file: 'original-gayatri-drone.m4a', title: 'Gayatri Drone', artist: 'Bulava Originals', durationSeconds: 60 },
  { slug: 'original-shubh-dhol', file: 'original-shubh-dhol.m4a', title: 'Shubh Dhol', artist: 'Bulava Originals', durationSeconds: 60 },
  { slug: 'original-sandhya-aarti', file: 'original-sandhya-aarti.m4a', title: 'Sandhya Aarti', artist: 'Bulava Originals', durationSeconds: 60 },
  { slug: 'original-roshni-dhamaal', file: 'original-roshni-dhamaal.m4a', title: 'Roshni Dhamaal', artist: 'Bulava Originals', durationSeconds: 60 },
  { slug: 'original-keynote-ambient', file: 'original-keynote-ambient.m4a', title: 'Keynote', artist: 'Bulava Originals', durationSeconds: 72 },
  { slug: 'original-alma-anthem', file: 'original-alma-anthem.m4a', title: 'Alma Mater', artist: 'Bulava Originals', durationSeconds: 68 },
  { slug: 'original-mela-chowk', file: 'original-mela-chowk.m4a', title: 'Mela Chowk', artist: 'Bulava Originals', durationSeconds: 58 },
  { slug: 'original-golden-veranda', file: 'original-golden-veranda.m4a', title: 'Golden Veranda', artist: 'Bulava Originals', durationSeconds: 71 },
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
