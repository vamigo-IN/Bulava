import { Controller, Get, Header, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  LogisticsSettingsSchema,
  SetGuestLogisticsSchema,
  SetSeatingSchema,
  type LogisticsSettingsInput,
  type SetGuestLogisticsInput,
  type SetSeatingInput,
} from '@bulava/validation';
import { EventAccess, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { EventAccessContext } from '../../common/request-context';
import { LogisticsService } from './logistics.service';

@ApiTags('logistics')
@Controller('events/:eventId')
export class LogisticsController {
  constructor(private readonly logistics: LogisticsService) {}

  @Get('logistics')
  @Header('Cache-Control', 'no-store')
  @RequireEventPermission('guest.read')
  overview(@EventAccess() access: EventAccessContext) {
    return this.logistics.overview(access);
  }

  @Put('logistics/settings')
  @RequireEventPermission('event.update')
  @ApiZodBody(LogisticsSettingsSchema)
  settings(@EventAccess() access: EventAccessContext, @ZodBody(LogisticsSettingsSchema) body: LogisticsSettingsInput, @ReqMeta() meta: RequestMeta) {
    return this.logistics.updateSettings(access, body, meta);
  }

  @Put('guests/:guestId/logistics')
  @RequireEventPermission('guest.write')
  @ApiZodBody(SetGuestLogisticsSchema)
  setGuest(
    @EventAccess() access: EventAccessContext,
    @Param('guestId', ParseIdPipe) guestId: string,
    @ZodBody(SetGuestLogisticsSchema) body: SetGuestLogisticsInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.logistics.setGuestLogistics(access, guestId, body, meta);
  }

  @Get('functions/:functionId/seating')
  @Header('Cache-Control', 'no-store')
  @RequireEventPermission('guest.read')
  seating(@EventAccess() access: EventAccessContext, @Param('functionId', ParseIdPipe) functionId: string) {
    return this.logistics.seating(access, functionId);
  }

  @Put('functions/:functionId/seating')
  @RequireEventPermission('guest.write')
  @ApiZodBody(SetSeatingSchema)
  setSeating(
    @EventAccess() access: EventAccessContext,
    @Param('functionId', ParseIdPipe) functionId: string,
    @ZodBody(SetSeatingSchema) body: SetSeatingInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.logistics.setSeating(access, functionId, body, meta);
  }
}
