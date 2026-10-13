import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { MediaService } from '../media/media.service';
import { RenderContextService } from '../templates/render-context.service';

/**
 * The host's preview link (/preview/<token>): the invitation exactly as guests
 * will see it, with a watermark, whatever the event's access mode. Hosts share
 * it with family before publishing; nobody can RSVP from it. Once the event is
 * published the preview ends: the link only names the public page (the web app
 * redirects there), so a preview link can never bypass the access mode chosen
 * at publishing.
 */
@Injectable()
export class PreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly renderContext: RenderContextService,
    private readonly media: MediaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async view(token: string) {
    const event = await this.prisma.event.findFirst({
      where: { previewToken: token, deletedAt: null },
      include: {
        accessPolicy: { select: { mode: true } },
        functions: { where: { deletedAt: null }, include: { venue: true }, orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }] },
      },
    });
    if (!event) throw AppError.notFound('Preview');
    if (event.status !== 'DRAFT') return { published: true as const, event: { slug: event.slug, status: event.status } };

    const [template, announcements, features] = await Promise.all([
      this.renderContext.resolveTemplate(event.id, event.typeKey, 'WEBSITE'),
      this.prisma.announcement.findMany({
        where: { eventId: event.id, publishedAt: { not: null }, audience: { path: ['all'], equals: true } },
        orderBy: { publishedAt: 'desc' },
        take: 10,
      }),
      this.entitlements.forEvent(event.id),
    ]);
    if (!template) throw new AppError('SERVICE_UNAVAILABLE', 'No template is available.');
    // The preview shows what guests will see once published: the plan's sections, music and mark.
    const show = EntitlementsService.invitation(features, event);
    const info = await this.prisma.template.findUnique({ where: { key: template.templateKey }, select: { name: true, tier: true } });

    return {
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        typeKey: event.typeKey,
        language: event.language,
        timezone: event.timezone,
        status: event.status,
        accessMode: event.accessPolicy.mode,
      },
      template: { key: template.templateKey, name: info?.name ?? template.templateKey, tier: info?.tier ?? 'FREE', definition: template.definition, customization: template.customization },
      context: await this.renderContext.build({
        event,
        functions: event.functions,
        customization: template.customization,
        announcements,
        ...(await this.media.templatePhotos(event.id, template.customization)),
        music: show.music ? await this.renderContext.resolveMusic(template) : null,
        faith: template.definition.theme.faith ?? null,
      }),
      // Previews always carry the mark; paying removes it from the published invitation.
      watermark: true,
      veil: show.watermark ? this.renderContext.siteAddress() : null,
      without: show.without,
      preview: true,
    };
  }
}
