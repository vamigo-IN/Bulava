import { Injectable } from '@nestjs/common';
import { Prisma } from '@bulava/database';
import type { z } from '@bulava/validation';
import type { CardLeadsQuerySchema, CardOrdersQuerySchema } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { AuditService } from '../audit/audit.service';
import { CardOrdersService } from './card-orders.service';
import { CardsService } from './cards.service';

const PAGE = 50;
const DAY = 86_400_000;

type LeadsQuery = z.infer<typeof CardLeadsQuerySchema>;
type OrdersQuery = z.infer<typeof CardOrdersQuerySchema>;

const count = (rows: Array<{ n: bigint | number }>) => Number(rows[0]?.n ?? 0);
const rate = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/**
 * The console's view of digital cards (docs/cards.md#console): the funnel from
 * conversions the server recorded (a made card, a downloaded image, a verified
 * payment), never from button clicks alone; leads and orders for support.
 */
@Injectable()
export class CardAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: CardsService,
    private readonly orders: CardOrdersService,
    private readonly audit: AuditService,
  ) {}

  async stats(days: number) {
    const since = new Date(Date.now() - days * DAY);
    const db = this.prisma;
    const [
      selected,
      opened,
      created,
      dialogs,
      newLeads,
      totalLeads,
      consented,
      freeSessions,
      freeLeads,
      freeImages,
      initiated,
      paid,
      planImages,
      paidFromFree,
      pending,
      paymentFailures,
      exportFailures,
      emailFailures,
      daily,
      templates,
      settings,
    ] = await Promise.all([
      db.cardEvent.count({ where: { type: 'TEMPLATE_SELECTED', createdAt: { gte: since } } }),
      db.cardEvent.count({ where: { type: 'EDITOR_OPENED', createdAt: { gte: since } } }),
      db.cardSession.count({ where: { customizedAt: { gte: since } } }),
      db.cardSession.count({ where: { downloadOpenedAt: { gte: since } } }),
      db.cardLead.count({ where: { firstSeenAt: { gte: since } } }),
      db.cardLead.count(),
      db.cardLead.count({ where: { marketingConsentAt: { not: null }, marketingWithdrawnAt: null } }),
      db.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(DISTINCT "sessionId") AS n FROM "card_exports" WHERE "kind" = 'FREE' AND "firstDownloadedAt" >= ${since}`,
      db.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(DISTINCT "leadId") AS n FROM "card_exports" WHERE "kind" = 'FREE' AND "firstDownloadedAt" >= ${since}`,
      db.cardExport.count({ where: { kind: 'FREE', firstDownloadedAt: { gte: since } } }),
      db.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(DISTINCT COALESCE("sessionId"::text, "id"::text)) AS n FROM "card_orders" WHERE "createdAt" >= ${since}`,
      db.cardOrder.aggregate({ where: { paidAt: { gte: since }, status: { in: ['PAID', 'REFUNDED'] } }, _count: true, _sum: { amountMinor: true } }),
      db.cardExport.count({ where: { kind: 'PLAN', firstDownloadedAt: { gte: since } } }),
      // Free-to-paid: contacts who downloaded a free card in the period and bought a card afterwards.
      db.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(DISTINCT e."leadId") AS n FROM "card_exports" e
        JOIN "card_orders" o ON o."leadId" = e."leadId" AND o."status" IN ('PAID', 'REFUNDED') AND o."paidAt" >= e."firstDownloadedAt"
        WHERE e."kind" = 'FREE' AND e."firstDownloadedAt" >= ${since}`,
      db.cardOrder.count({ where: { status: 'PENDING' } }),
      db.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(DISTINCT "orderId") AS n FROM "card_events" WHERE "type" = 'PAYMENT_FAILED' AND "createdAt" >= ${since}`,
      db.cardExport.count({ where: { status: 'FAILED', updatedAt: { gte: since } } }),
      db.cardOrder.count({ where: { status: 'PAID', emailStatus: 'FAILED' } }),
      // Days in Indian time; each table is grouped once, then joined to the calendar.
      db.$queryRaw<Array<{ day: Date; created: bigint; free: bigint; paid: bigint; revenue: bigint | null }>>`
        WITH days AS (
          SELECT generate_series(date_trunc('day', ${since}::timestamptz AT TIME ZONE 'Asia/Kolkata'), date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata'), interval '1 day') AS day
        ), made AS (
          SELECT date_trunc('day', "customizedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS day, COUNT(*) AS n
          FROM "card_sessions" WHERE "customizedAt" >= ${since} GROUP BY 1
        ), free AS (
          SELECT date_trunc('day', "firstDownloadedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS day, COUNT(*) AS n
          FROM "card_exports" WHERE "kind" = 'FREE' AND "firstDownloadedAt" >= ${since} GROUP BY 1
        ), bought AS (
          SELECT date_trunc('day', "paidAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS day, COUNT(*) AS n, SUM("amountMinor") FILTER (WHERE "status" = 'PAID') AS revenue
          FROM "card_orders" WHERE "status" IN ('PAID', 'REFUNDED') AND "paidAt" >= ${since} GROUP BY 1
        )
        SELECT d.day, COALESCE(m.n, 0) AS created, COALESCE(f.n, 0) AS free, COALESCE(b.n, 0) AS paid, b.revenue
        FROM days d LEFT JOIN made m ON m.day = d.day LEFT JOIN free f ON f.day = d.day LEFT JOIN bought b ON b.day = d.day
        ORDER BY d.day`,
      db.$queryRaw<Array<{ templateKey: string; created: bigint; free: bigint; paid: bigint }>>`
        SELECT s."templateKey",
          COUNT(*) FILTER (WHERE s."customizedAt" >= ${since}) AS created,
          COUNT(DISTINCT s."id") FILTER (WHERE EXISTS (SELECT 1 FROM "card_exports" e WHERE e."sessionId" = s."id" AND e."kind" = 'FREE' AND e."firstDownloadedAt" >= ${since})) AS free,
          COUNT(DISTINCT s."id") FILTER (WHERE EXISTS (SELECT 1 FROM "card_orders" o WHERE o."sessionId" = s."id" AND o."status" IN ('PAID', 'REFUNDED') AND o."paidAt" >= ${since})) AS paid
        FROM "card_sessions" s
        WHERE s."lastSeenAt" >= ${since}
        GROUP BY s."templateKey"
        ORDER BY created DESC, paid DESC, free DESC
        LIMIT 10`,
      this.cards.options(),
    ]);
    const named = templates.length ? await db.template.findMany({ where: { key: { in: templates.map((t) => t.templateKey) } }, select: { key: true, name: true, category: true } }) : [];
    const nameOf = new Map(named.map((n) => [n.key, n]));
    const createdCount = created;
    const freeCount = count(freeSessions);
    const paidCount = paid._count;
    const freeLeadCount = count(freeLeads);
    return {
      days,
      settings: { enabled: settings.enabled, priceMinor: settings.priceMinor, planDownloads: settings.planDownloads },
      funnel: {
        templatesSelected: selected,
        editorsOpened: opened,
        cardsCreated: createdCount,
        downloadDialogs: dialogs,
        freeDownloads: freeCount,
        paymentsStarted: count(initiated),
        purchases: paidCount,
      },
      totals: {
        newLeads,
        totalLeads,
        consentedLeads: consented,
        freeImages,
        planDownloads: planImages,
        revenueMinor: paid._sum.amountMinor ?? 0,
        pendingOrders: pending,
      },
      conversion: {
        /** Of the cards made, how many were downloaded free. */
        createdToFree: rate(freeCount, createdCount),
        /** Of the cards made, how many were bought. */
        createdToPaid: rate(paidCount, createdCount),
        /** Of the contacts who downloaded a free card, how many bought one afterwards. */
        freeToPaid: rate(count(paidFromFree), freeLeadCount),
        /** Of the checkouts opened, how many were paid. */
        checkoutToPaid: rate(paidCount, count(initiated)),
      },
      failures: { payments: count(paymentFailures), exports: exportFailures, emails: emailFailures },
      daily: daily.map((d) => ({ day: d.day.toISOString().slice(0, 10), created: Number(d.created), free: Number(d.free), paid: Number(d.paid), revenueMinor: Number(d.revenue ?? 0) })),
      templates: templates.map((t) => ({
        templateKey: t.templateKey,
        name: nameOf.get(t.templateKey)?.name ?? t.templateKey,
        category: nameOf.get(t.templateKey)?.category ?? null,
        created: Number(t.created),
        free: Number(t.free),
        paid: Number(t.paid),
      })),
    };
  }

  // ─────────────────────────── Leads ───────────────────────────

  private leadWhere(query: Pick<LeadsQuery, 'q' | 'consent'>): Prisma.CardLeadWhereInput {
    const q = query.q?.trim();
    const digits = q?.replace(/\D/g, '');
    return {
      ...(query.consent === 'granted' ? { marketingConsentAt: { not: null }, marketingWithdrawnAt: null } : {}),
      ...(query.consent === 'none' ? { OR: [{ marketingConsentAt: null }, { marketingWithdrawnAt: { not: null } }] } : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  ...(digits && digits.length >= 3 ? [{ phoneE164: { contains: digits } }] : []),
                  { email: { contains: q, mode: 'insensitive' as const } },
                  { name: { contains: q, mode: 'insensitive' as const } },
                ],
              },
            ],
          }
        : {}),
    };
  }

  async leads(query: LeadsQuery) {
    const where = this.leadWhere(query);
    const [total, rows] = await Promise.all([
      this.prisma.cardLead.count({ where }),
      this.prisma.cardLead.findMany({
        where,
        orderBy: { lastSeenAt: 'desc' },
        skip: (query.page - 1) * PAGE,
        take: PAGE,
        include: { _count: { select: { sessions: true, exports: { where: { kind: 'FREE', firstDownloadedAt: { not: null } } }, orders: { where: { status: 'PAID' } } } } },
      }),
    ]);
    return {
      total,
      page: query.page,
      pageSize: PAGE,
      leads: rows.map((l) => ({
        id: l.id,
        phone: l.phoneE164,
        countryCode: l.countryCode,
        name: l.name,
        email: l.email,
        offers: Boolean(l.marketingConsentAt && !l.marketingWithdrawnAt),
        lastChoice: l.lastChoice,
        firstSeenAt: l.firstSeenAt,
        lastSeenAt: l.lastSeenAt,
        cards: l._count.sessions,
        freeDownloads: l._count.exports,
        purchases: l._count.orders,
      })),
    };
  }

  async lead(id: string) {
    const lead = await this.prisma.cardLead.findUnique({
      where: { id },
      include: {
        consents: { orderBy: { createdAt: 'desc' }, take: 20 },
        sessions: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, templateKey: true, format: true, eventType: true, createdAt: true, customizedAt: true, lastSeenAt: true } },
        orders: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, reference: true, status: true, amountMinor: true, createdAt: true, paidAt: true, emailStatus: true, templateKey: true } },
        events: { orderBy: { createdAt: 'desc' }, take: 50, select: { type: true, templateKey: true, createdAt: true, meta: true } },
      },
    });
    if (!lead) throw AppError.notFound('Contact');
    return { ...lead, offers: Boolean(lead.marketingConsentAt && !lead.marketingWithdrawnAt) };
  }

  /** The marketing list: only contacts who ticked offers on WhatsApp and never withdrew. */
  async consentedCsv(staffId: string, meta: RequestMeta): Promise<string> {
    const rows = await this.prisma.cardLead.findMany({ where: { marketingConsentAt: { not: null }, marketingWithdrawnAt: null }, orderBy: { marketingConsentAt: 'asc' } });
    await this.audit.record({ actorType: 'USER', actorId: staffId, action: 'card_leads.exported', targetType: 'CardLead', metadata: { rows: rows.length }, meta });
    const cell = (v: string | null | undefined) => {
      const s = v ?? '';
      // Quote everything, and keep spreadsheet formulas from running.
      return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
    };
    const header = ['phone', 'country_code', 'national_number', 'name', 'email', 'offers_consented_at', 'last_seen_at'];
    const lines = rows.map((l) => [l.phoneE164, l.countryCode, l.nationalNumber, l.name, l.email, l.marketingConsentAt?.toISOString(), l.lastSeenAt.toISOString()].map(cell).join(','));
    return [header.join(','), ...lines].join('\r\n');
  }

  /** A contact asked to stop offers: recorded as a withdrawn consent. */
  async withdrawConsent(id: string, staffId: string, meta: RequestMeta) {
    const lead = await this.prisma.cardLead.findUnique({ where: { id } });
    if (!lead) throw AppError.notFound('Contact');
    if (!lead.marketingConsentAt || lead.marketingWithdrawnAt) return { offers: false };
    await this.prisma.$transaction(async (tx) => {
      await tx.cardLead.update({ where: { id }, data: { marketingWithdrawnAt: new Date() } });
      await tx.consent.create({ data: { cardLeadId: id, kind: 'whatsapp_offers', granted: false, version: 'whatsapp_offers@1', source: 'console' } });
      await this.audit.record({ actorType: 'USER', actorId: staffId, action: 'card_lead.offers_withdrawn', targetType: 'CardLead', targetId: id, meta }, tx);
    });
    return { offers: false };
  }

  // ─────────────────────────── Orders ───────────────────────────

  async orderList(query: OrdersQuery) {
    const q = query.q?.trim();
    const digits = q?.replace(/\D/g, '');
    const where: Prisma.CardOrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.emailFailed ? { status: 'PAID', emailStatus: 'FAILED' } : {}),
      ...(q
        ? {
            OR: [
              { reference: { contains: q.toUpperCase() } },
              { email: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              ...(digits && digits.length >= 3 ? [{ phoneE164: { contains: digits } }] : []),
              { providerPaymentId: q },
            ],
          }
        : {}),
    };
    const [total, rows, totals] = await Promise.all([
      this.prisma.cardOrder.count({ where }),
      this.prisma.cardOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * PAGE,
        take: PAGE,
        select: { id: true, reference: true, status: true, amountMinor: true, currency: true, name: true, email: true, phoneE164: true, templateKey: true, format: true, emailStatus: true, createdAt: true, paidAt: true, providerPaymentId: true, failureReason: true },
      }),
      this.prisma.cardOrder.groupBy({ by: ['status'], _count: true, _sum: { amountMinor: true } }),
    ]);
    return {
      total,
      page: query.page,
      pageSize: PAGE,
      totals: Object.fromEntries(totals.map((t) => [t.status, { count: t._count, amountMinor: t._sum.amountMinor ?? 0 }])),
      orders: rows,
    };
  }

  async order(id: string) {
    const order = await this.prisma.cardOrder.findUnique({
      where: { id },
      include: {
        exports: { orderBy: { createdAt: 'desc' }, select: { id: true, status: true, attempts: true, error: true, readyAt: true, downloads: true, firstDownloadedAt: true, expiresAt: true, createdAt: true } },
        events: { orderBy: { createdAt: 'asc' }, select: { type: true, createdAt: true, meta: true } },
        lead: { select: { id: true, phoneE164: true, marketingConsentAt: true, marketingWithdrawnAt: true } },
      },
    });
    if (!order) throw AppError.notFound('Order');
    const { design: _design, tokenHash: _token, ...rest } = order;
    return { ...rest, orderUrl: order.status === 'PAID' ? this.orders.orderUrl(order.id) : null };
  }

  private async paidOrder(id: string) {
    const order = await this.prisma.cardOrder.findUnique({ where: { id } });
    if (!order) throw AppError.notFound('Order');
    return order;
  }

  async resendEmail(id: string, staffId: string, meta: RequestMeta) {
    const order = await this.paidOrder(id);
    const result = await this.orders.sendEmail(order);
    await this.audit.record({ actorType: 'USER', actorId: staffId, action: 'card_order.email_resent', targetType: 'CardOrder', targetId: id, metadata: { reference: order.reference }, meta });
    return result;
  }

  async regenerate(id: string, staffId: string, meta: RequestMeta) {
    const order = await this.paidOrder(id);
    const result = await this.orders.regenerateOrder(order);
    await this.audit.record({ actorType: 'USER', actorId: staffId, action: 'card_order.regenerated', targetType: 'CardOrder', targetId: id, metadata: { reference: order.reference }, meta });
    return result;
  }
}
