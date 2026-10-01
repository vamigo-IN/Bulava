import { Controller, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  RegisterSchema,
  RegistrationDecisionSchema,
  RegistrationSettingsSchema,
  RegistrationStatusSchema,
  type RegisterInput,
  type RegistrationSettingsInput,
  z,
} from '@bulava/validation';
import { EventAccess, Public, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { EventAccessContext } from '../../common/request-context';
import { RegistrationsService } from './registrations.service';
import { publicEventCredentials } from '../templates/public-event-credentials';

@ApiTags('registrations')
@Controller('events/:eventId')
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get('registration')
  @RequireEventPermission('event.read')
  settings(@EventAccess() access: EventAccessContext) {
    return this.registrations.getSettings(access);
  }

  @Put('registration')
  @RequireEventPermission('event.update')
  @ApiZodBody(RegistrationSettingsSchema)
  update(@EventAccess() access: EventAccessContext, @ZodBody(RegistrationSettingsSchema) body: RegistrationSettingsInput, @ReqMeta() meta: RequestMeta) {
    return this.registrations.updateSettings(access, body, meta);
  }

  @Get('registrations')
  @RequireEventPermission('guest.read')
  list(@EventAccess() access: EventAccessContext, @Query('status') status?: string) {
    const parsed = RegistrationStatusSchema.safeParse(status);
    return this.registrations.list(access, parsed.success ? parsed.data : undefined);
  }

  @Post('registrations/:registrationId/decision')
  @HttpCode(200)
  @RequireEventPermission('guest.write')
  @ApiZodBody(RegistrationDecisionSchema)
  decide(
    @EventAccess() access: EventAccessContext,
    @Param('registrationId', ParseIdPipe) registrationId: string,
    @ZodBody(RegistrationDecisionSchema) body: z.infer<typeof RegistrationDecisionSchema>,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.registrations.decide(access, registrationId, body.decision, meta);
  }
}

@ApiTags('public-events')
@Public()
@Controller('public/events')
export class PublicRegistrationController {
  constructor(private readonly registrations: RegistrationsService) {}

  /** Anyone may register for a public event, so this is tightly rate limited per IP. */
  @Post(':slug/register')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiZodBody(RegisterSchema)
  register(@Param('slug') slug: string, @Req() req: Request, @ZodBody(RegisterSchema) body: RegisterInput, @ReqMeta() meta: RequestMeta) {
    const safeSlug = slug.slice(0, 120);
    const { pinPass, linkKey } = publicEventCredentials(req, safeSlug);
    return this.registrations.register(safeSlug, pinPass, linkKey, body, meta);
  }
}
