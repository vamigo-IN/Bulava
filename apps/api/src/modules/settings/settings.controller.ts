import { Controller, Delete, Get, Header, HttpCode, Param, Post, Put, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { SaveSettingsSchema, SETTING_GROUPS, SITE_ASSET_KINDS, z, type SaveSettingsInput, type SettingGroup, type SiteAssetKind } from '@bulava/validation';
import { CurrentUser, Public, ReqMeta, RequirePlatformPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { AppError } from '../../common/errors/app-error';
import type { AuthUser } from '../../common/request-context';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RunCheckSchema, SettingsChecksService } from './settings-checks.service';
import { PlatformSettingsService, SiteAssetCompleteSchema, SiteAssetUploadSchema } from './settings.service';

function group(name: string): SettingGroup {
  if (!(SETTING_GROUPS as readonly string[]).includes(name)) throw AppError.notFound('Settings');
  return name as SettingGroup;
}

/** Site settings, SEO, tracking, custom code and integrations: the Super Admin alone. */
@ApiTags('admin')
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(
    private readonly settings: PlatformSettingsService,
    private readonly checks: SettingsChecksService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePlatformPermission('settings.manage')
  overview() {
    return this.settings.overview();
  }

  @Put(':group')
  @RequirePlatformPermission('settings.manage')
  @ApiZodBody(SaveSettingsSchema)
  save(@CurrentUser() user: AuthUser, @Param('group') name: string, @ZodBody(SaveSettingsSchema) body: SaveSettingsInput, @ReqMeta() meta: RequestMeta) {
    return this.settings.save(group(name), body, user.id, meta);
  }

  @Post('checks/:target')
  @HttpCode(200)
  @RequirePlatformPermission('settings.manage')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiZodBody(RunCheckSchema)
  async check(@CurrentUser() user: AuthUser, @Param('target') target: string, @ZodBody(RunCheckSchema) body: z.infer<typeof RunCheckSchema>, @ReqMeta() meta: RequestMeta) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } });
    return this.checks.run(SettingsChecksService.assertCheckable(target), body, { id: user.id, email: me.email }, meta);
  }

  @Post('site-assets')
  @RequirePlatformPermission('settings.manage')
  @ApiZodBody(SiteAssetUploadSchema)
  siteAssetUpload(@ZodBody(SiteAssetUploadSchema) body: z.infer<typeof SiteAssetUploadSchema>) {
    return this.settings.siteAssetUpload(body);
  }

  @Post('site-assets/complete')
  @HttpCode(200)
  @RequirePlatformPermission('settings.manage')
  @ApiZodBody(SiteAssetCompleteSchema)
  siteAssetComplete(@CurrentUser() user: AuthUser, @ZodBody(SiteAssetCompleteSchema) body: z.infer<typeof SiteAssetCompleteSchema>, @ReqMeta() meta: RequestMeta) {
    return this.settings.siteAssetComplete(body, user.id, meta);
  }

  @Delete('site-assets/:kind')
  @HttpCode(200)
  @RequirePlatformPermission('settings.manage')
  siteAssetRemove(@CurrentUser() user: AuthUser, @Param('kind') kind: string, @ReqMeta() meta: RequestMeta) {
    if (!(SITE_ASSET_KINDS as readonly string[]).includes(kind)) throw AppError.notFound('Asset');
    return this.settings.siteAssetRemove(kind as SiteAssetKind, user.id, meta);
  }
}

/** Public: what marketing pages need (never secrets), and the site's logo, favicon and share image. */
@ApiTags('catalog')
@Public()
@Controller('public')
export class PublicSiteController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get('site-config')
  @Header('Cache-Control', 'public, max-age=60')
  config() {
    return this.settings.publicConfig();
  }

  @Get('site-assets/:kind')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  async asset(@Param('kind') kind: string, @Res() res: Response) {
    if (!(SITE_ASSET_KINDS as readonly string[]).includes(kind)) throw AppError.notFound('Asset');
    const url = await this.settings.publicAssetUrl(kind as SiteAssetKind);
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.redirect(302, url);
  }
}
