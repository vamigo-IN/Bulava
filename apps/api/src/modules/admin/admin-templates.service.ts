import { Injectable } from '@nestjs/common';
import type { Prisma, TemplateType } from '@bulava/database';
import {
  runTemplateChecks,
  TemplateDefinitionSchema,
  validateTemplateDefinition,
  type TemplateDefinition,
} from '@bulava/template-schema';
import { z } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { TemplatesService } from '../templates/templates.service';

const keySchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);

export const CreateTemplateSchema = z.object({
  key: keySchema,
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(60),
  type: z.enum(['WEBSITE', 'VIDEO', 'DIGITAL_CARD']),
  /** Start from an existing template's current definition. */
  fromTemplateKey: keySchema.optional(),
});
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;

export const UpdateTemplateMetaSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().min(1).max(60).optional(),
  style: z.string().trim().max(40).nullable().optional(),
  tier: z.enum(['FREE', 'STANDARD', 'PREMIUM']).optional(),
  badge: z.enum(['NEW', 'POPULAR', 'BESTSELLER']).nullable().optional(),
  featured: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  eventTypes: z.array(z.string().max(40)).max(20).optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
});
export type UpdateTemplateMetaInput = z.infer<typeof UpdateTemplateMetaSchema>;

export const DuplicateTemplateSchema = z.object({ key: keySchema, name: z.string().trim().min(1).max(80) });

const COLORS = { primary: '#7f1d1d', secondary: '#b8892b', accent: '#f1d9a0', background: '#fffaf0', surface: '#ffffff', text: '#1c1917', muted: '#78716c' };
const FONTS = {
  heading: { family: 'Playfair Display', scripts: ['Latn'], fallbacks: { Deva: 'Noto Serif Devanagari' } },
  body: { family: 'Noto Sans', scripts: ['Latn'], fallbacks: { Deva: 'Noto Sans Devanagari' } },
  script: { family: 'Great Vibes', scripts: ['Latn'], fallbacks: { Deva: 'Tiro Devanagari Hindi' } },
};

/** A minimal, valid starting point for a new template of each type. */
function starter(key: string, name: string, type: 'WEBSITE' | 'VIDEO' | 'DIGITAL_CARD'): unknown {
  const base = {
    schemaVersion: 1 as const,
    templateKey: key,
    type,
    name,
    languages: ['en', 'hi'],
    theme: { colors: COLORS },
    fonts: FONTS,
    capabilities: { editable: { colors: true, text: true }, textSlots: [{ key: 'tagline', label: 'Tagline', maxLength: 80 }] },
  };
  if (type === 'WEBSITE') {
    return {
      ...base,
      website: {
        pages: [
          {
            id: 'home',
            sections: [
              { id: 'hero', section: 'hero', variant: 'classic', props: { eyebrow: { t: 'invitation.youAreInvited' }, title: { template: '{{couple.partnerOne}} & {{couple.partnerTwo}}', fallback: { binding: 'event.title' } }, date: { binding: 'event.startDate', format: 'date' }, tagline: { binding: 'custom.tagline' } } },
              { id: 'schedule', section: 'eventTimeline', variant: 'cards' },
              { id: 'venue', section: 'venue' },
              { id: 'rsvp', section: 'rsvp' },
              { id: 'footer', section: 'footer' },
            ],
          },
        ],
      },
    };
  }
  return {
    ...base,
    canvas: type === 'VIDEO' ? { width: 1080, height: 1920, fps: 30 } : { width: 1080, height: 1350, fps: 30 },
    scenes: [
      {
        id: 'intro',
        durationSec: type === 'VIDEO' ? 4 : 1,
        background: 'background',
        elements: [
          { id: 'title', kind: 'text', frame: { x: 90, y: 560, w: 900, h: 400 }, content: { binding: 'event.title' }, style: { font: 'script', fontSize: 110, color: 'primary' }, animation: { in: { type: 'fadeUp' } } },
        ],
      },
    ],
  };
}

/**
 * Template Studio backend. Published versions are immutable; edits go to a
 * DRAFT version which is validated, checked against asset licenses and the
 * test matrix, then published as the new current version.
 */
@Injectable()
export class AdminTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalog: TemplatesService,
  ) {}

  /** Live templates, or (deleted = true) the soft-deleted ones staff can restore. */
  list(deleted = false) {
    return this.prisma.template.findMany({
      where: { deletedAt: deleted ? { not: null } : null },
      include: {
        versions: { select: { id: true, version: true, status: true, publishedAt: true, createdAt: true }, orderBy: { version: 'desc' } },
        _count: { select: { versions: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async get(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!template) throw AppError.notFound('Template');
    const working = template.versions[0]!;
    const usage = await this.prisma.eventTemplateSelection.count({ where: { templateVersion: { templateId: id } } });
    return { template: { ...template, versions: template.versions.map(({ definition: _d, ...v }) => v) }, working, usage };
  }

  async create(adminId: string, input: CreateTemplateInput, meta: RequestMeta) {
    if (await this.prisma.template.findUnique({ where: { key: input.key } })) throw new AppError('CONFLICT', 'A template with this key exists.');
    let definition: unknown = starter(input.key, input.name, input.type);
    if (input.fromTemplateKey) {
      const source = await this.prisma.template.findUnique({ where: { key: input.fromTemplateKey }, include: { currentVersion: true } });
      if (!source?.currentVersion) throw AppError.notFound('Source template');
      definition = { ...(source.currentVersion.definition as object), templateKey: input.key, name: input.name };
    }
    const parsed = TemplateDefinitionSchema.parse(definition);
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.template.create({
        data: {
          key: input.key,
          name: input.name,
          category: input.category,
          outputs: [parsed.type as TemplateType],
          languages: parsed.languages,
          eventTypes: parsed.eventTypes,
          status: 'DRAFT',
        },
      });
      const version = await tx.templateVersion.create({
        data: { templateId: template.id, version: 1, type: parsed.type as TemplateType, definition: parsed as unknown as Prisma.InputJsonValue, status: 'DRAFT', createdById: adminId },
      });
      await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'template.created', targetType: 'Template', targetId: template.id, meta }, tx);
      return { template, version };
    });
  }

  async duplicate(adminId: string, id: string, input: z.infer<typeof DuplicateTemplateSchema>, meta: RequestMeta) {
    const source = await this.prisma.template.findUnique({ where: { id }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
    const version = source?.versions[0];
    if (!source || !version) throw AppError.notFound('Template');
    if (await this.prisma.template.findUnique({ where: { key: input.key } })) throw new AppError('CONFLICT', 'A template with this key exists.');
    const definition = { ...(version.definition as object), templateKey: input.key, name: input.name };
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.template.create({
        data: {
          key: input.key,
          name: input.name,
          description: source.description,
          category: source.category,
          style: source.style,
          tier: source.tier,
          tags: source.tags,
          eventTypes: source.eventTypes,
          languages: source.languages,
          outputs: source.outputs,
          status: 'DRAFT',
        },
      });
      await tx.templateVersion.create({
        data: { templateId: template.id, version: 1, type: version.type, definition: definition as Prisma.InputJsonValue, status: 'DRAFT', createdById: adminId },
      });
      await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'template.duplicated', targetType: 'Template', targetId: template.id, metadata: { from: source.key }, meta }, tx);
      return template;
    });
  }

  /** Save the working draft. Structure must be valid; semantic issues come back as warnings. */
  async saveDraft(adminId: string, id: string, definition: unknown) {
    const template = await this.prisma.template.findUnique({ where: { id }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
    if (!template) throw AppError.notFound('Template');
    const structural = TemplateDefinitionSchema.safeParse(definition);
    if (!structural.success) {
      throw new AppError('VALIDATION_FAILED', 'The template definition is not valid.', structural.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
    }
    if (structural.data.templateKey !== template.key) throw new AppError('VALIDATION_FAILED', 'templateKey must match the template key.');
    const json = structural.data as unknown as Prisma.InputJsonValue;
    const latest = template.versions[0];
    const version =
      latest && latest.status === 'DRAFT'
        ? await this.prisma.templateVersion.update({ where: { id: latest.id }, data: { definition: json, type: structural.data.type as TemplateType } })
        : await this.prisma.templateVersion.create({
            data: { templateId: id, version: (latest?.version ?? 0) + 1, type: structural.data.type as TemplateType, definition: json, status: 'DRAFT', createdById: adminId },
          });
    const semantic = validateTemplateDefinition(structural.data);
    return { versionId: version.id, version: version.version, warnings: semantic.ok ? [] : semantic.issues };
  }

  /** Full pre-publish report: validation, asset licenses and the test matrix. */
  async check(id: string) {
    const template = await this.prisma.template.findUnique({ where: { id }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
    const version = template?.versions[0];
    if (!template || !version) throw AppError.notFound('Template');
    const validated = validateTemplateDefinition(version.definition);
    if (!validated.ok) return { ok: false, issues: validated.issues, licenseIssues: [], matrix: [] };
    const licenseIssues = await this.licenseIssues(validated.definition);
    const matrix = runTemplateChecks(validated.definition);
    const matrixIssues = matrix.filter((m) => m.empty.length > 0);
    return { ok: licenseIssues.length === 0 && matrixIssues.length === 0, issues: [], licenseIssues, matrix };
  }

  private async licenseIssues(definition: TemplateDefinition) {
    const ids = [...new Set(definition.assets.map((a) => a.assetId))];
    if (!ids.length) return [];
    const assets = await this.prisma.asset.findMany({ where: { id: { in: ids } }, include: { license: true } });
    const byId = new Map(assets.map((a) => [a.id, a]));
    const issues: Array<{ assetId: string; message: string }> = [];
    for (const assetId of ids) {
      const a = byId.get(assetId);
      if (!a) issues.push({ assetId, message: 'Asset does not exist' });
      else if (a.status !== 'APPROVED') issues.push({ assetId, message: `Asset is ${a.status.toLowerCase()}` });
      else if (!a.license) issues.push({ assetId, message: 'Asset has no license metadata' });
      else if (!a.license.commercialUse || !a.license.onDemandUse) issues.push({ assetId, message: 'License does not allow commercial on-demand use' });
      else if (a.license.expiresAt && a.license.expiresAt <= new Date()) issues.push({ assetId, message: 'License has expired' });
    }
    return issues;
  }

  async publish(adminId: string, id: string, meta: RequestMeta) {
    const report = await this.check(id);
    if (report.issues.length || report.licenseIssues.length) {
      throw new AppError('VALIDATION_FAILED', 'Fix the issues before publishing.', { issues: report.issues, licenseIssues: report.licenseIssues });
    }
    const template = await this.prisma.template.findUniqueOrThrow({ where: { id }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
    if (template.deletedAt) throw new AppError('CONFLICT', 'Restore this template before publishing it.');
    const version = template.versions[0]!;
    const definition = validateTemplateDefinition(version.definition);
    if (!definition.ok) throw new AppError('VALIDATION_FAILED', 'Invalid template.');
    await this.prisma.$transaction(async (tx) => {
      if (version.status === 'DRAFT') {
        await tx.templateVersion.update({ where: { id: version.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
      }
      await tx.template.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          currentVersionId: version.id,
          outputs: [definition.definition.type as TemplateType],
          languages: definition.definition.languages,
        },
      });
      await tx.templateAsset.deleteMany({ where: { templateVersionId: version.id } });
      if (definition.definition.assets.length) {
        await tx.templateAsset.createMany({
          data: [...new Set(definition.definition.assets.map((a) => a.assetId))].map((assetId) => ({ templateVersionId: version.id, assetId })),
          skipDuplicates: true,
        });
      }
      await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'template.published', targetType: 'Template', targetId: id, metadata: { version: version.version }, meta }, tx);
    });
    await this.catalog.invalidate();
    return { published: true, version: version.version, matrix: report.matrix };
  }

  /**
   * Delete a template: hidden from the catalog, the design picker and this list,
   * and never recreated by the catalog seed. Events already using it keep their
   * pinned version, so live invitations do not change. Staff can restore it.
   */
  async remove(adminId: string, id: string, meta: RequestMeta) {
    const template = await this.prisma.template.findUnique({ where: { id }, select: { id: true, key: true, deletedAt: true } });
    if (!template) throw AppError.notFound('Template');
    if (template.deletedAt) return { deleted: true };
    const usage = await this.prisma.eventTemplateSelection.count({ where: { templateVersion: { templateId: id } } });
    await this.prisma.$transaction(async (tx) => {
      await tx.template.update({ where: { id }, data: { status: 'ARCHIVED', deletedAt: new Date() } });
      await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'template.deleted', targetType: 'Template', targetId: id, metadata: { key: template.key, eventsUsing: usage }, meta }, tx);
    });
    await this.catalog.invalidate();
    return { deleted: true, eventsUsing: usage };
  }

  /** Bring a deleted template back as unpublished; staff publish it when ready. */
  async restore(adminId: string, id: string, meta: RequestMeta) {
    const template = await this.prisma.template.findUnique({ where: { id }, select: { key: true, deletedAt: true } });
    if (!template) throw AppError.notFound('Template');
    if (!template.deletedAt) return { restored: true };
    await this.prisma.$transaction(async (tx) => {
      await tx.template.update({ where: { id }, data: { status: 'UNPUBLISHED', deletedAt: null } });
      await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'template.restored', targetType: 'Template', targetId: id, metadata: { key: template.key }, meta }, tx);
    });
    await this.catalog.invalidate();
    return { restored: true };
  }

  async setStatus(adminId: string, id: string, status: 'UNPUBLISHED' | 'ARCHIVED', meta: RequestMeta) {
    await this.prisma.template.update({ where: { id }, data: { status } });
    await this.audit.record({ actorType: 'USER', actorId: adminId, action: `template.${status.toLowerCase()}`, targetType: 'Template', targetId: id, meta });
    await this.catalog.invalidate();
    return { status };
  }

  async updateMeta(adminId: string, id: string, input: UpdateTemplateMetaInput, meta: RequestMeta) {
    const updated = await this.prisma.template.update({
      where: { id },
      data: { ...input, ...(input.tier ? { isPremium: input.tier === 'PREMIUM' } : {}) },
    });
    await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'template.meta_updated', targetType: 'Template', targetId: id, metadata: input as Prisma.InputJsonValue, meta });
    await this.catalog.invalidate();
    return updated;
  }
}
