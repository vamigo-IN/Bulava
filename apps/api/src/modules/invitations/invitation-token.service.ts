import { Inject, Injectable, Logger } from '@nestjs/common';
import { decryptSecret, encryptSecret, generateSecureToken, hashToken } from '@bulava/auth';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import type { Tx } from '../../infrastructure/prisma/prisma.service';
import { EventLinksService } from '../domains/event-links.service';

/**
 * Invitation token lifecycle. Raw tokens exist only in memory and in the
 * link the host shares; the database stores a SHA-256 hash (lookup) and an
 * AES-256-GCM ciphertext (so hosts can copy the link again).
 */
@Injectable()
export class InvitationTokenService {
  private readonly logger = new Logger(InvitationTokenService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly links: EventLinksService,
  ) {}

  async issue(
    tx: Tx,
    params: { invitationId: string; eventId: string; expiresAt: Date | null; maxUses: number | null },
  ): Promise<{ token: string; url: string }> {
    const token = generateSecureToken();
    await tx.invitationToken.create({
      data: {
        invitationId: params.invitationId,
        eventId: params.eventId,
        tokenHash: hashToken(token),
        tokenCiphertext: encryptSecret(token, this.config.TOKEN_ENCRYPTION_KEY),
        expiresAt: params.expiresAt,
        maxUses: params.maxUses,
      },
    });
    return { token, url: this.urlFor(token, await this.links.guestOrigin(params.eventId)) };
  }

  async revokeAll(tx: Tx, invitationId: string): Promise<void> {
    await tx.invitationToken.updateMany({ where: { invitationId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** `origin` is the event's guest origin (its custom domain when one is live). */
  urlFor(token: string, origin: string = this.links.mainOrigin): string {
    return `${origin}/invite/${token}`;
  }

  /** Recover the shareable URL from a stored ciphertext; null if the key rotated. */
  revealUrl(ciphertext: string, origin?: string): string | null {
    try {
      return this.urlFor(decryptSecret(ciphertext, this.config.TOKEN_ENCRYPTION_KEY), origin);
    } catch {
      this.logger.warn('Could not decrypt an invitation token; it must be regenerated.');
      return null;
    }
  }

  static hash(token: string): string {
    return hashToken(token);
  }
}
