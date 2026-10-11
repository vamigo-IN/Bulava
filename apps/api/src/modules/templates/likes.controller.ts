import { Controller, Get, Header, HttpCode, Inject, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { generateSecureToken, hashToken } from '@bulava/auth';
import { z } from '@bulava/validation';
import { OptionalUser, Public, ReqMeta, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ZodBody } from '../../common/decorators/zod.decorators';
import type { AuthUser } from '../../common/request-context';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { AppError } from '../../common/errors/app-error';
import { LIKES_MAX_KEYS, LikesService, type Liker } from './likes.service';

/** A browser without an account: its random id, sent only to the public API, kept as a hash in the database. */
export const VISITOR_COOKIE = 'bulava_vid';
const VISITOR_COOKIE_PATH = '/api/v1/public';
const VISITOR_MAX_AGE_MS = 365 * 86_400_000;
const KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const LikeSchema = z.object({ liked: z.boolean() });

/** Hearts on designs (ADR-055): who liked what, and liking. */
@ApiTags('catalog')
@Public()
@Controller('public')
export class LikesController {
  constructor(
    private readonly likes: LikesService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private visitorId(req: Request): string | null {
    const raw = (req.cookies as Record<string, string> | undefined)?.[VISITOR_COOKIE];
    return raw && /^[A-Za-z0-9_-]{32,64}$/.test(raw) ? raw : null;
  }

  /** `?keys=a,b,c`: which of these designs this viewer liked, and the counts that may be shown (null while hidden). */
  @Get('likes')
  @Header('Cache-Control', 'private, no-store')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  state(@Query('keys') keys: string | undefined, @OptionalUser() user: AuthUser | null, @Req() req: Request) {
    const list = (keys ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter((k) => KEY.test(k) && k.length <= 80);
    if (list.length > LIKES_MAX_KEYS) throw new AppError('BAD_REQUEST', `Ask about ${LIKES_MAX_KEYS} designs at most.`);
    const visitor = this.visitorId(req);
    return this.likes.state(list, { userId: user?.id ?? null, visitorHash: visitor ? hashToken(visitor) : null });
  }

  /** Like or unlike a design. A browser without an account gets its visitor id on its first like. */
  @Post('templates/:key/like')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async like(
    @Param('key') key: string,
    @ZodBody(LikeSchema) body: z.infer<typeof LikeSchema>,
    @OptionalUser() user: AuthUser | null,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @ReqMeta() meta: RequestMeta,
  ) {
    if (!KEY.test(key) || key.length > 80) throw AppError.notFound('Template');
    let visitor = this.visitorId(req);
    if (!visitor && !user) {
      visitor = generateSecureToken();
      res.cookie(VISITOR_COOKIE, visitor, { httpOnly: true, secure: this.config.COOKIE_SECURE, sameSite: 'lax', path: VISITOR_COOKIE_PATH, maxAge: VISITOR_MAX_AGE_MS });
    }
    const liker: Liker = { userId: user?.id ?? null, visitorHash: visitor ? hashToken(visitor) : null };
    return this.likes.set(key, body.liked, liker, meta.ipAddress);
  }
}
