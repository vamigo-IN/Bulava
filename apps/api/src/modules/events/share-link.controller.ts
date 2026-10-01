import { Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ShareLinkExpirySchema, type ShareLinkExpiryInput } from '@bulava/validation';
import { EventAccess, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { ShareLinkService } from './share-link.service';

/** The one link a host shares for a public, private-link or secret-link event. */
@ApiTags('events')
@Controller('events/:eventId/share-link')
export class ShareLinkController {
  constructor(private readonly shareLinks: ShareLinkService) {}

  @Get()
  @RequireEventPermission('invitation.read')
  get(@EventAccess() access: EventAccessContext) {
    return this.shareLinks.info(access);
  }

  /** A new secret link; the old one stops working at once. */
  @Post('rotate')
  @HttpCode(200)
  @RequireEventPermission('event.update')
  rotate(@EventAccess() access: EventAccessContext, @ReqMeta() meta: RequestMeta) {
    return this.shareLinks.rotate(access, meta);
  }

  @Put('expiry')
  @RequireEventPermission('event.update')
  @ApiZodBody(ShareLinkExpirySchema)
  expiry(@EventAccess() access: EventAccessContext, @ZodBody(ShareLinkExpirySchema) body: ShareLinkExpiryInput, @ReqMeta() meta: RequestMeta) {
    return this.shareLinks.setExpiry(access, new Date(body.expiresAt), meta);
  }
}
