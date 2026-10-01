import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateGroupSchema, UpdateGroupSchema, type CreateGroupInput, type UpdateGroupInput } from '@bulava/validation';
import { EventAccess, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { EventAccessContext } from '../../common/request-context';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@Controller('events/:eventId/groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  @RequireEventPermission('guest.read')
  list(@EventAccess() access: EventAccessContext) {
    return this.groups.list(access);
  }

  @Post()
  @RequireEventPermission('group.manage')
  @ApiZodBody(CreateGroupSchema)
  create(
    @EventAccess() access: EventAccessContext,
    @ZodBody(CreateGroupSchema) body: CreateGroupInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.groups.create(access, body, meta);
  }

  @Patch(':groupId')
  @RequireEventPermission('group.manage')
  @ApiZodBody(UpdateGroupSchema)
  update(
    @EventAccess() access: EventAccessContext,
    @Param('groupId', ParseIdPipe) groupId: string,
    @ZodBody(UpdateGroupSchema) body: UpdateGroupInput,
  ) {
    return this.groups.update(access, groupId, body);
  }

  @Delete(':groupId')
  @HttpCode(200)
  @RequireEventPermission('group.manage')
  async remove(
    @EventAccess() access: EventAccessContext,
    @Param('groupId', ParseIdPipe) groupId: string,
    @ReqMeta() meta: RequestMeta,
  ) {
    await this.groups.remove(access, groupId, meta);
    return { deleted: true };
  }
}
