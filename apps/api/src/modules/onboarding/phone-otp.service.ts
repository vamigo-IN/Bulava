import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AppError } from '../../common/errors/app-error';
import { maskTarget } from '../guest-access/otp.service';
import { PlatformSettingsService } from '../settings/settings.service';

const OTP_TTL_MS = 10 * 60_000;
const MAX_SENDS_PER_WINDOW = 3;

/** What a code is for; a code proves one thing only. */
export type PhoneOtpPurpose = 'login' | 'quick-start';

/**
 * Six-digit codes sent to a host's WhatsApp number: signing in without a
 * password, and proving a number that already has an account during the quick
 * start. Codes are HMAC'd at rest, expire in 10 minutes, allow 5 attempts, and
 * sends are rate limited per number. Delivery needs the WhatsApp Business
 * integration with an approved authentication template; in development the
 * code is logged instead.
 */
@Injectable()
export class PhoneOtpService {
  private readonly logger = new Logger(PhoneOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly queues: QueueService,
    private readonly settings: PlatformSettingsService,
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

  async send(phone: string, purpose: PhoneOtpPurpose): Promise<{ target: string }> {
    const available = await this.assertAvailable();
    const key = `phone-otp-sends:${phone}`;
    const sends = await this.redis.client.incr(key);
    if (sends === 1) await this.redis.client.expire(key, 600);
    if (sends > MAX_SENDS_PER_WINDOW) throw new AppError('RATE_LIMITED', 'Too many codes requested. Please wait a few minutes.');

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.otpChallenge.create({
      data: { purpose: `phone:${purpose}`, target: phone, codeHash: this.hash(code, phone), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
    if (available) {
      await this.queues.add('whatsapp', { to: phone, template: 'otp', params: [code], copyCode: code });
    } else {
      // Development without WhatsApp: the code goes to the API log, never to the response.
      this.logger.warn(`[DEV WHATSAPP] code for ${maskTarget(phone)}: ${code}`);
    }
    return { target: maskTarget(phone) };
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
    await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
  }
}
