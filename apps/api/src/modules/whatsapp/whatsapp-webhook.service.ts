import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DeliveryStatus } from '@bulava/database';
import { SettingsStore } from '@bulava/settings';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { SETTINGS_STORE } from '../settings/settings.service';

/**
 * WhatsApp Business Cloud API webhook service.
 * Follows Meta's Webhooks Overview specifications:
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/
 *
 * 1. Verification Handshake (GET):
 *    Meta sends `hub.mode=subscribe`, `hub.verify_token`, and `hub.challenge`.
 *    We verify the token matches the stored `webhookVerifyToken` and return the
 *    challenge string as plain text with HTTP 200.
 *
 * 2. Event Notifications (POST):
 *    Meta sends event payloads with an `X-Hub-Signature-256` header.
 *    We verify authenticity using HMAC-SHA256 over the raw request body with
 *    the Meta `appSecret`.
 *    Events processed: message status updates (sent, delivered, read, failed),
 *    which update `InvitationDelivery` delivery records.
 */
@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SETTINGS_STORE) private readonly settings: SettingsStore,
  ) {}

  /**
   * Meta verification handshake (GET).
   *
   * Meta sends: `hub.mode=subscribe`, `hub.verify_token=<token>`, `hub.challenge=<challenge>`.
   * We verify the token matches our stored `webhookVerifyToken` and return the
   * challenge string to prove endpoint ownership.
   */
  async verifyChallenge(mode: string | undefined, token: string | undefined, challenge: string | undefined): Promise<string> {
    if (mode !== 'subscribe' || !token || !challenge) {
      throw new AppError('BAD_REQUEST', 'Invalid webhook verification request.');
    }
    const s = await this.settings.get('whatsapp');
    const secrets = s.secrets as Record<string, string | undefined>;
    const verifyToken = secrets.webhookVerifyToken;
    if (!verifyToken || token.trim() !== verifyToken.trim()) {
      throw new AppError('FORBIDDEN', 'Webhook verify token mismatch.');
    }
    return challenge;
  }

  /**
   * Meta webhook event (POST).
   *
   * Authenticity comes from HMAC-SHA256(`rawBody`, appSecret) compared to
   * the `X-Hub-Signature-256` header (after stripping the `sha256=` prefix).
   */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<{ ok: true }> {
    const s = await this.settings.get('whatsapp');
    const secrets = s.secrets as Record<string, string | undefined>;
    const appSecret = secrets.appSecret;
    if (!rawBody || !signature || !appSecret) {
      throw new AppError('FORBIDDEN', 'Invalid webhook signature.');
    }

    // Meta sends the header as "sha256=<hex>".
    const expected = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    const computed = createHmac('sha256', appSecret.trim()).update(rawBody).digest('hex');

    const a = Buffer.from(computed, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AppError('FORBIDDEN', 'Invalid webhook signature.');
    }

    const body = JSON.parse(rawBody.toString('utf8')) as WhatsAppWebhookBody;
    if (body.object !== 'whatsapp_business_account') return { ok: true };

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;
        await this.processStatuses(change.value?.statuses ?? []);
      }
    }

    return { ok: true };
  }

  /**
   * Process message status updates: update invitation delivery records
   * so the dashboard can show whether a WhatsApp invitation was delivered or read.
   */
  private async processStatuses(statuses: WhatsAppStatus[]) {
    for (const status of statuses) {
      if (!status.id || !status.status) continue;

      // Meta's wamid maps to the messageId we stored when the message was sent.
      const providerMessageId = status.id;
      const mapped = this.mapStatus(status.status);
      if (!mapped) continue;

      try {
        await this.prisma.invitationDelivery.updateMany({
          where: { providerMessageId },
          data: {
            status: mapped,
            ...(status.errors?.[0]?.title ? { error: status.errors[0].title } : {}),
          },
        });
      } catch (error) {
        // A status for a message we don't know about is fine: Meta retries and
        // sends statuses for messages we may have sent from other tools.
        this.logger.debug({ providerMessageId, status: status.status, err: error }, 'WhatsApp status update skipped');
      }
    }
  }

  /** Map Meta's status names to our internal delivery statuses. */
  private mapStatus(metaStatus: string): DeliveryStatus | null {
    switch (metaStatus) {
      case 'sent':
        return DeliveryStatus.SENT;
      case 'delivered':
        return DeliveryStatus.DELIVERED;
      case 'read':
        return DeliveryStatus.READ;
      case 'failed':
        return DeliveryStatus.FAILED;
      default:
        return null;
    }
  }
}

// ───── Meta webhook payload types ─────

interface WhatsAppWebhookBody {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        statuses?: WhatsAppStatus[];
      };
    }>;
  }>;
}

interface WhatsAppStatus {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string }>;
}
