import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { generateSecureToken, hashToken } from '@bulava/auth';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AppError, type ErrorCode } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { AccountService } from '../users/account.service';
import { ConsentService } from '../users/consent.service';
import { MfaService } from './mfa.service';
import { SessionService, type IssuedSession } from './session.service';

const FLOW_TTL_SECONDS = 10 * 60;
export const GOOGLE_STATE_COOKIE = 'bulava_google_state';
export const GOOGLE_STATE_COOKIE_PATH = '/api/v1/auth/google';

type Mode = 'signin' | 'link';

interface Flow {
  verifier: string;
  nonce: string;
  next: string;
  mode: Mode;
  /** The signed-in user linking Google (link mode only). */
  userId?: string;
  /** Started from the sign-up page with the Terms and Privacy box ticked: a new account may be created. */
  consented?: boolean;
}

interface GoogleClaims extends JWTPayload {
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  nonce?: string;
}

export type GoogleCallbackResult =
  | { kind: 'session'; session: IssuedSession; redirect: string }
  | { kind: 'mfa'; redirect: string }
  | { kind: 'linked'; redirect: string }
  | { kind: 'restore'; redirect: string }
  | { kind: 'error'; code: ErrorCode | 'GOOGLE_CANCELLED'; redirect: string };

/** Same-site relative paths only, so the flow can never be turned into an open redirect. */
export function safeNext(value: string | undefined | null, fallback = '/dashboard'): string {
  if (!value || value.length > 500 || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}

const base64url = (b: Buffer) => b.toString('base64url');

/**
 * "Continue with Google" (OpenID Connect authorization code flow with PKCE).
 *
 * - The one-time `state` lives in Redis and in an httpOnly cookie on the
 *   browser that started the flow, so a callback URL cannot be replayed or
 *   planted in someone else's browser (login CSRF).
 * - The ID token is verified against Google's published keys (issuer,
 *   audience, expiry, nonce) and only verified emails are accepted.
 * - An existing password account is never merged silently: Bulava does not
 *   verify emails at sign-up, so the owner links Google while signed in.
 * - Accounts with two-step sign-in still need their second factor.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly audit: AuditService,
    private readonly consents: ConsentService,
    private readonly account: AccountService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.GOOGLE_CLIENT_ID && this.config.GOOGLE_CLIENT_SECRET);
  }

  private web(path: string): string {
    return `${this.config.WEB_ORIGIN.replace(/\/$/, '')}${path}`;
  }

  private redirectUri(): string {
    return this.config.GOOGLE_REDIRECT_URI ?? this.web('/api/v1/auth/google/callback');
  }

  private flowKey(state: string): string {
    return `oauth:google:${hashToken(state)}`;
  }

  /** Builds Google's consent URL and remembers the flow. Returns the state for the browser cookie. */
  async start(input: { next?: string | null; mode: Mode; userId?: string; consented?: boolean }): Promise<{ url: string; state: string }> {
    if (!this.enabled) throw new AppError('GOOGLE_UNAVAILABLE', 'Google sign-in is not configured.');
    const state = generateSecureToken();
    const flow: Flow = {
      verifier: generateSecureToken(48),
      nonce: generateSecureToken(),
      next: safeNext(input.next, input.mode === 'link' ? '/dashboard/account' : '/dashboard'),
      mode: input.mode,
      userId: input.userId,
      consented: input.consented === true,
    };
    await this.redis.client.set(this.flowKey(state), JSON.stringify(flow), 'EX', FLOW_TTL_SECONDS);
    const url = new URL(this.config.GOOGLE_AUTH_URL);
    url.search = new URLSearchParams({
      client_id: this.config.GOOGLE_CLIENT_ID!,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce: flow.nonce,
      code_challenge: base64url(createHash('sha256').update(flow.verifier).digest()),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    return { url: url.toString(), state };
  }

  async callback(query: { code?: string; state?: string; error?: string }, cookieState: string | undefined, meta: RequestMeta): Promise<GoogleCallbackResult> {
    const fail = (code: ErrorCode | 'GOOGLE_CANCELLED', mode: Mode = 'signin', reason?: string): GoogleCallbackResult => {
      if (reason) this.logger.warn({ reason }, 'Google sign-in failed');
      return { kind: 'error', code, redirect: mode === 'link' ? this.web(`/dashboard/account?google=${code}`) : this.web(`/login?error=${code}`) };
    };
    if (!this.enabled) return fail('GOOGLE_UNAVAILABLE');
    if (!query.state || !cookieState || query.state !== cookieState) return fail('GOOGLE_FAILED', 'signin', 'state mismatch');
    // Single use: a replayed callback finds nothing.
    const raw = await this.redis.client.getdel(this.flowKey(query.state));
    if (!raw) return fail('GOOGLE_FAILED', 'signin', 'unknown or expired state');
    const flow = JSON.parse(raw) as Flow;
    if (query.error) return fail(query.error === 'access_denied' ? 'GOOGLE_CANCELLED' : 'GOOGLE_FAILED', flow.mode, `provider error ${query.error}`);
    if (!query.code) return fail('GOOGLE_FAILED', flow.mode, 'missing code');

    let claims: GoogleClaims;
    try {
      claims = await this.exchange(query.code, flow);
    } catch (error) {
      await this.audit.record({ actorType: 'ANONYMOUS', action: 'user.google_signin', targetType: 'User', result: 'FAILURE', metadata: { reason: 'TOKEN_REJECTED' }, meta });
      return fail('GOOGLE_FAILED', flow.mode, (error as Error).message);
    }
    const sub = String(claims.sub);
    const email = claims.email?.trim().toLowerCase();
    const verified = claims.email_verified === true || claims.email_verified === 'true';
    if (!email || !verified) return fail('GOOGLE_FAILED', flow.mode, 'email missing or not verified');

    // ───── Link to the signed-in account ─────
    if (flow.mode === 'link') {
      if (!flow.userId) return fail('GOOGLE_FAILED', 'link', 'link without user');
      const owner = await this.prisma.user.findUnique({ where: { googleSub: sub }, select: { id: true } });
      if (owner && owner.id !== flow.userId) return fail('GOOGLE_ALREADY_LINKED', 'link');
      await this.prisma.user.update({ where: { id: flow.userId }, data: { googleSub: sub } });
      await this.audit.record({ actorType: 'USER', actorId: flow.userId, action: 'user.google_linked', targetType: 'User', targetId: flow.userId, meta });
      return { kind: 'linked', redirect: this.web(`${flow.next}${flow.next.includes('?') ? '&' : '?'}google=linked`) };
    }

    // ───── Sign in, or sign up ─────
    let user = await this.prisma.user.findUnique({ where: { googleSub: sub } });
    let created = false;
    if (!user) {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) {
        // Only a verified email may be linked automatically (see class comment).
        if (!existing.emailVerifiedAt) {
          await this.audit.record({ actorType: 'ANONYMOUS', action: 'user.google_signin', targetType: 'User', targetId: existing.id, result: 'FAILURE', metadata: { reason: 'LINK_REQUIRED' }, meta });
          return fail('GOOGLE_LINK_REQUIRED');
        }
        user = await this.prisma.user.update({ where: { id: existing.id }, data: { googleSub: sub } });
      } else {
        // A new account needs the sign-up page's ticked box; from the sign-in page, send them there first.
        if (!flow.consented) return { kind: 'error', code: 'CONSENT_REQUIRED', redirect: this.web('/signup?error=CONSENT_REQUIRED') };
        const versions = await this.consents.versions(['terms', 'privacy']);
        user = await this.prisma.$transaction(async (tx) => {
          const createdUser = await tx.user.create({
            data: { email, name: (claims.name?.trim() || email.split('@')[0]!).slice(0, 120), googleSub: sub, emailVerifiedAt: new Date() },
          });
          await this.consents.recordSignup(tx, createdUser.id, versions, 'signup_google');
          await this.audit.record({ actorType: 'USER', actorId: createdUser.id, action: 'user.signup', targetType: 'User', targetId: createdUser.id, metadata: { method: 'google' }, meta }, tx);
          return createdUser;
        });
        created = true;
      }
    }
    // An account waiting to be deleted: Google proved it is the owner, so offer to restore it.
    if (AccountService.restorable(user)) {
      const token = await this.account.restoreToken(user.id);
      await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'user.restore_offered', targetType: 'User', targetId: user.id, metadata: { method: 'google' }, meta });
      // The token travels in the fragment: never sent to servers or logged.
      return { kind: 'restore', redirect: this.web(`/login#restore=${token}&until=${encodeURIComponent(user.deletionScheduledAt!.toISOString())}`) };
    }
    if (user.status !== 'ACTIVE' || user.deletedAt) return fail('GOOGLE_FAILED', 'signin', 'account not active');

    if (user.totpEnabledAt) {
      const { challengeToken } = await this.mfa.createChallenge(user.id);
      // The challenge travels in the fragment: never sent to servers or logged.
      return { kind: 'mfa', redirect: this.web(`/login?next=${encodeURIComponent(flow.next)}#mfa=${challengeToken}`) };
    }
    const session = await this.sessions.issue(user, meta);
    if (!created) {
      await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'user.login', targetType: 'User', targetId: user.id, metadata: { method: 'google' }, meta });
    }
    return { kind: 'session', session, redirect: this.web(flow.next) };
  }

  /** Disconnect Google; the account must keep another way to sign in. */
  async unlink(userId: string, meta: RequestMeta): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true, googleSub: true } });
    if (!user.googleSub) return;
    if (!user.passwordHash) throw new AppError('GOOGLE_UNLINK_BLOCKED', 'Set a password before disconnecting Google.');
    await this.prisma.user.update({ where: { id: userId }, data: { googleSub: null } });
    await this.audit.record({ actorType: 'USER', actorId: userId, action: 'user.google_unlinked', targetType: 'User', targetId: userId, meta });
  }

  /** Code → tokens (PKCE) → verified ID token claims. */
  private async exchange(code: string, flow: Flow): Promise<GoogleClaims> {
    const res = await fetch(this.config.GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: this.config.GOOGLE_CLIENT_ID!,
        client_secret: this.config.GOOGLE_CLIENT_SECRET!,
        redirect_uri: this.redirectUri(),
        grant_type: 'authorization_code',
        code_verifier: flow.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`token endpoint answered ${res.status}`);
    const body = (await res.json()) as { id_token?: string };
    if (!body.id_token) throw new Error('no id_token');
    this.jwks ??= createRemoteJWKSet(new URL(this.config.GOOGLE_JWKS_URL));
    const issuer = this.config.GOOGLE_ISSUER;
    const { payload } = await jwtVerify<GoogleClaims>(body.id_token, this.jwks, {
      issuer: [issuer, issuer.replace(/^https:\/\//, '')],
      audience: this.config.GOOGLE_CLIENT_ID!,
      clockTolerance: 60,
    });
    if (payload.nonce !== flow.nonce) throw new Error('nonce mismatch');
    if (!payload.sub) throw new Error('no subject');
    return payload;
  }
}
