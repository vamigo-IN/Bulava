import { Inject, Injectable } from '@nestjs/common';
import QRCode from 'qrcode';
import { decryptSecret, encryptSecret, generateSecureToken, hashToken } from '@bulava/auth';
import { ObjectStorage } from '@bulava/storage';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { STORAGE } from '../../infrastructure/storage/storage.module';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { EventLinksService } from '../domains/event-links.service';

/** Photos on the wall at once; older ones rotate out as new ones arrive. */
const WALL_SIZE = 40;
/** Signed image URLs outlive the wall's URL refresh (the page refreshes them every 30 minutes). */
const WALL_URL_TTL = 3600;
const WALL_EVENT_STATUSES = new Set(['ACTIVE', 'COMPLETED']);

/**
 * Live photo wall (spec §94): a full-screen slideshow of the event album's
 * approved photos for a screen at the venue, from the sub-albums the host
 * shows on the wall. The host turns it on and shares a secret link; nothing is
 * shown unless it is on, and only approved, shareable images appear, through
 * short-lived signed URLs.
 */
@Injectable()
export class LiveWallService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    private readonly audit: AuditService,
    private readonly links: EventLinksService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  wallUrl(token: string): string {
    return `${this.config.WEB_ORIGIN.replace(/\/$/, '')}/wall/${token}`;
  }

  /** The current wall link for the host, or null when the wall is off. */
  hostWallUrl(room: { liveWallEnabled: boolean; wallTokenCiphertext: string | null }): string | null {
    if (!room.liveWallEnabled || !room.wallTokenCiphertext) return null;
    try {
      return this.wallUrl(decryptSecret(room.wallTokenCiphertext, this.config.TOKEN_ENCRYPTION_KEY));
    } catch {
      return null;
    }
  }

  /** Gives a room a wall link if it has none (called when the wall is switched on). */
  async ensureToken(roomId: string): Promise<void> {
    const token = generateSecureToken();
    await this.prisma.mediaRoom.updateMany({
      where: { id: roomId, wallTokenHash: null },
      data: { wallTokenHash: hashToken(token), wallTokenCiphertext: encryptSecret(token, this.config.TOKEN_ENCRYPTION_KEY) },
    });
  }

  /** Replaces the wall link; screens showing the old one stop updating. */
  async rotate(access: EventAccessContext, roomId: string, meta: RequestMeta): Promise<{ wallUrl: string | null }> {
    const room = await this.prisma.mediaRoom.findFirst({ where: { id: roomId, eventId: access.eventId } });
    if (!room) throw AppError.notFound('Photo room');
    const token = generateSecureToken();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.mediaRoom.update({
        where: { id: roomId },
        data: { wallTokenHash: hashToken(token), wallTokenCiphertext: encryptSecret(token, this.config.TOKEN_ENCRYPTION_KEY) },
      });
      await this.audit.record(
        { actorType: 'USER', actorId: access.userId, action: 'media_room.wall_link_rotated', targetType: 'MediaRoom', targetId: roomId, eventId: access.eventId, meta },
        tx,
      );
      return row;
    });
    return { wallUrl: this.hostWallUrl(updated) };
  }

  private async roomByToken(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw AppError.notFound('Photo wall');
    const room = await this.prisma.mediaRoom.findUnique({
      where: { wallTokenHash: hashToken(token) },
      include: { event: { select: { title: true, language: true, typeKey: true, details: true, status: true, deletedAt: true } } },
    });
    if (!room || !room.liveWallEnabled || room.event.deletedAt || !WALL_EVENT_STATUSES.has(room.event.status)) {
      throw AppError.notFound('Photo wall');
    }
    return room;
  }

  /** What the wall screen polls: event heading, the gallery QR and the latest approved photos. */
  async publicWall(token: string) {
    const room = await this.roomByToken(token);
    const [qr, items] = await Promise.all([
      // The wall points at the gallery (view and download) when anyone may open it; uploading is never public.
      room.galleryVisibility === 'PUBLIC' ? this.prisma.qRCode.findFirst({ where: { targetId: room.id, type: 'PHOTO_UPLOAD', active: true }, select: { code: true } }) : null,
      this.prisma.mediaItem.findMany({
        // Only the sub-albums the host shows on the wall.
        where: { roomId: room.id, status: 'APPROVED', kind: 'image', privacy: { in: ['PUBLIC', 'EVENT_ONLY'] }, deletedAt: null, OR: [{ albumId: null }, { album: { showOnWall: true } }] },
        orderBy: { createdAt: 'desc' },
        take: WALL_SIZE,
        select: { id: true, optimizedKey: true, originalKey: true, thumbnailKey: true, width: true, height: true, uploaderName: true, createdAt: true },
      }),
    ]);
    const details = (room.event.details ?? {}) as Record<string, unknown>;
    const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
    return {
      event: {
        title: room.event.title,
        language: room.event.language,
        typeKey: room.event.typeKey,
        partnerOne: text(details.partnerOne),
        partnerTwo: text(details.partnerTwo),
      },
      room: { name: room.name },
      galleryUrl: qr ? `${await this.links.guestOrigin(room.eventId)}/p/${qr.code}/gallery` : null,
      pollSeconds: 8,
      items: await Promise.all(
        items.map(async (i) => ({
          id: i.id,
          url: await this.storage.presignDownload(i.optimizedKey ?? i.originalKey, { expiresInSeconds: WALL_URL_TTL }),
          thumbUrl: i.thumbnailKey ? await this.storage.presignDownload(i.thumbnailKey, { expiresInSeconds: WALL_URL_TTL }) : null,
          width: i.width,
          height: i.height,
          uploaderName: i.uploaderName,
          createdAt: i.createdAt,
        })),
      ),
    };
  }

  /** QR code to the album's gallery (see and download the photos), drawn on the wall when the gallery is public. */
  async galleryQrSvg(token: string): Promise<string> {
    const room = await this.roomByToken(token);
    if (room.galleryVisibility !== 'PUBLIC') throw AppError.notFound('QR code');
    const qr = await this.prisma.qRCode.findFirst({ where: { targetId: room.id, type: 'PHOTO_UPLOAD', active: true } });
    if (!qr) throw AppError.notFound('QR code');
    return QRCode.toString(`${await this.links.guestOrigin(room.eventId)}/p/${qr.code}/gallery`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  }
}
