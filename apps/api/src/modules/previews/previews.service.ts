import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { generateSecureToken, hashToken, permissionsForEventRole, platformRoleHasPermission, PREVIEW_LOOK_TOKEN, previewLookToken, type PlatformRole } from '@bulava/auth';
import { Prisma, type CardOrder, type Order, type PreviewItem, type PreviewRequest } from '@bulava/database';
import { zonedWallTimeToUtcIso } from '@bulava/localization';
import { hasCardDesign, type TemplateDefinition } from '@bulava/template-schema';
import {
  OPEN_PREVIEW_STATUSES,
  splitPhoneNumber,
  validateEventDetails,
  type DeskRequestsQuery,
  type PreviewAssignInput,
  type PreviewChangesInput,
  type PreviewItemCreateInput,
  type PreviewNoteInput,
  type PreviewOfferInput,
  type PreviewOwnInput,
  type PreviewProviderCreateInput,
  type PreviewRequestInput,
  type PreviewStatusInput,
  type StaffPreviewRequestInput,
} from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import type { AuthUser, EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { CardOrdersService } from '../cards/card-orders.service';
import { CardsService } from '../cards/cards.service';
import { EventsService, HELD_PREVIEW } from '../events/events.service';
import { FunctionsService } from '../functions/functions.service';
import { MediaService } from '../media/media.service';
import { MessagesService } from '../notifications/messages.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { DesignService } from '../templates/design.service';
import { RenderContextService } from '../templates/render-context.service';
import { ConsentService } from '../users/consent.service';
import { assertVerifiedAccount } from '../users/account-gate';
import { firstName, maskPhone, previewReference, previewTitle } from './preview-names';

type Kind = 'WEBSITE' | 'CARD' | 'FILM';
/** A preview on the customer's page: where it opens, and a card's design, photos and watermark for its thumbnail. */
interface LookItem {
  id: string;
  kind: Kind;
  templateKey: string;
  templateName: string;
  sharedAt: Date | null;
  href: string | null;
  design?: unknown;
  photos?: Record<string, string>;
  watermark?: string | null;
}
type RequestWithItems = PreviewRequest & { items: PreviewItem[] };

/** Who is acting on the desk: a preview provider, or staff who manage previews (preview.manage). */
export interface DeskActor {
  id: string;
  manage: boolean;
}

const OPEN = [...OPEN_PREVIEW_STATUSES] as PreviewRequest['status'][];
const ENDED: PreviewRequest['status'][] = ['CLOSED', 'CANCELLED'];
/** A second "your preview is ready" waits this long, so previews shared together go in one message. */
const READY_DELAY_MS = 60_000;
/** Sending the link again by hand: at most every ten minutes. */
const RESEND_COOLDOWN_MS = 10 * 60_000;
/** Views from one visitor count once per half hour. */
const VIEW_WINDOW_SECONDS = 30 * 60;
const PAGE = 30;

/** The event source of a preview's draft event once its customer owns it (HELD_PREVIEW while its provider holds it). */
export const OWNED_SOURCE = 'preview';

/**
 * The preview desk (ADR-076, docs/previews.md). Customers ask for a preview
 * (or staff enter one for a customer from outside); a preview provider takes
 * it, or an admin assigns it, and designs the website, card or film in the
 * same editors customers use, on a draft event and card sessions the provider
 * holds. Sharing a preview puts it on the customer's page (/look/<token>) and
 * sends them the link on WhatsApp and by email. Paying for the preview's offer
 * (a plan, or a card at the card price), or a plan that already covers it,
 * moves everything into the customer's account. Nothing a provider makes is
 * published or downloaded without the watermark before its customer owns it.
 */
@Injectable()
export class PreviewsService implements OnModuleInit {
  private readonly logger = new Logger(PreviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly messages: MessagesService,
    private readonly events: EventsService,
    private readonly functions: FunctionsService,
    private readonly design: DesignService,
    private readonly cards: CardsService,
    private readonly cardOrders: CardOrdersService,
    private readonly payments: PaymentsService,
    private readonly consents: ConsentService,
    private readonly renderContext: RenderContextService,
    private readonly media: MediaService,
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    // A plan bought from a preview page owns its designs; a card bought from it owns that card.
    this.payments.onLookOrder((look, userId) => this.offerFor(look, userId));
    this.payments.onOrderPaid((tx, order) => this.planPaid(tx, order));
    this.cardOrders.onPaid((tx, order) => this.cardPaid(tx, order));
  }

  // ─────────────────────────── Links ───────────────────────────

  token(request: Pick<PreviewRequest, 'id' | 'linkVersion'>): string {
    return previewLookToken(request.id, request.linkVersion, this.config.TOKEN_ENCRYPTION_KEY);
  }

  lookPath(request: Pick<PreviewRequest, 'id' | 'linkVersion'>): string {
    return `/look/${this.token(request)}`;
  }

  lookUrl(request: Pick<PreviewRequest, 'id' | 'linkVersion'>): string {
    return `${this.config.WEB_ORIGIN.replace(/\/$/, '')}${this.lookPath(request)}`;
  }

  private async byToken(token: string): Promise<RequestWithItems> {
    const request = PREVIEW_LOOK_TOKEN.test(token) ? await this.prisma.previewRequest.findUnique({ where: { tokenHash: hashToken(token) }, include: { items: { orderBy: { createdAt: 'asc' } } } }) : null;
    if (!request) throw AppError.notFound('Preview');
    return request;
  }

  // ─────────────────────────── Asking for a preview ───────────────────────────

  /** What the request form and the console send, checked against the occasion. */
  private async checked(input: PreviewRequestInput | StaffPreviewRequestInput) {
    const type = await this.prisma.eventType.findFirst({ where: { key: input.eventTypeKey, enabled: true } });
    if (!type) throw new AppError('INVALID_EVENT_TYPE', 'Choose the occasion.');
    const details = validateEventDetails(type.detailsSchemaKey, input.details);
    if (!details.success) {
      throw new AppError(
        'VALIDATION_FAILED',
        'Please check the names.',
        details.error.issues.map((i) => ({ path: ['details', ...i.path].join('.'), message: i.message })),
      );
    }
    if (!type.detailsSchemaKey && !input.title) {
      throw new AppError('VALIDATION_FAILED', 'Please give the celebration a name.', [{ path: 'title', message: 'Required' }]);
    }
    // A design they liked, if it is one we have (a stale link just leaves it out).
    const template = input.templateKey ? await this.prisma.template.findFirst({ where: { key: input.templateKey, status: 'PUBLISHED' }, select: { key: true } }) : null;
    return { type, details: details.data as Record<string, unknown>, templateKey: template?.key ?? null };
  }

  /** A new request, with its link token's hash (an HMAC of the id: the id comes first). */
  private async createRequest(
    tx: Tx,
    data: Omit<Prisma.PreviewRequestUncheckedCreateInput, 'tokenHash' | 'reference'>,
  ): Promise<PreviewRequest> {
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await tx.previewRequest.create({ data: { ...data, reference: previewReference(), tokenHash: `pending:${generateSecureToken(16)}` } });
        return await tx.previewRequest.update({ where: { id: created.id }, data: { tokenHash: hashToken(this.token(created)) } });
      } catch (error) {
        // A reference already given (one in a billion): another one.
        if (attempt < 3 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
        throw error;
      }
    }
  }

  /**
   * The request form. A number with a request still being worked on gets that
   * request back (the new wishes noted on it) rather than a second one; a form
   * a bot filled in is quietly dropped.
   */
  async request(input: PreviewRequestInput, user: AuthUser | null, meta: RequestMeta): Promise<{ reference: string }> {
    if (input.website) return { reference: 'PV-RECEIVED' };
    const { type, details, templateKey } = await this.checked(input);
    const open = await this.prisma.previewRequest.findFirst({ where: { phone: input.phone, status: { in: OPEN } }, orderBy: { createdAt: 'desc' } });
    if (open) {
      const wants = [...new Set([...open.wants, ...input.wants])];
      await this.prisma.$transaction(async (tx) => {
        await tx.previewRequest.update({ where: { id: open.id }, data: { wants, ...(templateKey && !open.templateKey ? { templateKey } : {}), ...(user && !open.userId ? { userId: user.id } : {}) } });
        await this.activity(tx, open.id, null, 'ASKED_AGAIN', input.notes ?? null, { wants: input.wants, templateKey, date: input.date ?? null });
      });
      return { reference: open.reference };
    }
    const versions = await this.consents.versions(['terms', 'privacy']);
    const request = await this.prisma.$transaction(async (tx) => {
      const created = await this.createRequest(tx, {
        source: 'WEBSITE',
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        userId: user?.id ?? null,
        eventTypeKey: type.key,
        title: input.title ?? null,
        details: details as Prisma.InputJsonValue,
        date: input.date ?? null,
        venue: input.venue ?? null,
        city: input.city ?? null,
        functions: input.functions as unknown as Prisma.InputJsonValue,
        wants: input.wants,
        templateKey,
        language: input.language,
        notes: input.notes ?? null,
        offerPlanKey: await this.defaultOffer(input.wants, templateKey),
        consentAt: new Date(),
      });
      // Their ticked box: the Terms and Privacy Policy they saw, and being contacted about this request.
      await this.consents.recordPreviewContact(tx, created.id, { version: `${versions.terms};${versions.privacy}`, source: 'preview_request', userId: user?.id ?? null });
      await this.activity(tx, created.id, null, 'CREATED', null, { source: 'WEBSITE' });
      await this.audit.record({ actorType: user ? 'USER' : 'ANONYMOUS', actorId: user?.id ?? null, action: 'preview.requested', targetType: 'PreviewRequest', targetId: created.id, metadata: { reference: created.reference, wants: input.wants }, meta }, tx);
      return created;
    });
    await this.tellProviders(request);
    await this.acknowledge(request);
    return { reference: request.reference };
  }

  /** A customer from outside (a call, a visit, a partner), entered in the console; staff confirm the customer agreed to be contacted. */
  async staffRequest(input: StaffPreviewRequestInput, actor: AuthUser, meta: RequestMeta) {
    const { type, details, templateKey } = await this.checked(input);
    if (input.assigneeId) await this.provider(input.assigneeId);
    if (input.offerPlanKey) await this.offerPlan(input.offerPlanKey, true);
    if (input.offerCouponCode) await this.coupon(input.offerCouponCode);
    const request = await this.prisma.$transaction(async (tx) => {
      const created = await this.createRequest(tx, {
        source: 'STAFF',
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        eventTypeKey: type.key,
        title: input.title ?? null,
        details: details as Prisma.InputJsonValue,
        date: input.date ?? null,
        venue: input.venue ?? null,
        city: input.city ?? null,
        functions: input.functions as unknown as Prisma.InputJsonValue,
        wants: input.wants,
        templateKey,
        language: input.language,
        notes: input.notes ?? null,
        offerPlanKey: input.offerPlanKey ?? (await this.defaultOffer(input.wants, templateKey)),
        offerCouponCode: input.offerCouponCode ?? null,
        consentAt: new Date(),
        createdById: actor.id,
        ...(input.assigneeId ? { assigneeId: input.assigneeId, assignedAt: new Date(), status: 'ASSIGNED' as const } : {}),
      });
      await this.consents.recordPreviewContact(tx, created.id, { version: 'staff-confirmed', source: `staff:${actor.id}` });
      await this.activity(tx, created.id, actor.id, 'CREATED', null, { source: 'STAFF' });
      if (input.assigneeId) await this.activity(tx, created.id, actor.id, 'ASSIGNED', null, { assigneeId: input.assigneeId });
      await this.audit.record({ actorType: 'USER', actorId: actor.id, action: 'preview.entered', targetType: 'PreviewRequest', targetId: created.id, metadata: { reference: created.reference, assigneeId: input.assigneeId ?? null }, meta }, tx);
      return created;
    });
    if (input.assigneeId) await this.tellAssignee(request, input.assigneeId);
    else await this.tellProviders(request);
    await this.acknowledge(request);
    return this.detail(request.id, { id: actor.id, manage: true });
  }

  /** The plan a request starts with: the cheapest public plan that covers its design and a film; none for cards alone. */
  private async defaultOffer(wants: readonly Kind[], templateKey: string | null): Promise<string | null> {
    if (!wants.includes('WEBSITE') && !wants.includes('FILM')) return null;
    const tier = templateKey ? (await this.prisma.template.findUnique({ where: { key: templateKey }, select: { tier: true } }))?.tier : undefined;
    const needTier = tier === 'SIGNATURE' ? 2 : tier === 'PREMIUM' ? 1 : 0;
    const plans = await this.prisma.pricingPlan.findMany({
      where: { active: true, kind: 'PLAN', visibility: 'PUBLIC', interval: 'ONE_TIME', priceMinor: { gt: 0 } },
      include: { features: true },
      orderBy: { priceMinor: 'asc' },
    });
    const limit = (plan: (typeof plans)[number], key: string) => {
      const f = plan.features.find((x) => x.featureKey === key);
      return !f || !f.enabled ? 0 : f.limit === null ? Infinity : f.limit;
    };
    const fit = plans.find((p) => limit(p, 'templates.maxTier') >= needTier && limit(p, 'events.max') >= 1 && (!wants.includes('FILM') || limit(p, 'video.renders.max') >= 1));
    return fit?.key ?? plans[plans.length - 1]?.key ?? null;
  }

  // ─────────────────────────── The desk ───────────────────────────

  /** Someone who may be given previews to make: a preview provider, or staff who can do the work. */
  private async provider(userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null, status: 'ACTIVE' }, select: { id: true, name: true, platformRole: true } });
    if (!user || !platformRoleHasPermission(user.platformRole as PlatformRole, 'preview.work')) throw new AppError('BAD_REQUEST', 'Choose a preview provider.');
    return user;
  }

  private async load(id: string): Promise<RequestWithItems> {
    const request = await this.prisma.previewRequest.findUnique({ where: { id }, include: { items: { orderBy: { createdAt: 'asc' } } } });
    if (!request) throw AppError.notFound('Request');
    return request;
  }

  /** Providers see their own requests and the open queue (open requests nobody has); staff who manage previews see all. */
  private visible(request: PreviewRequest, actor: DeskActor): boolean {
    return actor.manage || request.assigneeId === actor.id || (!request.assigneeId && OPEN.includes(request.status));
  }

  /** Work on a request: its provider, or staff who manage previews. */
  private async workable(id: string, actor: DeskActor): Promise<RequestWithItems> {
    const request = await this.load(id);
    if (!this.visible(request, actor)) throw AppError.notFound('Request');
    if (!actor.manage && request.assigneeId !== actor.id) throw new AppError('FORBIDDEN', 'Take this request first.');
    return request;
  }

  async summary(actor: DeskActor) {
    const [mine, open, changes, sent] = await Promise.all([
      this.prisma.previewRequest.count({ where: { assigneeId: actor.id, status: { in: OPEN } } }),
      this.prisma.previewRequest.count({ where: { status: { in: OPEN }, assigneeId: null } }),
      this.prisma.previewRequest.count({ where: { assigneeId: actor.id, status: 'CHANGES_REQUESTED' } }),
      this.prisma.previewRequest.count({ where: { assigneeId: actor.id, status: 'SENT' } }),
    ]);
    return { mine, open, changes, sent };
  }

  async list(actor: DeskActor, query: DeskRequestsQuery) {
    if (query.scope === 'all' && !actor.manage) throw AppError.notFound('Page');
    const where: Prisma.PreviewRequestWhereInput = {
      ...(query.scope === 'mine' ? { assigneeId: actor.id } : query.scope === 'open' ? { status: { in: OPEN }, assigneeId: null } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { reference: { contains: query.q, mode: 'insensitive' } },
              { name: { contains: query.q, mode: 'insensitive' } },
              { phone: { contains: query.q.replace(/[^\d+]/g, '') || query.q } },
              { title: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.previewRequest.findMany({
        where,
        include: { assignee: { select: { id: true, name: true } }, _count: { select: { items: true } } },
        orderBy: [{ updatedAt: 'desc' }],
        skip: (query.page - 1) * PAGE,
        take: PAGE,
      }),
      this.prisma.previewRequest.count({ where }),
    ]);
    return {
      total,
      page: query.page,
      pageSize: PAGE,
      requests: rows.map((r) => ({
        id: r.id,
        reference: r.reference,
        status: r.status,
        source: r.source,
        name: r.name,
        title: previewTitle(r),
        eventTypeKey: r.eventTypeKey,
        date: r.date,
        city: r.city,
        wants: r.wants,
        templateKey: r.templateKey,
        assignee: r.assignee,
        items: r._count.items,
        views: r.views,
        lastViewedAt: r.lastViewedAt,
        sentAt: r.sentAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    };
  }

  /** Everything about one request: the customer, their celebration, the previews with their links, the offer, the timeline. */
  async detail(id: string, actor: DeskActor) {
    const request = await this.prisma.previewRequest.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true } },
        items: { orderBy: { createdAt: 'asc' }, include: { event: { select: { id: true, previewToken: true, deletedAt: true } } } },
        activities: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!request || !this.visible(request, actor)) throw AppError.notFound('Request');
    const mine = actor.manage || request.assigneeId === actor.id;
    const actorIds = [...new Set(request.activities.map((a) => a.actorId).filter((x): x is string => !!x))];
    const keyOf = await this.currentKeys(request.items);
    const [actors, templates, plans, eventType] = await Promise.all([
      actorIds.length ? this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
      this.prisma.template.findMany({ where: { key: { in: [...new Set([...keyOf.values(), ...(request.templateKey ? [request.templateKey] : [])])] } }, select: { key: true, name: true, tier: true } }),
      this.offerPlans(actor.manage),
      this.prisma.eventType.findUnique({ where: { key: request.eventTypeKey }, select: { name: true, detailsSchemaKey: true } }),
    ]);
    const names = new Map(actors.map((u) => [u.id, u.name]));
    const templateName = new Map(templates.map((t) => [t.key, t.name]));
    const look = this.lookPath(request);
    return {
      id: request.id,
      reference: request.reference,
      status: request.status,
      source: request.source,
      // The customer's number and email are for whoever works on it.
      customer: { name: request.name, phone: mine ? request.phone : maskPhone(request.phone), email: mine ? request.email : null },
      celebration: {
        eventTypeKey: request.eventTypeKey,
        eventTypeName: eventType?.name ?? request.eventTypeKey,
        detailsSchemaKey: eventType?.detailsSchemaKey ?? null,
        title: previewTitle(request),
        details: request.details,
        date: request.date,
        venue: request.venue,
        city: request.city,
        functions: request.functions,
        language: request.language,
      },
      wants: request.wants,
      template: request.templateKey ? { key: request.templateKey, name: templateName.get(request.templateKey) ?? request.templateKey } : null,
      notes: request.notes,
      assignee: request.assignee,
      assignedAt: request.assignedAt,
      mine,
      offer: { planKey: request.offerPlanKey, couponCode: request.offerCouponCode, plans },
      link: mine ? { path: look, url: this.lookUrl(request) } : null,
      items: request.items.map((item) => ({
        id: item.id,
        kind: item.kind,
        status: item.status,
        templateKey: keyOf.get(item.id) ?? item.templateKey,
        templateName: templateName.get(keyOf.get(item.id) ?? item.templateKey) ?? item.templateKey,
        sharedAt: item.sharedAt,
        eventId: item.event && !item.event.deletedAt ? item.event.id : null,
        cardSessionId: item.cardSessionId,
        // Where the provider designs it, and where the customer sees it.
        edit: !mine
          ? null
          : item.kind === 'CARD'
            ? item.cardSessionId
              ? `/cards/editor/${item.templateKey}?card=${item.cardSessionId}`
              : null
            : item.event && !item.event.deletedAt
              ? item.kind === 'WEBSITE'
                ? `/dashboard/events/${item.event.id}/design`
                : `/dashboard/events/${item.event.id}/video?template=${keyOf.get(item.id) ?? item.templateKey}`
              : null,
        view: !mine ? null : item.kind === 'WEBSITE' ? (item.event && !item.event.deletedAt ? `/preview/${item.event.previewToken}` : null) : `${look}/${item.kind === 'CARD' ? 'card' : 'film'}/${item.id}`,
      })),
      views: request.views,
      firstViewedAt: request.firstViewedAt,
      lastViewedAt: request.lastViewedAt,
      sentAt: request.sentAt,
      ownedAt: request.ownedAt,
      createdAt: request.createdAt,
      activity: request.activities.map((a) => ({ id: a.id, kind: a.kind, text: a.text, meta: a.meta, at: a.createdAt, actor: a.actorId ? (names.get(a.actorId) ?? null) : null })),
    };
  }

  /**
   * A provider takes a request from the open queue (first come, first served):
   * a new one, or one a provider before them gave back, with what they started.
   */
  async take(id: string, actor: DeskActor, meta: RequestMeta) {
    const taken = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.previewRequest.updateMany({ where: { id, status: { in: OPEN }, assigneeId: null }, data: { assigneeId: actor.id, assignedAt: new Date() } });
      if (!claimed.count) throw new AppError('PREVIEW_TAKEN', 'Someone has taken this request already.');
      await tx.previewRequest.updateMany({ where: { id, status: 'NEW' }, data: { status: 'ASSIGNED' } });
      const request = await tx.previewRequest.findUniqueOrThrow({ where: { id }, include: { items: true } });
      // Anything a provider before them started comes with it.
      await this.moveHeld(tx, request, actor.id);
      await this.activity(tx, id, actor.id, 'TAKEN', null, {});
      await this.audit.record({ actorType: 'USER', actorId: actor.id, action: 'preview.taken', targetType: 'PreviewRequest', targetId: id, meta }, tx);
      return request;
    });
    return this.detail(taken.id, actor);
  }

  /** Back to the open queue, for another provider. */
  async release(id: string, actor: DeskActor, meta: RequestMeta) {
    const request = await this.workable(id, actor);
    if (request.status === 'OWNED' || ENDED.includes(request.status)) throw new AppError('BAD_REQUEST', 'This request is finished.');
    await this.prisma.$transaction(async (tx) => {
      await tx.previewRequest.update({ where: { id }, data: { assigneeId: null, assignedAt: null, ...(request.status === 'ASSIGNED' || request.status === 'IN_PROGRESS' ? { status: 'NEW' } : {}) } });
      await this.activity(tx, id, actor.id, 'RELEASED', null, {});
      await this.audit.record({ actorType: 'USER', actorId: actor.id, action: 'preview.released', targetType: 'PreviewRequest', targetId: id, meta }, tx);
    });
    return { ok: true };
  }

  /** Staff give a request to a provider (or back to the queue); what was started moves with it. */
  async assign(id: string, input: PreviewAssignInput, actor: AuthUser, meta: RequestMeta) {
    const request = await this.load(id);
    if (request.status === 'OWNED' || ENDED.includes(request.status)) throw new AppError('BAD_REQUEST', 'This request is finished.');
    if (!input.assigneeId) return this.release(id, { id: actor.id, manage: true }, meta);
    const provider = await this.provider(input.assigneeId);
    await this.prisma.$transaction(async (tx) => {
      await tx.previewRequest.update({ where: { id }, data: { assigneeId: provider.id, assignedAt: new Date(), ...(request.status === 'NEW' ? { status: 'ASSIGNED' } : {}) } });
      await this.moveHeld(tx, request, provider.id);
      await this.activity(tx, id, actor.id, 'ASSIGNED', null, { assigneeId: provider.id, name: provider.name });
      await this.audit.record({ actorType: 'USER', actorId: actor.id, action: 'preview.assigned', targetType: 'PreviewRequest', targetId: id, metadata: { assigneeId: provider.id }, meta }, tx);
    });
    if (provider.id !== actor.id) await this.tellAssignee(request, provider.id);
    return this.detail(id, { id: actor.id, manage: true });
  }

  async setStatus(id: string, input: PreviewStatusInput, actor: DeskActor, meta: RequestMeta) {
    const request = await this.workable(id, actor);
    if (request.status === 'OWNED') throw new AppError('BAD_REQUEST', 'This request is owned by its customer.');
    if ((input.status === 'CLOSED' || input.status === 'CANCELLED' || (input.status === 'NEW' && ENDED.includes(request.status))) && !actor.manage) {
      throw AppError.forbidden('Ask an admin to close or reopen a request.');
    }
    const data: Prisma.PreviewRequestUpdateInput =
      input.status === 'NEW' ? (ENDED.includes(request.status) ? { status: request.sentAt ? 'SENT' : request.assigneeId ? 'ASSIGNED' : 'NEW' } : { status: 'NEW', assignee: { disconnect: true }, assignedAt: null }) : { status: input.status };
    await this.prisma.$transaction(async (tx) => {
      await tx.previewRequest.update({ where: { id }, data });
      await this.activity(tx, id, actor.id, 'STATUS', null, { from: request.status, to: input.status });
      await this.audit.record({ actorType: 'USER', actorId: actor.id, action: 'preview.status_changed', targetType: 'PreviewRequest', targetId: id, metadata: { from: request.status, to: input.status }, meta }, tx);
    });
    return this.detail(id, actor);
  }

  async note(id: string, input: PreviewNoteInput, actor: DeskActor) {
    const request = await this.load(id);
    if (!this.visible(request, actor)) throw AppError.notFound('Request');
    await this.prisma.$transaction((tx) => this.activity(tx, id, actor.id, 'NOTE', input.text, {}));
    return this.detail(id, actor);
  }

  /** The plans a preview can be offered with: public ones, and hidden ones for staff who manage previews. */
  private async offerPlans(manage: boolean) {
    const plans = await this.prisma.pricingPlan.findMany({
      where: { active: true, kind: 'PLAN', interval: 'ONE_TIME', priceMinor: { gt: 0 }, ...(manage ? {} : { visibility: 'PUBLIC' }) },
      orderBy: { priceMinor: 'asc' },
      select: { key: true, name: true, priceMinor: true, listPriceMinor: true, visibility: true },
    });
    return plans;
  }

  private async offerPlan(key: string, manage: boolean) {
    const plan = await this.prisma.pricingPlan.findFirst({ where: { key, active: true, kind: 'PLAN', interval: 'ONE_TIME', ...(manage ? {} : { visibility: 'PUBLIC' }) } });
    if (!plan) throw new AppError('BAD_REQUEST', 'Choose one of the plans.');
    return plan;
  }

  private async coupon(code: string) {
    const now = new Date();
    const coupon = await this.prisma.coupon.findFirst({ where: { code: code.toUpperCase(), active: true, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } });
    if (!coupon) throw new AppError('COUPON_INVALID', 'This coupon is not valid.');
    return coupon;
  }

  async setOffer(id: string, input: PreviewOfferInput, actor: DeskActor, meta: RequestMeta) {
    const request = await this.workable(id, actor);
    if (request.status === 'OWNED') throw new AppError('BAD_REQUEST', 'This request is owned by its customer.');
    if (input.planKey) await this.offerPlan(input.planKey, actor.manage);
    else if (request.items.some((i) => i.kind !== 'CARD' && i.status === 'SHARED')) {
      throw new AppError('BAD_REQUEST', 'A shared website or film is owned with a plan: keep a plan as the offer, or take them back first.');
    }
    if (input.couponCode !== undefined && !actor.manage) throw AppError.forbidden('Ask an admin to add a coupon.');
    if (input.couponCode) await this.coupon(input.couponCode);
    await this.prisma.$transaction(async (tx) => {
      await tx.previewRequest.update({ where: { id }, data: { offerPlanKey: input.planKey, ...(input.couponCode !== undefined ? { offerCouponCode: input.couponCode } : {}) } });
      await this.activity(tx, id, actor.id, 'OFFER', null, { planKey: input.planKey, couponCode: input.couponCode ?? request.offerCouponCode });
      await this.audit.record({ actorType: 'USER', actorId: actor.id, action: 'preview.offer_changed', targetType: 'PreviewRequest', targetId: id, metadata: { planKey: input.planKey, couponCode: input.couponCode ?? null }, meta }, tx);
    });
    return this.detail(id, actor);
  }

  // ─────────────────────────── Making previews ───────────────────────────

  private access(eventId: string, userId: string): EventAccessContext {
    return { eventId, userId, role: 'OWNER', permissions: permissionsForEventRole('OWNER'), functionIds: [] };
  }

  /**
   * A draft event for a website or film preview: one of the request's events
   * whose website (or film) no other preview uses, else a new one made from
   * what the customer told us: the occasion, the names, the date, and the
   * functions with their dates and venues. So a second website design is a
   * second event, and a film goes with the first event that has none. Events
   * are held by the provider (source "preview_desk"): never published, and
   * out of their own events list.
   */
  private async ensureEvent(request: RequestWithItems, kind: 'WEBSITE' | 'FILM', actorId: string, meta: RequestMeta): Promise<string> {
    const taken = new Set(request.items.filter((i) => i.eventId && i.kind === kind).map((i) => i.eventId!));
    const free = [...new Set(request.items.map((i) => i.eventId).filter((x): x is string => !!x && !taken.has(x)))];
    if (free.length) {
      const live = await this.prisma.event.findFirst({ where: { id: { in: free }, deletedAt: null, source: HELD_PREVIEW }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      if (live) return live.id;
    }
    const type = await this.prisma.eventType.findUniqueOrThrow({ where: { key: request.eventTypeKey } });
    const timezone = 'Asia/Kolkata';
    const asked = (request.functions as Array<{ name: string; date?: string; time?: string; venue?: string }> | null) ?? [];
    const event = await this.events.create(
      actorId,
      {
        typeKey: type.key,
        title: previewTitle(request).slice(0, 160),
        language: request.language,
        timezone,
        accessMode: 'PRIVATE_LINK',
        visibility: 'UNLISTED',
        details: request.details as Record<string, unknown>,
        // Without functions of theirs, the occasion's main one (dated below).
        applyDefaults: asked.length === 0,
      },
      meta,
      { source: HELD_PREVIEW },
    );
    const access = this.access(event.id, actorId);
    const place = (venue: string | undefined) => {
      const name = venue ?? request.venue ?? undefined;
      return name ? { name, ...(request.city ? { city: request.city } : {}) } : undefined;
    };
    for (const [index, fn] of asked.entries()) {
      const date = fn.date ?? (index === 0 ? request.date : null) ?? null;
      const startsAt = date ? zonedWallTimeToUtcIso(`${date}T${fn.time ?? '10:00'}`, timezone) : undefined;
      const venue = place(fn.venue);
      await this.functions.create(access, { name: fn.name, startsAt, venue, visibility: 'LISTED', accessMode: 'INHERIT', audienceGroupIds: [], status: 'SCHEDULED', sortOrder: index }, meta);
    }
    if (!asked.length && request.date) {
      await this.events.setMainDate(event.id, type, request.date, timezone);
      const main = await this.prisma.eventFunction.findFirst({ where: { eventId: event.id, deletedAt: null }, orderBy: { sortOrder: 'asc' }, select: { id: true } });
      const venue = place(undefined);
      if (main && venue) await this.functions.update(access, main.id, { venue }, meta);
    }
    return event.id;
  }

  /** A card from the design, its details filled in from the request, saved for the provider (they open it in the card editor). */
  private async previewCard(request: RequestWithItems, templateKey: string, actorId: string): Promise<string> {
    const d = (request.details ?? {}) as Record<string, string | undefined>;
    const asked = (request.functions as Array<{ name: string; date?: string; time?: string; venue?: string }> | null) ?? [];
    const session = await this.cards.createForPreview(templateKey, {
      eventType: request.eventTypeKey,
      language: request.language,
      userId: actorId,
      details: {
        title: request.title ?? '',
        partnerOne: d.partnerOne ?? '',
        partnerTwo: d.partnerTwo ?? '',
        honoree: d.name ?? '',
        date: request.date ?? asked[0]?.date ?? '',
        time: asked[0]?.time ?? '',
        venue: request.venue ?? asked[0]?.venue ?? '',
        city: request.city ?? '',
        functions: asked.slice(0, 4).map((f) => ({ name: f.name.slice(0, 60), date: f.date ?? '', time: f.time ?? '' })),
      },
    });
    return session.id;
  }

  /** A preview to make: the website or film on the request's draft event, or a card. It starts as a draft only the provider sees. */
  async addItem(id: string, input: PreviewItemCreateInput, actor: DeskActor, meta: RequestMeta) {
    const request = await this.workable(id, actor);
    if (request.status === 'OWNED' || ENDED.includes(request.status)) throw new AppError('BAD_REQUEST', 'This request is finished.');
    const template = await this.prisma.template.findUnique({ where: { key: input.templateKey }, include: { currentVersion: true } });
    const output = input.kind === 'FILM' ? 'VIDEO' : 'WEBSITE';
    if (!template || template.status !== 'PUBLISHED' || !template.currentVersion || !template.outputs.includes(output)) {
      throw new AppError('TEMPLATE_NOT_AVAILABLE', 'This design is not available.');
    }
    if (template.eventTypes.length && !template.eventTypes.includes(request.eventTypeKey)) {
      throw new AppError('TEMPLATE_NOT_AVAILABLE', 'This design is not made for this occasion.');
    }
    if (input.kind === 'CARD' && !hasCardDesign(template.currentVersion.definition as unknown as TemplateDefinition)) {
      throw new AppError('TEMPLATE_NOT_AVAILABLE', 'This design cannot be made into a card.');
    }
    // The provider is the event's owner while they hold it (the console may act for them).
    const holder = request.assigneeId ?? actor.id;
    let eventId: string | null = null;
    let cardSessionId: string | null = null;
    if (input.kind === 'CARD') cardSessionId = await this.previewCard(request, template.key, holder);
    else {
      eventId = await this.ensureEvent(request, input.kind, holder, meta);
      await this.design.select(this.access(eventId, holder), output, { templateKey: template.key }, meta);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.previewItem.create({ data: { requestId: id, kind: input.kind, templateKey: template.key, eventId, cardSessionId, createdById: actor.id } });
      if (request.status === 'ASSIGNED' || request.status === 'NEW') await tx.previewRequest.update({ where: { id }, data: { status: 'IN_PROGRESS', ...(request.assigneeId ? {} : { assigneeId: actor.id, assignedAt: new Date() }) } });
      await this.activity(tx, id, actor.id, 'ITEM_ADDED', null, { kind: input.kind, templateKey: template.key });
    });
    return this.detail(id, actor);
  }

  /**
   * The design each preview shows now: a website or film is whatever its
   * event has chosen since (the provider may pick another in the editors); a
   * card keeps its template.
   */
  private async currentKeys(items: Array<Pick<PreviewItem, 'id' | 'kind' | 'templateKey' | 'eventId'>>): Promise<Map<string, string>> {
    const eventIds = [...new Set(items.map((i) => i.eventId).filter((x): x is string => !!x))];
    const selections = eventIds.length
      ? await this.prisma.eventTemplateSelection.findMany({ where: { eventId: { in: eventIds }, output: { in: ['WEBSITE', 'VIDEO'] } }, select: { eventId: true, output: true, templateVersion: { select: { template: { select: { key: true } } } } } })
      : [];
    const chosen = new Map(selections.map((s) => [`${s.eventId}:${s.output}`, s.templateVersion.template.key]));
    return new Map(items.map((i) => [i.id, i.kind === 'CARD' || !i.eventId ? i.templateKey : (chosen.get(`${i.eventId}:${i.kind === 'FILM' ? 'VIDEO' : 'WEBSITE'}`) ?? i.templateKey)]));
  }

  private async item(request: RequestWithItems, itemId: string): Promise<PreviewItem> {
    const item = request.items.find((i) => i.id === itemId);
    if (!item) throw AppError.notFound('Preview');
    return item;
  }

  /**
   * Puts a preview on the customer's page: its link goes to them on WhatsApp
   * and by email (one message for previews shared within a minute).
   */
  async share(id: string, itemId: string, actor: DeskActor, meta: RequestMeta) {
    const request = await this.workable(id, actor);
    if (request.status === 'OWNED' || ENDED.includes(request.status)) throw new AppError('BAD_REQUEST', 'This request is finished.');
    const item = await this.item(request, itemId);
    if (item.kind === 'CARD' ? !item.cardSessionId : !item.eventId) throw new AppError('BAD_REQUEST', 'This preview has nothing to show yet.');
    // A website or a film is owned with a plan; cards alone sell at the card price.
    if (item.kind !== 'CARD' && !request.offerPlanKey) throw new AppError('BAD_REQUEST', 'Choose a plan as the offer first: a website or a film comes with a plan.');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.previewItem.update({ where: { id: itemId }, data: { status: 'SHARED', sharedAt: item.sharedAt ?? now } });
      await tx.previewRequest.update({ where: { id }, data: { status: 'SENT', sentAt: request.sentAt ?? now } });
      await this.activity(tx, id, actor.id, 'SHARED', null, { kind: item.kind, templateKey: item.templateKey });
      await this.audit.record({ actorType: 'USER', actorId: actor.id, action: 'preview.shared', targetType: 'PreviewRequest', targetId: id, metadata: { itemId, kind: item.kind }, meta }, tx);
    });
    const message = await this.tellCustomer(request.id, false);
    return { ...(await this.detail(id, actor)), message };
  }

  async withdraw(id: string, itemId: string, actor: DeskActor) {
    const request = await this.workable(id, actor);
    await this.item(request, itemId);
    await this.prisma.$transaction(async (tx) => {
      await tx.previewItem.update({ where: { id: itemId }, data: { status: 'WITHDRAWN' } });
      await this.activity(tx, id, actor.id, 'WITHDRAWN', null, { itemId });
    });
    return this.detail(id, actor);
  }

  /** A draft the customer never saw. Its card goes with it; the event stays while another preview uses it. */
  async removeItem(id: string, itemId: string, actor: DeskActor) {
    const request = await this.workable(id, actor);
    const item = await this.item(request, itemId);
    if (item.status !== 'DRAFT') throw new AppError('BAD_REQUEST', 'Take a shared preview off the customer’s page instead.');
    await this.prisma.$transaction(async (tx) => {
      await tx.previewItem.delete({ where: { id: itemId } });
      if (item.cardSessionId) await tx.cardSession.deleteMany({ where: { id: item.cardSessionId, orders: { none: {} } } });
      if (item.eventId && !request.items.some((i) => i.id !== itemId && i.eventId === item.eventId)) {
        await tx.event.updateMany({ where: { id: item.eventId, source: HELD_PREVIEW }, data: { deletedAt: new Date() } });
      }
      await this.activity(tx, id, actor.id, 'ITEM_REMOVED', null, { kind: item.kind });
    });
    return this.detail(id, actor);
  }

  /** The link again, by hand (at most every ten minutes). */
  async resend(id: string, actor: DeskActor) {
    const request = await this.workable(id, actor);
    if (!request.items.some((i) => i.status === 'SHARED')) throw new AppError('BAD_REQUEST', 'Share a preview first.');
    const message = await this.tellCustomer(request.id, true);
    return { ...(await this.detail(id, actor)), message };
  }

  /** A new link: the old one stops working at once. */
  async rotateLink(id: string, actor: DeskActor, meta: RequestMeta) {
    const request = await this.workable(id, actor);
    const version = request.linkVersion + 1;
    await this.prisma.$transaction(async (tx) => {
      await tx.previewRequest.update({ where: { id }, data: { linkVersion: version, tokenHash: hashToken(previewLookToken(id, version, this.config.TOKEN_ENCRYPTION_KEY)) } });
      await this.activity(tx, id, actor.id, 'LINK_REPLACED', null, {});
      await this.audit.record({ actorType: 'USER', actorId: actor.id, action: 'preview.link_replaced', targetType: 'PreviewRequest', targetId: id, meta }, tx);
    });
    return this.detail(id, actor);
  }

  // ─────────────────────────── The customer's page ───────────────────────────

  /**
   * What the customer's page shows: the celebration, the previews that are
   * shared (never the provider's drafts), the offer and whether it is owned.
   * Their number and email never leave the desk.
   */
  async look(token: string, user: AuthUser | null) {
    const request = await this.byToken(token);
    const shared = request.items.filter((i) => i.status === 'SHARED');
    const keyOf = await this.currentKeys(shared);
    const [assignee, templates, plan, cardOptions, events, cardViews] = await Promise.all([
      request.assigneeId ? this.prisma.user.findUnique({ where: { id: request.assigneeId }, select: { name: true } }) : Promise.resolve(null),
      this.prisma.template.findMany({ where: { key: { in: [...new Set(keyOf.values())] } }, select: { key: true, name: true } }),
      request.offerPlanKey ? this.prisma.pricingPlan.findFirst({ where: { key: request.offerPlanKey, active: true }, select: { key: true, name: true, priceMinor: true, listPriceMinor: true, tagline: true } }) : Promise.resolve(null),
      this.cards.options(),
      this.prisma.event.findMany({ where: { id: { in: shared.map((i) => i.eventId).filter((x): x is string => !!x) }, deletedAt: null }, select: { id: true, previewToken: true } }),
      // Cards as the card page shows them, with the watermark, for their thumbnails.
      Promise.all(
        shared
          .filter((i) => i.kind === 'CARD' && i.cardSessionId)
          .map(async (i) => [i.cardSessionId!, await this.cards.previewRenderData(i.cardSessionId!).catch(() => null)] as const),
      ),
    ]);
    const names = new Map(templates.map((t) => [t.key, t.name]));
    const previewOf = new Map(events.map((e) => [e.id, e.previewToken]));
    const cardView = new Map(cardViews);
    const owned = request.status === 'OWNED';
    return {
      reference: request.reference,
      state: owned ? 'owned' : ENDED.includes(request.status) ? 'ended' : shared.length ? 'ready' : 'waiting',
      title: previewTitle(request),
      eventTypeKey: request.eventTypeKey,
      date: request.date,
      language: request.language,
      customerName: firstName(request.name),
      designer: assignee ? firstName(assignee.name) : null,
      ownedByYou: owned && !!user && request.ownerId === user.id,
      items: shared.flatMap((item): LookItem[] => {
        const key = keyOf.get(item.id) ?? item.templateKey;
        const base = { id: item.id, kind: item.kind, templateKey: key, templateName: names.get(key) ?? key, sharedAt: item.sharedAt };
        if (item.kind === 'WEBSITE') {
          const t = item.eventId ? previewOf.get(item.eventId) : undefined;
          // Once owned, the website is the owner's: its preview link is theirs to share.
          return t && !owned ? [{ ...base, href: `/preview/${t}` }] : owned ? [{ ...base, href: null }] : [];
        }
        if (item.kind === 'CARD') {
          const card = item.cardSessionId ? cardView.get(item.cardSessionId) : null;
          return card ? [{ ...base, href: `/look/${token}/card/${item.id}`, design: card.design, photos: card.photos, watermark: card.watermark }] : [];
        }
        return item.eventId ? [{ ...base, href: `/look/${token}/film/${item.id}` }] : [];
      }),
      offer: plan
        ? { kind: 'PLAN' as const, planKey: plan.key, planName: plan.name, priceMinor: plan.priceMinor, listPriceMinor: plan.listPriceMinor, tagline: plan.tagline, couponCode: request.offerCouponCode }
        : { kind: 'CARD' as const, priceMinor: cardOptions.priceMinor },
    };
  }

  /** One card on the customer's page: its design and photos, with the watermark (the only way a preview card is seen). */
  async lookCard(token: string, itemId: string) {
    const request = await this.byToken(token);
    const item = request.items.find((i) => i.id === itemId && i.kind === 'CARD' && i.status === 'SHARED');
    if (!item?.cardSessionId) throw AppError.notFound('Preview');
    const data = await this.cards.previewRenderData(item.cardSessionId);
    return { ...data, title: previewTitle(request), reference: request.reference, owned: request.status === 'OWNED' };
  }

  /** One film on the customer's page: the film's design and the event's details, played in the browser with a watermark. */
  async lookFilm(token: string, itemId: string) {
    const request = await this.byToken(token);
    const item = request.items.find((i) => i.id === itemId && i.kind === 'FILM' && i.status === 'SHARED');
    if (!item?.eventId) throw AppError.notFound('Preview');
    const event = await this.prisma.event.findFirst({
      where: { id: item.eventId, deletedAt: null },
      include: { functions: { where: { deletedAt: null }, include: { venue: true }, orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }] } },
    });
    if (!event) throw AppError.notFound('Preview');
    const template = await this.renderContext.resolveTemplate(event.id, event.typeKey, 'VIDEO');
    if (!template) throw AppError.notFound('Preview');
    const context = await this.renderContext.build({
      event,
      functions: event.functions,
      customization: template.customization,
      ...(await this.media.templatePhotos(event.id, template.customization)),
      music: await this.renderContext.resolveMusic(template),
      faith: template.definition.theme.faith ?? null,
    });
    return { title: previewTitle(request), reference: request.reference, language: event.language, templateKey: template.templateKey, definition: template.definition, customization: template.customization, context, owned: request.status === 'OWNED' };
  }

  /** A visit to the customer's page: counted once per visitor and half hour; the first one goes on the timeline. */
  async viewed(token: string, visitor: string) {
    const request = await this.byToken(token);
    const key = `preview-view:${request.id}:${createHash('sha256').update(visitor).digest('hex').slice(0, 16)}`;
    const fresh = await this.redis.client.set(key, '1', 'EX', VIEW_WINDOW_SECONDS, 'NX').catch(() => 'OK');
    if (fresh !== 'OK') return { ok: true };
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.previewRequest.update({ where: { id: request.id }, data: { views: { increment: 1 }, lastViewedAt: now, firstViewedAt: request.firstViewedAt ?? now } });
      if (!request.firstViewedAt) await this.activity(tx, request.id, null, 'VIEWED', null, {});
    });
    return { ok: true };
  }

  /** The customer asks for changes from their page: back to the provider, with their words. */
  async askChanges(token: string, input: PreviewChangesInput) {
    const request = await this.byToken(token);
    if (request.status === 'OWNED' || ENDED.includes(request.status)) throw new AppError('PREVIEW_ENDED', 'This preview has ended.');
    await this.prisma.$transaction(async (tx) => {
      await tx.previewRequest.update({ where: { id: request.id }, data: { status: 'CHANGES_REQUESTED' } });
      await this.activity(tx, request.id, null, 'CHANGES', input.message, {});
    });
    const to = request.assigneeId ? [request.assigneeId] : await this.managerIds();
    for (const userId of to) {
      await this.notifications.notify({ type: 'PREVIEW_CHANGES', channel: 'IN_APP', userId, payload: { requestId: request.id, reference: request.reference, title: previewTitle(request), message: input.message.slice(0, 300) } });
      await this.notifications.notify({ type: 'PREVIEW_CHANGES', channel: 'EMAIL', userId, payload: { requestId: request.id, reference: request.reference, title: previewTitle(request), message: input.message.slice(0, 1000) } });
    }
    return { ok: true };
  }

  // ─────────────────────────── Owning the designs ───────────────────────────

  /**
   * "Pay to own", signed in. A plan as the offer: had at once when the
   * account's plan covers it, else the checkout (the order carries the page's
   * link, and paying moves the designs here). Cards at the card price: the
   * chosen card is bought like any watermark-free card, and once paid it is
   * saved in the account.
   */
  async own(token: string, input: PreviewOwnInput, user: AuthUser, meta: RequestMeta) {
    await assertVerifiedAccount(this.prisma, user.id);
    const request = await this.byToken(token);
    if (request.status === 'OWNED') {
      if (request.ownerId === user.id) return { owned: true as const, eventId: this.heldEvent(request) };
      throw new AppError('PREVIEW_OWNED', 'This design belongs to someone else now.');
    }
    if (ENDED.includes(request.status)) throw new AppError('PREVIEW_ENDED', 'This preview has ended. Ask for a new one.');
    const shared = request.items.filter((i) => i.status === 'SHARED');
    if (!shared.length) throw new AppError('PREVIEW_NOT_READY', 'Your preview is not ready yet.');

    if (request.offerPlanKey) {
      const plan = await this.prisma.pricingPlan.findFirst({ where: { key: request.offerPlanKey, active: true } });
      if (!plan) throw new AppError('PREVIEW_NOT_READY', 'Your preview is not ready yet.');
      const plans = await this.payments.accountPlans(user.id);
      const covered = plans.some((p) => p.kind === 'PLAN' && p.interval === 'ONE_TIME' && p.priceMinor >= plan.priceMinor);
      if (covered) {
        await this.prisma.$transaction((tx) => this.claim(tx, request.id, user.id, { via: 'PLAN_INCLUDED' }));
        await this.audit.record({ actorType: 'USER', actorId: user.id, action: 'preview.owned', targetType: 'PreviewRequest', targetId: request.id, metadata: { via: 'plan' }, meta });
        const owned = await this.load(request.id);
        return { owned: true as const, eventId: this.heldEvent(owned) };
      }
      return { checkout: { planKey: plan.key, couponCode: request.offerCouponCode, look: token } };
    }

    // Cards at the card price.
    const cards = shared.filter((i) => i.kind === 'CARD' && i.cardSessionId);
    const item = input.itemId ? cards.find((i) => i.id === input.itemId) : cards.length === 1 ? cards[0] : undefined;
    if (!item?.cardSessionId) throw new AppError('BAD_REQUEST', 'Choose the card you would like.');
    if (input.acceptTerms !== true) throw new AppError('CONSENT_REQUIRED', 'Please accept the Terms of Service and the Refund and Cancellation Policy');
    const account = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, email: true, phone: true } });
    const email = input.email ?? account.email;
    if (!email) throw new AppError('VALIDATION_FAILED', 'An email for your receipt and your card.', [{ path: 'email', message: 'Required' }]);
    const phone = splitPhoneNumber(account.phone ?? request.phone);
    if (!phone) throw new AppError('VALIDATION_FAILED', 'Add your WhatsApp number to your account first.');
    const session = await this.prisma.cardSession.findUniqueOrThrow({ where: { id: item.cardSessionId } });
    const checkout = await this.cardOrders.createForSession(session, { phone, name: (input.name ?? account.name).slice(0, 80), email, acceptTerms: true, marketingConsent: false }, user, meta, { previewRequestId: request.id });
    return { cardCheckout: checkout };
  }

  /** The request's draft event (its website and film), if any. */
  private heldEvent(request: RequestWithItems): string | null {
    return request.items.find((i) => i.eventId)?.eventId ?? null;
  }

  /** A plan order placed from a preview page: its request and offer (any plan, hidden ones too, the link being the offer). */
  private async offerFor(look: string, userId: string): Promise<{ requestId: string; planKey: string } | null> {
    const request = await this.byToken(look).catch(() => null);
    if (!request?.offerPlanKey || ENDED.includes(request.status)) return null;
    if (request.status === 'OWNED' && request.ownerId !== userId) return null;
    return { requestId: request.id, planKey: request.offerPlanKey };
  }

  private async planPaid(tx: Tx, order: Order): Promise<void> {
    if (!order.previewRequestId) return;
    await this.claim(tx, order.previewRequestId, order.userId, { via: 'PLAN', orderId: order.id });
  }

  private async cardPaid(tx: Tx, order: CardOrder): Promise<void> {
    if (!order.previewRequestId || !order.userId) return;
    await this.claim(tx, order.previewRequestId, order.userId, { via: 'CARD', cardOrderId: order.id, cardSessionId: order.sessionId });
  }

  /**
   * Moves designs into the buyer's account, once (under the request's row
   * lock): with a plan, the draft events (websites and films, now theirs, with
   * new preview links) and every card; with a card bought at the card price,
   * the cards made for them (the others as their drafts, each sold at the card
   * price). The provider keeps nothing. Someone else buying afterwards (two
   * checkouts open at once) owns nothing more: a card buyer keeps their paid
   * card through its order, a plan buyer is refunded by staff.
   */
  async claim(tx: Tx, requestId: string, buyerId: string, how: { via: 'PLAN' | 'PLAN_INCLUDED' | 'CARD'; orderId?: string; cardOrderId?: string; cardSessionId?: string | null }): Promise<void> {
    await tx.$executeRaw`SELECT id FROM preview_requests WHERE id = ${requestId}::uuid FOR UPDATE`;
    const request = await tx.previewRequest.findUnique({ where: { id: requestId }, include: { items: true } });
    if (!request) return;
    if (request.status === 'OWNED' && request.ownerId && request.ownerId !== buyerId) {
      this.logger.warn({ requestId, buyerId, via: how.via }, 'A preview already owned was bought again');
      await this.activity(tx, requestId, null, 'BOUGHT_AGAIN', null, { via: how.via, buyerId, orderId: how.orderId ?? how.cardOrderId ?? null });
      return;
    }
    if (how.via === 'CARD') {
      const sessions = request.items.map((i) => i.cardSessionId).filter((x): x is string => !!x);
      if (sessions.length) await tx.cardSession.updateMany({ where: { id: { in: sessions } }, data: { userId: buyerId } });
    } else {
      for (const eventId of new Set(request.items.map((i) => i.eventId).filter((x): x is string => !!x))) await this.transferEvent(tx, eventId, buyerId, true);
      const sessions = request.items.map((i) => i.cardSessionId).filter((x): x is string => !!x);
      if (sessions.length) await tx.cardSession.updateMany({ where: { id: { in: sessions } }, data: { userId: buyerId } });
    }
    const firstTime = request.status !== 'OWNED';
    // Cards at the card price: owned once the customer has one of them.
    await tx.previewRequest.update({
      where: { id: requestId },
      data: {
        status: 'OWNED',
        ...(firstTime ? { ownedAt: new Date(), ownerId: buyerId } : {}),
        ...(how.orderId ? { orderId: how.orderId } : {}),
        ...(how.cardOrderId ? { cardOrderId: how.cardOrderId } : {}),
      },
    });
    await this.activity(tx, requestId, null, 'OWNED', null, { via: how.via, buyerId, orderId: how.orderId ?? how.cardOrderId ?? null });
    const title = previewTitle(request);
    const eventId = request.items.find((i) => i.eventId)?.eventId ?? null;
    // In the bell of the provider and of the new owner (in-app rows need no queue).
    if (request.assigneeId) await tx.notification.create({ data: { type: 'PREVIEW_OWNED', channel: 'IN_APP', userId: request.assigneeId, status: 'DELIVERED', sentAt: new Date(), payload: { requestId, reference: request.reference, title, role: 'provider' } } });
    if (firstTime) await tx.notification.create({ data: { type: 'PREVIEW_OWNED', channel: 'IN_APP', userId: buyerId, status: 'DELIVERED', sentAt: new Date(), payload: { requestId, reference: request.reference, title, role: 'owner', eventId: how.via === 'CARD' ? null : eventId } } });
  }

  /**
   * An event changes hands (ADR-076: the first ownership transfer). The new
   * holder becomes its OWNER member and the previous one leaves the team; a
   * customer's (final) gets the event in their list and a new preview link.
   */
  private async transferEvent(tx: Tx, eventId: string, toUserId: string, final: boolean): Promise<void> {
    const event = await tx.event.findUnique({ where: { id: eventId }, select: { ownerId: true, source: true, deletedAt: true } });
    if (!event || event.deletedAt) return;
    if (event.ownerId !== toUserId) {
      await tx.eventMember.deleteMany({ where: { eventId, userId: { in: [event.ownerId, toUserId] } } });
      await tx.eventMember.create({ data: { eventId, userId: toUserId, role: 'OWNER' } });
    }
    await tx.event.update({
      where: { id: eventId },
      data: { ownerId: toUserId, ...(final ? { source: OWNED_SOURCE, previewToken: generateSecureToken(18) } : {}) },
    });
    await this.audit.record({ actorType: 'SYSTEM', action: final ? 'event.ownership_transferred' : 'event.preview_reassigned', targetType: 'Event', targetId: eventId, eventId, metadata: { from: event.ownerId, to: toUserId } }, tx);
  }

  /** What a request's provider started (its draft event and cards) moves to its new provider. */
  private async moveHeld(tx: Tx, request: RequestWithItems, toUserId: string): Promise<void> {
    for (const eventId of new Set(request.items.map((i) => i.eventId).filter((x): x is string => !!x))) {
      const held = await tx.event.findFirst({ where: { id: eventId, source: HELD_PREVIEW }, select: { id: true } });
      if (held) await this.transferEvent(tx, eventId, toUserId, false);
    }
    const sessions = request.items.map((i) => i.cardSessionId).filter((x): x is string => !!x);
    if (sessions.length) await tx.cardSession.updateMany({ where: { id: { in: sessions } }, data: { userId: toUserId } });
  }

  // ─────────────────────────── The customer's dashboard ───────────────────────────

  /** Previews made for this account: asked for while signed in, or for its confirmed WhatsApp number. */
  async mine(user: AuthUser) {
    const account = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true, phoneVerifiedAt: true } });
    const requests = await this.prisma.previewRequest.findMany({
      where: { OR: [{ userId: user.id }, { ownerId: user.id }, ...(account.phone && account.phoneVerifiedAt ? [{ phone: account.phone }] : [])], status: { not: 'CANCELLED' } },
      include: { items: { where: { status: 'SHARED' }, select: { kind: true, eventId: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    return requests.map((r) => ({
      reference: r.reference,
      status: r.status,
      title: previewTitle(r),
      date: r.date,
      wants: r.wants,
      shared: r.items.map((i) => i.kind),
      link: this.lookPath(r),
      eventId: r.status === 'OWNED' && r.ownerId === user.id ? (r.items.find((i) => i.eventId)?.eventId ?? null) : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  // ─────────────────────────── Preview providers (console) ───────────────────────────

  async providers() {
    const people = await this.prisma.user.findMany({
      where: { platformRole: 'PREVIEW_PROVIDER', deletedAt: null },
      select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true, totpEnabledAt: true },
      orderBy: { name: 'asc' },
    });
    const counts = await this.prisma.previewRequest.groupBy({ by: ['assigneeId', 'status'], where: { assigneeId: { in: people.map((p) => p.id) } }, _count: { _all: true } });
    return people.map((p) => {
      const mine = counts.filter((c) => c.assigneeId === p.id);
      const sum = (statuses: readonly string[]) => mine.filter((c) => statuses.includes(c.status)).reduce((n, c) => n + c._count._all, 0);
      return { ...p, twoStep: Boolean(p.totpEnabledAt), totpEnabledAt: undefined, open: sum(OPEN), owned: sum(['OWNED']) };
    });
  }

  /**
   * A preview provider's account, made by an admin: an existing customer's
   * account takes the role (never a staff member's), or a new one is made for
   * the email or number; they sign in with a code sent there.
   */
  async addProvider(input: PreviewProviderCreateInput, actor: AuthUser, meta: RequestMeta) {
    const existing = await this.prisma.user.findFirst({ where: { OR: [...(input.email ? [{ email: input.email }] : []), ...(input.phone ? [{ phone: input.phone }] : [])], deletedAt: null } });
    if (existing && existing.platformRole !== 'USER' && existing.platformRole !== 'PREVIEW_PROVIDER') {
      throw new AppError('CONFLICT', 'This person is already on the staff with another role. Change their role in Staff & roles.');
    }
    const user = await this.prisma.$transaction(async (tx) => {
      const made = existing
        ? await tx.user.update({ where: { id: existing.id }, data: { platformRole: 'PREVIEW_PROVIDER' } })
        : // Like the quick start's accounts, it belongs to its address or number until a code proves it at the first sign-in.
          await tx.user.create({ data: { name: input.name, email: input.email ?? null, phone: input.phone ?? null, platformRole: 'PREVIEW_PROVIDER', provisional: true } });
      await this.audit.record({ actorType: 'USER', actorId: actor.id, action: 'preview.provider_added', targetType: 'User', targetId: made.id, metadata: { existing: Boolean(existing) }, meta }, tx);
      return made;
    });
    await this.notifications.notify({ type: 'PREVIEW_WELCOME', channel: 'IN_APP', userId: user.id, payload: { name: firstName(user.name) } });
    if (user.email) await this.notifications.notify({ type: 'PREVIEW_WELCOME', channel: 'EMAIL', userId: user.id, payload: { name: firstName(user.name) } });
    return { id: user.id, name: user.name, email: user.email, phone: user.phone, existing: Boolean(existing) };
  }

  /** The role taken back: their open requests return to the queue (what they started moves to whoever takes each). */
  async removeProvider(userId: string, actor: AuthUser, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, platformRole: true } });
    if (!user || user.platformRole !== 'PREVIEW_PROVIDER') throw AppError.notFound('Preview provider');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { platformRole: 'USER' } });
      const open = await tx.previewRequest.findMany({ where: { assigneeId: userId, status: { in: OPEN } }, select: { id: true, status: true } });
      for (const r of open) {
        await tx.previewRequest.update({ where: { id: r.id }, data: { assigneeId: null, assignedAt: null, ...(r.status === 'ASSIGNED' || r.status === 'IN_PROGRESS' ? { status: 'NEW' } : {}) } });
        await this.activity(tx, r.id, actor.id, 'RELEASED', null, { reason: 'provider_removed' });
      }
      await this.audit.record({ actorType: 'USER', actorId: actor.id, action: 'preview.provider_removed', targetType: 'User', targetId: userId, metadata: { released: open.length }, meta }, tx);
    });
    return { ok: true };
  }

  // ─────────────────────────── Telling people ───────────────────────────

  private activity(tx: Tx, requestId: string, actorId: string | null, kind: string, text: string | null, meta: Record<string, unknown>) {
    return tx.previewActivity.create({ data: { requestId, actorId, kind, text, meta: meta as Prisma.InputJsonValue } });
  }

  private async managerIds(): Promise<string[]> {
    const staff = await this.prisma.user.findMany({ where: { platformRole: { in: ['PLATFORM_ADMIN', 'SUPER_ADMIN'] }, deletedAt: null, status: 'ACTIVE' }, select: { id: true } });
    return staff.map((s) => s.id);
  }

  /** A new request in the open queue: every preview provider's bell. */
  private async tellProviders(request: PreviewRequest): Promise<void> {
    try {
      const providers = await this.prisma.user.findMany({ where: { platformRole: 'PREVIEW_PROVIDER', deletedAt: null, status: 'ACTIVE' }, select: { id: true } });
      if (!providers.length) return;
      await this.prisma.notification.createMany({
        data: providers.map((p) => ({ type: 'PREVIEW_NEW', channel: 'IN_APP', userId: p.id, status: 'DELIVERED', sentAt: new Date(), payload: { requestId: request.id, reference: request.reference, title: previewTitle(request), wants: request.wants } })),
      });
    } catch (error) {
      this.logger.error({ err: error, requestId: request.id }, 'Could not tell the preview providers');
    }
  }

  private async tellAssignee(request: PreviewRequest, userId: string): Promise<void> {
    const payload = { requestId: request.id, reference: request.reference, title: previewTitle(request), wants: request.wants };
    try {
      await this.notifications.notify({ type: 'PREVIEW_ASSIGNED', channel: 'IN_APP', userId, payload });
      await this.notifications.notify({ type: 'PREVIEW_ASSIGNED', channel: 'EMAIL', userId, payload });
    } catch (error) {
      this.logger.error({ err: error, requestId: request.id }, 'Could not tell the preview provider');
    }
  }

  /** "We have your request": by email when they gave one, and on WhatsApp while its template is set. */
  private async acknowledge(request: PreviewRequest): Promise<void> {
    try {
      await this.messages.toPreviewCustomer({ requestId: request.id, type: 'PREVIEW_REQUESTED', phone: request.phone, email: request.email });
    } catch (error) {
      this.logger.error({ err: error, requestId: request.id }, 'Could not acknowledge a preview request');
    }
  }

  /**
   * "Your preview is ready", with the page's link. Previews shared within a
   * minute go in one message (the worker writes it when it sends); by hand,
   * at most every ten minutes.
   */
  private async tellCustomer(requestId: string, byHand: boolean): Promise<{ whatsapp: boolean; email: boolean; queued: boolean }> {
    const request = await this.load(requestId);
    const since = new Date(Date.now() - (byHand ? RESEND_COOLDOWN_MS : READY_DELAY_MS));
    const recent = await this.prisma.notification.findFirst({
      where: { type: 'PREVIEW_READY', payload: { path: ['previewRequestId'], equals: requestId }, OR: [{ status: 'QUEUED' }, { createdAt: { gt: since } }] },
      orderBy: { createdAt: 'desc' },
    });
    if (recent && byHand && recent.createdAt > since) throw new AppError('PREVIEW_TOO_SOON', 'The link was sent a few minutes ago. Try again a little later.');
    if (recent && !byHand) return { whatsapp: false, email: false, queued: true };
    try {
      const sent = await this.messages.toPreviewCustomer({ requestId, type: 'PREVIEW_READY', phone: request.phone, email: request.email, delayMs: byHand ? 0 : READY_DELAY_MS });
      return { ...sent, queued: sent.whatsapp || sent.email };
    } catch (error) {
      this.logger.error({ err: error, requestId }, 'Could not queue the preview link');
      return { whatsapp: false, email: false, queued: false };
    }
  }
}
