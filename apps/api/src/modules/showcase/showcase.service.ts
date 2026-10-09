import { Injectable } from '@nestjs/common';
import { fitsShowcase, SHOWCASE_RULES, SHOWCASE_SECTIONS, type PublicShowcase, type ShowcaseFit, type ShowcaseInput, type ShowcaseSection } from '@bulava/validation';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventLinksService } from '../domains/event-links.service';
import { TemplatesService, type TemplateSummary } from '../templates/templates.service';

/** A published template as the console's picker lists it. */
export interface ShowcaseCandidate {
  key: string;
  name: string;
  category: string;
  tier: TemplateSummary['tier'];
  badge: string | null;
  featured: boolean;
  /** The sections it can appear in. */
  fits: ShowcaseSection[];
  colors: Record<string, string> | null;
}

export interface AdminShowcaseSection {
  section: ShowcaseSection;
  max: number;
  fit: ShowcaseFit;
  /** As saved, in order: keys that are no longer published stay listed so the console can flag them. */
  templateKeys: string[];
  updatedAt: string | null;
}

export interface AdminShowcase {
  sections: AdminShowcaseSection[];
  templates: ShowcaseCandidate[];
  /** The public site, for "open on the site" links. */
  siteOrigin: string;
}

const fits = (section: ShowcaseSection, t: TemplateSummary) => fitsShowcase(section, { outputs: t.outputs, heroSection: t.preview.heroSection });

/**
 * Which templates the home page shows, section by section, and the first cards
 * of the card gallery. Staff choose them in the console (showcase.manage); the
 * site reads the published picks and fills sections without picks itself.
 */
@Injectable()
export class ShowcaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
    private readonly audit: AuditService,
    private readonly links: EventLinksService,
  ) {}

  /** The published catalog by key (the cached list, without definitions). */
  private async published(): Promise<Map<string, TemplateSummary>> {
    return new Map((await this.templates.list({})).map((t) => [t.key, t]));
  }

  /** For the site: each section's picks that are published and still fit it. */
  async publicShowcase(): Promise<PublicShowcase> {
    const [rows, published] = await Promise.all([this.prisma.showcaseSection.findMany(), this.published()]);
    const out: PublicShowcase = {};
    for (const row of rows) {
      if (!(SHOWCASE_SECTIONS as readonly string[]).includes(row.section)) continue;
      const section = row.section as ShowcaseSection;
      const keys = row.templateKeys
        .filter((key) => {
          const tpl = published.get(key);
          return !!tpl && fits(section, tpl);
        })
        .slice(0, SHOWCASE_RULES[section].max);
      if (keys.length) out[section] = keys;
    }
    return out;
  }

  async adminShowcase(): Promise<AdminShowcase> {
    const [rows, published] = await Promise.all([this.prisma.showcaseSection.findMany(), this.published()]);
    const saved = new Map(rows.map((r) => [r.section, r]));
    return {
      sections: SHOWCASE_SECTIONS.map((section) => ({
        section,
        ...SHOWCASE_RULES[section],
        templateKeys: saved.get(section)?.templateKeys ?? [],
        updatedAt: saved.get(section)?.updatedAt.toISOString() ?? null,
      })),
      templates: [...published.values()].map((t) => ({
        key: t.key,
        name: t.name,
        category: t.category,
        tier: t.tier,
        badge: t.badge,
        featured: t.featured,
        fits: SHOWCASE_SECTIONS.filter((s) => fits(s, t)),
        colors: t.preview.colors,
      })),
      siteOrigin: this.links.mainOrigin,
    };
  }

  /** Saves a section's picks in order; an empty list hands the section back to the automatic choice. */
  async save(userId: string, section: ShowcaseSection, input: ShowcaseInput, meta: RequestMeta): Promise<AdminShowcase> {
    const { max } = SHOWCASE_RULES[section];
    if (input.templateKeys.length > max) {
      throw new AppError('VALIDATION_FAILED', max === 1 ? 'This section shows one template.' : `This section shows at most ${max} templates.`);
    }
    const published = await this.published();
    const unfit = input.templateKeys.filter((key) => {
      const tpl = published.get(key);
      return !tpl || !fits(section, tpl);
    });
    if (unfit.length) throw new AppError('SHOWCASE_TEMPLATE_UNFIT', `Not published, or not for this section: ${unfit.join(', ')}.`, { keys: unfit });

    await this.prisma.$transaction(async (tx) => {
      const previous = await tx.showcaseSection.findUnique({ where: { section }, select: { templateKeys: true } });
      if (input.templateKeys.length) {
        await tx.showcaseSection.upsert({
          where: { section },
          create: { section, templateKeys: input.templateKeys, updatedById: userId },
          update: { templateKeys: input.templateKeys, updatedById: userId },
        });
      } else {
        await tx.showcaseSection.deleteMany({ where: { section } });
      }
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'admin.showcase_saved',
          targetType: 'ShowcaseSection',
          targetId: section,
          metadata: { section, templateKeys: input.templateKeys, previous: previous?.templateKeys ?? [] },
          meta,
        },
        tx,
      );
    });
    return this.adminShowcase();
  }
}
