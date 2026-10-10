import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from '@bulava/validation';
import { CurrentUser, ReqMeta, RequirePlatformPermission, type RequestMeta } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody } from '../../common/decorators/zod.decorators';
import { ParseIdPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/request-context';
import { PaymentsService } from '../payments/payments.service';
import {
  AdminTemplatesService,
  CreateTemplateSchema,
  DuplicateTemplateSchema,
  ImportCardSchema,
  UpdateTemplateMetaSchema,
  type CreateTemplateInput,
  type ImportCardInput,
  type UpdateTemplateMetaInput,
} from './admin-templates.service';
import {
  AdminService,
  AssetUrlsSchema,
  CouponSchema,
  CreateAssetSchema,
  CreateMusicSchema,
  LicenseSchema,
  PlanFeatureSchema,
  ReviewSchema,
  TestimonialSchema,
  UpdatePlanSchema,
  UploadUrlSchema,
} from './admin.service';

const Decision = z.object({ decision: z.enum(['APPROVE', 'REJECT']) });

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly templates: AdminTemplatesService,
    private readonly payments: PaymentsService,
  ) {}

  // ───── Dashboard & operations ─────
  @Get('stats')
  @RequirePlatformPermission('admin.read')
  stats() {
    return this.admin.stats();
  }

  @Get('queues')
  @RequirePlatformPermission('admin.read')
  queues() {
    return this.admin.queuesOverview();
  }

  @Get('audit')
  @RequirePlatformPermission('admin.read')
  audit(@Query('eventId') eventId?: string, @Query('action') action?: string) {
    return this.admin.auditLog({ eventId: eventId && /^[0-9a-f-]{36}$/i.test(eventId) ? eventId : undefined, action: action?.slice(0, 60) });
  }

  @Post('orders/:id/refund')
  @HttpCode(200)
  @RequirePlatformPermission('payment.refund')
  refund(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ReqMeta() meta: RequestMeta) {
    return this.payments.refund(user.id, id, meta);
  }

  @Get('moderation')
  @RequirePlatformPermission('media.moderate')
  moderation() {
    return this.admin.moderationQueue();
  }

  @Post('moderation/:itemId')
  @HttpCode(200)
  @RequirePlatformPermission('media.moderate')
  moderate(@CurrentUser() user: AuthUser, @Param('itemId', ParseIdPipe) itemId: string, @ZodBody(Decision) body: z.infer<typeof Decision>, @ReqMeta() meta: RequestMeta) {
    return this.admin.moderate(user.id, itemId, body.decision, meta);
  }

  @Get('renders/failed')
  @RequirePlatformPermission('admin.read')
  failedRenders() {
    return this.admin.failedRenders();
  }

  @Post('renders/:jobId/retry')
  @HttpCode(200)
  @RequirePlatformPermission('template.manage')
  retry(@CurrentUser() user: AuthUser, @Param('jobId', ParseIdPipe) jobId: string, @ReqMeta() meta: RequestMeta) {
    return this.admin.retryRender(user.id, jobId, meta);
  }

  // ───── Template Studio ─────
  @Get('templates')
  @RequirePlatformPermission('template.manage')
  listTemplates(@Query('deleted') deleted?: string) {
    return this.templates.list(deleted === 'true');
  }

  @Delete('templates/:id')
  @RequirePlatformPermission('template.manage')
  deleteTemplate(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ReqMeta() meta: RequestMeta) {
    return this.templates.remove(user.id, id, meta);
  }

  @Post('templates/:id/restore')
  @HttpCode(200)
  @RequirePlatformPermission('template.manage')
  restoreTemplate(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ReqMeta() meta: RequestMeta) {
    return this.templates.restore(user.id, id, meta);
  }

  @Get('templates/:id')
  @RequirePlatformPermission('template.manage')
  getTemplate(@Param('id', ParseIdPipe) id: string) {
    return this.templates.get(id);
  }

  @Post('templates')
  @RequirePlatformPermission('template.manage')
  @ApiZodBody(CreateTemplateSchema)
  createTemplate(@CurrentUser() user: AuthUser, @ZodBody(CreateTemplateSchema) body: CreateTemplateInput, @ReqMeta() meta: RequestMeta) {
    return this.templates.create(user.id, body, meta);
  }

  /** Card JSON from a design tool: check it (`create: false`) or make a draft template from it. */
  @Post('templates/import-card')
  @HttpCode(200)
  @RequirePlatformPermission('template.manage')
  @ApiZodBody(ImportCardSchema)
  importCard(@CurrentUser() user: AuthUser, @ZodBody(ImportCardSchema) body: ImportCardInput, @ReqMeta() meta: RequestMeta) {
    return this.templates.importCard(user.id, body, meta);
  }

  @Post('templates/:id/duplicate')
  @RequirePlatformPermission('template.manage')
  duplicate(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(DuplicateTemplateSchema) body: z.infer<typeof DuplicateTemplateSchema>, @ReqMeta() meta: RequestMeta) {
    return this.templates.duplicate(user.id, id, body, meta);
  }

  @Put('templates/:id/draft')
  @RequirePlatformPermission('template.manage')
  saveDraft(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @Body() body: { definition?: unknown }) {
    return this.templates.saveDraft(user.id, id, body?.definition);
  }

  @Post('templates/:id/check')
  @HttpCode(200)
  @RequirePlatformPermission('template.manage')
  check(@Param('id', ParseIdPipe) id: string) {
    return this.templates.check(id);
  }

  @Post('templates/:id/publish')
  @HttpCode(200)
  @RequirePlatformPermission('template.manage')
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ReqMeta() meta: RequestMeta) {
    return this.templates.publish(user.id, id, meta);
  }

  @Post('templates/:id/unpublish')
  @HttpCode(200)
  @RequirePlatformPermission('template.manage')
  unpublish(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ReqMeta() meta: RequestMeta) {
    return this.templates.setStatus(user.id, id, 'UNPUBLISHED', meta);
  }

  @Post('templates/:id/archive')
  @HttpCode(200)
  @RequirePlatformPermission('template.manage')
  archive(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ReqMeta() meta: RequestMeta) {
    return this.templates.setStatus(user.id, id, 'ARCHIVED', meta);
  }

  @Patch('templates/:id')
  @RequirePlatformPermission('template.manage')
  @ApiZodBody(UpdateTemplateMetaSchema)
  updateMeta(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(UpdateTemplateMetaSchema) body: UpdateTemplateMetaInput, @ReqMeta() meta: RequestMeta) {
    return this.templates.updateMeta(user.id, id, body, meta);
  }

  // ───── Assets, music, licenses ─────
  @Post('uploads/:kind')
  @RequirePlatformPermission('asset.manage')
  uploadUrl(@Param('kind') kind: string, @ZodBody(UploadUrlSchema) body: z.infer<typeof UploadUrlSchema>) {
    return this.admin.assetUploadUrl(kind === 'music' ? 'music' : 'asset', body.contentType);
  }

  @Get('assets')
  @RequirePlatformPermission('asset.manage')
  assets(@Query('category') category?: string, @Query('status') status?: string) {
    return this.admin.assets({ category: category?.slice(0, 60), status: status?.slice(0, 30) });
  }

  @Post('assets')
  @RequirePlatformPermission('asset.manage')
  @ApiZodBody(CreateAssetSchema)
  createAsset(@CurrentUser() user: AuthUser, @ZodBody(CreateAssetSchema) body: z.infer<typeof CreateAssetSchema>, @ReqMeta() meta: RequestMeta) {
    return this.admin.createAsset(user.id, body, meta);
  }

  @Post('assets/:id/renditions')
  @HttpCode(200)
  @RequirePlatformPermission('asset.manage')
  reprocessAsset(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ReqMeta() meta: RequestMeta) {
    return this.admin.reprocessAsset(user.id, id, meta);
  }

  /** Signed preview URLs for Template Studio (artwork that is not published yet). */
  @Post('assets/urls')
  @HttpCode(200)
  @RequirePlatformPermission('template.manage')
  @ApiZodBody(AssetUrlsSchema)
  assetUrls(@ZodBody(AssetUrlsSchema) body: z.infer<typeof AssetUrlsSchema>) {
    return this.admin.assetUrls(body.ids);
  }

  @Post('assets/:id/review')
  @HttpCode(200)
  @RequirePlatformPermission('asset.manage')
  reviewAsset(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(ReviewSchema) body: z.infer<typeof ReviewSchema>, @ReqMeta() meta: RequestMeta) {
    return this.admin.reviewAsset(user.id, id, body.status, meta);
  }

  @Get('music')
  @RequirePlatformPermission('asset.manage')
  music() {
    return this.admin.music();
  }

  @Post('music')
  @RequirePlatformPermission('asset.manage')
  @ApiZodBody(CreateMusicSchema)
  createMusic(@CurrentUser() user: AuthUser, @ZodBody(CreateMusicSchema) body: z.infer<typeof CreateMusicSchema>, @ReqMeta() meta: RequestMeta) {
    return this.admin.createMusic(user.id, body, meta);
  }

  @Post('music/:id/review')
  @HttpCode(200)
  @RequirePlatformPermission('asset.manage')
  reviewMusic(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(ReviewSchema) body: z.infer<typeof ReviewSchema>, @ReqMeta() meta: RequestMeta) {
    return this.admin.reviewMusic(user.id, id, body.status, meta);
  }

  @Put('licenses/:id')
  @RequirePlatformPermission('asset.manage')
  @ApiZodBody(LicenseSchema)
  updateLicense(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(LicenseSchema) body: z.infer<typeof LicenseSchema>, @ReqMeta() meta: RequestMeta) {
    return this.admin.updateLicense(user.id, id, body, meta);
  }

  @Get('licenses/alerts')
  @RequirePlatformPermission('asset.manage')
  licenseAlerts() {
    return this.admin.licenseAlerts();
  }

  // ───── Pricing ─────
  @Get('plans')
  @RequirePlatformPermission('pricing.manage')
  plans() {
    return this.admin.plans();
  }

  @Patch('plans/:key')
  @RequirePlatformPermission('pricing.manage')
  @ApiZodBody(UpdatePlanSchema)
  updatePlan(@CurrentUser() user: AuthUser, @Param('key') key: string, @ZodBody(UpdatePlanSchema) body: z.infer<typeof UpdatePlanSchema>, @ReqMeta() meta: RequestMeta) {
    return this.admin.updatePlan(user.id, key.slice(0, 40), body, meta);
  }

  @Put('plans/:key/features/:featureKey')
  @RequirePlatformPermission('pricing.manage')
  @ApiZodBody(PlanFeatureSchema)
  setFeature(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
    @Param('featureKey') featureKey: string,
    @ZodBody(PlanFeatureSchema) body: z.infer<typeof PlanFeatureSchema>,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.admin.setPlanFeature(user.id, key.slice(0, 40), featureKey.slice(0, 60), body, meta);
  }

  @Get('coupons')
  @RequirePlatformPermission('pricing.manage')
  coupons() {
    return this.admin.coupons();
  }

  @Put('coupons')
  @RequirePlatformPermission('pricing.manage')
  @ApiZodBody(CouponSchema)
  saveCoupon(@CurrentUser() user: AuthUser, @ZodBody(CouponSchema) body: z.infer<typeof CouponSchema>, @ReqMeta() meta: RequestMeta) {
    return this.admin.upsertCoupon(user.id, body, meta);
  }

  // ───── Marketing content ─────
  @Get('testimonials')
  @RequirePlatformPermission('content.manage')
  testimonials() {
    return this.admin.testimonials();
  }

  @Post('testimonials')
  @RequirePlatformPermission('content.manage')
  @ApiZodBody(TestimonialSchema)
  createTestimonial(@CurrentUser() user: AuthUser, @ZodBody(TestimonialSchema) body: z.infer<typeof TestimonialSchema>, @ReqMeta() meta: RequestMeta) {
    return this.admin.saveTestimonial(user.id, null, body, meta);
  }

  @Put('testimonials/:id')
  @RequirePlatformPermission('content.manage')
  updateTestimonial(@CurrentUser() user: AuthUser, @Param('id', ParseIdPipe) id: string, @ZodBody(TestimonialSchema) body: z.infer<typeof TestimonialSchema>, @ReqMeta() meta: RequestMeta) {
    return this.admin.saveTestimonial(user.id, id, body, meta);
  }

  @Delete('testimonials/:id')
  @HttpCode(200)
  @RequirePlatformPermission('content.manage')
  async deleteTestimonial(@Param('id', ParseIdPipe) id: string) {
    await this.admin.deleteTestimonial(id);
    return { deleted: true };
  }
}
