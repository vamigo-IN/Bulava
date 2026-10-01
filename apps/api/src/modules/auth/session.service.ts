import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { generateSecureToken, hashToken, type PlatformRole } from '@bulava/auth';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';

export interface AccessTokenClaims {
  sub: string;
  pr: PlatformRole;
  /** Present (true) when the session passed two-step verification. */
  mfa?: true;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

/** A rotated refresh token re-presented within this window is treated as a benign race (two tabs). */
const ROTATION_GRACE_MS = 10_000;

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async issue(user: { id: string; platformRole: PlatformRole }, meta: RequestMeta, options: { familyId?: string; mfa?: boolean } = {}) {
    const familyId = options.familyId ?? randomUUID();
    const mfa = options.mfa === true;
    const refreshToken = generateSecureToken();
    const refreshExpiresAt = new Date(Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        familyId,
        expiresAt: refreshExpiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        mfa,
      },
    });
    return { ...this.signAccessToken(user, mfa), refreshToken, refreshExpiresAt } satisfies IssuedSession;
  }

  signAccessToken(user: { id: string; platformRole: PlatformRole }, mfa = false) {
    const claims: AccessTokenClaims = { sub: user.id, pr: user.platformRole, ...(mfa ? { mfa: true as const } : {}) };
    const accessToken = this.jwt.sign(claims);
    const accessExpiresAt = new Date(Date.now() + this.config.ACCESS_TOKEN_TTL_SECONDS * 1000);
    return { accessToken, accessExpiresAt };
  }

  verifyAccessToken(token: string): AccessTokenClaims | null {
    try {
      return this.jwt.verify<AccessTokenClaims>(token);
    } catch {
      return null;
    }
  }

  /** Rotate a refresh token. Re-use of an already-rotated token revokes the whole family. */
  async rotate(refreshToken: string, meta: RequestMeta): Promise<IssuedSession> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: { select: { id: true, platformRole: true, status: true, deletedAt: true } } },
    });
    if (!session) throw new AppError('SESSION_EXPIRED', 'Session expired. Please sign in again.');

    const now = Date.now();
    if (session.rotatedAt) {
      const withinGrace = now - session.rotatedAt.getTime() < ROTATION_GRACE_MS;
      if (!withinGrace) await this.revokeFamily(session.familyId);
      throw new AppError('SESSION_EXPIRED', 'Session expired. Please sign in again.');
    }
    if (
      session.revokedAt ||
      session.expiresAt.getTime() <= now ||
      session.user.status !== 'ACTIVE' ||
      session.user.deletedAt
    ) {
      throw new AppError('SESSION_EXPIRED', 'Session expired. Please sign in again.');
    }

    // Conditional update prevents two concurrent rotations of the same token.
    const updated = await this.prisma.session.updateMany({
      where: { id: session.id, rotatedAt: null },
      data: { rotatedAt: new Date(now), lastUsedAt: new Date(now) },
    });
    if (updated.count !== 1) throw new AppError('SESSION_EXPIRED', 'Session expired. Please sign in again.');

    // The two-step flag carries over to the rotated token: it describes how the family signed in.
    return this.issue(session.user, meta, { familyId: session.familyId, mfa: session.mfa });
  }

  async revoke(refreshToken: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
    if (session) await this.revokeFamily(session.familyId);
  }

  /** Ends every session of a user (after a second factor is added or removed). */
  async revokeAllForUser(userId: string, tx: Pick<PrismaService, 'session'> = this.prisma): Promise<void> {
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
