import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ContactMessageSchema,
  ContactMessageUpdateSchema,
  ContactReplySchema,
  type ContactMessageInput,
  type ContactMessageUpdateInput,
  type ContactReplyInput,
} from '@bulava/validation';
import { CurrentUser, Public, ReqMeta, RequirePlatformPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/request-context';
import { ContactService } from './contact.service';

const one = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** The contact form. Anyone can write, so it is tightly rate limited per IP. */
@ApiTags('catalog')
@Public()
@Controller('public/contact')
export class PublicContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 4, ttl: 10 * 60_000 } })
  @ApiZodBody(ContactMessageSchema)
  submit(@ZodBody(ContactMessageSchema) body: ContactMessageInput) {
    return this.contact.submit(body);
  }
}

/** The console's inbox for contact-form messages. */
@ApiTags('admin')
@Controller('admin/contact-messages')
export class AdminContactController {
  constructor(private readonly contact: ContactService) {}

  @Get()
  @RequirePlatformPermission('contact.manage')
  list(@Query('status') status?: unknown, @Query('q') q?: unknown, @Query('cursor') cursor?: unknown) {
    return this.contact.list({ status: one(status), q: one(q), cursor: one(cursor) });
  }

  @Get('counts')
  @RequirePlatformPermission('contact.manage')
  counts() {
    return this.contact.counts();
  }

  @Get(':id')
  @RequirePlatformPermission('contact.manage')
  get(@Param('id', ParseIdPipe) id: string) {
    return this.contact.get(id);
  }

  @Patch(':id')
  @RequirePlatformPermission('contact.manage')
  @ApiZodBody(ContactMessageUpdateSchema)
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(ContactMessageUpdateSchema) body: ContactMessageUpdateInput, @ReqMeta() meta: RequestMeta) {
    return this.contact.update(user.id, id, body, meta);
  }

  @Post(':id/replies')
  @RequirePlatformPermission('contact.manage')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiZodBody(ContactReplySchema)
  reply(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(ContactReplySchema) body: ContactReplyInput, @ReqMeta() meta: RequestMeta) {
    return this.contact.reply(user.id, id, body, meta);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePlatformPermission('contact.manage')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ReqMeta() meta: RequestMeta) {
    await this.contact.remove(user.id, id, meta);
    return { deleted: true };
  }
}
