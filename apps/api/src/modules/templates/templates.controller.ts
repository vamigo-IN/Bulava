import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/auth.decorators';
import { ZodQuery } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import { TemplateAssetsService } from './template-assets.service';
import { TemplateListQuerySchema, TemplatesService, type TemplateListQuery } from './templates.service';

/** Public marketing/catalog endpoints consumed by the web app (server-side). */
@ApiTags('catalog')
@Public()
@Controller()
export class TemplatesController {
  constructor(
    private readonly templates: TemplatesService,
    private readonly assets: TemplateAssetsService,
  ) {}

  /**
   * Painted artwork layers (approved, licensed, in a published template):
   * redirects to a signed URL for the rendition at least `w` pixels wide.
   * Catalogue pages request many layers at once, hence the higher limit.
   */
  @Get('public/template-assets/:assetId')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  async templateAsset(@Param('assetId', ParseIdPipe) assetId: string, @Query('w') w: string | undefined, @Res() res: Response) {
    const width = Math.min(4096, Math.max(200, Number.parseInt(w ?? '', 10) || 2400));
    const url = await this.assets.publicUrl(assetId, width);
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.redirect(302, url);
  }

  @Get('public/templates')
  @Header('Cache-Control', 'public, max-age=60')
  list(@ZodQuery(TemplateListQuerySchema) query: TemplateListQuery) {
    return this.templates.list(query);
  }

  @Get('public/templates/:key')
  @Header('Cache-Control', 'public, max-age=60')
  get(@Param('key') key: string) {
    return this.templates.getByKey(key.slice(0, 80));
  }

  @Get('public/site-stats')
  @Header('Cache-Control', 'public, max-age=300')
  stats() {
    return this.templates.siteStats();
  }

  @Get('public/testimonials')
  @Header('Cache-Control', 'public, max-age=300')
  testimonials() {
    return this.templates.testimonials();
  }

  @Get('meta/plans')
  @Header('Cache-Control', 'public, max-age=300')
  plans() {
    return this.templates.plans();
  }
}
