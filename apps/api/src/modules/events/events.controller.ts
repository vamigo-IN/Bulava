import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateEventSchema,
  UpdateEventSchema,
  type CreateEventInput,
  type UpdateEventInput,
} from '@bulava/validation';
import {
  CurrentUser,
  EventAccess,
  ReqMeta,
  RequireEventPermission,
  type RequestMeta,
} from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import type { AuthUser, EventAccessContext } from '../../common/request-context';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.events.listForUser(user.id);
  }

  @Post()
  @ApiZodBody(CreateEventSchema)
  create(@CurrentUser() user: AuthUser, @ZodBody(CreateEventSchema) body: CreateEventInput, @ReqMeta() meta: RequestMeta) {
    return this.events.create(user.id, body, meta);
  }

  @Get(':eventId')
  @RequireEventPermission('event.read')
  get(@EventAccess() access: EventAccessContext) {
    return this.events.get(access);
  }

  @Patch(':eventId')
  @RequireEventPermission('event.update')
  @ApiZodBody(UpdateEventSchema)
  update(
    @EventAccess() access: EventAccessContext,
    @ZodBody(UpdateEventSchema) body: UpdateEventInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.events.update(access, body, meta);
  }

  @Delete(':eventId')
  @HttpCode(200)
  @RequireEventPermission('event.delete')
  async remove(@EventAccess() access: EventAccessContext, @ReqMeta() meta: RequestMeta) {
    await this.events.softDelete(access, meta);
    return { deleted: true };
  }
}
