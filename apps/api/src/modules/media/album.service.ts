import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import type { MediaAlbum, MediaRoom, Prisma } from '@bulava/database';
import { ALLOWED_UPLOAD_TYPES, ObjectStorage, StorageKeys } from '@bulava/storage';
import { FEATURE_KEYS, type CreateSubAlbumInput, type TeamUploadRequestInput, type UpdateAlbumInput, type UpdateSubAlbumInput } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { STORAGE } from '../../infrastructure/storage/storage.module';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EventLinksService } from '../domains/event-links.service';
import { LiveWallService } from './live-wall.service';

/** The hidden album for the host's design photos: never the main album, never in guest galleries. */
export const DESIGN_ROOM_SLUG = 'design-photos';
const SIGNED_TTL = 3600;
const roomCode = () => randomBytes(8).toString('base64url').replace(/[-_]/g, 'x').slice(0, 10);

type Tx = Prisma.TransactionClient;

export interface DownloadPolicy {
  guestsCanDownload: boolean;
  originalQuality: boolean;
}

export function downloadPolicy(room: Pick<MediaRoom, 'downloadPolicy'>): DownloadPolicy {
  const p = (room.downloadPolicy ?? {}) as Partial<DownloadPolicy>;
  return { guestsCanDownload: p.guestsCanDownload === true, originalQuality: p.originalQuality === true };
}

type FunctionInfo = { id: string; name: string; sortOrder: number; startsAt: Date | null; visibility: string; status: string; deletedAt: Date | null };

/**
 * Sub-albums in the order everyone sees them: one per function in the
 * functions' order, then the host's own albums, then General.
 */
export function orderAlbums<T extends Pick<MediaAlbum, 'kind' | 'functionId' | 'createdAt'>>(albums: T[], functions: Array<Pick<FunctionInfo, 'id' | 'sortOrder' | 'startsAt'>>): T[] {
  const fnOrder = new Map(functions.map((f, i) => [f.id, [f.sortOrder, f.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER, i] as const]));
  const rank = (a: T) => (a.kind === 'FUNCTION' && a.functionId && fnOrder.has(a.functionId) ? 0 : a.kind === 'GENERAL' ? 2 : 1);
  return [...albums].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    if (rank(a) === 0) {
      const [sa, ta, ia] = fnOrder.get(a.functionId!)!;
      const [sb, tb, ib] = fnOrder.get(b.functionId!)!;
      return sa - sb || ta - tb || ia - ib;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/**
 * The sub-album an upload page suggests: the function happening today (or the
 * nearest one within a day), otherwise General.
 */
export function suggestedAlbumId(albums: Array<Pick<MediaAlbum, 'id' | 'kind' | 'functionId'>>, functions: Array<Pick<FunctionInfo, 'id' | 'startsAt'>>, now = new Date()): string | null {
  const starts = new Map(functions.map((f) => [f.id, f.startsAt]));
  let best: { id: string; distance: number } | null = null;
  for (const album of albums) {
    const at = album.functionId ? starts.get(album.functionId) : null;
    if (!at) continue;
    const distance = Math.abs(at.getTime() - now.getTime());
    if (distance <= 24 * 3600 * 1000 && (!best || distance < best.distance)) best = { id: album.id, distance };
  }
  return best?.id ?? albums.find((a) => a.kind === 'GENERAL')?.id ?? albums[0]?.id ?? null;
}

/**
 * One photo album per event (spec "event media", redesigned): a single upload
 * link and QR code, one guest gallery and one live wall, organised into
 * sub-albums. Every function gets its own sub-album automatically (names
 * follow the function), there is always a General one, and hosts can add
 * their own. Photographers and guests choose a sub-album when they upload;
 * hosts choose which sub-albums the gallery and the live wall show.
 */
@Injectable()
export class AlbumService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    private readonly queues: QueueService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService,
    private readonly wall: LiveWallService,
    private readonly links: EventLinksService,
  ) {}

  // ─────────────────────────── The main album ───────────────────────────

  private async functions(eventId: string, tx: Tx | PrismaService = this.prisma): Promise<FunctionInfo[]> {
    return tx.eventFunction.findMany({
      where: { eventId },
      select: { id: true, name: true, sortOrder: true, startsAt: true, visibility: true, status: true, deletedAt: true },
      orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }],
    });
  }

  private async uniqueSlug(tx: Tx, eventId: string, base: string): Promise<string> {
    const taken = new Set((await tx.mediaRoom.findMany({ where: { eventId }, select: { slug: true } })).map((r) => r.slug));
    let slug = base;
    for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
    return slug;
  }

  /**
   * The event's main album, made ready: adopts the oldest existing album or
   * creates one (with its QR code), keeps a General sub-album and one per
   * function in step with the functions, and folds any other album into it
   * (photos move into a sub-album named after it, its QR codes now point here,
   * so printed codes keep working). Safe to call on every read.
   */
  async ensure(eventId: string): Promise<MediaRoom> {
    const rooms = await this.prisma.mediaRoom.findMany({ where: { eventId, slug: { not: DESIGN_ROOM_SLUG } }, orderBy: { createdAt: 'asc' } });
    let main = rooms.find((r) => r.isMain) ?? null;

    if (!main) {
      main = await this.prisma.$transaction(async (tx) => {
        const adopted = rooms[0];
        if (adopted) return tx.mediaRoom.update({ where: { id: adopted.id }, data: { isMain: true } });
        const event = await tx.event.findUniqueOrThrow({ where: { id: eventId }, select: { title: true } });
        return tx.mediaRoom.create({ data: { eventId, name: event.title.slice(0, 80) || 'Photos', slug: await this.uniqueSlug(tx, eventId, 'photos'), isMain: true } });
      }).catch(async (error: unknown) => {
        // Another request made the main album first (one per event, by a unique index).
        const winner = await this.prisma.mediaRoom.findFirst({ where: { eventId, isMain: true } });
        if (!winner) throw error;
        return winner;
      });
    }
    const mainId = main.id;

    const hasQr = await this.prisma.qRCode.count({ where: { eventId, targetId: mainId, type: 'PHOTO_UPLOAD', active: true } });
    if (!hasQr) await this.prisma.qRCode.create({ data: { eventId, type: 'PHOTO_UPLOAD', targetId: mainId, code: roomCode() } });

    const functions = await this.functions(eventId);
    let albums = await this.prisma.mediaAlbum.findMany({ where: { roomId: mainId } });
    const missing = functions.filter((f) => !f.deletedAt && !albums.some((a) => a.functionId === f.id));
    const needsGeneral = !albums.some((a) => a.kind === 'GENERAL');
    if (missing.length || needsGeneral) {
      await this.prisma.mediaAlbum.createMany({
        data: [
          ...(needsGeneral ? [{ roomId: mainId, eventId, kind: 'GENERAL' as const, name: 'General' }] : []),
          ...missing.map((f) => ({ roomId: mainId, eventId, kind: 'FUNCTION' as const, name: f.name, functionId: f.id })),
        ],
        skipDuplicates: true,
      });
      albums = await this.prisma.mediaAlbum.findMany({ where: { roomId: mainId } });
    }
    // Function albums follow their function's name.
    for (const album of albums) {
      const fn = album.functionId ? functions.find((f) => f.id === album.functionId) : null;
      if (fn && album.kind === 'FUNCTION' && fn.name !== album.name) await this.prisma.mediaAlbum.update({ where: { id: album.id }, data: { name: fn.name } });
    }

    const general = albums.find((a) => a.kind === 'GENERAL')!;
    // Fold other albums into the main one.
    for (const legacy of rooms.filter((r) => r.id !== mainId)) {
      // A concurrent request may have folded it already; the next read sees the result.
      await this.prisma.$transaction(async (tx) => {
        const byFunction = legacy.functionId ? albums.find((a) => a.functionId === legacy.functionId) : null;
        const target =
          byFunction ??
          (await tx.mediaAlbum.findFirst({ where: { roomId: mainId, kind: 'CUSTOM', name: legacy.name } })) ??
          (await tx.mediaAlbum.create({ data: { roomId: mainId, eventId, kind: 'CUSTOM', name: legacy.name.slice(0, 80) } }));
        await tx.mediaItem.updateMany({ where: { roomId: legacy.id }, data: { roomId: mainId, albumId: target.id } });
        await tx.qRCode.updateMany({ where: { eventId, targetId: legacy.id, type: 'PHOTO_UPLOAD' }, data: { targetId: mainId } });
        await tx.mediaRoom.delete({ where: { id: legacy.id } });
        await this.audit.record({ actorType: 'SYSTEM', action: 'media_room.merged', targetType: 'MediaRoom', targetId: legacy.id, eventId, metadata: { into: mainId, albumId: target.id } }, tx);
      }).catch(() => undefined);
    }
    // Photos from before sub-albums: the main album's function, otherwise General.
    const homeAlbum = main.functionId ? (albums.find((a) => a.functionId === main!.functionId) ?? general) : general;
    await this.prisma.mediaItem.updateMany({ where: { roomId: mainId, albumId: null }, data: { albumId: homeAlbum.id } });
    return main;
  }

  /** The main album only if it exists (public paths that must not create anything). */
  findMain(eventId: string) {
    return this.prisma.mediaRoom.findFirst({ where: { eventId, isMain: true } });
  }

  private async qrCodeFor(eventId: string, roomId: string): Promise<string | null> {
    const qr = await this.prisma.qRCode.findFirst({ where: { eventId, targetId: roomId, type: 'PHOTO_UPLOAD', active: true }, orderBy: { createdAt: 'asc' } });
    return qr?.code ?? null;
  }

  /** Everything the Photos page shows: the album's links and settings, and its sub-albums with counts. */
  async get(access: EventAccessContext) {
    const main = await this.ensure(access.eventId);
    const [room, functions, albums, counts, code, origin] = await Promise.all([
      this.prisma.mediaRoom.findUniqueOrThrow({ where: { id: main.id } }),
      this.functions(access.eventId),
      this.prisma.mediaAlbum.findMany({ where: { roomId: main.id } }),
      this.prisma.mediaItem.groupBy({ by: ['albumId', 'status'], where: { roomId: main.id, status: { notIn: ['DELETED', 'UPLOADING', 'REJECTED'] } }, _count: { _all: true } }),
      this.qrCodeFor(access.eventId, main.id),
      this.links.guestOrigin(access.eventId),
    ]);
    const count = (albumId: string | null, pending = false) =>
      counts.filter((c) => (albumId === null || c.albumId === albumId) && (!pending || c.status === 'PENDING_MODERATION')).reduce((n, c) => n + c._count._all, 0);
    const fnById = new Map(functions.map((f) => [f.id, f]));
    return {
      id: room.id,
      name: room.name,
      galleryVisibility: room.galleryVisibility,
      moderationMode: room.moderationMode,
      uploadsEnabled: room.uploadsEnabled,
      downloadPolicy: downloadPolicy(room),
      liveWallEnabled: room.liveWallEnabled,
      wallUrl: this.wall.hostWallUrl(room),
      qrCode: code,
      uploadUrl: code ? `${origin}/p/${code}` : null,
      galleryUrl: code ? `${origin}/p/${code}/gallery` : null,
      itemCount: count(null),
      pendingCount: count(null, true),
      albums: orderAlbums(albums, functions).map((a) => {
        const fn = a.functionId ? fnById.get(a.functionId) : undefined;
        return {
          id: a.id,
          kind: a.kind,
          name: a.name,
          functionId: a.functionId,
          functionStartsAt: fn?.startsAt ?? null,
          functionRemoved: a.kind === 'FUNCTION' && (!fn || !!fn.deletedAt),
          showInGallery: a.showInGallery,
          showOnWall: a.showOnWall,
          itemCount: count(a.id),
          pendingCount: count(a.id, true),
        };
      }),
    };
  }

  async update(access: EventAccessContext, input: UpdateAlbumInput, meta: RequestMeta) {
    const main = await this.ensure(access.eventId);
    const current = downloadPolicy(main);
    if (input.liveWallEnabled) await this.wall.ensureToken(main.id);
    await this.prisma.mediaRoom.update({
      where: { id: main.id },
      data: {
        name: input.name,
        galleryVisibility: input.galleryVisibility,
        moderationMode: input.moderationMode,
        uploadsEnabled: input.uploadsEnabled,
        liveWallEnabled: input.liveWallEnabled,
        downloadPolicy: { guestsCanDownload: input.guestsCanDownload ?? current.guestsCanDownload, originalQuality: input.originalQuality ?? current.originalQuality },
      },
    });
    await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'album.updated', targetType: 'MediaRoom', targetId: main.id, eventId: access.eventId, metadata: { fields: Object.keys(input) }, meta });
    return this.get(access);
  }

  async qrSvg(eventId: string): Promise<string> {
    const main = await this.ensure(eventId);
    const code = await this.qrCodeFor(eventId, main.id);
    if (!code) throw AppError.notFound('QR code');
    return QRCode.toString(`${await this.links.guestOrigin(eventId)}/p/${code}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  }

  async rotateWall(access: EventAccessContext, meta: RequestMeta) {
    const main = await this.ensure(access.eventId);
    return this.wall.rotate(access, main.id, meta);
  }

  // ─────────────────────────── Sub-albums ───────────────────────────

  private async subAlbum(access: EventAccessContext, albumId: string) {
    const album = await this.prisma.mediaAlbum.findFirst({ where: { id: albumId, eventId: access.eventId, room: { isMain: true } } });
    if (!album) throw AppError.notFound('Album');
    return album;
  }

  async createSubAlbum(access: EventAccessContext, input: CreateSubAlbumInput, meta: RequestMeta) {
    const main = await this.ensure(access.eventId);
    const album = await this.prisma.mediaAlbum.create({ data: { roomId: main.id, eventId: access.eventId, kind: 'CUSTOM', name: input.name } });
    await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'album.sub_created', targetType: 'MediaAlbum', targetId: album.id, eventId: access.eventId, meta });
    return this.get(access);
  }

  async updateSubAlbum(access: EventAccessContext, albumId: string, input: UpdateSubAlbumInput, meta: RequestMeta) {
    const album = await this.subAlbum(access, albumId);
    if (input.name !== undefined && album.kind === 'FUNCTION') {
      throw new AppError('VALIDATION_FAILED', 'Function albums are named after their function. Rename the function instead.');
    }
    await this.prisma.mediaAlbum.update({ where: { id: album.id }, data: { name: input.name, showInGallery: input.showInGallery, showOnWall: input.showOnWall } });
    await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'album.sub_updated', targetType: 'MediaAlbum', targetId: album.id, eventId: access.eventId, metadata: { fields: Object.keys(input) }, meta });
    return this.get(access);
  }

  /** Removes a host-made sub-album; its photos move to General. */
  async deleteSubAlbum(access: EventAccessContext, albumId: string, meta: RequestMeta) {
    const album = await this.subAlbum(access, albumId);
    if (album.kind !== 'CUSTOM') throw new AppError('VALIDATION_FAILED', 'Only albums you added can be removed.');
    const general = await this.prisma.mediaAlbum.findFirstOrThrow({ where: { roomId: album.roomId, kind: 'GENERAL' } });
    await this.prisma.$transaction(async (tx) => {
      await tx.mediaItem.updateMany({ where: { albumId: album.id }, data: { albumId: general.id } });
      await tx.mediaAlbum.delete({ where: { id: album.id } });
      await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'album.sub_deleted', targetType: 'MediaAlbum', targetId: album.id, eventId: access.eventId, meta }, tx);
    });
    return this.get(access);
  }

  /** A sub-album's photos for the team (including ones waiting for approval). */
  async items(access: EventAccessContext, albumId: string) {
    const album = await this.subAlbum(access, albumId);
    const items = await this.prisma.mediaItem.findMany({
      where: { albumId: album.id, status: { notIn: ['DELETED', 'UPLOADING'] } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return Promise.all(
      items.map(async (i) => ({
        id: i.id,
        kind: i.kind,
        status: i.status,
        uploaderName: i.uploaderName,
        width: i.width,
        height: i.height,
        sizeBytes: Number(i.sizeBytes),
        createdAt: i.createdAt,
        moderationNotes: i.moderationNotes,
        thumbUrl: i.thumbnailKey ? await this.storage.presignDownload(i.thumbnailKey, { expiresInSeconds: SIGNED_TTL }) : null,
        viewUrl: await this.storage.presignDownload(i.optimizedKey ?? i.originalKey, { expiresInSeconds: SIGNED_TTL }),
      })),
    );
  }

  // ─────────────────────────── Team uploads ───────────────────────────

  /**
   * A photographer (or anyone with media.upload) uploads straight into a
   * sub-album: a signed PUT to private storage, verified on completion and
   * processed by the media worker. Team uploads skip moderation.
   */
  async requestTeamUpload(access: EventAccessContext, input: TeamUploadRequestInput) {
    const album = await this.subAlbum(access, input.albumId);
    const type = ALLOWED_UPLOAD_TYPES[input.contentType];
    if (!type || (type.kind !== 'image' && type.kind !== 'video')) throw new AppError('UPLOAD_REJECTED', 'Only photos and videos can be uploaded.');
    if (input.sizeBytes > type.maxBytes) throw new AppError('UPLOAD_REJECTED', `Files must be under ${Math.round(type.maxBytes / 1024 / 1024)} MB.`);
    const features = await this.entitlements.forEvent(access.eventId);
    const used = await this.prisma.mediaItem.count({ where: { eventId: access.eventId, status: { notIn: ['DELETED', 'REJECTED'] } } });
    EntitlementsService.assertWithinLimit(features, FEATURE_KEYS.PHOTOS_MAX, used);
    const uploader = await this.prisma.user.findUnique({ where: { id: access.userId }, select: { name: true } });
    const item = await this.prisma.mediaItem.create({
      data: {
        roomId: album.roomId,
        albumId: album.id,
        eventId: access.eventId,
        uploaderUserId: access.userId,
        uploaderName: uploader?.name ?? null,
        kind: type.kind,
        originalKey: `pending-${randomBytes(12).toString('hex')}`,
        mimeType: input.contentType,
        sizeBytes: BigInt(input.sizeBytes),
        status: 'UPLOADING',
      },
    });
    const key = StorageKeys.mediaOriginal(access.eventId, item.id, type.ext);
    await this.prisma.mediaItem.update({ where: { id: item.id }, data: { originalKey: key } });
    return { itemId: item.id, uploadUrl: await this.storage.presignUpload(key, input.contentType, 900), headers: { 'Content-Type': input.contentType }, expiresInSeconds: 900 };
  }

  async completeTeamUpload(access: EventAccessContext, itemId: string) {
    const item = await this.prisma.mediaItem.findFirst({ where: { id: itemId, eventId: access.eventId, uploaderUserId: access.userId, album: { room: { isMain: true } } } });
    if (!item) throw AppError.notFound('Upload');
    if (item.status !== 'UPLOADING') return { status: item.status };
    const head = await this.storage.head(item.originalKey);
    if (!head) throw new AppError('UPLOAD_REJECTED', 'The file was not received. Please try again.');
    const limit = ALLOWED_UPLOAD_TYPES[item.mimeType]?.maxBytes ?? 0;
    if ((head.ContentLength ?? 0) > limit || (head.ContentType && head.ContentType !== item.mimeType)) {
      await this.storage.delete(item.originalKey).catch(() => undefined);
      await this.prisma.mediaItem.update({ where: { id: item.id }, data: { status: 'REJECTED', moderationNotes: 'Failed upload validation' } });
      throw new AppError('UPLOAD_REJECTED', 'This file could not be accepted.');
    }
    await this.prisma.mediaItem.update({ where: { id: item.id }, data: { status: 'PROCESSING', sizeBytes: BigInt(head.ContentLength ?? 0) } });
    await this.queues.add('media-processing', { mediaItemId: item.id }, { jobId: `media-${item.id}` });
    return { status: 'PROCESSING' as const };
  }
}
