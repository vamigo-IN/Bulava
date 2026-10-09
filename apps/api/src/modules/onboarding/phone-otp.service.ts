import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { generateSecureToken } from '@bulava/auth';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AppError } from '../../common/errors/app-error';
import { maskTarget } from '../guest-access/otp.service';
import { PlatformSettingsService } from '../settings/settings.service';
import { WhatsAppDeliveryService } from '../whatsapp/whatsapp-delivery.service';

const OTP_TTL_MS = 10 * 60_000;
const MAX_SENDS_PER_WINDOW = 3;
/** Seconds before the sign-in page offers to send another code. */
export const PHONE_RESEND_AFTER_SECONDS = 30;
/** A code's message (with the code in its data) stays in the queue only this long. */
const JOB_KEEP_SECONDS = 15 * 60;

/** What a code is for; a code proves one thing only. */
export type PhoneOtpPurpose = 'login' | 'quick-start' | 'confirm';

/**
 * How a code's WhatsApp message is doing: still `sending`, `sent` (accepted),
 * `delivered` or `read` on the phone, `failed` (most often a number that is not
 * on WhatsApp), or `unknown` (logged in development, or no longer tracked).
 */
export type PhoneCodeDelivery = 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'unknown';

/**
 * Six-digit codes sent to a WhatsApp number: signing in (or up) without a
 * password, confirming the number on an account, and proving a number that
 * already has an account during the quick start. Codes are HMAC'd at rest,
 * expire in 10 minutes, allow 5 attempts, and sends are rate limited per
 * number. Delivery needs the WhatsApp Business integration with an approved
 * authentication template; in development the code is logged instead. Each
 * send has an id the page can ask about (`delivery`), so a number that cannot
 * get the message is offered another way in.
 */
@Injectable()
export class PhoneOtpService {
  private readonly logger = new Logger(PhoneOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly queues: QueueService,
    private readonly settings: PlatformSettingsService,
    private readonly deliveries: WhatsAppDeliveryService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private hash(code: string, phone: string): string {
    return createHmac('sha256', this.config.JWT_ACCESS_SECRET).update(`phone-otp:${phone}:${code}`).digest('hex');
  }

  /** Can a code reach a phone right now (WhatsApp set up with an authentication template)? */
  async available(): Promise<boolean> {
    return (await this.settings.whatsappHost()).otp;
  }

  /** In production a code must actually be deliverable; in development it is logged instead. */
  async assertAvailable(): Promise<boolean> {
    const available = await this.available();
    if (!available && this.config.NODE_ENV === 'production') {
      throw new AppError('PHONE_OTP_UNAVAILABLE', 'WhatsApp codes are not available right now. Sign in with your email instead.');
    }
    return available;
  }

  async send(phone: string, purpose: PhoneOtpPurpose): Promise<{ target: string; sendId: string }> {
    const available = await this.assertAvailable();
    const key = `phone-otp-sends:${phone}`;
    const sends = await this.redis.client.incr(key);
    if (sends === 1) await this.redis.client.expire(key, 600);
    if (sends > MAX_SENDS_PER_WINDOW) throw new AppError('RATE_LIMITED', 'Too many codes requested. Please wait a few minutes.');

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.otpChallenge.create({
      data: { purpose: `phone:${purpose}`, target: phone, codeHash: this.hash(code, phone), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
    const sendId = generateSecureToken(16);
    if (available) {
      await this.queues.add(
        'whatsapp',
        { to: phone, template: 'otp', params: [code], copyCode: code },
        { jobId: jobId(sendId), removeOnComplete: { age: JOB_KEEP_SECONDS }, removeOnFail: { age: JOB_KEEP_SECONDS } },
      );
    } else {
      // Development without WhatsApp: the code goes to the API log, never to the response.
      this.logger.warn(`[DEV WHATSAPP] code for ${maskTarget(phone)}: ${code}`);
    }
    return { target: maskTarget(phone), sendId };
  }

  /** Whether the message with this send's code got through (the worker's result, then the provider's report). */
  async delivery(sendId: string): Promise<PhoneCodeDelivery> {
    const job = await this.queues.jobState('whatsapp', jobId(sendId));
    if (!job) return 'unknown';
    if (job.state === 'failed') return 'failed';
    if (job.state !== 'completed') return 'sending';
    const result = (job.result ?? {}) as { outcome?: string; messageId?: string };
    // Refused by the provider (a number it rejects outright), or WhatsApp switched off since.
    if (result.outcome !== 'sent') return 'failed';
    if (!result.messageId) return 'sent';
    return (await this.deliveries.status(result.messageId)) ?? 'sent';
  }

  async verify(phone: string, code: string, purpose: PhoneOtpPurpose): Promise<void> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { purpose: `phone:${purpose}`, target: phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge || challenge.attempts >= challenge.maxAttempts) throw new AppError('OTP_INVALID', 'That code has expired. Request a new one.');
    await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    const expected = Buffer.from(challenge.codeHash);
    const given = Buffer.from(this.hash(code, phone));
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new AppError('OTP_INVALID', 'That code is not correct.');
    // Single use, even when two requests carry the same code.
    const consumed = await this.prisma.otpChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (consumed.count !== 1) throw new AppError('OTP_INVALID', 'That code has expired. Request a new one.');
  }
}

/** BullMQ job ids may not contain ':' (its key separator). */
function jobId(sendId: string): string {
  return `otp-${sendId}`;
}
