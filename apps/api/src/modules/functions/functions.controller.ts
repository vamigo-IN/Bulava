import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateFunctionSchema,
  UpdateFunctionSchema,
  type CreateFunctionInput,
  type UpdateFunctionInput,
} from '@bulava/validation';
import { EventAccess, ReqMeta, RequireEventPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { EventAccessContext } from '../../common/request-context';
import { FunctionsService } from './functions.service';

@ApiTags('functions')
@Controller('events/:eventId/functions')
export class FunctionsController {
  constructor(private readonly functions: FunctionsService) {}

  @Get()
  @RequireEventPermission('function.read')
  list(@EventAccess() access: EventAccessContext) {
    return this.functions.list(access);
  }

  @Post()
  @RequireEventPermission('function.manage')
  @ApiZodBody(CreateFunctionSchema)
  create(
    @EventAccess() access: EventAccessContext,
    @ZodBody(CreateFunctionSchema) body: CreateFunctionInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.functions.create(access, body, meta);
  }

  @Patch(':functionId')
  @RequireEventPermission('function.manage')
  @ApiZodBody(UpdateFunctionSchema)
  update(
    @EventAccess() access: EventAccessContext,
    @Param('functionId', ParseIdPipe) functionId: string,
    @ZodBody(UpdateFunctionSchema) body: UpdateFunctionInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.functions.update(access, functionId, body, meta);
  }

  @Delete(':functionId')
  @HttpCode(200)
  @RequireEventPermission('function.manage')
  async remove(
    @EventAccess() access: EventAccessContext,
    @Param('functionId', ParseIdPipe) functionId: string,
    @ReqMeta() meta: RequestMeta,
  ) {
    await this.functions.softDelete(access, functionId, meta);
    return { deleted: true };
  }
}
