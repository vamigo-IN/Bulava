import { Controller, Delete, Get, Header, HttpCode, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SetDomainSchema, type SetDomainInput } from '@bulava/validation';
import { EventAccess, Public, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { AppError } from '../../common/errors/app-error';
import type { EventAccessContext } from '../../common/request-context';
import { DomainsService } from './domains.service';

@ApiTags('domains')
@Controller('events/:eventId/domain')
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @RequireEventPermission('event.read')
  get(@EventAccess() access: EventAccessContext) {
    return this.domains.get(access);
  }

  @Put()
  @RequireEventPermission('event.update')
  @ApiZodBody(SetDomainSchema)
  set(@EventAccess() access: EventAccessContext, @ZodBody(SetDomainSchema) body: SetDomainInput, @ReqMeta() meta: RequestMeta) {
    return this.domains.set(access, body.hostname, meta);
  }

  /** Check DNS and TLS now instead of waiting for the next scheduled check. */
  @Post('check')
  @HttpCode(200)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @RequireEventPermission('event.update')
  check(@EventAccess() access: EventAccessContext) {
    return this.domains.check(access);
  }

  @Delete()
  @HttpCode(200)
  @RequireEventPermission('event.update')
  async remove(@EventAccess() access: EventAccessContext, @ReqMeta() meta: RequestMeta) {
    await this.domains.remove(access, meta);
    return { removed: true };
  }
}

/** Used by the web app to route requests that arrive on customer domains. */
@ApiTags('domains')
@Public()
@Controller('public/domains')
export class PublicDomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get('resolve')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async resolve(@Query('host') host: string | undefined) {
    const found = typeof host === 'string' && host.length <= 300 ? await this.domains.resolve(host) : null;
    if (!found) throw AppError.notFound('Domain');
    return found;
  }
}
