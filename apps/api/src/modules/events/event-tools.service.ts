import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@bulava/database';
import { isLinkMode } from '@bulava/auth';
import { slugify, z } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { AudienceService } from '../audience/audience.service';
import { openRegistrationByDefault } from '../registrations/registration-defaults';
import { newPreviewToken } from './events.service';
import { ShareLinkService } from './share-link.service';

export const CloneEventSchema = z.object({
  title: z.string().trim().min(1).max(160),
  functions: z.boolean().default(true),
  groups: z.boolean().default(true),
  settings: z.boolean().default(true),
  templates: z.boolean().default(true),
});
export type CloneEventInput = z.infer<typeof CloneEventSchema>;

export const EXPORT_KINDS = ['guests', 'rsvps', 'invitations', 'attendance', 'media', 'travel', 'stays', 'seating'] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

/** RFC 4180 CSV with spreadsheet formula-injection protection. */
export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}

/** "2026-12-14 16:35" in the event's time zone, for people reading a sheet on site. */
export function localDateTime(value: Date | null, timeZone: string): string {
  if (!value) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(value)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

@Injectable()
export class EventToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly audience: AudienceService,
    private readonly shareLinks: ShareLinkService,
  ) {}

  /** Clone an event's structure for planners. Guests are never cloned. */
  async clone(access: EventAccessContext, input: CloneEventInput, meta: RequestMeta) {
    const source = await this.prisma.event.findFirstOrThrow({
      where: { id: access.eventId, deletedAt: null },
      include: {
        accessPolicy: true,
        groups: true,
        functions: { where: { deletedAt: null }, include: { venue: true, accessPolicy: true, audienceGroups: true } },
        templateSelections: true,
        rsvpQuestions: true,
      },
    });
    // A copy starts as a draft: the plan is asked for when it is published (ADR-054).
    const created = await this.prisma.$transaction(async (tx) => {
      const policy = await tx.accessPolicy.create({ data: { mode: source.accessPolicy.mode, requireOtp: source.accessPolicy.requireOtp } });
      const event = await tx.event.create({
        data: {
          ownerId: access.userId,
          organizationId: source.organizationId,
          typeKey: source.typeKey,
          title: input.title,
          slug: `${slugify(input.title) || 'event'}-${randomBytes(3).toString('hex')}`,
          previewToken: newPreviewToken(),
          description: source.description,
          language: source.language,
          timezone: source.timezone,
          visibility: source.visibility,
          accessPolicyId: policy.id,
          details: input.settings ? (source.details as Prisma.InputJsonValue) : {},
          settings: input.settings ? (source.settings as Prisma.InputJsonValue) : {},
          members: { create: { userId: access.userId, role: 'OWNER' } },
        },
      });
      const groupMap = new Map<string, string>();
      const groups = input.groups ? source.groups : source.groups.filter((g) => g.kind === 'SYSTEM');
      for (const g of groups) {
        const ng = await tx.guestGroup.create({ data: { eventId: event.id, name: g.name, slug: g.slug, description: g.description, kind: g.kind, color: g.color, sortOrder: g.sortOrder } });
        groupMap.set(g.id, ng.id);
      }
      if (input.functions) {
        for (const f of source.functions) {
          const venue = f.venue
            ? await tx.venue.create({ data: { eventId: event.id, name: f.venue.name, address: f.venue.address, city: f.venue.city, mapUrl: f.venue.mapUrl, country: f.venue.country } })
            : null;
          const fpolicy = f.accessPolicy ? await tx.accessPolicy.create({ data: { mode: f.accessPolicy.mode } }) : null;
          await tx.eventFunction.create({
            data: {
              eventId: event.id,
              name: f.name,
              slug: f.slug,
              description: f.description,
              venueId: venue?.id ?? null,
              visibility: f.visibility,
              accessPolicyId: fpolicy?.id ?? null,
              status: f.status === 'COMPLETED' ? 'SCHEDULED' : f.status,
              sortOrder: f.sortOrder,
              settings: f.settings as Prisma.InputJsonValue,
              audienceGroups: { create: f.audienceGroups.filter((a) => groupMap.has(a.groupId)).map((a) => ({ groupId: groupMap.get(a.groupId)! })) },
            },
          });
        }
      }
      if (input.templates) {
        for (const s of source.templateSelections) {
          await tx.eventTemplateSelection.create({ data: { eventId: event.id, output: s.output, templateVersionId: s.templateVersionId, customization: s.customization as Prisma.InputJsonValue } });
        }
        for (const q of source.rsvpQuestions.filter((q) => q.functionId === null)) {
          await tx.rSVPQuestion.create({ data: { eventId: event.id, key: q.key, label: q.label as Prisma.InputJsonValue, type: q.type, options: q.options as Prisma.InputJsonValue, required: q.required, sortOrder: q.sortOrder } });
        }
      }
      // The copy is shared like a new event: its own secret link, registration open.
      if (isLinkMode(source.accessPolicy.mode)) await openRegistrationByDefault(tx, event.id, { always: true });
      if (source.accessPolicy.mode === 'SECRET_TOKEN') await this.shareLinks.ensureSecretLink(tx, event.id);
      await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'event.cloned', targetType: 'Event', targetId: event.id, eventId: event.id, metadata: { from: source.id }, meta }, tx);
      return event;
    });
    return { id: created.id, slug: created.slug };
  }

  async exportCsv(access: EventAccessContext, kind: ExportKind, meta: RequestMeta): Promise<{ filename: string; csv: string }> {
    const event = await this.prisma.event.findFirstOrThrow({ where: { id: access.eventId }, select: { slug: true, timezone: true } });
    const local = (d: Date | null) => localDateTime(d, event.timezone);
    let csv: string;
    if (kind === 'guests') {
      const guests = await this.prisma.guest.findMany({
        where: { eventId: access.eventId, deletedAt: null },
        include: { groups: { include: { group: { select: { name: true } } } } },
        orderBy: { name: 'asc' },
      });
      const [facts, guestFacts, fns] = await Promise.all([
        this.audience.loadEventFacts(access.eventId),
        this.audience.loadGuestFacts(access.eventId),
        this.prisma.eventFunction.findMany({ where: { eventId: access.eventId, deletedAt: null }, select: { id: true, name: true } }),
      ]);
      const byGuest = new Map(guestFacts.map((g) => [g.guestId, g]));
      const names = new Map(fns.map((f) => [f.id, f.name]));
      csv = toCsv(
        guests.map((g) => {
          const f = byGuest.get(g.id);
          const matrix = f ? AudienceService.accessMatrix(facts, f) : new Map();
          return {
            name: g.name,
            phone: g.phone,
            email: g.email,
            groups: g.groups.map((x) => x.group.name).join('; '),
            functions: [...matrix].filter(([, d]) => d.allowed).map(([id]) => names.get(id)).join('; '),
            notes: g.notes,
          };
        }),
        ['name', 'phone', 'email', 'groups', 'functions', 'notes'],
      );
    } else if (kind === 'rsvps') {
      const rows = await this.prisma.rSVP.findMany({
        where: { eventId: access.eventId, guest: { deletedAt: null } },
        include: { guest: { select: { name: true, phone: true } }, function: { select: { name: true } }, answers: { include: { question: { select: { key: true } } } } },
        orderBy: { respondedAt: 'desc' },
      });
      csv = toCsv(
        rows.map((r) => ({
          guest: r.guest.name,
          phone: r.guest.phone,
          function: r.function?.name ?? 'Event',
          status: r.status,
          attendees: r.attendeeCount,
          answers: r.answers.map((a) => `${a.question.key}=${Array.isArray(a.value) ? (a.value as unknown[]).join('|') : String(a.value)}`).join('; '),
          message: r.message,
          respondedAt: r.respondedAt,
        })),
        ['guest', 'phone', 'function', 'status', 'attendees', 'answers', 'message', 'respondedAt'],
      );
    } else if (kind === 'invitations') {
      const rows = await this.prisma.invitation.findMany({
        where: { eventId: access.eventId },
        include: { guest: { select: { name: true } }, function: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      });
      csv = toCsv(
        rows.map((r) => ({ guest: r.guest.name, scope: r.function?.name ?? 'All functions', status: r.status, sentAt: r.sentAt, openedAt: r.openedAt, respondedAt: r.acceptedAt ?? r.declinedAt })),
        ['guest', 'scope', 'status', 'sentAt', 'openedAt', 'respondedAt'],
      );
    } else if (kind === 'attendance') {
      const rows = await this.prisma.checkIn.findMany({
        where: { eventId: access.eventId },
        include: { guest: { select: { name: true } }, function: { select: { name: true } } },
        orderBy: { checkedInAt: 'asc' },
      });
      csv = toCsv(
        rows.map((r) => ({ guest: r.guest.name, function: r.function?.name ?? 'Event', headcount: r.headcount, checkedInAt: r.checkedInAt, method: r.method })),
        ['guest', 'function', 'headcount', 'checkedInAt', 'method'],
      );
    } else if (kind === 'travel') {
      // Transport desk sheet: arrivals and departures in time order.
      const rows = await this.prisma.guestTravel.findMany({
        where: { eventId: access.eventId, guest: { deletedAt: null } },
        include: { guest: { select: { name: true, phone: true, isVip: true } } },
        orderBy: [{ direction: 'asc' }, { at: 'asc' }],
      });
      csv = toCsv(
        rows.map((r) => ({
          direction: r.direction,
          time: local(r.at),
          guest: r.guest.name,
          phone: r.guest.phone,
          vip: r.guest.isVip ? 'yes' : '',
          travellers: r.travellers,
          mode: r.mode,
          carrier: r.carrier,
          reference: r.reference,
          place: r.place,
          pickup: r.pickupRequested ? 'yes' : '',
          pickupNote: r.pickupNote,
          enteredBy: r.enteredByGuest ? 'guest' : 'host',
        })),
        ['direction', 'time', 'guest', 'phone', 'vip', 'travellers', 'mode', 'carrier', 'reference', 'place', 'pickup', 'pickupNote', 'enteredBy'],
      );
    } else if (kind === 'stays') {
      const rows = await this.prisma.guestStay.findMany({
        where: { eventId: access.eventId, guest: { deletedAt: null } },
        include: { guest: { select: { name: true, phone: true, isVip: true, dietary: true } } },
        orderBy: [{ hotelName: 'asc' }, { roomNumber: 'asc' }],
      });
      csv = toCsv(
        rows.map((r) => ({
          hotel: r.hotelName,
          room: r.roomNumber,
          roomType: r.roomType,
          guest: r.guest.name,
          phone: r.guest.phone,
          vip: r.guest.isVip ? 'yes' : '',
          dietary: r.guest.dietary,
          checkIn: local(r.checkInAt),
          checkOut: local(r.checkOutAt),
          notes: r.notes,
        })),
        ['hotel', 'room', 'roomType', 'guest', 'phone', 'vip', 'dietary', 'checkIn', 'checkOut', 'notes'],
      );
    } else if (kind === 'seating') {
      const rows = await this.prisma.seatAssignment.findMany({
        where: { eventId: access.eventId, guest: { deletedAt: null }, function: { deletedAt: null } },
        include: { guest: { select: { name: true, isVip: true, dietary: true } }, function: { select: { name: true, sortOrder: true } } },
      });
      rows.sort(
        (a, b) =>
          a.function.sortOrder - b.function.sortOrder ||
          a.tableLabel.localeCompare(b.tableLabel, 'en', { numeric: true }) ||
          (a.seatLabel ?? '').localeCompare(b.seatLabel ?? '', 'en', { numeric: true }) ||
          a.guest.name.localeCompare(b.guest.name),
      );
      csv = toCsv(
        rows.map((r) => ({ function: r.function.name, table: r.tableLabel, seat: r.seatLabel, guest: r.guest.name, vip: r.guest.isVip ? 'yes' : '', dietary: r.guest.dietary })),
        ['function', 'table', 'seat', 'guest', 'vip', 'dietary'],
      );
    } else {
      const rows = await this.prisma.mediaItem.findMany({
        where: { eventId: access.eventId, status: { notIn: ['DELETED', 'UPLOADING'] } },
        include: { room: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      });
      csv = toCsv(
        rows.map((r) => ({ id: r.id, album: r.room.name, kind: r.kind, status: r.status, uploader: r.uploaderName, width: r.width, height: r.height, sizeBytes: Number(r.sizeBytes), uploadedAt: r.createdAt })),
        ['id', 'album', 'kind', 'status', 'uploader', 'width', 'height', 'sizeBytes', 'uploadedAt'],
      );
    }
    await this.audit.record({ actorType: 'USER', actorId: access.userId, action: `export.${kind}`, targetType: 'Event', targetId: access.eventId, eventId: access.eventId, meta });
    return { filename: `${event.slug}-${kind}.csv`, csv };
  }

  static assertKind(kind: string): ExportKind {
    if (!(EXPORT_KINDS as readonly string[]).includes(kind)) throw AppError.notFound('Export');
    return kind as ExportKind;
  }
}
