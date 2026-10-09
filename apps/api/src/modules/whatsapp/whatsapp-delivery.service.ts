import { Inject, Injectable, Logger } from '@nestjs/common';
import { SettingsStore } from '@bulava/settings';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { SETTINGS_STORE } from '../settings/settings.service';

export type WhatsAppMessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

const STATUSES = new Set<WhatsAppMessageStatus>(['sent', 'delivered', 'read', 'failed']);
/** How long a reported failure is kept: long enough for the person still waiting for the message. */
const FAILURE_TTL_SECONDS = 60 * 60;
/** GetGabs is asked about one message at most this often. */
const LOOKUP_CACHE_SECONDS = 4;

const failedKey = (messageId: string) => `wa-failed:${messageId}`;
const lookupKey = (messageId: string) => `wa-lookup:${messageId}`;

/**
 * Where one WhatsApp message stands, for someone waiting for a sign-in code:
 * a message that cannot be delivered (most often, a number that is not on
 * WhatsApp) lets the sign-in page offer Google or email instead. Meta reports
 * failures to its webhook, which records them here for an hour; GetGabs is
 * asked on request (its webhook carries chats, not statuses), at most every
 * few seconds per message.
 */
@Injectable()
export class WhatsAppDeliveryService {
  private readonly logger = new Logger(WhatsAppDeliveryService.name);

  constructor(
    private readonly redis: RedisService,
    @Inject(SETTINGS_STORE) private readonly store: SettingsStore,
  ) {}

  /** A provider reported that a message failed. */
  async recordFailure(messageId: string, reason: string | null): Promise<void> {
    await this.redis.client.set(failedKey(messageId), (reason ?? 'failed').slice(0, 200), 'EX', FAILURE_TTL_SECONDS);
  }

  /** The latest status known for a sent message, or null when nobody has said yet. */
  async status(messageId: string): Promise<WhatsAppMessageStatus | null> {
    if (await this.redis.client.exists(failedKey(messageId))) return 'failed';
    const settings = await this.store.get('whatsapp');
    const apiKey = settings.secrets.apiKey;
    if (settings.value.provider !== 'GETGABS' || !apiKey) return null;

    const cached = await this.redis.client.get(lookupKey(messageId));
    if (cached !== null) return cached === '' ? null : (cached as WhatsAppMessageStatus);
    const status = await this.askGetGabs(messageId, apiKey);
    await this.redis.client.set(lookupKey(messageId), status ?? '', 'EX', LOOKUP_CACHE_SECONDS);
    if (status === 'failed') await this.recordFailure(messageId, 'failed');
    return status;
  }

  private async askGetGabs(messageId: string, apiKey: string): Promise<WhatsAppMessageStatus | null> {
    const base = (process.env.GETGABS_API_BASE || 'https://app.getgabs.com').replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/whatsappbusiness/getmessgageinfobyid`, {
        method: 'POST',
        // The key travels in the body: that is how GetGabs authenticates its messaging API.
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ api_key: apiKey, message_id: messageId }),
        signal: AbortSignal.timeout(5_000),
      });
      const body = (await res.json().catch(() => ({}))) as { status?: boolean; message?: { status?: unknown } | string };
      if (!res.ok || body.status === false || typeof body.message !== 'object' || !body.message) return null;
      const status = String(body.message.status ?? '').toLowerCase() as WhatsAppMessageStatus;
      return STATUSES.has(status) ? status : null;
    } catch (error) {
      this.logger.warn({ err: (error as Error).message }, 'GetGabs message lookup failed');
      return null;
    }
  }
}
