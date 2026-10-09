import { Controller, Get, Header, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ShowcaseInputSchema, ShowcaseSectionParamSchema, type ShowcaseInput, type ShowcaseSection } from '@bulava/validation';
import { CurrentUser, Public, ReqMeta, RequirePlatformPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/request-context';
import { ShowcaseService } from './showcase.service';

/** The console's Home page screen: which templates each home page section shows. */
@ApiTags('admin')
@Controller('admin/showcase')
export class AdminShowcaseController {
  constructor(private readonly showcase: ShowcaseService) {}

  @Get()
  @RequirePlatformPermission('showcase.manage')
  get() {
    return this.showcase.adminShowcase();
  }

  @Put(':section')
  @RequirePlatformPermission('showcase.manage')
  @ApiZodBody(ShowcaseInputSchema)
  save(
    @CurrentUser() user: AuthUser,
    @Param('section', new ZodValidationPipe(ShowcaseSectionParamSchema)) section: ShowcaseSection,
    @ZodBody(ShowcaseInputSchema) body: ShowcaseInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.showcase.save(user.id, section, body, meta);
  }
}

/** The picks the site applies (published templates only; sections without picks are left out). */
@ApiTags('catalog')
@Public()
@Controller('public/showcase')
export class PublicShowcaseController {
  constructor(private readonly showcase: ShowcaseService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  get() {
    return this.showcase.publicShowcase();
  }
}
