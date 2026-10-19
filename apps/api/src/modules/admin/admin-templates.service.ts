import { Injectable } from '@nestjs/common';
import type { Prisma, TemplateType } from '@bulava/database';
import {
  importCardJson,
  runTemplateChecks,
  TemplateDefinitionSchema,
  validateTemplateDefinition,
  type CardImportResult,
  type TemplateDefinition,
} from '@bulava/template-schema';
import { z } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { TemplatesService } from '../templates/templates.service';

const keySchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);

/** Frames a new image card can start in. */
const CARD_FORMATS = ['portrait', 'square', 'story', 'landscape'] as const;
const CARD_FRAMES: Record<(typeof CARD_FORMATS)[number], { width: number; height: number }> = {
  portrait: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1350, height: 1080 },
};

export const CreateTemplateSchema = z.object({
  key: keySchema,
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(60),
  type: z.enum(['WEBSITE', 'VIDEO', 'DIGITAL_CARD']),
  /** Start from an existing template's current definition. */
  fromTemplateKey: keySchema.optional(),
  /** Without a source: blank canvas boards for the Design Studio (default), or the classic sections and film elements. */
  start: z.enum(['canvas', 'classic']).optional(),
  /** An image card's frame (films are 9:16, the frame hosts' phones play them in). */
  format: z.enum(CARD_FORMATS).optional(),
});
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;

/** Card JSON from a design tool or generator (see importCardJson): checked, or made into a draft. */
export const ImportCardSchema = z.object({
  card: z.record(z.string(), z.unknown()),
  key: keySchema.optional(),
  name: z.string().trim().min(1).max(80).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  /** false: only report what would be made and what needs attention; true: make the draft template. */
  create: z.boolean().default(false),
});
export type ImportCardInput = z.infer<typeof ImportCardSchema>;

export const UpdateTemplateMetaSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().min(1).max(60).optional(),
  style: z.string().trim().max(40).nullable().optional(),
  tier: z.enum(['FREE', 'PREMIUM', 'SIGNATURE']).optional(),
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

const NAMES = { template: '{{couple.partnerOne}} & {{couple.partnerTwo}}', fallback: { binding: 'honoree.name', fallback: { binding: 'event.title' } } };
const at = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, rotate: 0 });

/** An opening board: the names, a rule and the date, on plain paper (the Design Studio adds the rest). */
function openingBoard(width: number, height: number) {
  const u = width / 390;
  const mid = height / 2;
  return {
    width,
    height,
    background: { type: 'color', color: 'background' },
    layers: [
      { id: 'names', kind: 'text', frame: at(30 * u, mid - 110 * u, 330 * u, 130 * u), content: NAMES, style: { font: 'script', size: 46 * u, color: 'primary', lineHeight: 1.08 }, overflow: 'shrink', animation: { entrance: 'fadeUp' } },
      { id: 'rule', kind: 'shape', shape: 'line', frame: at(165 * u, mid + 36 * u, 60 * u, 2 * u), fill: { type: 'color', color: 'secondary' }, stroke: { width: Math.max(1, u), color: 'secondary' }, animation: { entrance: 'fade', delaySec: 0.2 } },
      { id: 'date', kind: 'text', frame: at(30 * u, mid + 52 * u, 330 * u, 24 * u), content: { binding: 'event.startDate', format: 'dateWithWeekday' }, style: { font: 'body', size: 14 * u, weight: 500, color: 'muted', letterSpacing: 0.12, transform: 'upper' }, overflow: 'shrink', animation: { entrance: 'fadeUp', delaySec: 0.3 } },
    ],
  };
}

/** A function's board: its name and its date, time and venue (repeated once per function). */
function functionBoard(width: number, height: number) {
  const u = width / 390;
  const top = (height - 300 * u) / 2;
  return {
    width,
    height,
    background: { type: 'color', color: 'surface' },
    layers: [
      { id: 'name', kind: 'text', frame: at(30 * u, top, 330 * u, 56 * u), content: { binding: 'function.name' }, style: { font: 'heading', size: 32 * u, color: 'text', lineHeight: 1.1 }, overflow: 'shrink', animation: { entrance: 'fadeUp' } },
      { id: 'details', kind: 'widget', frame: at(36 * u, top + 76 * u, 318 * u, 190 * u), widget: { type: 'details', rows: ['date', 'time', 'venue'], icons: true, iconColor: 'primary', iconCircle: 'background', labelColor: 'muted', valueColor: 'text', labelSize: 9 * u, valueSize: 15 * u, font: 'body', dividers: true, dividerColor: 'muted' }, animation: { entrance: 'fadeUp', delaySec: 0.2 } },
    ],
  };
}

/** Blank canvas boards (ADR-075): a website's opening and function card, or a film's or card's scenes on its frame. */
function canvasStarter(type: 'WEBSITE' | 'VIDEO' | 'DIGITAL_CARD', format: (typeof CARD_FORMATS)[number] | undefined) {
  if (type === 'WEBSITE') {
    return {
      website: {
        pages: [
          {
            id: 'home',
            sections: [
              { id: 'hero', section: 'canvas', canvas: { mobile: openingBoard(390, 844), desktopMaxWidth: 480, repeatPerFunction: false } },
              { id: 'functions', section: 'canvas', canvas: { mobile: functionBoard(390, 520), desktopMaxWidth: 520, repeatPerFunction: true } },
              { id: 'rsvp', section: 'rsvp' },
              { id: 'footer', section: 'footer' },
            ],
          },
        ],
      },
    };
  }
  const frame = type === 'VIDEO' ? CARD_FRAMES.story : CARD_FRAMES[format ?? 'portrait'];
  // Scenes are drawn 450 wide, in the shape of the frame (the film board).
  const board = { width: 450, height: Math.round((450 * frame.height) / frame.width) };
  const scene = (id: string, durationSec: number, b: object, extra: object = {}) => ({ id, durationSec, background: 'background', transition: 'fade', canvas: { board: b, stagger: 0.14, camera: type === 'VIDEO' ? 'push' : 'still', intensity: type === 'VIDEO' ? 0.6 : 0 }, elements: [], ...extra });
  return {
    canvas: { ...frame, fps: 30 },
    scenes:
      type === 'VIDEO'
        ? [scene('opening', 5, openingBoard(board.width, board.height)), scene('function', 5, functionBoard(board.width, board.height), { repeatPerFunction: true })]
        : [scene('card', 1, openingBoard(board.width, board.height))],
  };
}

/** A minimal, valid starting point for a new template of each type. */
export function starter(key: string, name: string, type: 'WEBSITE' | 'VIDEO' | 'DIGITAL_CARD', start: 'canvas' | 'classic' = 'classic', format?: (typeof CARD_FORMATS)[number]): unknown {
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
  if (start === 'canvas') return { ...base, ...canvasStarter(type, format) };
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
    let definition: unknown = starter(input.key, input.name, input.type, input.start, input.format);
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

  /**
   * Card JSON to a canvas template. Without `create` it only reports: the key,
   * name and category it would use, what it could not carry over (images that
   * are not licensed assets, unknown bindings and fonts), whether the key is
   * taken and any validation issues. With `create` it makes the draft, which
   * the Studio, its Canvas editor, checks and publishing then treat as any other.
   */
  async importCard(adminId: string, input: ImportCardInput, meta: RequestMeta) {
    let result: CardImportResult;
    try {
      result = importCardJson(input.card, { key: input.key, name: input.name, category: input.category });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(
          'VALIDATION_FAILED',
          'This is not card JSON: it needs a canvas and a list of elements.',
          error.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), message: i.message })),
        );
      }
      throw error;
    }
    const parsed = TemplateDefinitionSchema.safeParse(result.definition);
    if (!parsed.success) {
      throw new AppError('VALIDATION_FAILED', 'The converted card is not a valid template.', parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), message: i.message })));
    }
    const semantic = validateTemplateDefinition(parsed.data);
    const assetIds = parsed.data.assets.map((a) => a.assetId);
    const known = assetIds.length ? await this.prisma.asset.findMany({ where: { id: { in: assetIds } }, select: { id: true } }) : [];
    const missing = assetIds.filter((id) => !known.some((k) => k.id === id));
    const hero = parsed.data.website?.pages[0]?.sections[0];
    const summary = {
      key: result.key,
      name: result.name,
      category: result.category,
      eventTypes: result.eventTypes,
      layers: hero?.section === 'canvas' ? (hero.canvas?.mobile.layers.length ?? 0) : 0,
      standIns: result.standIns,
      warnings: [...result.warnings, ...missing.map((id) => `The image ${id} is not in the asset library.`)],
      issues: semantic.ok ? [] : semantic.issues,
      keyTaken: Boolean(await this.prisma.template.findUnique({ where: { key: result.key }, select: { id: true } })),
    };
    if (!input.create) return summary;
    if (summary.keyTaken) throw new AppError('CONFLICT', 'A template with this key exists. Choose another key.');
    const template = await this.prisma.$transaction(async (tx) => {
      const created = await tx.template.create({
        data: { key: result.key, name: result.name, category: result.category, outputs: ['WEBSITE'], languages: parsed.data.languages, eventTypes: parsed.data.eventTypes, status: 'DRAFT' },
      });
      await tx.templateVersion.create({
        data: { templateId: created.id, version: 1, type: 'WEBSITE', definition: parsed.data as unknown as Prisma.InputJsonValue, status: 'DRAFT', createdById: adminId },
      });
      await this.audit.record(
        { actorType: 'USER', actorId: adminId, action: 'template.imported', targetType: 'Template', targetId: created.id, metadata: { from: 'card-json', layers: summary.layers, standIns: result.standIns.length }, meta },
        tx,
      );
      return created;
    });
    return { ...summary, template: { id: template.id } };
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
      data: { ...input, ...(input.tier ? { isPremium: input.tier === 'SIGNATURE' } : {}) },
    });
    await this.audit.record({ actorType: 'USER', actorId: adminId, action: 'template.meta_updated', targetType: 'Template', targetId: id, metadata: input as Prisma.InputJsonValue, meta });
    await this.catalog.invalidate();
    return updated;
  }
}
