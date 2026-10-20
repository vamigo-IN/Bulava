import { Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { platformRoleHasPermission, PREVIEW_LOOK_TOKEN } from '@bulava/auth';
import {
  DeskRequestsQuerySchema,
  PreviewAssignSchema,
  PreviewChangesSchema,
  PreviewItemCreateSchema,
  PreviewNoteSchema,
  PreviewOfferSchema,
  PreviewOwnSchema,
  PreviewProviderCreateSchema,
  PreviewRequestSchema,
  PreviewStatusSchema,
  StaffPreviewRequestSchema,
  type DeskRequestsQuery,
  type PreviewAssignInput,
  type PreviewChangesInput,
  type PreviewItemCreateInput,
  type PreviewNoteInput,
  type PreviewOfferInput,
  type PreviewOwnInput,
  type PreviewProviderCreateInput,
  type PreviewRequestInput,
  type PreviewStatusInput,
  type StaffPreviewRequestInput,
} from '@bulava/validation';
import { CurrentUser, OptionalUser, Public, ReqMeta, RequirePlatformPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody, ZodQuery } from '../../common/decorators/zod.decorators';
import { AppError } from '../../common/errors/app-error';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/request-context';
import { PreviewsService, type DeskActor } from './previews.service';

/** The customer's link token travels in this header, never in an API path (Nginx and the API log paths). */
export const PREVIEW_LOOK_HEADER = 'x-preview-look';

function lookToken(token: string | undefined): string {
  if (!token || !PREVIEW_LOOK_TOKEN.test(token)) throw AppError.notFound('Preview');
  return token;
}

const actor = (user: AuthUser): DeskActor => ({ id: user.id, manage: platformRoleHasPermission(user.platformRole, 'preview.manage') });

/** Asking for a preview (the request form): no account needed. */
@ApiTags('previews')
@Public()
@Controller('public/preview-requests')
export class PublicPreviewRequestsController {
  constructor(private readonly previews: PreviewsService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @ApiZodBody(PreviewRequestSchema)
  request(@ZodBody(PreviewRequestSchema) body: PreviewRequestInput, @OptionalUser() user: AuthUser | null, @ReqMeta() meta: RequestMeta) {
    return this.previews.request(body, user, meta);
  }
}

/** The customer's preview page (/look/<token>): its previews, a card and a film to view, and asking for changes. */
@ApiTags('previews')
@Public()
@Controller('public/looks')
export class PublicLooksController {
  constructor(private readonly previews: PreviewsService) {}

  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  look(@Headers(PREVIEW_LOOK_HEADER) token: string | undefined, @OptionalUser() user: AuthUser | null) {
    return this.previews.look(lookToken(token), user);
  }

  @Get('cards/:itemId')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  card(@Headers(PREVIEW_LOOK_HEADER) token: string | undefined, @Param('itemId', ParseIdPipe) itemId: string) {
    return this.previews.lookCard(lookToken(token), itemId);
  }

  @Get('films/:itemId')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  film(@Headers(PREVIEW_LOOK_HEADER) token: string | undefined, @Param('itemId', ParseIdPipe) itemId: string) {
    return this.previews.lookFilm(lookToken(token), itemId);
  }

  @Post('view')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  view(@Headers(PREVIEW_LOOK_HEADER) token: string | undefined, @ReqMeta() meta: RequestMeta) {
    return this.previews.viewed(lookToken(token), `${meta.ipAddress ?? ''}|${meta.userAgent ?? ''}`);
  }

  @Post('changes')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @ApiZodBody(PreviewChangesSchema)
  changes(@Headers(PREVIEW_LOOK_HEADER) token: string | undefined, @ZodBody(PreviewChangesSchema) body: PreviewChangesInput) {
    return this.previews.askChanges(lookToken(token), body);
  }
}

/** Signed in: owning a preview, and the previews made for this account. */
@ApiTags('previews')
@Controller()
export class LooksController {
  constructor(private readonly previews: PreviewsService) {}

  @Post('looks/own')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodBody(PreviewOwnSchema)
  own(@Headers(PREVIEW_LOOK_HEADER) token: string | undefined, @ZodBody(PreviewOwnSchema) body: PreviewOwnInput, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.previews.own(lookToken(token), body, user, meta);
  }

  @Get('previews/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.previews.mine(user);
  }
}

/** The preview desk (preview providers, in the dashboard): the queue, a request's work, sharing previews. */
@ApiTags('previews')
@Controller('desk')
@RequirePlatformPermission('preview.work')
export class DeskController {
  constructor(private readonly previews: PreviewsService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.previews.summary(actor(user));
  }

  @Get('requests')
  list(@CurrentUser() user: AuthUser, @ZodQuery(DeskRequestsQuerySchema) query: DeskRequestsQuery) {
    return this.previews.list(actor(user), query);
  }

  @Get('requests/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string) {
    return this.previews.detail(id, actor(user));
  }

  @Post('requests/:id/take')
  @HttpCode(200)
  take(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ReqMeta() meta: RequestMeta) {
    return this.previews.take(id, actor(user), meta);
  }

  @Post('requests/:id/release')
  @HttpCode(200)
  release(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ReqMeta() meta: RequestMeta) {
    return this.previews.release(id, actor(user), meta);
  }

  @Patch('requests/:id/status')
  @ApiZodBody(PreviewStatusSchema)
  status(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(PreviewStatusSchema) body: PreviewStatusInput, @ReqMeta() meta: RequestMeta) {
    return this.previews.setStatus(id, body, actor(user), meta);
  }

  @Put('requests/:id/offer')
  @ApiZodBody(PreviewOfferSchema)
  offer(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(PreviewOfferSchema) body: PreviewOfferInput, @ReqMeta() meta: RequestMeta) {
    return this.previews.setOffer(id, body, actor(user), meta);
  }

  @Post('requests/:id/notes')
  @ApiZodBody(PreviewNoteSchema)
  note(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(PreviewNoteSchema) body: PreviewNoteInput) {
    return this.previews.note(id, body, actor(user));
  }

  @Post('requests/:id/items')
  @ApiZodBody(PreviewItemCreateSchema)
  addItem(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(PreviewItemCreateSchema) body: PreviewItemCreateInput, @ReqMeta() meta: RequestMeta) {
    return this.previews.addItem(id, body, actor(user), meta);
  }

  @Post('requests/:id/items/:itemId/share')
  @HttpCode(200)
  share(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @Param('itemId', ParseIdPipe) itemId: string, @ReqMeta() meta: RequestMeta) {
    return this.previews.share(id, itemId, actor(user), meta);
  }

  @Post('requests/:id/items/:itemId/withdraw')
  @HttpCode(200)
  withdraw(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @Param('itemId', ParseIdPipe) itemId: string) {
    return this.previews.withdraw(id, itemId, actor(user));
  }

  @Delete('requests/:id/items/:itemId')
  removeItem(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @Param('itemId', ParseIdPipe) itemId: string) {
    return this.previews.removeItem(id, itemId, actor(user));
  }

  @Post('requests/:id/send')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  send(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string) {
    return this.previews.resend(id, actor(user));
  }

  @Post('requests/:id/link/rotate')
  @HttpCode(200)
  rotate(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ReqMeta() meta: RequestMeta) {
    return this.previews.rotateLink(id, actor(user), meta);
  }
}

/** The console's Previews page (preview.manage): every request, customers from outside, assignments, and the preview providers. */
@ApiTags('admin')
@Controller('admin/previews')
@RequirePlatformPermission('preview.manage')
export class AdminPreviewsController {
  constructor(private readonly previews: PreviewsService) {}

  @Get('requests')
  list(@CurrentUser() user: AuthUser, @ZodQuery(DeskRequestsQuerySchema) query: DeskRequestsQuery) {
    return this.previews.list({ id: user.id, manage: true }, { ...query, scope: query.scope === 'mine' ? 'all' : query.scope });
  }

  @Get('requests/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string) {
    return this.previews.detail(id, { id: user.id, manage: true });
  }

  @Post('requests')
  @ApiZodBody(StaffPreviewRequestSchema)
  create(@CurrentUser() user: AuthUser, @ZodBody(StaffPreviewRequestSchema) body: StaffPreviewRequestInput, @ReqMeta() meta: RequestMeta) {
    return this.previews.staffRequest(body, user, meta);
  }

  @Post('requests/:id/assign')
  @HttpCode(200)
  @ApiZodBody(PreviewAssignSchema)
  assign(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(PreviewAssignSchema) body: PreviewAssignInput, @ReqMeta() meta: RequestMeta) {
    return this.previews.assign(id, body, user, meta);
  }

  @Patch('requests/:id/status')
  @ApiZodBody(PreviewStatusSchema)
  status(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(PreviewStatusSchema) body: PreviewStatusInput, @ReqMeta() meta: RequestMeta) {
    return this.previews.setStatus(id, body, { id: user.id, manage: true }, meta);
  }

  @Put('requests/:id/offer')
  @ApiZodBody(PreviewOfferSchema)
  offer(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(PreviewOfferSchema) body: PreviewOfferInput, @ReqMeta() meta: RequestMeta) {
    return this.previews.setOffer(id, body, { id: user.id, manage: true }, meta);
  }

  @Post('requests/:id/notes')
  @ApiZodBody(PreviewNoteSchema)
  note(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(PreviewNoteSchema) body: PreviewNoteInput) {
    return this.previews.note(id, body, { id: user.id, manage: true });
  }

  @Get('providers')
  providers() {
    return this.previews.providers();
  }

  @Post('providers')
  @ApiZodBody(PreviewProviderCreateSchema)
  addProvider(@CurrentUser() user: AuthUser, @ZodBody(PreviewProviderCreateSchema) body: PreviewProviderCreateInput, @ReqMeta() meta: RequestMeta) {
    return this.previews.addProvider(body, user, meta);
  }

  @Delete('providers/:id')
  removeProvider(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ReqMeta() meta: RequestMeta) {
    return this.previews.removeProvider(id, user, meta);
  }
}

