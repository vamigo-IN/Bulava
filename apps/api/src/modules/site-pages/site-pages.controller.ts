import { Controller, Delete, Get, Header, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SitePageInputSchema, type SitePageInput } from '@bulava/validation';
import { CurrentUser, Public, ReqMeta, RequirePlatformPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/request-context';
import { SitePagesService } from './site-pages.service';

/** Site pages in the console: About, Contact, the policies, and pages staff add. */
@ApiTags('admin')
@Controller('admin/pages')
export class AdminSitePagesController {
  constructor(private readonly pages: SitePagesService) {}

  @Get()
  @RequirePlatformPermission('page.manage')
  list() {
    return this.pages.list();
  }

  @Get(':id')
  @RequirePlatformPermission('page.manage')
  get(@Param('id', ParseIdPipe) id: string) {
    return this.pages.get(id);
  }

  @Post()
  @RequirePlatformPermission('page.manage')
  @ApiZodBody(SitePageInputSchema)
  create(@CurrentUser() user: AuthUser, @ZodBody(SitePageInputSchema) body: SitePageInput, @ReqMeta() meta: RequestMeta) {
    return this.pages.create(user.id, body, meta);
  }

  @Put(':id')
  @RequirePlatformPermission('page.manage')
  @ApiZodBody(SitePageInputSchema)
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(SitePageInputSchema) body: SitePageInput, @ReqMeta() meta: RequestMeta) {
    return this.pages.update(user.id, id, body, meta);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePlatformPermission('page.manage')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ReqMeta() meta: RequestMeta) {
    await this.pages.remove(user.id, id, meta);
    return { deleted: true };
  }
}

/** Published pages for the site: the footer and sitemap list, and each page. */
@ApiTags('catalog')
@Public()
@Controller('public/pages')
export class PublicSitePagesController {
  constructor(private readonly pages: SitePagesService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  list() {
    return this.pages.publicList();
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=60')
  page(@Param('slug') slug: string) {
    return this.pages.publicPage(slug);
  }
}
