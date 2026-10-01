import { Inject, Injectable } from '@nestjs/common';
import {
  buildRenderContext,
  validateTemplateDefinition,
  type Customization,
  type FunctionContext,
  type GalleryImage,
  type RenderContext,
  type TemplateDefinition,
} from '@bulava/template-schema';
import type { Prisma, TemplateType } from '@bulava/database';
import { SettingsStore } from '@bulava/settings';
import type { ObjectStorage } from '@bulava/storage';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { STORAGE } from '../../infrastructure/storage/storage.module';
import { SETTINGS_STORE } from '../settings/settings.service';

type FunctionWithVenue = Prisma.EventFunctionGetPayload<{ include: { venue: true } }>;

export interface ResolvedTemplate {
  templateId: string;
  templateKey: string;
  templateVersionId: string;
  tier: 'FREE' | 'STANDARD' | 'PREMIUM';
  definition: TemplateDefinition;
  customization: Customization | null;
  isDefault: boolean;
}

const FALLBACK_TEMPLATE_KEY = 'classic-ivory';
/** Signed music links outlive a long visit but not a forwarded page. */
const MUSIC_URL_TTL_SECONDS = 6 * 3600;

/**
 * Builds the RenderContext a template binds to. Callers pass only functions
 * the viewer is already authorized to see, so templates can never leak data.
 */
@Injectable()
export class RenderContextService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    @Inject(SETTINGS_STORE) private readonly settings: SettingsStore,
  ) {}

  /**
   * Website background music: the host's choice (validated against the template's
   * capabilities when saved) or the template default. Only approved tracks with a
   * current commercial, on-demand licence ever play.
   */
  async resolveMusic(template: ResolvedTemplate | null): Promise<RenderContext['music']> {
    if (!template) return null;
    const musicId = template.customization?.musicId ?? template.definition.music?.defaultMusicId;
    if (!musicId) return null;
    const track = await this.prisma.music.findUnique({ where: { id: musicId }, include: { license: true } });
    if (!track || track.status !== 'APPROVED' || !track.license.commercialUse || !track.license.onDemandUse) return null;
    if (track.license.expiresAt && track.license.expiresAt <= new Date()) return null;
    return { url: await this.storage.presignDownload(track.storageKey, { expiresInSeconds: MUSIC_URL_TTL_SECONDS }), title: track.title };
  }

  toFunctionContext(fn: FunctionWithVenue): FunctionContext {
    return {
      id: fn.id,
      name: fn.name,
      description: fn.description,
      startsAt: fn.startsAt?.toISOString() ?? null,
      endsAt: fn.endsAt?.toISOString() ?? null,
      status: fn.status,
      venue: fn.venue
        ? { name: fn.venue.name, address: fn.venue.address, city: fn.venue.city, mapUrl: fn.venue.mapUrl }
        : null,
    };
  }

  async build(input: {
    event: { title: string; description: string | null; typeKey: string; startDate: Date | null; endDate: Date | null; language: string; timezone: string; details: Prisma.JsonValue };
    functions: FunctionWithVenue[];
    guestName?: string | null;
    gallery?: GalleryImage[];
    photos?: GalleryImage[];
    photoSlots?: RenderContext['photoSlots'];
    customization?: Customization | null;
    announcements?: Array<{ title: string; body: string; publishedAt: Date | null }>;
    language?: string;
    music?: RenderContext['music'];
  }): Promise<RenderContext> {
    const visible = input.functions.filter((f) => f.status !== 'DRAFT');
    const starts = visible.map((f) => f.startsAt).filter((d): d is Date => d !== null).sort((a, b) => a.getTime() - b.getTime());
    const context = buildRenderContext({
      event: {
        title: input.event.title,
        description: input.event.description,
        typeKey: input.event.typeKey,
        // Derive dates from what this viewer can see, never from hidden functions.
        startDate: starts[0]?.toISOString() ?? null,
        endDate: starts[starts.length - 1]?.toISOString() ?? null,
        language: input.language ?? input.event.language,
        timezone: input.event.timezone,
      },
      details: (input.event.details ?? {}) as Record<string, unknown>,
      functions: visible.map((f) => this.toFunctionContext(f)),
      guestName: input.guestName ?? null,
      gallery: input.gallery ?? [],
      photos: input.photos ?? [],
      photoSlots: input.photoSlots,
      custom: input.customization?.custom ?? {},
      announcements: input.announcements?.map((a) => ({ title: a.title, body: a.body, publishedAt: a.publishedAt?.toISOString() ?? null })),
      music: input.music ?? null,
    });
    return this.withMaps(context);
  }

  /**
   * Google Maps embeds for venues, when the Super Admin has enabled them. The key
   * is a browser key restricted to Bulava's domains in Google Cloud, so it is
   * public by design; the map frame gets only the site's origin as referrer.
   */
  private async withMaps(context: RenderContext): Promise<RenderContext> {
    const maps = await this.settings.get('maps');
    const key = maps.value.enabled && maps.value.showOnInvitations ? maps.value.embedKey : undefined;
    if (!key) return context;
    const embed = <T extends { name: string; address: string | null; city: string | null } | null | undefined>(venue: T): T => {
      if (!venue) return venue;
      const place = [venue.name, venue.address, venue.city].filter(Boolean).join(', ');
      return { ...venue, embedUrl: `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(place)}` };
    };
    return {
      ...context,
      venue: embed(context.venue),
      function: context.function ? { ...context.function, venue: embed(context.function.venue) } : context.function,
      functions: context.functions.map((f) => ({ ...f, venue: embed(f.venue) })),
    };
  }

  /** The event's chosen template for an output, or a sensible free default. */
  async resolveTemplate(eventId: string, typeKey: string, output: TemplateType = 'WEBSITE'): Promise<ResolvedTemplate | null> {
    const selection = await this.prisma.eventTemplateSelection.findUnique({
      where: { eventId_output: { eventId, output } },
      include: { templateVersion: { include: { template: true } } },
    });
    if (selection) {
      const parsed = validateTemplateDefinition(selection.templateVersion.definition);
      if (parsed.ok) {
        return {
          templateId: selection.templateVersion.templateId,
          templateKey: selection.templateVersion.template.key,
          templateVersionId: selection.templateVersionId,
          tier: selection.templateVersion.template.tier,
          definition: parsed.definition,
          customization: (selection.customization ?? null) as Customization | null,
          isDefault: false,
        };
      }
    }
    if (output !== 'WEBSITE') return null;
    const candidates = await this.prisma.template.findMany({
      where: { status: 'PUBLISHED', tier: 'FREE', outputs: { has: 'WEBSITE' }, currentVersionId: { not: null } },
      include: { currentVersion: true },
      orderBy: { sortOrder: 'asc' },
    });
    const pick =
      candidates.find((t) => t.eventTypes.includes(typeKey)) ?? candidates.find((t) => t.key === FALLBACK_TEMPLATE_KEY) ?? candidates[0];
    if (!pick?.currentVersion) return null;
    const parsed = validateTemplateDefinition(pick.currentVersion.definition);
    if (!parsed.ok) return null;
    return {
      templateId: pick.id,
      templateKey: pick.key,
      templateVersionId: pick.currentVersion.id,
      tier: pick.tier,
      definition: parsed.definition,
      customization: null,
      isDefault: true,
    };
  }
}
