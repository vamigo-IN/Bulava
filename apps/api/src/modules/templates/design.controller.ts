import { Controller, Get, Header, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { TemplateType } from '@bulava/database';
import { z } from '@bulava/validation';
import { EventAccess, Public, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { AppError } from '../../common/errors/app-error';
import type { EventAccessContext } from '../../common/request-context';
import { DesignService, OUTPUTS, SelectTemplateSchema, type SelectTemplateInput } from './design.service';
import { publicEventCredentials } from './public-event-credentials';
import { PublicEventsService } from './public-events.service';

const PinSchema = z.object({ pin: z.string().trim().min(4).max(12) });

function parseOutput(value: string): TemplateType {
  const upper = value.toUpperCase().replace('-', '_');
  if (!(OUTPUTS as readonly string[]).includes(upper)) throw AppError.notFound('Output');
  return upper as TemplateType;
}

@ApiTags('design')
@Controller('events/:eventId')
export class DesignController {
  constructor(private readonly design: DesignService) {}

  @Get('design')
  @RequireEventPermission('event.read')
  get(@EventAccess() access: EventAccessContext) {
    return this.design.get(access);
  }

  @Put('design/:output')
  @RequireEventPermission('event.update')
  @ApiZodBody(SelectTemplateSchema)
  select(
    @EventAccess() access: EventAccessContext,
    @Param('output') output: string,
    @ZodBody(SelectTemplateSchema) body: SelectTemplateInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.design.select(access, parseOutput(output), body, meta);
  }

  @Get('entitlements')
  @RequireEventPermission('event.read')
  entitlements(@EventAccess() access: EventAccessContext) {
    return this.design.entitlementsSummary(access);
  }
}

@ApiTags('public-events')
@Public()
@Controller('public/events')
export class PublicEventsController {
  constructor(private readonly publicEvents: PublicEventsService) {}

  @Get('sitemap')
  @Header('Cache-Control', 'public, max-age=600')
  sitemap() {
    return this.publicEvents.sitemap();
  }

  @Get(':slug')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  view(@Param('slug') slug: string, @Req() req: Request) {
    const safeSlug = slug.slice(0, 120);
    const { pinPass, linkKey } = publicEventCredentials(req, safeSlug);
    return this.publicEvents.view(safeSlug, pinPass, linkKey);
  }

  @Post(':slug/pin')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodBody(PinSchema)
  pin(@Param('slug') slug: string, @ZodBody(PinSchema) body: z.infer<typeof PinSchema>) {
    return this.publicEvents.verifyPin(slug.slice(0, 120), body.pin);
  }
}
