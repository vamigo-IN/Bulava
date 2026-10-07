import { Injectable } from '@nestjs/common';
import { Prisma, type SitePage } from '@bulava/database';
import { SitePageSectionSchema, z, type PublicSitePage, type PublicSitePageLink, type SitePageInput, type SitePageSection } from '@bulava/validation';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventLinksService } from '../domains/event-links.service';

const Sections = z.array(SitePageSectionSchema);

/** Stored sections, read defensively: a row edited by hand never breaks the page. */
function sections(value: Prisma.JsonValue): SitePageSection[] {
  const parsed = Sections.safeParse(value);
  return parsed.success ? parsed.data : [];
}

const isUniqueViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/** A page as the console sees it, with its address on the public site. */
export type AdminSitePage = Omit<SitePage, 'sections'> & { sections: SitePageSection[]; url: string };

/**
 * Site pages at /<slug>. Staff edit them in the console (page.manage); the site
 * reads published ones. Built-in pages (About, Contact, the policies) keep their
 * address and layout and stay published: the footer, the checkout and the
 * payment gateway's review link to them.
 */
@Injectable()
export class SitePagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly links: EventLinksService,
  ) {}

  private view(row: SitePage): AdminSitePage {
    return { ...row, sections: sections(row.sections), url: `${this.links.mainOrigin}/${row.slug}` };
  }

  // ───────── Public ─────────

  async publicList(): Promise<PublicSitePageLink[]> {
    const rows = await this.prisma.sitePage.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, title: true, footerGroup: true, sortOrder: true, updatedAt: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
    return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
  }

  async publicPage(slug: string): Promise<PublicSitePage> {
    const row = await this.prisma.sitePage.findFirst({ where: { slug: slug.toLowerCase().slice(0, 60), status: 'PUBLISHED' } });
    if (!row) throw AppError.notFound('Page');
    return {
      slug: row.slug,
      title: row.title,
      description: row.description,
      layout: row.layout,
      footerGroup: row.footerGroup,
      sections: sections(row.sections),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ───────── Console ─────────

  async list(): Promise<AdminSitePage[]> {
    const rows = await this.prisma.sitePage.findMany({ orderBy: [{ system: 'desc' }, { footerGroup: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }] });
    return rows.map((r) => this.view(r));
  }

  async get(id: string): Promise<AdminSitePage> {
    const row = await this.prisma.sitePage.findUnique({ where: { id } });
    if (!row) throw AppError.notFound('Page');
    return this.view(row);
  }

  async create(userId: string, input: SitePageInput, meta: RequestMeta): Promise<AdminSitePage> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.sitePage.create({
          data: { ...input, sections: input.sections, system: false, publishedAt: input.status === 'PUBLISHED' ? new Date() : null, updatedById: userId },
        });
        await this.audit.record(
          { actorType: 'USER', actorId: userId, action: 'admin.page_created', targetType: 'SitePage', targetId: created.id, metadata: { slug: created.slug, status: created.status }, meta },
          tx,
        );
        return created;
      });
      return this.view(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError('PAGE_SLUG_TAKEN', 'Another page already uses this address.');
      throw error;
    }
  }

  async update(userId: string, id: string, input: SitePageInput, meta: RequestMeta): Promise<AdminSitePage> {
    const existing = await this.prisma.sitePage.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Page');
    if (existing.system && (input.slug !== existing.slug || input.layout !== existing.layout || input.status !== 'PUBLISHED')) {
      throw new AppError('PAGE_PROTECTED', 'Built-in pages keep their address and layout and stay published.');
    }
    const changed = (Object.keys(input) as Array<keyof SitePageInput>).filter((k) => JSON.stringify(input[k]) !== JSON.stringify(existing[k]));
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.sitePage.update({
          where: { id },
          data: { ...input, sections: input.sections, publishedAt: existing.publishedAt ?? (input.status === 'PUBLISHED' ? new Date() : null), updatedById: userId },
        });
        await this.audit.record(
          { actorType: 'USER', actorId: userId, action: 'admin.page_saved', targetType: 'SitePage', targetId: id, metadata: { slug: updated.slug, status: updated.status, changed }, meta },
          tx,
        );
        return updated;
      });
      return this.view(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError('PAGE_SLUG_TAKEN', 'Another page already uses this address.');
      throw error;
    }
  }

  async remove(userId: string, id: string, meta: RequestMeta): Promise<void> {
    const existing = await this.prisma.sitePage.findUnique({ where: { id }, select: { slug: true, system: true } });
    if (!existing) throw AppError.notFound('Page');
    if (existing.system) throw new AppError('PAGE_PROTECTED', 'Built-in pages cannot be deleted.');
    await this.prisma.$transaction(async (tx) => {
      await tx.sitePage.delete({ where: { id } });
      await this.audit.record({ actorType: 'USER', actorId: userId, action: 'admin.page_deleted', targetType: 'SitePage', targetId: id, metadata: { slug: existing.slug }, meta }, tx);
    });
  }
}
