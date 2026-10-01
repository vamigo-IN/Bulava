import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EventAccess, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { EventAccessContext } from '../../common/request-context';
import { CreateVideoSchema, VideosService, type CreateVideoInput } from './videos.service';

@ApiTags('videos')
@Controller()
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Get('events/:eventId/videos')
  @RequireEventPermission('event.read')
  list(@EventAccess() access: EventAccessContext) {
    return this.videos.list(access);
  }

  @Post('events/:eventId/videos')
  @RequireEventPermission('event.update')
  @ApiZodBody(CreateVideoSchema)
  create(@EventAccess() access: EventAccessContext, @ZodBody(CreateVideoSchema) body: CreateVideoInput, @ReqMeta() meta: RequestMeta) {
    return this.videos.create(access, body, meta);
  }

  @Post('events/:eventId/videos/:jobId/cancel')
  @HttpCode(200)
  @RequireEventPermission('event.update')
  cancel(@EventAccess() access: EventAccessContext, @Param('jobId', ParseIdPipe) jobId: string, @ReqMeta() meta: RequestMeta) {
    return this.videos.cancel(access, jobId, meta);
  }

  @Get('events/:eventId/videos/:jobId/download')
  @RequireEventPermission('event.read')
  download(@EventAccess() access: EventAccessContext, @Param('jobId', ParseIdPipe) jobId: string) {
    return this.videos.download(access, jobId);
  }

  @Get('music')
  music() {
    return this.videos.licensedMusic();
  }
}
