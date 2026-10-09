import { Controller, Get, Header, Param, Post, Put, SetMetadata } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CheckInSettingsSchema, type CheckInSettingsInput } from '@bulava/validation';
import { EventAccess, Public, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { AppError } from '../../common/errors/app-error';
import { RAW_RESPONSE } from '../../common/interceptors/response-envelope.interceptor';
import type { EventAccessContext } from '../../common/request-context';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CheckInSchema, CheckInService, type CheckInInput } from './checkin.service';

@ApiTags('check-in')
@Controller()
export class CheckInController {
  constructor(
    private readonly checkIns: CheckInService,
    private readonly prisma: PrismaService,
  ) {}

  /** Resolve which event a scanned code belongs to, for staff who scanned it with a phone camera. */
  @Get('check-in-codes/:code')
  async resolve(@Param('code') code: string) {
    if (!/^[A-Za-z0-9]{8,24}$/.test(code)) throw AppError.notFound('Guest');
    const qr = await this.prisma.qRCode.findUnique({ where: { code }, select: { eventId: true, type: true, active: true } });
    if (!qr || qr.type !== 'CHECK_IN' || !qr.active) throw AppError.notFound('Guest');
    // The event id alone reveals nothing; the lookup below still requires membership.
    return { eventId: qr.eventId };
  }

  @Get('events/:eventId/check-ins/lookup/:code')
  @RequireEventPermission('guest.read')
  lookup(@EventAccess() access: EventAccessContext, @Param('code') code: string) {
    return this.checkIns.lookup(access, code);
  }

  @Post('events/:eventId/check-ins')
  @RequireEventPermission('guest.write')
  @ApiZodBody(CheckInSchema)
  checkIn(@EventAccess() access: EventAccessContext, @ZodBody(CheckInSchema) body: CheckInInput, @ReqMeta() meta: RequestMeta) {
    return this.checkIns.checkIn(access, body, meta);
  }

  @Get('events/:eventId/check-ins/summary')
  @RequireEventPermission('guest.read')
  summary(@EventAccess() access: EventAccessContext) {
    return this.checkIns.summary(access);
  }

  /** Whether entry uses QR passes (off until the host turns it on). */
  @Get('events/:eventId/check-ins/settings')
  @RequireEventPermission('guest.read')
  settings(@EventAccess() access: EventAccessContext) {
    return this.checkIns.settings(access);
  }

  @Put('events/:eventId/check-ins/settings')
  @RequireEventPermission('event.update')
  @ApiZodBody(CheckInSettingsSchema)
  updateSettings(@EventAccess() access: EventAccessContext, @ZodBody(CheckInSettingsSchema) body: CheckInSettingsInput, @ReqMeta() meta: RequestMeta) {
    return this.checkIns.updateSettings(access, body, meta);
  }
}

/** Guest-facing QR image for their own check-in code (token-authenticated). */
@ApiTags('check-in')
@Public()
@Controller('public/check-in')
export class PublicCheckInController {
  constructor(private readonly checkIns: CheckInService) {}

  @Get(':code/qr.svg')
  @SetMetadata(RAW_RESPONSE, true)
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'private, max-age=3600')
  qr(@Param('code') code: string) {
    if (!/^[A-Za-z0-9]{8,24}$/.test(code)) throw AppError.notFound('Code');
    return this.checkIns.qrSvg(code);
  }
}
