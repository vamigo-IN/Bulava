import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateGuestSchema,
  PaginationSchema,
  SetGuestFunctionsSchema,
  SetGuestGroupsSchema,
  UpdateGuestSchema,
  type CreateGuestInput,
  type PaginationInput,
  type SetGuestFunctionsInput,
  type SetGuestGroupsInput,
  type UpdateGuestInput,
} from '@bulava/validation';
import { EventAccess, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody, ZodQuery } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { EventAccessContext } from '../../common/request-context';
import { GuestsService } from './guests.service';

@ApiTags('guests')
@Controller('events/:eventId/guests')
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  @Get()
  @RequireEventPermission('guest.read')
  list(@EventAccess() access: EventAccessContext, @ZodQuery(PaginationSchema) page: PaginationInput) {
    return this.guests.list(access, page);
  }

  @Post()
  @RequireEventPermission('guest.write')
  @ApiZodBody(CreateGuestSchema)
  create(
    @EventAccess() access: EventAccessContext,
    @ZodBody(CreateGuestSchema) body: CreateGuestInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.guests.create(access, body, meta);
  }

  @Get(':guestId')
  @RequireEventPermission('guest.read')
  get(@EventAccess() access: EventAccessContext, @Param('guestId', ParseIdPipe) guestId: string) {
    return this.guests.get(access, guestId);
  }

  @Patch(':guestId')
  @RequireEventPermission('guest.write')
  @ApiZodBody(UpdateGuestSchema)
  update(
    @EventAccess() access: EventAccessContext,
    @Param('guestId', ParseIdPipe) guestId: string,
    @ZodBody(UpdateGuestSchema) body: UpdateGuestInput,
  ) {
    return this.guests.update(access, guestId, body);
  }

  @Delete(':guestId')
  @HttpCode(200)
  @RequireEventPermission('guest.write')
  async remove(
    @EventAccess() access: EventAccessContext,
    @Param('guestId', ParseIdPipe) guestId: string,
    @ReqMeta() meta: RequestMeta,
  ) {
    await this.guests.softDelete(access, guestId, meta);
    return { deleted: true };
  }

  @Put(':guestId/groups')
  @RequireEventPermission('guest.write')
  @ApiZodBody(SetGuestGroupsSchema)
  setGroups(
    @EventAccess() access: EventAccessContext,
    @Param('guestId', ParseIdPipe) guestId: string,
    @ZodBody(SetGuestGroupsSchema) body: SetGuestGroupsInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.guests.setGroups(access, guestId, body, meta);
  }

  @Put(':guestId/functions')
  @RequireEventPermission('guest.write')
  @ApiZodBody(SetGuestFunctionsSchema)
  setFunctions(
    @EventAccess() access: EventAccessContext,
    @Param('guestId', ParseIdPipe) guestId: string,
    @ZodBody(SetGuestFunctionsSchema) body: SetGuestFunctionsInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.guests.setFunctions(access, guestId, body, meta);
  }
}
