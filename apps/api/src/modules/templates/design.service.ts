import { Injectable } from '@nestjs/common';
import type { Prisma, TemplateType } from '@bulava/database';
import { validateCustomization, validateTemplateDefinition } from '@bulava/template-schema';
import { FEATURE_KEYS, z } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { MediaService } from '../media/media.service';
import { RenderContextService } from './render-context.service';
import { TemplatesService } from './templates.service';

export const SelectTemplateSchema = z.object({
  templateKey: z.string().trim().min(1).max(80),
  customization: z.unknown().optional(),
});
export type SelectTemplateInput = z.infer<typeof SelectTemplateSchema>;

export const OUTPUTS = ['WEBSITE', 'VIDEO', 'DIGITAL_CARD'] as const;

@Injectable()
export class DesignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly renderContext: RenderContextService,
    private readonly entitlements: EntitlementsService,
    private readonly templates: TemplatesService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
  ) {}

  /** Everything the host "Design" tab needs: selections, preview context and plan limits. */
  async get(access: EventAccessContext) {
    const event = await this.prisma.event.findFirstOrThrow({
      where: { id: access.eventId, deletedAt: null },
      include: { functions: { where: { deletedAt: null }, include: { venue: true }, orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }] } },
    });
    const [website, video, card, features] = await Promise.all([
      this.renderContext.resolveTemplate(event.id, event.typeKey, 'WEBSITE'),
      this.renderContext.resolveTemplate(event.id, event.typeKey, 'VIDEO'),
      this.renderContext.resolveTemplate(event.id, event.typeKey, 'DIGITAL_CARD'),
      this.entitlements.forEvent(event.id),
    ]);
    const context = await this.renderContext.build({ event, functions: event.functions, customization: website?.customization, ...(await this.media.templatePhotos(event.id, website?.customization)) });
    return {
      selections: { WEBSITE: website, VIDEO: video, DIGITAL_CARD: card },
      context,
      entitlements: EntitlementsService.summary(features),
      watermark: EntitlementsService.enabled(features, FEATURE_KEYS.WATERMARK),
    };
  }

  async select(access: EventAccessContext, output: TemplateType, input: SelectTemplateInput, meta: RequestMeta) {
    const event = await this.prisma.event.findFirstOrThrow({ where: { id: access.eventId, deletedAt: null } });
    const template = await this.prisma.template.findUnique({ where: { key: input.templateKey }, include: { currentVersion: true } });
    if (!template || template.status !== 'PUBLISHED' || !template.currentVersion || !template.outputs.includes(output)) {
      throw new AppError('TEMPLATE_NOT_AVAILABLE', 'This template is not available.');
    }
    if (template.eventTypes.length > 0 && !template.eventTypes.includes(event.typeKey)) {
      throw new AppError('TEMPLATE_NOT_AVAILABLE', 'This template is not designed for this type of event.');
    }
    // A draft may try any design (it shows with a watermark); the plan is checked when the event is published.
    if (event.status !== 'DRAFT') {
      const features = await this.entitlements.forEvent(event.id);
      EntitlementsService.assertTemplateTier(features, template.tier);
    }

    const parsed = validateTemplateDefinition(template.currentVersion.definition);
    if (!parsed.ok) throw new AppError('TEMPLATE_NOT_AVAILABLE', 'This template is not available.');
    const custom = validateCustomization(parsed.definition, input.customization ?? {});
    if (!custom.ok) throw new AppError('CUSTOMIZATION_INVALID', 'Some changes are not allowed for this template.', custom.issues);
    // Placed photos must be approved images of this event.
    const photoIds = [...(custom.value.photoIds ?? []), ...Object.values(custom.value.photoSlots ?? {})];
    if (photoIds.length) {
      const approved = await this.media.approvedImageIds(event.id, photoIds);
      if (photoIds.some((id) => !approved.has(id))) throw new AppError('CUSTOMIZATION_INVALID', 'Choose photos from this event.');
    }
    if (custom.value.musicId) {
      const music = await this.prisma.music.findUnique({ where: { id: custom.value.musicId }, include: { license: true } });
      const licensed =
        music?.status === 'APPROVED' && music.license.commercialUse && music.license.onDemandUse && (!music.license.expiresAt || music.license.expiresAt > new Date());
      if (!licensed) throw new AppError('CUSTOMIZATION_INVALID', 'This music is not available.');
    }

    const selection = await this.prisma.$transaction(async (tx) => {
      const row = await tx.eventTemplateSelection.upsert({
        where: { eventId_output: { eventId: event.id, output } },
        create: { eventId: event.id, output, templateVersionId: template.currentVersion!.id, customization: custom.value as Prisma.InputJsonValue },
        update: { templateVersionId: template.currentVersion!.id, customization: custom.value as Prisma.InputJsonValue },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: access.userId,
          action: 'event.template_selected',
          targetType: 'Event',
          targetId: event.id,
          eventId: event.id,
          metadata: { output, templateKey: template.key, version: template.currentVersion!.version },
          meta,
        },
        tx,
      );
      return row;
    });
    return { output, templateKey: template.key, templateVersionId: selection.templateVersionId, customization: custom.value };
  }

  async entitlementsSummary(access: EventAccessContext) {
    return EntitlementsService.summary(await this.entitlements.forEvent(access.eventId));
  }
}
