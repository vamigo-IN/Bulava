import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  BulkCreateInvitationsSchema,
  CreateInvitationSchema,
  z,
  type BulkCreateInvitationsInput,
  type CreateInvitationInput,
} from '@bulava/validation';
import { EventAccess, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { EventAccessContext } from '../../common/request-context';
import { InvitationsService } from './invitations.service';

const MarkSharedSchema = z.object({ channel: z.enum(['WHATSAPP_LINK', 'MANUAL']).default('MANUAL') });
/** Omit invitationIds to send every live invitation whose guest has an email address (or phone number, for WhatsApp). */
const EmailInvitationsSchema = z.object({ invitationIds: z.array(z.uuid()).min(1).max(1000).optional() });

@ApiTags('invitations')
@Controller('events/:eventId/invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  @RequireEventPermission('invitation.read')
  list(@EventAccess() access: EventAccessContext) {
    return this.invitations.list(access);
  }

  @Get('channels')
  @RequireEventPermission('invitation.read')
  channels(@EventAccess() access: EventAccessContext) {
    return this.invitations.channels(access);
  }

  @Post()
  @RequireEventPermission('invitation.send')
  @ApiZodBody(CreateInvitationSchema)
  create(
    @EventAccess() access: EventAccessContext,
    @ZodBody(CreateInvitationSchema) body: CreateInvitationInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.invitations.create(access, body, meta);
  }

  @Post('bulk')
  @RequireEventPermission('invitation.send')
  @ApiZodBody(BulkCreateInvitationsSchema)
  bulk(
    @EventAccess() access: EventAccessContext,
    @ZodBody(BulkCreateInvitationsSchema) body: BulkCreateInvitationsInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.invitations.bulkCreate(access, body, meta);
  }

  @Post(':invitationId/regenerate')
  @HttpCode(200)
  @RequireEventPermission('invitation.send')
  regenerate(
    @EventAccess() access: EventAccessContext,
    @Param('invitationId', ParseIdPipe) invitationId: string,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.invitations.regenerate(access, invitationId, meta);
  }

  @Post(':invitationId/revoke')
  @HttpCode(200)
  @RequireEventPermission('invitation.revoke')
  revoke(
    @EventAccess() access: EventAccessContext,
    @Param('invitationId', ParseIdPipe) invitationId: string,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.invitations.revoke(access, invitationId, meta);
  }

  @Post('email')
  @HttpCode(200)
  @RequireEventPermission('invitation.send')
  @ApiZodBody(EmailInvitationsSchema)
  email(@EventAccess() access: EventAccessContext, @ZodBody(EmailInvitationsSchema) body: z.infer<typeof EmailInvitationsSchema>, @ReqMeta() meta: RequestMeta) {
    return this.invitations.sendByEmail(access, body.invitationIds, meta);
  }

  @Post('whatsapp')
  @HttpCode(200)
  @RequireEventPermission('invitation.send')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodBody(EmailInvitationsSchema)
  whatsapp(@EventAccess() access: EventAccessContext, @ZodBody(EmailInvitationsSchema) body: z.infer<typeof EmailInvitationsSchema>, @ReqMeta() meta: RequestMeta) {
    return this.invitations.sendByWhatsApp(access, body.invitationIds, meta);
  }

  @Post(':invitationId/shared')
  @HttpCode(200)
  @RequireEventPermission('invitation.send')
  @ApiZodBody(MarkSharedSchema)
  shared(
    @EventAccess() access: EventAccessContext,
    @Param('invitationId', ParseIdPipe) invitationId: string,
    @ZodBody(MarkSharedSchema) body: z.infer<typeof MarkSharedSchema>,
  ) {
    return this.invitations.markShared(access, invitationId, body.channel);
  }
}
