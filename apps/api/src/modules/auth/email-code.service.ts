import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { generateSecureToken, hashToken } from '@bulava/auth';
import { SettingsStore } from '@bulava/settings';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AppError } from '../../common/errors/app-error';
import { maskTarget } from '../guest-access/otp.service';
import { PlatformSettingsService, SETTINGS_STORE } from '../settings/settings.service';
import { emailCodeEmail } from './auth-emails';

/**
 * What a code is for; a code proves one thing only. `access`: the one sign-in
 * form's code, which signs in to the address's account or proves the address
 * for a new one; `login`: the second step after a password (the console).
 */
export type EmailCodePurpose = 'access' | 'signup' | 'login' | 'claim' | 'reset';

const CODE_TTL_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 5;
/** Seconds before the same step may send another code. */
export const RESEND_AFTER_SECONDS = 30;
const MAX_SENDS_PER_WINDOW = 5;
const SEND_WINDOW_SECONDS = 15 * 60;
/** Wrong codes per address across every step, before a pause (resending resets a step's own attempts). */
const MAX_FAILURES = 10;
const FAILURE_WINDOW_SECONDS = 60 * 60;

/** Counts an attempt on a challenge that still exists; -1 when it is gone (so nothing is recreated without its expiry). */
const COUNT_ATTEMPT = `if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
return redis.call('HINCRBY', KEYS[1], 'attempts', 1)`;
/** Replaces a live challenge's code and gives it a fresh expiry; 0 when it is gone. */
const REPLACE_CODE = `if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
redis.call('HSET', KEYS[1], 'codeHash', ARGV[1], 'attempts', '0', 'sentAt', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1`;

/** A code on its way: what the next step needs, without the code. */
export interface EmailChallenge {
  challengeToken: string;
  /** The address, masked ("r•••@example.com"). */
  target: string;
  expiresAt: Date;
  /** Seconds before another code may be sent. */
  resendAfter: number;
}

const expired = () => new AppError('VERIFICATION_EXPIRED', 'This code has expired. Please start again.');

/**
 * Six-digit codes sent by email: confirming an address before an account is
 * made with it (or before it is added to one), the second step of every
 * password sign-in, and password resets. A challenge lives in Redis under the
 * hash of its token, which only the browser that started it holds; the code is
 * HMAC'd with the token, expires in 10 minutes, allows 5 attempts, and is
 * deleted by the request that uses it. Sends and wrong codes are limited per
 * address. Without email set up, outside production the code goes to the API
 * log instead; in production callers check `available()` first.
 */
@Injectable()
export class EmailCodeService {
  private readonly logger = new Logger(EmailCodeService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly queues: QueueService,
    private readonly settings: PlatformSettingsService,
    @Inject(SETTINGS_STORE) private readonly store: SettingsStore,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Email is set up under Integrations, so codes reach people. */
  async deliverable(): Promise<boolean> {
    return (await this.settings.messaging()).email;
  }

  /** Codes can be required: email is set up, or this is not production (the code is logged instead). */
  async available(): Promise<boolean> {
    return this.config.NODE_ENV !== 'production' || (await this.deliverable());
  }

  /**
   * Sends a code for `purpose` to `email` and keeps `payload` until it is
   * entered. `silent` makes the same answer without sending anything (a
   * password reset for an address with no account).
   */
  async start<P extends object>(purpose: EmailCodePurpose, email: string, payload: P, options: { name?: string; silent?: boolean } = {}): Promise<EmailChallenge> {
    await this.countSend(email);
    const token = generateSecureToken();
    const code = newCode();
    const key = challengeKey(token);
    const sentAt = Date.now();
    await this.redis.client
      .multi()
      .hset(key, {
        purpose,
        email,
        name: options.name ?? '',
        codeHash: this.hash(token, code),
        payload: JSON.stringify(payload),
        attempts: '0',
        sentAt: String(sentAt),
        silent: options.silent ? '1' : '0',
      })
      .expire(key, CODE_TTL_SECONDS)
      .exec();
    if (!options.silent) await this.deliver(email, code, purpose, options.name);
    return { challengeToken: token, target: maskTarget(email), expiresAt: new Date(sentAt + CODE_TTL_SECONDS * 1000), resendAfter: RESEND_AFTER_SECONDS };
  }

  /** A new code for the same step, once `RESEND_AFTER_SECONDS` have passed since the last one. */
  async resend(token: string): Promise<Omit<EmailChallenge, 'challengeToken'>> {
    const key = challengeKey(token);
    const challenge = await this.redis.client.hgetall(key);
    if (!challenge.purpose || !challenge.email) throw expired();
    const wait = Math.ceil((Number(challenge.sentAt) + RESEND_AFTER_SECONDS * 1000 - Date.now()) / 1000);
    if (wait > 0) throw new AppError('RATE_LIMITED', `Please wait ${wait} seconds before asking for another code.`);
    await this.countSend(challenge.email);
    const code = newCode();
    const sentAt = Date.now();
    const replaced = await this.redis.client.eval(REPLACE_CODE, 1, key, this.hash(token, code), String(sentAt), String(CODE_TTL_SECONDS));
    if (replaced !== 1) throw expired();
    if (challenge.silent !== '1') await this.deliver(challenge.email, code, challenge.purpose as EmailCodePurpose, challenge.name || undefined);
    return { target: maskTarget(challenge.email), expiresAt: new Date(sentAt + CODE_TTL_SECONDS * 1000), resendAfter: RESEND_AFTER_SECONDS };
  }

  /** The code for `purpose`: the address and payload it was sent with. The challenge is used up. */
  async verify<P>(token: string, code: string, purpose: EmailCodePurpose): Promise<{ email: string; payload: P }> {
    const key = challengeKey(token);
    const challenge = await this.redis.client.hgetall(key);
    // A missing challenge, or one started for another step, is never a match.
    if (challenge.purpose !== purpose || !challenge.email) throw expired();
    const failKey = `email-code-fail:${challenge.email}`;
    if (Number((await this.redis.client.get(failKey)) ?? 0) >= MAX_FAILURES) {
      throw new AppError('RATE_LIMITED', 'Too many wrong codes. Please try again in an hour.');
    }
    const attempts = Number(await this.redis.client.eval(COUNT_ATTEMPT, 1, key));
    if (attempts < 0) throw expired();
    if (attempts > MAX_ATTEMPTS) {
      await this.redis.client.del(key);
      throw expired();
    }
    if (!sameHash(challenge.codeHash ?? '', this.hash(token, code))) {
      await this.redis.client.multi().incr(failKey).expire(failKey, FAILURE_WINDOW_SECONDS).exec();
      if (attempts >= MAX_ATTEMPTS) await this.redis.client.del(key);
      throw new AppError('OTP_INVALID', attempts >= MAX_ATTEMPTS ? 'That code is not correct, and that was the last try. Please start again.' : 'That code is not correct.');
    }
    // Single use: only the request that removes the challenge carries on.
    if ((await this.redis.client.del(key)) !== 1) throw expired();
    await this.redis.client.del(failKey);
    return { email: challenge.email, payload: JSON.parse(challenge.payload ?? '{}') as P };
  }

  private hash(token: string, code: string): string {
    return createHmac('sha256', this.config.JWT_ACCESS_SECRET).update(`email-code:${token}:${code}`).digest('hex');
  }

  private async countSend(email: string): Promise<void> {
    // Like the request throttle, off only in tests (the setting is refused in production).
    if (this.config.RATE_LIMIT_DISABLED) return;
    const key = `email-code-sends:${email}`;
    const sends = await this.redis.client.incr(key);
    if (sends === 1) await this.redis.client.expire(key, SEND_WINDOW_SECONDS);
    if (sends > MAX_SENDS_PER_WINDOW) throw new AppError('RATE_LIMITED', 'Too many codes requested. Please wait a few minutes.');
  }

  private async deliver(email: string, code: string, purpose: EmailCodePurpose, name?: string): Promise<void> {
    const site = (await this.store.get('site')).value;
    const mail = emailCodeEmail({ site: site.name, name, code, purpose, minutes: CODE_TTL_SECONDS / 60 });
    // The job carries the code: it is removed as soon as the worker is done with it.
    await this.queues.add('email', { to: email, ...mail }, { removeOnComplete: true, removeOnFail: true });
    if (!(await this.deliverable())) {
      // Development without email: the code goes to the API log, never to the response.
      this.logger.warn(`[DEV EMAIL] ${purpose} code for ${maskTarget(email)}: ${code}`);
    }
  }
}

function challengeKey(token: string): string {
  return `email-code:${hashToken(token)}`;
}

function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
