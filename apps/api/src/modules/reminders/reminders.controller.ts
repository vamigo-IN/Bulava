import { Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReminderSettingsSchema, type ReminderSettingsInput } from '@bulava/validation';
import { EventAccess, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { RemindersService } from './reminders.service';

@ApiTags('reminders')
@Controller('events/:eventId/reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  @RequireEventPermission('rsvp.read')
  get(@EventAccess() access: EventAccessContext) {
    return this.reminders.get(access);
  }

  @Put()
  @RequireEventPermission('invitation.send')
  @ApiZodBody(ReminderSettingsSchema)
  update(@EventAccess() access: EventAccessContext, @ZodBody(ReminderSettingsSchema) body: ReminderSettingsInput, @ReqMeta() meta: RequestMeta) {
    return this.reminders.update(access, body, meta);
  }

  @Post('rsvp/send-now')
  @HttpCode(200)
  @RequireEventPermission('invitation.send')
  sendNow(@EventAccess() access: EventAccessContext, @ReqMeta() meta: RequestMeta) {
    return this.reminders.sendRsvpNow(access, meta);
  }
}
