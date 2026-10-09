import { Injectable, Inject } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { authorizedFunctions, validateInvitationToken } from '@bulava/auth';
import type { GalleryVisibility, MediaAlbum, MediaItem, MediaRoom, ModerationMode, Prisma } from '@bulava/database';
import { ALLOWED_UPLOAD_TYPES, ObjectStorage, StorageKeys } from '@bulava/storage';
import type { GalleryImage, PhotoSlot } from '@bulava/template-schema';
import { FEATURE_KEYS, type MediaUploadRequestInput, z } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { STORAGE } from '../../infrastructure/storage/storage.module';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuditService } from '../audit/audit.service';
import { AudienceService, type EventAudienceFacts, type GuestAudienceFacts } from '../audience/audience.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { InvitationTokenService } from '../invitations/invitation-token.service';
import { AlbumService, DESIGN_ROOM_SLUG, downloadPolicy, orderAlbums, suggestedAlbumId } from './album.service';

/** A photo the host uploads straight into their design (cover, portraits…). */
export const DesignUploadSchema = z.object({
  contentType: z.string().max(100),
  sizeBytes: z.number().int().positive(),
});
export type DesignUploadInput = z.infer<typeof DesignUploadSchema>;

export const ModerateSchema = z.object({ decision: z.enum(['APPROVE', 'REJECT']), notes: z.string().max(300).optional() });

const SIGNED_TTL = 3600;

type Viewer = { kind: 'host' } | { kind: 'guest'; guest: GuestAudienceFacts; event: EventAudienceFacts; name?: string } | { kind: 'anonymous' };

/**
 * Photo uploads, moderation and galleries around each event's one album
 * (AlbumService keeps it and its sub-albums ready). Originals never leave
 * private storage except through short-lived signed URLs, and gallery
 * visibility is enforced on every request. The album link is for viewing:
 * the team uploads from the dashboard, and invited guests only from their own
 * invitation link, when the host allows it (`uploadsEnabled`).
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    private readonly queues: QueueService,
    private readonly audience: AudienceService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService,
    private readonly analytics: AnalyticsService,
    private readonly albums: AlbumService,
  ) {}

  // ─────────────────────────── Host: photos ───────────────────────────

  private async toHostItem(i: MediaItem) {
    return {
      id: i.id,
      kind: i.kind,
      status: i.status,
      albumId: i.albumId,
      uploaderName: i.uploaderName,
      width: i.width,
      height: i.height,
      sizeBytes: Number(i.sizeBytes),
      createdAt: i.createdAt,
      moderationNotes: i.moderationNotes,
      thumbUrl: i.thumbnailKey ? await this.storage.presignDownload(i.thumbnailKey, { expiresInSeconds: SIGNED_TTL }) : null,
      viewUrl: await this.storage.presignDownload(i.optimizedKey ?? i.originalKey, { expiresInSeconds: SIGNED_TTL }),
    };
  }

  async moderate(access: EventAccessContext, itemId: string, decision: 'APPROVE' | 'REJECT', notes: string | undefined, meta: RequestMeta) {
    const item = await this.prisma.mediaItem.findFirst({ where: { id: itemId, eventId: access.eventId, status: { not: 'DELETED' } } });
    if (!item) throw AppError.notFound('Photo');
    if (item.status === 'UPLOADING' || item.status === 'PROCESSING') throw new AppError('MEDIA_NOT_READY', 'This photo is still processing.');
    await this.prisma.mediaItem.update({ where: { id: itemId }, data: { status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', moderationNotes: notes ?? null } });
    await this.audit.record({ actorType: 'USER', actorId: access.userId, action: `media.${decision.toLowerCase()}d`, targetType: 'MediaItem', targetId: itemId, eventId: access.eventId, meta });
  }

  /** Moves a photo to another sub-album of the event's album. */
  async moveItem(access: EventAccessContext, itemId: string, albumId: string, meta: RequestMeta) {
    const [item, album] = await Promise.all([
      this.prisma.mediaItem.findFirst({ where: { id: itemId, eventId: access.eventId, status: { not: 'DELETED' }, room: { isMain: true } } }),
      this.prisma.mediaAlbum.findFirst({ where: { id: albumId, eventId: access.eventId, room: { isMain: true } } }),
    ]);
    if (!item) throw AppError.notFound('Photo');
    if (!album) throw AppError.notFound('Album');
    await this.prisma.mediaItem.update({ where: { id: item.id }, data: { albumId: album.id } });
    await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'media.moved', targetType: 'MediaItem', targetId: item.id, eventId: access.eventId, metadata: { albumId: album.id }, meta });
  }

  async deleteItem(access: EventAccessContext, itemId: string, meta: RequestMeta) {
    const item = await this.prisma.mediaItem.findFirst({ where: { id: itemId, eventId: access.eventId, status: { not: 'DELETED' } } });
    if (!item) throw AppError.notFound('Photo');
    await this.prisma.mediaItem.update({ where: { id: itemId }, data: { status: 'DELETED', deletedAt: new Date() } });
    // Remove the objects; the DB row stays for the audit trail.
    await Promise.all([item.originalKey, item.optimizedKey, item.thumbnailKey].filter((k): k is string => !!k).map((k) => this.storage.delete(k).catch(() => undefined)));
    await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'media.deleted', targetType: 'MediaItem', targetId: itemId, eventId: access.eventId, meta });
  }

  async hostDownloadUrl(access: EventAccessContext, itemId: string): Promise<string> {
    const item = await this.prisma.mediaItem.findFirst({ where: { id: itemId, eventId: access.eventId, status: { notIn: ['DELETED', 'UPLOADING'] } } });
    if (!item) throw AppError.notFound('Photo');
    const ext = item.originalKey.split('.').pop() ?? 'jpg';
    return this.storage.presignDownload(item.originalKey, { expiresInSeconds: 600, downloadName: `bulava-${item.id}.${ext}` });
  }

  // ─────────────────────────── Public: the album link ───────────────────────────

  /** The album a QR code or upload link opens (folding an older album into the main one first). */
  private async roomByCode(roomCode: string) {
    if (!/^[A-Za-z0-9]{6,20}$/.test(roomCode)) throw AppError.notFound('Photo album');
    const resolve = async () => {
      const qr = await this.prisma.qRCode.findUnique({ where: { code: roomCode } });
      if (!qr || !qr.active || qr.type !== 'PHOTO_UPLOAD' || !qr.targetId || (qr.expiresAt && qr.expiresAt < new Date())) throw AppError.notFound('Photo album');
      const room = await this.prisma.mediaRoom.findUnique({
        where: { id: qr.targetId },
        include: { event: { select: { id: true, title: true, language: true, deletedAt: true, status: true, typeKey: true, details: true } } },
      });
      if (!room || room.event.deletedAt || room.event.status === 'DRAFT' || room.slug === DESIGN_ROOM_SLUG) throw AppError.notFound('Photo album');
      return { qr, room };
    };
    const found = await resolve();
    if (found.room.isMain) return found;
    await this.albums.ensure(found.room.eventId);
    return resolve();
  }

  /** Resolve an optional invitation token into a guest viewer for this event. */
  private async viewerFromInvite(eventId: string, inviteToken: string | undefined): Promise<Viewer> {
    if (!inviteToken || !/^[A-Za-z0-9_-]{43}$/.test(inviteToken)) return { kind: 'anonymous' };
    const row = await this.prisma.invitationToken.findUnique({
      where: { tokenHash: InvitationTokenService.hash(inviteToken) },
      include: { invitation: { include: { guest: { select: { deletedAt: true, name: true } } } } },
    });
    if (!row || row.eventId !== eventId || row.invitation.guest.deletedAt || !validateInvitationToken(row, row.invitation).ok) {
      return { kind: 'anonymous' };
    }
    const [event, [guest]] = await Promise.all([this.audience.loadEventFacts(eventId), this.audience.loadGuestFacts(eventId, [row.invitation.guestId])]);
    return guest ? { kind: 'guest', guest, event, name: row.invitation.guest.name } : { kind: 'anonymous' };
  }

  /** Uploads through the album link: invited guests (from their invitation), when the host allows it. */
  private canUpload(room: Pick<MediaRoom, 'uploadsEnabled'>, viewer: Viewer): boolean {
    return room.uploadsEnabled && viewer.kind === 'guest';
  }

  private canViewGallery(room: Pick<MediaRoom, 'galleryVisibility'>, viewer: Viewer): boolean {
    if (viewer.kind === 'host') return true;
    const visibility: GalleryVisibility = room.galleryVisibility;
    if (visibility === 'PUBLIC') return true;
    if (visibility === 'PRIVATE' || viewer.kind !== 'guest') return false;
    return true; // INVITE_ONLY and FUNCTION_RESTRICTED: any guest; the latter is narrowed per sub-album.
  }

  /** Functions whose sub-albums this viewer may see in the gallery (FUNCTION_RESTRICTED) or pick for uploads. */
  private async visibleFunctionIds(eventId: string, viewer: Viewer): Promise<Set<string>> {
    if (viewer.kind === 'guest') return new Set(authorizedFunctions(viewer.event.functions, viewer.event.eventPolicy, AudienceService.viewerFor(viewer.guest, null)).map((f) => f.id));
    // Someone holding the album link (at the venue, or shared by the host): the listed functions.
    const fns = await this.prisma.eventFunction.findMany({ where: { eventId, deletedAt: null, status: { not: 'DRAFT' }, visibility: 'LISTED' }, select: { id: true } });
    return new Set(fns.map((f) => f.id));
  }

  /** Sub-albums a viewer may upload into: General, the host's own, and the functions they can see. */
  private uploadableAlbums(albums: MediaAlbum[], visibleFns: Set<string>): MediaAlbum[] {
    return albums.filter((a) => a.kind !== 'FUNCTION' || (a.functionId !== null && visibleFns.has(a.functionId)));
  }

  /** Sub-albums a viewer sees in the gallery: those the host shows, narrowed by function for FUNCTION_RESTRICTED. */
  private galleryAlbums(room: Pick<MediaRoom, 'galleryVisibility'>, albums: MediaAlbum[], visibleFns: Set<string>, viewer: Viewer): MediaAlbum[] {
    return albums.filter((a) => {
      if (viewer.kind === 'host') return true;
      if (!a.showInGallery) return false;
      if (room.galleryVisibility !== 'FUNCTION_RESTRICTED' || a.kind !== 'FUNCTION') return true;
      return a.functionId !== null && visibleFns.has(a.functionId);
    });
  }

  private async albumContext(room: MediaRoom, viewer: Viewer) {
    const [albums, functions, visibleFns] = await Promise.all([
      this.prisma.mediaAlbum.findMany({ where: { roomId: room.id } }),
      this.prisma.eventFunction.findMany({ where: { eventId: room.eventId, deletedAt: null }, select: { id: true, sortOrder: true, startsAt: true } }),
      this.visibleFunctionIds(room.eventId, viewer),
    ]);
    return { albums: orderAlbums(albums, functions), functions, visibleFns };
  }

  async publicRoom(roomCode: string, inviteToken?: string) {
    const { room } = await this.roomByCode(roomCode);
    const viewer = await this.viewerFromInvite(room.eventId, inviteToken);
    const { albums, functions, visibleFns } = await this.albumContext(room, viewer);
    const uploadable = this.uploadableAlbums(albums, visibleFns);
    const details = (room.event.details ?? {}) as Record<string, string>;
    return {
      event: { title: room.event.title, language: room.event.language, typeKey: room.event.typeKey, partnerOne: details.partnerOne ?? null, partnerTwo: details.partnerTwo ?? null },
      room: { name: room.name, functionName: null, uploadsEnabled: room.uploadsEnabled, moderated: room.moderationMode !== 'AUTO_APPROVE' },
      albums: uploadable.map((a) => ({ id: a.id, kind: a.kind, name: a.name })),
      defaultAlbumId: suggestedAlbumId(uploadable, functions),
      /** This visitor may add photos: an invited guest (from their invitation) when the host allows guest uploads. */
      canUpload: this.canUpload(room, viewer),
      canViewGallery: this.canViewGallery(room, viewer),
      accept: Object.keys(ALLOWED_UPLOAD_TYPES).filter((t) => ['image', 'video'].includes(ALLOWED_UPLOAD_TYPES[t]!.kind)),
    };
  }

  async requestUpload(roomCode: string, input: MediaUploadRequestInput, _meta: RequestMeta, inviteToken?: string) {
    const { qr, room } = await this.roomByCode(roomCode);
    // The album link alone never uploads: the team uses the dashboard, invited guests their invitation.
    if (!room.uploadsEnabled) throw new AppError('UPLOADS_CLOSED', 'Only the hosts and their team add photos to this album.');
    const viewer = await this.viewerFromInvite(room.eventId, inviteToken);
    if (viewer.kind !== 'guest') throw new AppError('UPLOAD_NEEDS_INVITATION', 'Open the album from your invitation to add photos.');
    const type = ALLOWED_UPLOAD_TYPES[input.contentType];
    if (!type || (type.kind !== 'image' && type.kind !== 'video')) throw new AppError('UPLOAD_REJECTED', 'Only photos and videos can be uploaded.');
    if (input.sizeBytes > type.maxBytes) throw new AppError('UPLOAD_REJECTED', `Files must be under ${Math.round(type.maxBytes / 1024 / 1024)} MB.`);

    // The chosen sub-album (one this guest may upload into), or General.
    const { albums, visibleFns } = await this.albumContext(room, viewer);
    const uploadable = this.uploadableAlbums(albums, visibleFns);
    const album = input.albumId ? uploadable.find((a) => a.id === input.albumId) : uploadable.find((a) => a.kind === 'GENERAL');
    if (!album) throw new AppError('INVALID_REFERENCE', 'Choose one of this event’s albums.');

    const features = await this.entitlements.forEvent(room.eventId);
    const used = await this.prisma.mediaItem.count({ where: { eventId: room.eventId, status: { notIn: ['DELETED', 'REJECTED'] } } });
    EntitlementsService.assertWithinLimit(features, FEATURE_KEYS.PHOTOS_MAX, used);

    const item = await this.prisma.mediaItem.create({
      data: {
        roomId: room.id,
        albumId: album.id,
        eventId: room.eventId,
        uploaderName: input.uploaderName || viewer.name || null,
        kind: type.kind,
        originalKey: `pending-${randomBytes(12).toString('hex')}`,
        mimeType: input.contentType,
        sizeBytes: BigInt(input.sizeBytes),
        status: 'UPLOADING',
      },
    });
    const key = StorageKeys.mediaOriginal(room.eventId, item.id, type.ext);
    await this.prisma.mediaItem.update({ where: { id: item.id }, data: { originalKey: key } });
    await this.prisma.qRCode.update({ where: { id: qr.id }, data: { scanCount: { increment: 1 } } }).catch(() => undefined);
    return {
      itemId: item.id,
      uploadUrl: await this.storage.presignUpload(key, input.contentType, 900),
      headers: { 'Content-Type': input.contentType },
      expiresInSeconds: 900,
    };
  }

  private designRoom(eventId: string) {
    return this.prisma.mediaRoom.upsert({
      where: { eventId_slug: { eventId, slug: DESIGN_ROOM_SLUG } },
      create: { eventId, name: 'Design photos', slug: DESIGN_ROOM_SLUG, galleryVisibility: 'PRIVATE', moderationMode: 'AUTO_APPROVE', uploadsEnabled: false },
      update: {},
    });
  }

  /**
   * Upload a photo from the design panel: a signed PUT to object storage for an
   * image only, counted against the plan's photo limit. The worker verifies and
   * processes it like any upload; it is approved automatically (the host placed it).
   */
  async requestDesignUpload(access: EventAccessContext, input: DesignUploadInput) {
    const type = ALLOWED_UPLOAD_TYPES[input.contentType];
    if (!type || type.kind !== 'image') throw new AppError('UPLOAD_REJECTED', 'Only photos can be used in a design.');
    if (input.sizeBytes > type.maxBytes) throw new AppError('UPLOAD_REJECTED', `Files must be under ${Math.round(type.maxBytes / 1024 / 1024)} MB.`);
    const features = await this.entitlements.forEvent(access.eventId);
    const used = await this.prisma.mediaItem.count({ where: { eventId: access.eventId, status: { notIn: ['DELETED', 'REJECTED'] } } });
    EntitlementsService.assertWithinLimit(features, FEATURE_KEYS.PHOTOS_MAX, used);
    const room = await this.designRoom(access.eventId);
    const item = await this.prisma.mediaItem.create({
      data: {
        roomId: room.id,
        eventId: access.eventId,
        uploaderUserId: access.userId,
        kind: 'image',
        originalKey: `pending-${randomBytes(12).toString('hex')}`,
        mimeType: input.contentType,
        sizeBytes: BigInt(input.sizeBytes),
        privacy: 'PRIVATE',
        status: 'UPLOADING',
      },
    });
    const key = StorageKeys.mediaOriginal(access.eventId, item.id, type.ext);
    await this.prisma.mediaItem.update({ where: { id: item.id }, data: { originalKey: key } });
    return { itemId: item.id, uploadUrl: await this.storage.presignUpload(key, input.contentType, 900), headers: { 'Content-Type': input.contentType }, expiresInSeconds: 900 };
  }

  async completeDesignUpload(access: EventAccessContext, itemId: string) {
    const item = await this.prisma.mediaItem.findFirst({ where: { id: itemId, eventId: access.eventId, room: { slug: DESIGN_ROOM_SLUG } } });
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

  /** Status of a design upload (the panel waits for processing before placing it). */
  async designUploadStatus(access: EventAccessContext, itemId: string) {
    const item = await this.prisma.mediaItem.findFirst({ where: { id: itemId, eventId: access.eventId } });
    if (!item) throw AppError.notFound('Upload');
    return item.status === 'APPROVED' ? { status: item.status, photo: await this.toHostItem(item) } : { status: item.status };
  }

  async completeUpload(roomCode: string, itemId: string) {
    const { room } = await this.roomByCode(roomCode);
    const item = await this.prisma.mediaItem.findFirst({ where: { id: itemId, roomId: room.id } });
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
    this.analytics.track('media_uploaded', { eventId: room.eventId }, { kind: item.kind, roomId: room.id });
    return { status: 'PROCESSING' as const };
  }

  /** The guest gallery: the sub-albums the host shows (and this viewer may see), with their approved photos. */
  async publicGallery(roomCode: string, inviteToken?: string) {
    const { room } = await this.roomByCode(roomCode);
    const viewer = await this.viewerFromInvite(room.eventId, inviteToken);
    if (!this.canViewGallery(room, viewer)) throw AppError.forbidden('This gallery is private.');
    const { albums, visibleFns } = await this.albumContext(room, viewer);
    const shown = this.galleryAlbums(room, albums, visibleFns, viewer);
    const policy = downloadPolicy(room);
    const items = shown.length
      ? await this.prisma.mediaItem.findMany({
          where: { roomId: room.id, albumId: { in: shown.map((a) => a.id) }, status: 'APPROVED', privacy: { in: ['PUBLIC', 'EVENT_ONLY'] } },
          orderBy: { createdAt: 'desc' },
          take: 300,
        })
      : [];
    this.analytics.track('gallery_viewed', { eventId: room.eventId }, { roomId: room.id });
    const counts = new Map<string, number>();
    for (const i of items) counts.set(i.albumId!, (counts.get(i.albumId!) ?? 0) + 1);
    return {
      event: { title: room.event.title, language: room.event.language },
      canUpload: this.canUpload(room, viewer),
      albums: shown.filter((a) => counts.get(a.id)).map((a) => ({ id: a.id, name: a.name, count: counts.get(a.id)! })),
      items: await Promise.all(
        items.map(async (i) => {
          const download = policy.originalQuality ? i.originalKey : (i.optimizedKey ?? i.originalKey);
          return {
            id: i.id,
            albumId: i.albumId,
            kind: i.kind,
            uploaderName: i.uploaderName,
            width: i.width,
            height: i.height,
            thumbUrl: i.thumbnailKey ? await this.storage.presignDownload(i.thumbnailKey, { expiresInSeconds: SIGNED_TTL }) : null,
            viewUrl: await this.storage.presignDownload(i.optimizedKey ?? i.originalKey, { expiresInSeconds: SIGNED_TTL }),
            downloadUrl: policy.guestsCanDownload ? await this.storage.presignDownload(download, { expiresInSeconds: 600, downloadName: `photo-${i.id}.${download.split('.').pop()}` }) : null,
          };
        }),
      ),
    };
  }

  // ─────────────────────────── For invitation pages ───────────────────────────

  /** The event's album as it appears on a guest's invitation (upload link and gallery). */
  async roomsForGuest(eventId: string, guest: GuestAudienceFacts, event: EventAudienceFacts) {
    const main = (await this.albums.findMain(eventId)) ?? (await this.albums.ensure(eventId));
    const qr = await this.prisma.qRCode.findFirst({ where: { eventId, targetId: main.id, type: 'PHOTO_UPLOAD', active: true }, orderBy: { createdAt: 'asc' } });
    if (!qr) return [];
    const viewer: Viewer = { kind: 'guest', guest, event };
    const entry = { name: main.name, code: qr.code, uploadsEnabled: this.canUpload(main, viewer), canViewGallery: this.canViewGallery(main, viewer) };
    return entry.uploadsEnabled || entry.canViewGallery ? [entry] : [];
  }

  /** Approved gallery photos the viewer may see, for the template gallery section. */
  async galleryForTemplate(eventId: string, viewer: { guest: GuestAudienceFacts; event: EventAudienceFacts } | null, limit = 24): Promise<GalleryImage[]> {
    const main = await this.albums.findMain(eventId);
    if (!main) return [];
    const v: Viewer = viewer ? { kind: 'guest', ...viewer } : { kind: 'anonymous' };
    if (!this.canViewGallery(main, v)) return [];
    const { albums, visibleFns } = await this.albumContext(main, v);
    const shown = this.galleryAlbums(main, albums, visibleFns, v);
    if (!shown.length) return [];
    const items = await this.prisma.mediaItem.findMany({
      where: { roomId: main.id, albumId: { in: shown.map((a) => a.id) }, status: 'APPROVED', kind: 'image', privacy: { in: ['PUBLIC', 'EVENT_ONLY'] }, thumbnailKey: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return Promise.all(
      items.map(async (i) => ({
        url: await this.storage.presignDownload(i.optimizedKey ?? i.originalKey, { expiresInSeconds: SIGNED_TTL }),
        thumbUrl: await this.storage.presignDownload(i.thumbnailKey!, { expiresInSeconds: SIGNED_TTL }),
        width: i.width,
        height: i.height,
      })),
    );
  }

  /**
   * Photos a design uses: the ordered list (customization.photoIds) and the
   * named places (customization.photoSlots), signed, in one query. Only
   * approved images of this event are ever returned.
   */
  async templatePhotos(
    eventId: string,
    customization: { photoIds?: readonly string[]; photoSlots?: Partial<Record<PhotoSlot, string>> } | null | undefined,
  ): Promise<{ photos: GalleryImage[]; photoSlots: Partial<Record<PhotoSlot, GalleryImage>> }> {
    const slotEntries = Object.entries(customization?.photoSlots ?? {}) as Array<[PhotoSlot, string]>;
    const ids = [...new Set([...(customization?.photoIds ?? []), ...slotEntries.map(([, id]) => id)])];
    if (!ids.length) return { photos: [], photoSlots: {} };
    const items = await this.prisma.mediaItem.findMany({ where: { eventId, id: { in: ids }, status: 'APPROVED', kind: 'image', deletedAt: null } });
    const signed = new Map<string, GalleryImage>();
    await Promise.all(
      items.map(async (i) =>
        signed.set(i.id, {
          url: await this.storage.presignDownload(i.optimizedKey ?? i.originalKey, { expiresInSeconds: SIGNED_TTL }),
          thumbUrl: await this.storage.presignDownload(i.thumbnailKey ?? i.optimizedKey ?? i.originalKey, { expiresInSeconds: SIGNED_TTL }),
          width: i.width,
          height: i.height,
        }),
      ),
    );
    const photos = (customization?.photoIds ?? []).map((id) => signed.get(id)).filter((p): p is GalleryImage => !!p);
    const photoSlots: Partial<Record<PhotoSlot, GalleryImage>> = {};
    for (const [slot, id] of slotEntries) {
      const photo = signed.get(id);
      if (photo) photoSlots[slot] = photo;
    }
    return { photos, photoSlots };
  }

  /** Ids among these that are approved images of the event (design validation). */
  async approvedImageIds(eventId: string, ids: readonly string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await this.prisma.mediaItem.findMany({ where: { eventId, id: { in: [...ids] }, status: 'APPROVED', kind: 'image', deletedAt: null }, select: { id: true } });
    return new Set(rows.map((r) => r.id));
  }

  /** Customer-chosen template photos (customization.photoIds), signed. */
  async photosByIds(eventId: string, ids: readonly string[] | undefined): Promise<GalleryImage[]> {
    if (!ids?.length) return [];
    const items = await this.prisma.mediaItem.findMany({ where: { eventId, id: { in: [...ids] }, status: 'APPROVED', kind: 'image' } });
    const byId = new Map(items.map((i) => [i.id, i]));
    const ordered = ids.map((id) => byId.get(id)).filter((i): i is MediaItem => !!i);
    return Promise.all(
      ordered.map(async (i) => ({
        url: await this.storage.presignDownload(i.optimizedKey ?? i.originalKey, { expiresInSeconds: SIGNED_TTL }),
        thumbUrl: await this.storage.presignDownload(i.thumbnailKey ?? i.optimizedKey ?? i.originalKey, { expiresInSeconds: SIGNED_TTL }),
        width: i.width,
        height: i.height,
      })),
    );
  }

  /** Host-side list of approved event photos for the template photo picker. */
  async approvedPhotos(access: EventAccessContext) {
    const items = await this.prisma.mediaItem.findMany({
      where: { eventId: access.eventId, status: 'APPROVED', kind: 'image' },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return Promise.all(items.map((i) => this.toHostItem(i)));
  }

  static moderationStatus(mode: ModerationMode): Prisma.MediaItemUpdateInput['status'] {
    return mode === 'AUTO_APPROVE' ? 'APPROVED' : 'PENDING_MODERATION';
  }
}
