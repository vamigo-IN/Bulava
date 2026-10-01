import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AppError } from '../../common/errors/app-error';

const OTP_TTL_MS = 10 * 60_000;
const PASS_TTL_SECONDS = 30 * 86_400;
const MAX_SENDS_PER_WINDOW = 3;

/** Masks "+919876543210" -> "+91•••••3210", "riya@example.com" -> "r•••@example.com". */
export function maskTarget(target: string): string {
  if (target.includes('@')) {
    const [user, domain] = target.split('@');
    return `${user![0]}•••@${domain}`;
  }
  return `${target.slice(0, 3)}•••••${target.slice(-4)}`;
}

/**
 * One-time codes that confirm a guest's identity for events whose access
 * policy requires OTP. Codes are HMAC'd at rest, expire in 10 minutes,
 * allow 5 attempts, and sends are rate limited per target.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly queues: QueueService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private hash(code: string, target: string): string {
    return createHmac('sha256', this.config.JWT_ACCESS_SECRET).update(`otp:${target}:${code}`).digest('hex');
  }

  private passSig(guestId: string, exp: number): string {
    return createHmac('sha256', this.config.JWT_ACCESS_SECRET).update(`otp-pass:${guestId}:${exp}`).digest('base64url');
  }

  verifyPass(guestId: string, pass: string | undefined): boolean {
    if (!pass) return false;
    const [expStr, sig] = pass.split('.');
    const exp = Number(expStr);
    if (!sig || !Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    const a = Buffer.from(this.passSig(guestId, exp));
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async send(guest: { id: string; email: string | null; phone: string | null; name: string }, eventTitle: string): Promise<{ channel: 'EMAIL' | 'SMS'; target: string }> {
    const target = guest.email ?? guest.phone;
    if (!target) throw new AppError('OTP_REQUIRED', 'Please contact your host to verify your invitation.');
    const key = `otp-sends:${target}`;
    const sends = await this.redis.client.incr(key);
    if (sends === 1) await this.redis.client.expire(key, 600);
    if (sends > MAX_SENDS_PER_WINDOW) throw new AppError('RATE_LIMITED', 'Too many codes requested. Please wait a few minutes.');

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.otpChallenge.create({
      data: { purpose: `guest:${guest.id}`, target, codeHash: this.hash(code, target), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
    if (guest.email) {
      await this.queues.add('email', {
        to: guest.email,
        subject: `${code} is your code for ${eventTitle}`,
        text: `Dear ${guest.name},\n\nYour verification code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>Dear ${escapeHtml(guest.name)},</p><p>Your verification code is</p><p style="font-size:28px;letter-spacing:6px;font-weight:bold">${code}</p><p>It expires in 10 minutes.</p>`,
      });
      return { channel: 'EMAIL', target: maskTarget(target) };
    }
    // No SMS gateway is configured yet: in development the code is logged; in production this is a hard error.
    if (this.config.NODE_ENV === 'production') throw new AppError('SERVICE_UNAVAILABLE', 'SMS verification is not available yet.');
    this.logger.warn(`[DEV SMS] OTP for ${maskTarget(target)}: ${code}`);
    return { channel: 'SMS', target: maskTarget(target) };
  }

  async verify(guestId: string, target: string, code: string): Promise<{ pass: string; expiresAt: string }> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { purpose: `guest:${guestId}`, target, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge || challenge.attempts >= challenge.maxAttempts) throw new AppError('OTP_INVALID', 'That code has expired. Request a new one.');
    await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    const expected = Buffer.from(challenge.codeHash);
    const given = Buffer.from(this.hash(code, target));
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new AppError('OTP_INVALID', 'That code is not correct.');
    await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
    const exp = Math.floor(Date.now() / 1000) + PASS_TTL_SECONDS;
    return { pass: `${exp}.${this.passSig(guestId, exp)}`, expiresAt: new Date(exp * 1000).toISOString() };
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
