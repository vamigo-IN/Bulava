import { Controller, Get, Param, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { EventAccess, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { CloneEventSchema, EventToolsService, type CloneEventInput } from './event-tools.service';

@ApiTags('events')
@Controller('events/:eventId')
export class EventToolsController {
  constructor(private readonly tools: EventToolsService) {}

  @Post('clone')
  @RequireEventPermission('event.update')
  @ApiZodBody(CloneEventSchema)
  clone(@EventAccess() access: EventAccessContext, @ZodBody(CloneEventSchema) body: CloneEventInput, @ReqMeta() meta: RequestMeta) {
    return this.tools.clone(access, body, meta);
  }

  /** CSV exports (guests, rsvps, invitations, attendance, media). */
  @Get('exports/:kind')
  @RequireEventPermission('guest.read')
  async export(@EventAccess() access: EventAccessContext, @Param('kind') kind: string, @ReqMeta() meta: RequestMeta, @Res() res: Response) {
    const { filename, csv } = await this.tools.exportCsv(access, EventToolsService.assertKind(kind.replace(/\.csv$/, '')), meta);
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      .setHeader('Cache-Control', 'no-store')
      // BOM so Excel opens Indic scripts correctly.
      .send(`\uFEFF${csv}`);
  }
}
