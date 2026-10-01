import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateRSVPQuestionSchema,
  UpdateRSVPQuestionSchema,
  type CreateRSVPQuestionInput,
  type UpdateRSVPQuestionInput,
} from '@bulava/validation';
import { EventAccess, RequireEventPermission } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { EventAccessContext } from '../../common/request-context';
import { RsvpService } from './rsvp.service';

@ApiTags('rsvp')
@Controller('events/:eventId')
export class RsvpController {
  constructor(private readonly rsvp: RsvpService) {}

  @Get('rsvps/summary')
  @RequireEventPermission('rsvp.read')
  summary(@EventAccess() access: EventAccessContext) {
    return this.rsvp.summary(access);
  }

  @Get('rsvps')
  @RequireEventPermission('rsvp.read')
  list(@EventAccess() access: EventAccessContext) {
    return this.rsvp.list(access);
  }

  @Get('rsvp-questions')
  @RequireEventPermission('rsvp.read')
  listQuestions(@EventAccess() access: EventAccessContext) {
    return this.rsvp.listQuestions(access);
  }

  @Post('rsvp-questions')
  @RequireEventPermission('rsvp.write')
  @ApiZodBody(CreateRSVPQuestionSchema)
  createQuestion(
    @EventAccess() access: EventAccessContext,
    @ZodBody(CreateRSVPQuestionSchema) body: CreateRSVPQuestionInput,
  ) {
    return this.rsvp.createQuestion(access, body);
  }

  @Patch('rsvp-questions/:questionId')
  @RequireEventPermission('rsvp.write')
  @ApiZodBody(UpdateRSVPQuestionSchema)
  updateQuestion(
    @EventAccess() access: EventAccessContext,
    @Param('questionId', ParseIdPipe) questionId: string,
    @ZodBody(UpdateRSVPQuestionSchema) body: UpdateRSVPQuestionInput,
  ) {
    return this.rsvp.updateQuestion(access, questionId, body);
  }

  @Delete('rsvp-questions/:questionId')
  @HttpCode(200)
  @RequireEventPermission('rsvp.write')
  async deleteQuestion(@EventAccess() access: EventAccessContext, @Param('questionId', ParseIdPipe) questionId: string) {
    await this.rsvp.deleteQuestion(access, questionId);
    return { deleted: true };
  }
}
