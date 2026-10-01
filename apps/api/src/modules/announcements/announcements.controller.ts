import { Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateAnnouncementSchema, type CreateAnnouncementInput } from '@bulava/validation';
import { EventAccess, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { EventAccessContext } from '../../common/request-context';
import { AnnouncementsService } from './announcements.service';

@ApiTags('announcements')
@Controller('events/:eventId/announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @RequireEventPermission('event.read')
  list(@EventAccess() access: EventAccessContext) {
    return this.announcements.list(access);
  }

  @Post()
  @RequireEventPermission('invitation.send')
  @ApiZodBody(CreateAnnouncementSchema)
  create(@EventAccess() access: EventAccessContext, @ZodBody(CreateAnnouncementSchema) body: CreateAnnouncementInput, @ReqMeta() meta: RequestMeta) {
    return this.announcements.create(access, body, meta);
  }

  @Post(':announcementId/publish')
  @HttpCode(200)
  @RequireEventPermission('invitation.send')
  publish(@EventAccess() access: EventAccessContext, @Param('announcementId', ParseIdPipe) id: string, @ReqMeta() meta: RequestMeta) {
    return this.announcements.publish(access, id, meta);
  }

  @Delete(':announcementId')
  @HttpCode(200)
  @RequireEventPermission('invitation.send')
  async remove(@EventAccess() access: EventAccessContext, @Param('announcementId', ParseIdPipe) id: string) {
    await this.announcements.remove(access, id);
    return { deleted: true };
  }
}
