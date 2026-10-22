import { ORIGINAL_TRACKS, type PrismaClient } from '@bulava/database';
import type { TemplateDefinition } from '@bulava/template-schema';

/** A track as the gates read it: approved, with its licence. */
export interface GatedTrack {
  id: string;
  title: string;
  storageKey: string;
  status: string;
  license: { commercialUse: boolean; onDemandUse: boolean; expiresAt: Date | null };
}

/** Only approved tracks with a current commercial, on-demand licence ever play (pages and films alike). */
export function isPlayableTrack(track: GatedTrack | null | undefined, now = new Date()): track is GatedTrack {
  return Boolean(
    track &&
      track.status === 'APPROVED' &&
      track.license.commercialUse &&
      track.license.onDemandUse &&
      (!track.license.expiresAt || track.license.expiresAt > now),
  );
}

/** The storage key Bulava's own tracks are seeded under (`definition.music.defaultTrack` names the slug). */
export const ownTrackKey = (slug: string) => `music/${slug}.m4a`;

/**
 * One of Bulava's own tracks by its slug: the row seeded under `music/<slug>.m4a`, or, where the library already held
 * a track of that title in the ORIGINAL collection when it was seeded (demo-music.mjs, a staff upload), that row: the
 * seed leaves such a track alone (seedOriginalMusic), so it is the slug's track.
 */
async function ownTrack(prisma: Pick<PrismaClient, 'music'>, slug: string): Promise<GatedTrack | null> {
  const seeded = await prisma.music.findUnique({ where: { storageKey: ownTrackKey(slug) }, include: { license: true } });
  const title = ORIGINAL_TRACKS.find((t) => t.slug === slug)?.title;
  if (seeded || !title) return seeded;
  return prisma.music.findFirst({ where: { title, collection: 'ORIGINAL' }, orderBy: { createdAt: 'asc' }, include: { license: true } });
}

/**
 * The template's own music: its `defaultMusicId`, else the Bulava track its
 * `defaultTrack` slug names (`ownTrack`), each only when it passes the
 * same gates as every played track (`isPlayableTrack`). A missing or unlicensed
 * default is not the host's fault: it is reported through `warn` and the
 * answer is `null` (no music); this never throws. Shared by films
 * (`VideosService.create`) and website pages (`RenderContextService.resolveMusic`).
 */
export async function findDefaultTrack(
  prisma: Pick<PrismaClient, 'music'>,
  definition: Pick<TemplateDefinition, 'music'>,
  warn: (message: string) => void = () => {},
  now = new Date(),
): Promise<GatedTrack | null> {
  const music = definition.music;
  const candidates: Array<{ find: () => Promise<GatedTrack | null>; label: string }> = [];
  const byId = music?.defaultMusicId;
  const slug = music?.defaultTrack;
  if (byId) candidates.push({ find: () => prisma.music.findUnique({ where: { id: byId }, include: { license: true } }), label: `music ${byId}` });
  if (slug) candidates.push({ find: () => ownTrack(prisma, slug), label: `track "${slug}"` });
  for (const { find, label } of candidates) {
    try {
      const track = await find();
      if (isPlayableTrack(track, now)) return track;
      warn(track ? `The template's ${label} is not approved or not licensed for on-demand use.` : `The template's ${label} is not in the music library.`);
    } catch (err) {
      warn(`Looking up the template's ${label} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return null;
}
