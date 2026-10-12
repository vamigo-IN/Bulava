import { Controller, Get, Header, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StockImportSchema, StockSearchSchema, type StockImportInput, type StockSearchInput } from '@bulava/validation';
import { EventAccess, Public, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody, ZodQuery } from '../../common/decorators/zod.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { MediaService } from '../media/media.service';
import { StockService } from './stock.service';

/**
 * Stock photos and illustrations in an event's editors (ADR-064): searching
 * and bringing one in as a design photo take the right to edit the event.
 * (The card editor has its own routes, by card session.)
 */
@ApiTags('stock')
@Controller()
export class StockController {
  constructor(
    private readonly stock: StockService,
    private readonly media: MediaService,
  ) {}

  /** What the editors may offer: no keys and no secrets, only whether and whose. */
  @Get('public/stock/status')
  @Public()
  @Header('Cache-Control', 'public, max-age=300')
  status() {
    return this.stock.status();
  }

  @Get('events/:eventId/stock')
  @RequireEventPermission('event.update')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  search(@ZodQuery(StockSearchSchema) query: StockSearchInput) {
    return this.stock.search(query);
  }

  @Post('events/:eventId/stock')
  @RequireEventPermission('event.update')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiZodBody(StockImportSchema)
  async import(@EventAccess() access: EventAccessContext, @ZodBody(StockImportSchema) body: StockImportInput, @ReqMeta() meta: RequestMeta) {
    // The plan's room first: nothing is downloaded for a photo that could not be kept.
    await this.media.assertPhotoRoom(access);
    return this.media.importDesignPhoto(access, await this.stock.fetchImage(body.id), meta);
  }
}
