import { Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Req, SetMetadata } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  CreateSubAlbumSchema,
  IdSchema,
  MediaUploadRequestSchema,
  TeamUploadRequestSchema,
  UpdateAlbumSchema,
  UpdateSubAlbumSchema,
  z,
  type CreateSubAlbumInput,
  type MediaUploadRequestInput,
  type TeamUploadRequestInput,
  type UpdateAlbumInput,
  type UpdateSubAlbumInput,
} from '@bulava/validation';
import { EventAccess, Public, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { RAW_RESPONSE } from '../../common/interceptors/response-envelope.interceptor';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { EventAccessContext } from '../../common/request-context';
import { AlbumService } from './album.service';
import { DesignUploadSchema, MediaService, ModerateSchema, type DesignUploadInput } from './media.service';
import { LiveWallService } from './live-wall.service';

const MoveSchema = z.object({ albumId: IdSchema });

@ApiTags('media')
@Controller('events/:eventId')
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly album: AlbumService,
  ) {}

  // ───── The event's album and its sub-albums ─────

  @Get('album')
  @RequireEventPermission('media.view')
  getAlbum(@EventAccess() access: EventAccessContext) {
    return this.album.get(access);
  }

  @Patch('album')
  @RequireEventPermission('media.moderate')
  @ApiZodBody(UpdateAlbumSchema)
  updateAlbum(@EventAccess() access: EventAccessContext, @ZodBody(UpdateAlbumSchema) body: UpdateAlbumInput, @ReqMeta() meta: RequestMeta) {
    return this.album.update(access, body, meta);
  }

  @Get('album/qr.svg')
  @RequireEventPermission('media.view')
  @SetMetadata(RAW_RESPONSE, true)
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'private, max-age=300')
  qr(@EventAccess() access: EventAccessContext) {
    return this.album.qrSvg(access.eventId);
  }

  /** New secret link for the live photo wall; screens using the old link stop updating. */
  @Post('album/wall/rotate')
  @HttpCode(200)
  @RequireEventPermission('media.moderate')
  rotateWall(@EventAccess() access: EventAccessContext, @ReqMeta() meta: RequestMeta) {
    return this.album.rotateWall(access, meta);
  }

  @Post('album/sub-albums')
  @RequireEventPermission('media.moderate')
  @ApiZodBody(CreateSubAlbumSchema)
  createSubAlbum(@EventAccess() access: EventAccessContext, @ZodBody(CreateSubAlbumSchema) body: CreateSubAlbumInput, @ReqMeta() meta: RequestMeta) {
    return this.album.createSubAlbum(access, body, meta);
  }

  @Patch('album/sub-albums/:albumId')
  @RequireEventPermission('media.moderate')
  @ApiZodBody(UpdateSubAlbumSchema)
  updateSubAlbum(
    @EventAccess() access: EventAccessContext,
    @Param('albumId', ParseIdPipe) albumId: string,
    @ZodBody(UpdateSubAlbumSchema) body: UpdateSubAlbumInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.album.updateSubAlbum(access, albumId, body, meta);
  }

  @Delete('album/sub-albums/:albumId')
  @HttpCode(200)
  @RequireEventPermission('media.moderate')
  deleteSubAlbum(@EventAccess() access: EventAccessContext, @Param('albumId', ParseIdPipe) albumId: string, @ReqMeta() meta: RequestMeta) {
    return this.album.deleteSubAlbum(access, albumId, meta);
  }

  @Get('album/sub-albums/:albumId/items')
  @RequireEventPermission('media.view')
  items(@EventAccess() access: EventAccessContext, @Param('albumId', ParseIdPipe) albumId: string) {
    return this.album.items(access, albumId);
  }

  /** Photographers and the team upload straight into a sub-album. */
  @Post('album/uploads')
  @RequireEventPermission('media.upload')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiZodBody(TeamUploadRequestSchema)
  teamUpload(@EventAccess() access: EventAccessContext, @ZodBody(TeamUploadRequestSchema) body: TeamUploadRequestInput) {
    return this.album.requestTeamUpload(access, body);
  }

  @Post('album/uploads/:itemId/complete')
  @HttpCode(200)
  @RequireEventPermission('media.upload')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  completeTeamUpload(@EventAccess() access: EventAccessContext, @Param('itemId', ParseIdPipe) itemId: string) {
    return this.album.completeTeamUpload(access, itemId);
  }

  // ───── Photos ─────

  @Get('media/approved-photos')
  @RequireEventPermission('media.view')
  approved(@EventAccess() access: EventAccessContext) {
    return this.media.approvedPhotos(access);
  }

  /** Photos uploaded straight from the design panel. */
  @Post('media/design-uploads')
  @RequireEventPermission('event.update')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiZodBody(DesignUploadSchema)
  designUpload(@EventAccess() access: EventAccessContext, @ZodBody(DesignUploadSchema) body: DesignUploadInput) {
    return this.media.requestDesignUpload(access, body);
  }

  @Post('media/design-uploads/:itemId/complete')
  @HttpCode(200)
  @RequireEventPermission('event.update')
  completeDesignUpload(@EventAccess() access: EventAccessContext, @Param('itemId', ParseIdPipe) itemId: string) {
    return this.media.completeDesignUpload(access, itemId);
  }

  @Get('media/design-uploads/:itemId')
  @RequireEventPermission('event.update')
  designUploadStatus(@EventAccess() access: EventAccessContext, @Param('itemId', ParseIdPipe) itemId: string) {
    return this.media.designUploadStatus(access, itemId);
  }

  @Post('media/:itemId/moderate')
  @HttpCode(200)
  @RequireEventPermission('media.moderate')
  @ApiZodBody(ModerateSchema)
  async moderate(
    @EventAccess() access: EventAccessContext,
    @Param('itemId', ParseIdPipe) itemId: string,
    @ZodBody(ModerateSchema) body: z.infer<typeof ModerateSchema>,
    @ReqMeta() meta: RequestMeta,
  ) {
    await this.media.moderate(access, itemId, body.decision, body.notes, meta);
    return { ok: true };
  }

  /** Moves a photo to another sub-album. */
  @Post('media/:itemId/move')
  @HttpCode(200)
  @RequireEventPermission('media.moderate')
  @ApiZodBody(MoveSchema)
  async move(@EventAccess() access: EventAccessContext, @Param('itemId', ParseIdPipe) itemId: string, @ZodBody(MoveSchema) body: z.infer<typeof MoveSchema>, @ReqMeta() meta: RequestMeta) {
    await this.media.moveItem(access, itemId, body.albumId, meta);
    return { ok: true };
  }

  @Get('media/:itemId/download')
  @RequireEventPermission('media.view')
  async download(@EventAccess() access: EventAccessContext, @Param('itemId', ParseIdPipe) itemId: string) {
    return { url: await this.media.hostDownloadUrl(access, itemId) };
  }

  @Delete('media/:itemId')
  @HttpCode(200)
  @RequireEventPermission('media.delete')
  async remove(@EventAccess() access: EventAccessContext, @Param('itemId', ParseIdPipe) itemId: string, @ReqMeta() meta: RequestMeta) {
    await this.media.deleteItem(access, itemId, meta);
    return { deleted: true };
  }
}

/** The album link for guests: no account needed, the album code is the credential. */
@ApiTags('public-media')
@Public()
@Controller('public/media-rooms')
export class PublicMediaController {
  constructor(private readonly media: MediaService) {}

  private invite(req: Request): string | undefined {
    return req.get('x-bulava-invite') ?? undefined;
  }

  @Get(':code')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  room(@Param('code') code: string, @Req() req: Request) {
    return this.media.publicRoom(code, this.invite(req));
  }

  @Post(':code/uploads')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiZodBody(MediaUploadRequestSchema)
  requestUpload(@Param('code') code: string, @ZodBody(MediaUploadRequestSchema) body: MediaUploadRequestInput, @ReqMeta() meta: RequestMeta) {
    return this.media.requestUpload(code, body, meta);
  }

  @Post(':code/uploads/:itemId/complete')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  complete(@Param('code') code: string, @Param('itemId', ParseIdPipe) itemId: string) {
    return this.media.completeUpload(code, itemId);
  }

  @Get(':code/gallery')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  gallery(@Param('code') code: string, @Req() req: Request) {
    return this.media.publicGallery(code, this.invite(req));
  }
}

/** Live photo wall screens: the secret wall link is the credential. */
@ApiTags('public-media')
@Public()
@Controller('public/walls')
export class PublicWallController {
  constructor(private readonly wall: LiveWallService) {}

  @Get(':token')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  view(@Param('token') token: string) {
    return this.wall.publicWall(token);
  }

  @Get(':token/qr.svg')
  @SetMetadata(RAW_RESPONSE, true)
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'private, max-age=300')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  qr(@Param('token') token: string) {
    return this.wall.uploadQrSvg(token);
  }
}
