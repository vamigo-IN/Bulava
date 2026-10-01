import { Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  AcceptTeamInviteSchema,
  AddMemberSchema,
  UpdateMemberSchema,
  VerifyTeamInviteSchema,
  type AcceptTeamInviteInput,
  type AddMemberInput,
  type UpdateMemberInput,
  type VerifyTeamInviteInput,
} from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { CurrentUser, EventAccess, Public, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser, EventAccessContext } from '../../common/request-context';
import { setSessionCookies } from '../auth/cookies';
import { MembersService } from './members.service';
import { TeamInvitesService } from './team-invites.service';

/** Guessing codes is pointless (the link token is 256-bit, five wrong codes lock it), but keep it slow anyway. */
const INVITE_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('team')
@Controller('events/:eventId/members')
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly invites: TeamInvitesService,
  ) {}

  @Get()
  @RequireEventPermission('event.read')
  list(@EventAccess() access: EventAccessContext) {
    return this.members.list(access);
  }

  /** Adds someone with an account, or emails an invitation with a code to someone without one. */
  @Post()
  @RequireEventPermission('member.manage')
  @ApiZodBody(AddMemberSchema)
  add(@EventAccess() access: EventAccessContext, @ZodBody(AddMemberSchema) body: AddMemberInput, @ReqMeta() meta: RequestMeta) {
    return this.members.add(access, body, meta);
  }

  /** A new link and code for a waiting (or locked) invitation; the old ones stop working. */
  @Post('invites/:inviteId/resend')
  @HttpCode(200)
  @RequireEventPermission('member.manage')
  resend(@EventAccess() access: EventAccessContext, @Param('inviteId', ParseIdPipe) inviteId: string, @ReqMeta() meta: RequestMeta) {
    return this.invites.resend(access, inviteId, meta);
  }

  @Delete('invites/:inviteId')
  @HttpCode(200)
  @RequireEventPermission('member.manage')
  async revoke(@EventAccess() access: EventAccessContext, @Param('inviteId', ParseIdPipe) inviteId: string, @ReqMeta() meta: RequestMeta) {
    await this.invites.revoke(access, inviteId, meta);
    return { revoked: true };
  }

  @Patch(':memberId')
  @RequireEventPermission('member.manage')
  @ApiZodBody(UpdateMemberSchema)
  update(@EventAccess() access: EventAccessContext, @Param('memberId', ParseIdPipe) memberId: string, @ZodBody(UpdateMemberSchema) body: UpdateMemberInput, @ReqMeta() meta: RequestMeta) {
    return this.members.update(access, memberId, body, meta);
  }

  @Delete(':memberId')
  @HttpCode(200)
  @RequireEventPermission('member.manage')
  async remove(@EventAccess() access: EventAccessContext, @Param('memberId', ParseIdPipe) memberId: string, @ReqMeta() meta: RequestMeta) {
    await this.members.remove(access, memberId, meta);
    return { removed: true };
  }
}

/** The invited person's side: the link token identifies the invitation, the emailed code proves the email. */
@ApiTags('team')
@Controller('team-invites/:token')
export class TeamInviteController {
  constructor(
    private readonly invites: TeamInvitesService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Get()
  @Throttle(INVITE_THROTTLE)
  info(@Param('token') token: string) {
    return this.invites.publicInfo(token);
  }

  /** Step one: check the code (not used up yet). */
  @Public()
  @Post('verify')
  @HttpCode(200)
  @Throttle(INVITE_THROTTLE)
  @ApiZodBody(VerifyTeamInviteSchema)
  verify(@Param('token') token: string, @ZodBody(VerifyTeamInviteSchema) body: VerifyTeamInviteInput) {
    return this.invites.verify(token, body.code);
  }

  /** Step two for someone new: create the account, join the team and sign in. */
  @Public()
  @Post('accept')
  @HttpCode(200)
  @Throttle(INVITE_THROTTLE)
  @ApiZodBody(AcceptTeamInviteSchema)
  async accept(@Param('token') token: string, @ZodBody(AcceptTeamInviteSchema) body: AcceptTeamInviteInput, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const { eventId, user, session } = await this.invites.accept(token, body, meta);
    setSessionCookies(res, session, this.config);
    return { eventId, user };
  }

  /** For someone who already has an account: signed in as the invited email, join with the code. */
  @Post('join')
  @HttpCode(200)
  @Throttle(INVITE_THROTTLE)
  @ApiZodBody(VerifyTeamInviteSchema)
  join(@Param('token') token: string, @ZodBody(VerifyTeamInviteSchema) body: VerifyTeamInviteInput, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.invites.acceptSignedIn(token, body.code, user, meta);
  }
}
