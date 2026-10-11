import { Inject, Injectable } from '@nestjs/common';
import { hashToken } from '@bulava/auth';
import { SettingsStore } from '@bulava/settings';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AppError } from '../../common/errors/app-error';
import { SETTINGS_STORE } from '../settings/settings.service';

/** Who is liking: a signed-in person, or a browser without an account (the hash of its visitor id). */
export interface Liker {
  userId: string | null;
  visitorHash: string | null;
}

/** How many designs one state request may ask about (a gallery page and its featured row). */
export const LIKES_MAX_KEYS = 120;
const NETWORK_WINDOW_SECONDS = 86_400;

/**
 * Likes on designs (ADR-055). Every like is real: one per person or browser
 * per design, counted in `templates.likeCount` in the same transaction. The
 * numbers are public only when the Super Admin switches them on (settings,
 * `likes`), and only from the minimum up, so new designs show a heart, not "0".
 */
@Injectable()
export class LikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(SETTINGS_STORE) private readonly settings: SettingsStore,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** The public number for a count, or null while it stays hidden. */
  private async shown(): Promise<(count: number) => number | null> {
    const { showCounts, minimum } = (await this.settings.get('likes')).value;
    return (count) => (showCounts && count >= minimum ? count : null);
  }

  private where(liker: Liker): { userId: string } | { visitorHash: string } | null {
    if (liker.userId) return { userId: liker.userId };
    if (liker.visitorHash) return { visitorHash: liker.visitorHash };
    return null;
  }

  /** For the designs on a page: which this viewer liked, and the counts that may be shown. */
  async state(keys: string[], liker: Liker): Promise<{ liked: string[]; counts: Record<string, number | null> }> {
    const wanted = [...new Set(keys)].slice(0, LIKES_MAX_KEYS);
    if (!wanted.length) return { liked: [], counts: {} };
    const [templates, shown] = await Promise.all([
      this.prisma.template.findMany({ where: { key: { in: wanted }, status: 'PUBLISHED', deletedAt: null }, select: { id: true, key: true, likeCount: true } }),
      this.shown(),
    ]);
    const counts = Object.fromEntries(templates.map((t) => [t.key, shown(t.likeCount)]));
    // A browser's likes from before its owner signed in still show as theirs.
    const whose = [liker.userId ? { userId: liker.userId } : null, liker.visitorHash ? { visitorHash: liker.visitorHash } : null].filter((w): w is NonNullable<typeof w> => w !== null);
    if (!whose.length || !templates.length) return { liked: [], counts };
    const rows = await this.prisma.templateLike.findMany({ where: { templateId: { in: templates.map((t) => t.id) }, OR: whose }, select: { templateId: true } });
    const likedIds = new Set(rows.map((r) => r.templateId));
    return { liked: templates.filter((t) => likedIds.has(t.id)).map((t) => t.key), counts };
  }

  /** Like (or unlike) a published design. Idempotent: liking twice counts once. */
  async set(key: string, liked: boolean, liker: Liker, ip: string | null): Promise<{ liked: boolean; likes: number | null }> {
    const who = this.where(liker);
    if (!who) throw new AppError('BAD_REQUEST', 'Liking needs a browser that keeps cookies.');
    const template = await this.prisma.template.findFirst({ where: { key, status: 'PUBLISHED', deletedAt: null }, select: { id: true } });
    if (!template) throw AppError.notFound('Template');
    const templateId = template.id;

    if (liked) {
      // Without an account: one browser per network per design a day, so a script cannot pile up likes.
      if (!liker.userId && liker.visitorHash && ip && !this.config.RATE_LIMIT_DISABLED) {
        const slot = `like-net:${hashToken(`${ip}|${templateId}`)}`;
        const first = await this.redis.client.set(slot, liker.visitorHash, 'EX', NETWORK_WINDOW_SECONDS, 'NX');
        if (first === null && (await this.redis.client.get(slot)) !== liker.visitorHash) {
          throw new AppError('RATE_LIMITED', 'Someone on this network has liked this design today. Sign in to like it too.');
        }
      }
      await this.prisma.$transaction(async (tx) => {
        // A like this browser gave before signing in becomes the person's own, never a second one.
        if (liker.userId && liker.visitorHash) {
          const theirs = await tx.templateLike.findUnique({ where: { templateId_userId: { templateId, userId: liker.userId } }, select: { id: true } });
          if (!theirs) {
            const moved = await tx.templateLike.updateMany({ where: { templateId, visitorHash: liker.visitorHash, userId: null }, data: { userId: liker.userId, visitorHash: null } });
            if (moved.count) return;
          }
        }
        const created = await tx.templateLike.createMany({ data: [{ templateId, ...who }], skipDuplicates: true });
        if (created.count) await tx.template.update({ where: { id: templateId }, data: { likeCount: { increment: created.count } } });
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        const mine = [who, ...(liker.userId && liker.visitorHash ? [{ visitorHash: liker.visitorHash, userId: null }] : [])];
        const removed = await tx.templateLike.deleteMany({ where: { templateId, OR: mine } });
        if (removed.count) await tx.template.update({ where: { id: templateId }, data: { likeCount: { decrement: removed.count } } });
      });
    }
    const [row, shown] = await Promise.all([this.prisma.template.findUniqueOrThrow({ where: { id: templateId }, select: { likeCount: true } }), this.shown()]);
    return { liked, likes: shown(row.likeCount) };
  }
}
