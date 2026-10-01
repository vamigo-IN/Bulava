import { Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PLATFORM_ROLE_PERMISSIONS } from '@bulava/auth';
import type { z } from '@bulava/validation';
import { CurrentUser, ReqMeta, RequirePlatformPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody, ZodQuery } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/request-context';
import {
  AdminUsersService,
  ConfirmIdentitySchema,
  GrantPlanSchema,
  OrdersQuerySchema,
  RevokeGrantSchema,
  TransferSuperAdminSchema,
  UpdateUserSchema,
  UsersQuerySchema,
} from './admin-users.service';

/** Customers, staff roles, the Super Admin handover, complimentary upgrades and orders. */
@ApiTags('admin')
@Controller('admin')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get('users')
  @RequirePlatformPermission('admin.read')
  list(@ZodQuery(UsersQuerySchema) query: z.infer<typeof UsersQuerySchema>) {
    return this.users.list(query);
  }

  @Get('users/:id')
  @RequirePlatformPermission('admin.read')
  profile(@CurrentUser() actor: AuthUser, @Param('id', ParseIdPipe) id: string) {
    return this.users.profile(actor, id);
  }

  @Patch('users/:id')
  @RequirePlatformPermission('user.manage')
  @ApiZodBody(UpdateUserSchema)
  update(@CurrentUser() actor: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(UpdateUserSchema) body: z.infer<typeof UpdateUserSchema>, @ReqMeta() meta: RequestMeta) {
    return this.users.update(actor, id, body, meta);
  }

  @Post('users/:id/sessions/revoke')
  @HttpCode(200)
  @RequirePlatformPermission('user.manage')
  revokeSessions(@CurrentUser() actor: AuthUser, @Param('id', ParseIdPipe) id: string, @ReqMeta() meta: RequestMeta) {
    return this.users.revokeSessions(actor, id, meta);
  }

  @Post('users/:id/mfa/reset')
  @HttpCode(200)
  @RequirePlatformPermission('staff.manage')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodBody(ConfirmIdentitySchema)
  resetTwoStep(@CurrentUser() actor: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(ConfirmIdentitySchema) body: z.infer<typeof ConfirmIdentitySchema>, @ReqMeta() meta: RequestMeta) {
    return this.users.resetTwoStep(actor, id, body, meta);
  }

  @Post('users/:id/grants')
  @RequirePlatformPermission('plan.grant')
  @ApiZodBody(GrantPlanSchema)
  grant(@CurrentUser() actor: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(GrantPlanSchema) body: z.infer<typeof GrantPlanSchema>, @ReqMeta() meta: RequestMeta) {
    return this.users.grantPlan(actor, id, body, meta);
  }

  @Post('orders/:id/revoke')
  @HttpCode(200)
  @RequirePlatformPermission('plan.grant')
  @ApiZodBody(RevokeGrantSchema)
  revokeGrant(@CurrentUser() actor: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(RevokeGrantSchema) body: z.infer<typeof RevokeGrantSchema>, @ReqMeta() meta: RequestMeta) {
    return this.users.revokeGrant(actor, id, body, meta);
  }

  @Get('orders')
  @RequirePlatformPermission('billing.read')
  orders(@ZodQuery(OrdersQuerySchema) query: z.infer<typeof OrdersQuerySchema>) {
    return this.users.orders(query);
  }

  @Get('staff')
  @RequirePlatformPermission('staff.manage')
  async staff() {
    return { ...(await this.users.staff()), roles: PLATFORM_ROLE_PERMISSIONS };
  }

  @Post('staff/transfer-super-admin')
  @HttpCode(200)
  @RequirePlatformPermission('staff.manage')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiZodBody(TransferSuperAdminSchema)
  transfer(@CurrentUser() actor: AuthUser, @ZodBody(TransferSuperAdminSchema) body: z.infer<typeof TransferSuperAdminSchema>, @ReqMeta() meta: RequestMeta) {
    return this.users.transferSuperAdmin(actor, body, meta);
  }
}
