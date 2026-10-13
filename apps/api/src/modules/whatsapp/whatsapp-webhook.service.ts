import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { recordWhatsAppDelivery } from '@bulava/database';
import { SettingsStore } from '@bulava/settings';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { SETTINGS_STORE } from '../settings/settings.service';
import { WhatsAppDeliveryService } from './whatsapp-delivery.service';
import { WhatsAppInboxService } from './whatsapp-inbox.service';

/** A WhatsApp message id ("wamid."), as Meta and GetGabs report them. */
const WAMID = /^wamid\.[A-Za-z0-9+/=_-]{8,300}$/;

/** Compares secrets in constant time, whatever their lengths. */
function sameSecret(given: string, expected: string): boolean {
  const digest = (v: string) => createHash('sha256').update(v.trim()).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/** GetGabs nests some details as JSON inside a string field. */
function parseJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string' || !value.trimStart().startsWith('{')) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The messages an incoming GetGabs chat answers: a tapped button, a quoted reply, a form opened from a message. */
export function repliedTo(event: GetGabsWebhookEvent): string[] {
  const context = parseJson(event.message_text)?.context;
  const ids = [
    event.targeted_message_id,
    event.targetedMsgId,
    parseJson(event.replyformsg)?.message_id,
    typeof context === 'object' && context !== null ? (context as { id?: unknown }).id : undefined,
  ];
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && WAMID.test(id)))];
}

/**
 * Webhooks from the WhatsApp providers (Integrations → WhatsApp Business).
 *
 * Meta's Cloud API (`/whatsapp/webhook`, see
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/):
 * a verification handshake (GET, answered with `hub.challenge` when the verify
 * token matches) and signed deliveries (POST, HMAC-SHA256 of the raw body with
 * the app secret in `X-Hub-Signature-256`) carrying message statuses.
 *
 * GetGabs (`/whatsapp/getgabs?token=…`, its "Webhook URL for All Chats"):
 * incoming chats. GetGabs does not sign them, so the URL carries a secret
 * token. A reply to an invitation (a quick-reply button, a quoted reply)
 * proves it was read; GetGabs reports delivery itself only on request, which
 * the worker asks for.
 *
 * Every report goes through `recordWhatsAppDelivery`, which only moves an
 * invitation's delivery forward (reports can arrive out of order).
 */
@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveries: WhatsAppDeliveryService,
    private readonly inbox: WhatsAppInboxService,
    @Inject(SETTINGS_STORE) private readonly settings: SettingsStore,
  ) {}

  /**
   * Meta verification handshake (GET): `hub.mode=subscribe`, `hub.verify_token`
   * and `hub.challenge`; the challenge goes back when the token matches the
   * stored `webhookVerifyToken`, proving the endpoint is ours.
   */
  async verifyChallenge(mode: string | undefined, token: string | undefined, challenge: string | undefined): Promise<string> {
    if (mode !== 'subscribe' || !token || !challenge) {
      throw new AppError('BAD_REQUEST', 'Invalid webhook verification request.');
    }
    const verifyToken = (await this.settings.get('whatsapp')).secrets.webhookVerifyToken;
    if (!verifyToken || !sameSecret(token, verifyToken)) {
      throw new AppError('FORBIDDEN', 'Webhook verify token mismatch.');
    }
    return challenge;
  }

  /** Meta event delivery (POST), authenticated by HMAC-SHA256(raw body, app secret) against `X-Hub-Signature-256`. */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<{ ok: true }> {
    const appSecret = (await this.settings.get('whatsapp')).secrets.appSecret;
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
        for (const status of change.value?.statuses ?? []) {
          if (!status.id || !status.status) continue;
          // Meta's wamid is the message id the worker stored when it sent the invitation.
          await recordWhatsAppDelivery(this.prisma, { providerMessageId: status.id }, status.status, status.errors?.[0]?.title ?? null);
          if (status.status === 'failed') {
            // Sign-in codes have no delivery row: someone may be waiting for one (a number not on WhatsApp fails here).
            await this.deliveries.recordFailure(status.id, status.errors?.[0]?.title ?? null);
            const error = status.errors?.[0];
            await this.inbox.failed(status.id, { code: error?.code ?? null, reason: error?.title ?? error?.message ?? 'failed', phone: status.recipient_id ?? null });
          }
        }
        // Messages people send to the number (ADR-073).
        for (const message of change.value?.messages ?? []) {
          if (!message.from) continue;
          const text = message.text?.body ?? message.button?.text ?? message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? null;
          const replyTo = message.context?.id && WAMID.test(message.context.id) ? [message.context.id] : [];
          // A reply to an invitation proves it was read.
          for (const id of replyTo) await recordWhatsAppDelivery(this.prisma, { providerMessageId: id }, 'read');
          await this.inbox.inbound(message.from, text, replyTo);
        }
      }
    }

    return { ok: true };
  }

  /** GetGabs: one incoming chat (or, should GetGabs forward them, a status of a message this number sent). */
  async handleGetGabs(token: string, body: unknown): Promise<{ ok: true }> {
    const expected = (await this.settings.get('whatsapp')).secrets.webhookToken;
    if (!expected || !token || !sameSecret(token, expected)) {
      throw new AppError('FORBIDDEN', 'Unknown webhook.');
    }
    const event = (typeof body === 'object' && body !== null && !Array.isArray(body) ? body : {}) as GetGabsWebhookEvent;
    let changed = 0;
    if (event.direction === 'outbound') {
      if (typeof event.message_id === 'string' && WAMID.test(event.message_id)) {
        const report = typeof event.status === 'string' ? event.status : null;
        const error = typeof event.error_message === 'string' ? event.error_message : null;
        changed = await recordWhatsAppDelivery(this.prisma, { providerMessageId: event.message_id }, report, error);
        if (report?.toLowerCase() === 'failed') {
          await this.deliveries.recordFailure(event.message_id, error);
          await this.inbox.failed(event.message_id, { reason: error ?? 'failed' });
        }
      }
    } else {
      const answers = repliedTo(event);
      for (const id of answers) {
        const count = await recordWhatsAppDelivery(this.prisma, { providerMessageId: id }, 'read');
        changed += count;
      }
      // Whoever wrote: reachable again (or opted out), and their host hears it (ADR-073).
      if (typeof event.message_from === 'string' && event.message_from.trim()) await this.inbox.inbound(event.message_from, chatText(event), answers);
    }
    if (changed) this.logger.debug({ changed }, 'GetGabs webhook updated invitation deliveries');
    return { ok: true };
  }
}

// ───── Meta webhook payload ─────

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
        messages?: WhatsAppInboundMessage[];
      };
    }>;
  }>;
}

interface WhatsAppStatus {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string; message?: string }>;
}

/** A message someone sent to the number (text, a quick-reply button, an interactive reply). */
interface WhatsAppInboundMessage {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } };
  /** The message this one replies to. */
  context?: { id?: string };
}

/** The words of an incoming GetGabs chat: plain text, or the body inside GetGabs' JSON (a quoted reply, a button). */
export function chatText(event: GetGabsWebhookEvent): string | null {
  const parsed = parseJson(event.message_text);
  if (parsed) {
    for (const value of [parsed.body, parsed.text, (parsed.text as { body?: unknown } | undefined)?.body, (parsed.button as { text?: unknown } | undefined)?.text]) {
      if (typeof value === 'string' && value.trim()) return value;
    }
    return null;
  }
  return typeof event.message_text === 'string' ? event.message_text : null;
}

// ───── GetGabs webhook payload (its "All Chats" webhook; every field optional) ─────

export interface GetGabsWebhookEvent {
  message_id?: unknown;
  message_text?: unknown;
  message_type?: unknown;
  message_sub_type?: unknown;
  message_from?: unknown;
  /** inbound (from a customer) or outbound. */
  direction?: unknown;
  status?: unknown;
  error_message?: unknown;
  /** The message a button reply answers. */
  targeted_message_id?: unknown;
  /** JSON: the message a quoted reply answers ({ message_id, … }). */
  replyformsg?: unknown;
  /** Forms and flows: the message that opened it. */
  targetedMsgId?: unknown;
  timestamp?: unknown;
}
