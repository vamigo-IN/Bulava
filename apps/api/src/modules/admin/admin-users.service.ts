import { Inject, Injectable } from '@nestjs/common';
import { ASSIGNABLE_PLATFORM_ROLES, platformRoleHasPermission } from '@bulava/auth';
import type { Prisma } from '@bulava/database';
import { z } from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { AuthUser } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { MfaService } from '../auth/mfa.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';

const ALL_ROLES = ['USER', 'SUPPORT', 'CONTENT_MANAGER', 'FINANCE_MANAGER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'] as const;

export const UsersQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  role: z.enum([...ALL_ROLES, 'STAFF']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
});
export const UpdateUserSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  /** Changing a role needs staff.manage (the Super Admin). SUPER_ADMIN is never assignable: it is handed over. */
  platformRole: z.enum(ASSIGNABLE_PLATFORM_ROLES).optional(),
});
export const ConfirmIdentitySchema = z.object({ password: z.string().min(1).max(200), code: z.string().trim().max(20).optional() });
export const TransferSuperAdminSchema = ConfirmIdentitySchema.extend({ userId: z.uuid() });
export const GrantPlanSchema = z.object({
  planKey: z.string().trim().min(1).max(40),
  /** Required for per-event plans; omitted for account (yearly) plans. */
  eventId: z.uuid().optional(),
  note: z.string().trim().min(3).max(300),
});
export const RevokeGrantSchema = z.object({ note: z.string().trim().min(3).max(300) });
export const OrdersQuerySchema = z.object({
  status: z.enum(['CREATED', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED', 'ABANDONED']).optional(),
  kind: z.enum(['PURCHASE', 'ADMIN_GRANT']).optional(),
  q: z.string().trim().max(80).optional(),
  userId: z.uuid().optional(),
});

/** A checkout nobody finished within this time is shown as abandoned. */
const ABANDONED_AFTER_MS = 60 * 60 * 1000;

const PAYMENT_FIELDS = { provider: true, providerPaymentId: true, status: true, amountMinor: true, verifiedAt: true, createdAt: true } satisfies Prisma.PaymentSelect;

/** What a payment status means to a person reading the console. */
export function paymentState(order: { status: string; kind: string; createdAt: Date; amountMinor: number }): string {
  if (order.kind === 'ADMIN_GRANT') return order.status === 'PAID' ? 'COMPLIMENTARY' : 'REVOKED';
  if (order.status === 'CREATED') return Date.now() - order.createdAt.getTime() > ABANDONED_AFTER_MS ? 'ABANDONED' : 'AWAITING_PAYMENT';
  if (order.status === 'PAID' && order.amountMinor === 0) return 'PAID_WITH_COUPON';
  return order.status;
}

/**
 * Customers and staff in the admin console: full profiles, staff roles
 * (the Super Admin alone), handing over the Super Admin role, and
 * complimentary plan upgrades.
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mfa: MfaService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  list(query: z.infer<typeof UsersQuerySchema>) {
    const where: Prisma.UserWhereInput = {
      ...(query.q ? { OR: [{ email: { contains: query.q, mode: 'insensitive' } }, { name: { contains: query.q, mode: 'insensitive' } }, { phone: { contains: query.q } }] } : {}),
      ...(query.role === 'STAFF' ? { platformRole: { not: 'USER' } } : query.role ? { platformRole: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        platformRole: true,
        totpEnabledAt: true,
        createdAt: true,
        _count: { select: { ownedEvents: true, orders: true } },
      },
      orderBy: [{ platformRole: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  /** Everything about one person. Payment details only for staff with billing.read. */
  async profile(actor: AuthUser, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        platformRole: true,
        locale: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        googleSub: true,
        totpEnabledAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });
    if (!user) throw AppError.notFound('User');
    const billing = platformRoleHasPermission(actor.platformRole, 'billing.read');
    const now = new Date();
    const [events, memberships, sessions, entitlements, orders, activity, lastSession] = await Promise.all([
      this.prisma.event.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          title: true,
          typeKey: true,
          status: true,
          slug: true,
          createdAt: true,
          deletedAt: true,
          _count: { select: { guests: true, invitations: true, videoJobs: true, functions: true } },
          templateSelections: { select: { output: true, updatedAt: true, templateVersion: { select: { version: true, template: { select: { key: true, name: true, tier: true } } } } } },
          videoJobs: { select: { status: true, createdAt: true, templateVersion: { select: { template: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' }, take: 5 },
          domain: { select: { hostname: true, status: true } },
        },
      }),
      this.prisma.eventMember.findMany({ where: { userId, event: { ownerId: { not: userId } } }, select: { role: true, event: { select: { id: true, title: true, status: true } } }, take: 50 }),
      this.prisma.session.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: now } },
        orderBy: { lastUsedAt: 'desc' },
        take: 20,
        select: { id: true, createdAt: true, lastUsedAt: true, userAgent: true, ipAddress: true, mfa: true },
      }),
      this.prisma.entitlement.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 300 }),
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { plan: { select: { key: true, name: true } }, coupon: { select: { code: true } }, payments: { select: PAYMENT_FIELDS, orderBy: { createdAt: 'asc' } } },
      }),
      this.prisma.auditLog.findMany({ where: { OR: [{ actorId: userId }, { targetId: userId }] }, orderBy: { createdAt: 'desc' }, take: 40 }),
      this.prisma.session.findFirst({ where: { userId }, orderBy: { lastUsedAt: 'desc' }, select: { lastUsedAt: true } }),
    ]);

    const eventIds = events.map((e) => e.id);
    const photos = eventIds.length ? await this.prisma.mediaItem.groupBy({ by: ['eventId'], where: { eventId: { in: eventIds }, status: 'APPROVED' }, _count: { _all: true } }) : [];
    const photoCount = new Map(photos.map((p) => [p.eventId, p._count._all]));
    const orderEventIds = [...new Set(orders.map((o) => o.eventId).filter((id): id is string => Boolean(id)))];
    const titles = new Map((await this.prisma.event.findMany({ where: { id: { in: orderEventIds } }, select: { id: true, title: true } })).map((e) => [e.id, e.title]));
    const granters = new Map(
      (await this.prisma.user.findMany({ where: { id: { in: orders.map((o) => o.grantedById).filter((id): id is string => Boolean(id)) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]),
    );
    // The plan each event is on: its latest paid or granted order.
    const planFor = (eventId: string | null) => orders.find((o) => o.eventId === eventId && o.status === 'PAID')?.plan.name ?? null;
    const active = (e: { validUntil: Date | null; validFrom: Date }) => e.validFrom <= now && (!e.validUntil || e.validUntil > now);
    const paid = orders.filter((o) => o.status === 'PAID' && o.kind === 'PURCHASE');

    return {
      user: {
        ...user,
        googleSub: undefined,
        googleLinked: Boolean(user.googleSub),
        mfaEnabled: Boolean(user.totpEnabledAt),
        lastActiveAt: lastSession?.lastUsedAt ?? null,
      },
      summary: {
        events: events.filter((e) => !e.deletedAt).length,
        guests: events.reduce((sum, e) => sum + e._count.guests, 0),
        invitations: events.reduce((sum, e) => sum + e._count.invitations, 0),
        photos: [...photoCount.values()].reduce((a, b) => a + b, 0),
        videos: events.reduce((sum, e) => sum + e._count.videoJobs, 0),
        ...(billing ? { paidOrders: paid.length, totalPaidMinor: paid.reduce((sum, o) => sum + o.amountMinor, 0), currency: paid[0]?.currency ?? 'INR' } : {}),
        accountPlan: planFor(null),
      },
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        typeKey: e.typeKey,
        status: e.deletedAt ? 'DELETED' : e.status,
        slug: e.slug,
        createdAt: e.createdAt,
        counts: { ...e._count, photos: photoCount.get(e.id) ?? 0 },
        plan: planFor(e.id) ?? 'Free',
        templates: e.templateSelections.map((s) => ({
          output: s.output,
          key: s.templateVersion.template.key,
          name: s.templateVersion.template.name,
          tier: s.templateVersion.template.tier,
          version: s.templateVersion.version,
          chosenAt: s.updatedAt,
        })),
        videos: e.videoJobs.map((v) => ({ template: v.templateVersion.template.name, status: v.status, createdAt: v.createdAt })),
        domain: e.domain,
      })),
      memberships: memberships.map((m) => ({ role: m.role, event: m.event })),
      entitlements: entitlements.map((e) => ({
        featureKey: e.featureKey,
        enabled: e.enabled,
        limit: e.limit,
        used: e.used,
        eventId: e.eventId,
        eventTitle: e.eventId ? (events.find((x) => x.id === e.eventId)?.title ?? titles.get(e.eventId) ?? null) : null,
        sourceType: e.sourceType,
        validFrom: e.validFrom,
        validUntil: e.validUntil,
        active: active(e),
      })),
      orders: billing
        ? orders.map((o) => ({
            id: o.id,
            kind: o.kind,
            plan: o.plan,
            eventId: o.eventId,
            eventTitle: o.eventId ? (titles.get(o.eventId) ?? null) : null,
            amountMinor: o.amountMinor,
            currency: o.currency,
            status: o.status,
            state: paymentState(o),
            coupon: o.coupon?.code ?? null,
            note: o.note,
            grantedBy: o.grantedById ? (granters.get(o.grantedById) ?? null) : null,
            providerOrderId: o.providerOrderId,
            createdAt: o.createdAt,
            payments: o.payments.map((p) => ({ provider: p.provider, providerPaymentId: p.providerPaymentId, status: p.status, amountMinor: p.amountMinor, verifiedAt: p.verifiedAt, createdAt: p.createdAt })),
          }))
        : null,
      sessions,
      activity: activity.map((a) => ({ id: a.id, action: a.action, actorId: a.actorId, byThisUser: a.actorId === userId, targetType: a.targetType, result: a.result, createdAt: a.createdAt, ipAddress: a.ipAddress })),
    };
  }

  /** Suspend or reactivate (user.manage), or change a staff role (staff.manage). The Super Admin is untouchable here. */
  async update(actor: AuthUser, userId: string, input: z.infer<typeof UpdateUserSchema>, meta: RequestMeta) {
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, platformRole: true, status: true, deletedAt: true } });
    if (!target || target.deletedAt) throw AppError.notFound('User');
    if (target.platformRole === 'SUPER_ADMIN') throw new AppError('SUPER_ADMIN_PROTECTED', 'The Super Admin cannot be changed or suspended. They can hand the role over from Staff & roles.');
    if (userId === actor.id) throw new AppError('BAD_REQUEST', 'You cannot change your own account here.');
    const staffManager = platformRoleHasPermission(actor.platformRole, 'staff.manage');
    if (input.platformRole !== undefined && !staffManager) throw AppError.forbidden('Only the Super Admin can change staff roles.');
    if (input.status === 'SUSPENDED' && target.platformRole !== 'USER' && !staffManager) throw AppError.forbidden('Only the Super Admin can suspend staff.');
    const user = await this.prisma.user.update({ where: { id: userId }, data: input });
    if (input.status === 'SUSPENDED') await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.record({
      actorType: 'USER',
      actorId: actor.id,
      action: input.platformRole && input.platformRole !== target.platformRole ? 'staff.role_changed' : 'admin.user_updated',
      targetType: 'User',
      targetId: userId,
      metadata: { ...input, previousRole: target.platformRole },
      meta,
    });
    return { id: user.id, status: user.status, platformRole: user.platformRole };
  }

  /**
   * Hand the Super Admin role to another person. The current Super Admin
   * confirms with their password (and two-step code), becomes a Platform admin,
   * and the database guarantees there is only ever one Super Admin.
   */
  async transferSuperAdmin(actor: AuthUser, input: z.infer<typeof TransferSuperAdminSchema>, meta: RequestMeta) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { platformRole: true } });
    if (me.platformRole !== 'SUPER_ADMIN') throw AppError.forbidden('Only the Super Admin can hand over the role.');
    if (input.userId === actor.id) throw new AppError('BAD_REQUEST', 'Choose someone else.');
    const target = await this.prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, name: true, email: true, status: true, deletedAt: true, totpEnabledAt: true } });
    if (!target || target.deletedAt || target.status !== 'ACTIVE' || !target.email) throw new AppError('BAD_REQUEST', 'The new Super Admin must be an active account with an email address.');
    if (this.config.staffMfaRequired && !target.totpEnabledAt) throw new AppError('BAD_REQUEST', `${target.name} must turn on two-step sign-in (Account → Security) before taking over.`);
    await this.mfa.confirmSensitiveAction(actor.id, input, meta);
    await this.prisma.$transaction(async (tx) => {
      // Demote first: the unique index allows one SUPER_ADMIN at any moment.
      await tx.user.update({ where: { id: actor.id }, data: { platformRole: 'PLATFORM_ADMIN' } });
      await tx.user.update({ where: { id: target.id }, data: { platformRole: 'SUPER_ADMIN' } });
      await this.audit.record({ actorType: 'USER', actorId: actor.id, action: 'staff.super_admin_transferred', targetType: 'User', targetId: target.id, metadata: { from: actor.id, to: target.id }, meta }, tx);
    });
    return { superAdminId: target.id };
  }

  /** For a staff member locked out of their authenticator: they set it up again at next sign-in. */
  async resetTwoStep(actor: AuthUser, userId: string, input: z.infer<typeof ConfirmIdentitySchema>, meta: RequestMeta) {
    if (userId === actor.id) throw new AppError('BAD_REQUEST', 'Manage your own two-step sign-in from Security.');
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, totpEnabledAt: true } });
    if (!target) throw AppError.notFound('User');
    if (!target.totpEnabledAt) throw new AppError('MFA_NOT_ENABLED', 'Two-step sign-in is not on for this account.');
    await this.mfa.confirmSensitiveAction(actor.id, input, meta);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { totpSecretCiphertext: null, totpEnabledAt: null, totpLastStep: null } });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.record({ actorType: 'USER', actorId: actor.id, action: 'staff.mfa_reset', targetType: 'User', targetId: userId, meta }, tx);
    });
    return { reset: true };
  }

  /** Sign someone out everywhere. Staff sessions only by the Super Admin. */
  async revokeSessions(actor: AuthUser, userId: string, meta: RequestMeta) {
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
    if (!target) throw AppError.notFound('User');
    if (target.platformRole !== 'USER' && !platformRoleHasPermission(actor.platformRole, 'staff.manage')) throw AppError.forbidden('Only the Super Admin can sign staff out.');
    const { count } = await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.record({ actorType: 'USER', actorId: actor.id, action: 'admin.sessions_revoked', targetType: 'User', targetId: userId, metadata: { count }, meta });
    return { revoked: count };
  }

  /**
   * Complimentary upgrade by the Super Admin: recorded as a zero-amount order
   * (kind ADMIN_GRANT, with the reason), so it shows in payment history and
   * grants exactly the same entitlements as a purchase.
   */
  async grantPlan(actor: AuthUser, userId: string, input: z.infer<typeof GrantPlanSchema>, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, deletedAt: true } });
    if (!user || user.deletedAt) throw AppError.notFound('User');
    const plan = await this.prisma.pricingPlan.findUnique({ where: { key: input.planKey }, include: { features: true } });
    if (!plan) throw AppError.notFound('Plan');
    if (plan.interval === 'ONE_TIME') {
      if (!input.eventId) throw new AppError('BAD_REQUEST', 'Choose the event to upgrade.');
      const event = await this.prisma.event.findFirst({ where: { id: input.eventId, ownerId: userId, deletedAt: null }, select: { id: true } });
      if (!event) throw new AppError('BAD_REQUEST', 'That event does not belong to this person.');
    } else if (input.eventId) {
      throw new AppError('BAD_REQUEST', 'This plan applies to the whole account, not one event.');
    }
    const eventId = plan.interval === 'ONE_TIME' ? (input.eventId ?? null) : null;
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: { userId, eventId, planId: plan.id, amountMinor: 0, currency: plan.currency, status: 'PAID', kind: 'ADMIN_GRANT', note: input.note, grantedById: actor.id },
      });
      await tx.payment.create({ data: { orderId: created.id, provider: 'ADMIN', providerPaymentId: `admin-${created.id}`, status: 'CAPTURED', amountMinor: 0, verifiedAt: new Date() } });
      await this.payments.grant(tx, { ...created, plan });
      await this.audit.record(
        { actorType: 'USER', actorId: actor.id, action: 'plan.granted', targetType: 'Order', targetId: created.id, eventId, metadata: { userId, plan: plan.key, note: input.note }, meta },
        tx,
      );
      return created;
    });
    await this.notifications.notify({ type: 'PAYMENT', channel: 'IN_APP', userId, eventId, payload: { orderId: order.id, plan: plan.name, amountMinor: 0, complimentary: true } });
    return { orderId: order.id, plan: plan.name, eventId };
  }

  /** Undo a complimentary upgrade: its entitlements end now. Paid orders are refunded instead. */
  async revokeGrant(actor: AuthUser, orderId: string, input: z.infer<typeof RevokeGrantSchema>, meta: RequestMeta) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.kind !== 'ADMIN_GRANT') throw AppError.notFound('Complimentary upgrade');
    if (order.status !== 'PAID') throw new AppError('CONFLICT', 'This upgrade was already revoked.');
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED', note: `${order.note ?? ''}\nRevoked: ${input.note}`.trim() } });
      await tx.entitlement.updateMany({ where: { sourceType: 'ORDER', sourceId: orderId }, data: { validUntil: new Date() } });
      await this.audit.record({ actorType: 'USER', actorId: actor.id, action: 'plan.grant_revoked', targetType: 'Order', targetId: orderId, eventId: order.eventId, metadata: { note: input.note }, meta }, tx);
    });
    return { revoked: true };
  }

  /** Orders with a readable payment state; filters for the console. */
  async orders(query: z.infer<typeof OrdersQuerySchema>) {
    const abandonedBefore = new Date(Date.now() - ABANDONED_AFTER_MS);
    const where: Prisma.OrderWhereInput = {
      ...(query.status === 'ABANDONED'
        ? { status: 'CREATED', createdAt: { lt: abandonedBefore } }
        : query.status === 'CREATED'
          ? { status: 'CREATED', createdAt: { gte: abandonedBefore } }
          : query.status
            ? { status: query.status }
            : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.q ? { user: { OR: [{ email: { contains: query.q, mode: 'insensitive' } }, { name: { contains: query.q, mode: 'insensitive' } }] } } : {}),
    };
    const [rows, totals] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          plan: { select: { key: true, name: true } },
          user: { select: { id: true, email: true, name: true } },
          coupon: { select: { code: true } },
          // Never the raw gateway payloads: the console needs the reference and state only.
          payments: { select: PAYMENT_FIELDS, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      this.prisma.order.groupBy({ by: ['status'], where: { kind: 'PURCHASE' }, _count: { _all: true }, _sum: { amountMinor: true } }),
    ]);
    const eventIds = [...new Set(rows.map((o) => o.eventId).filter((id): id is string => Boolean(id)))];
    const granterIds = [...new Set(rows.map((o) => o.grantedById).filter((id): id is string => Boolean(id)))];
    const [events, granters] = await Promise.all([
      eventIds.length ? this.prisma.event.findMany({ where: { id: { in: eventIds } }, select: { id: true, title: true } }) : [],
      granterIds.length ? this.prisma.user.findMany({ where: { id: { in: granterIds } }, select: { id: true, name: true } }) : [],
    ]);
    const titles = new Map(events.map((e) => [e.id, e.title]));
    const names = new Map(granters.map((u) => [u.id, u.name]));
    return {
      orders: rows.map((o) => ({
        ...o,
        state: paymentState(o),
        eventTitle: o.eventId ? (titles.get(o.eventId) ?? null) : null,
        grantedBy: o.grantedById ? (names.get(o.grantedById) ?? null) : null,
      })),
      totals: Object.fromEntries(totals.map((t) => [t.status, { count: t._count._all, amountMinor: t._sum.amountMinor ?? 0 }])),
    };
  }

  /** Staff (everyone who is not a plain user), with the permissions each role carries. */
  async staff() {
    const people = await this.prisma.user.findMany({
      where: { platformRole: { not: 'USER' }, deletedAt: null },
      select: { id: true, name: true, email: true, status: true, platformRole: true, totpEnabledAt: true, createdAt: true },
      orderBy: [{ platformRole: 'desc' }, { name: 'asc' }],
    });
    return { people: people.map((p) => ({ ...p, mfaEnabled: Boolean(p.totpEnabledAt), totpEnabledAt: undefined })), staffMfaRequired: this.config.staffMfaRequired };
  }
}
