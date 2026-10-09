import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { z } from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { AudienceService } from '../audience/audience.service';

export const CheckInSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9]{8,24}$/),
  functionId: z.uuid().nullable().optional(),
  headcount: z.number().int().min(1).max(50).default(1),
  /** Allow a second check-in (re-entry) for the same function. */
  allowReentry: z.boolean().default(false),
});
export type CheckInInput = z.infer<typeof CheckInSchema>;

/**
 * Event-day check-in. When the host turns on entry passes (`Event.entryPasses`),
 * each guest's invitation carries a stable CHECK_IN QR code that opens
 * /checkin/<code> on staff phones (or the dashboard's scanner); staff must be
 * signed in with guest access to the event. Duplicate check-ins are refused
 * unless re-entry is allowed.
 */
@Injectable()
export class CheckInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly audience: AudienceService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async codeForGuest(eventId: string, guestId: string): Promise<string> {
    const existing = await this.prisma.qRCode.findFirst({ where: { eventId, type: 'CHECK_IN', targetId: guestId, active: true } });
    if (existing) return existing.code;
    const code = randomBytes(12).toString('base64url').replace(/[-_]/g, 'z').slice(0, 16);
    const created = await this.prisma.qRCode.create({ data: { eventId, type: 'CHECK_IN', targetId: guestId, code } });
    return created.code;
  }

  checkInUrl(code: string): string {
    return `${this.config.WEB_ORIGIN.replace(/\/$/, '')}/checkin/${code}`;
  }

  qrSvg(code: string): Promise<string> {
    return QRCode.toString(this.checkInUrl(code), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  }

  private async guestByCode(eventId: string, code: string) {
    const qr = await this.prisma.qRCode.findFirst({ where: { eventId, code, type: 'CHECK_IN', active: true } });
    if (!qr?.targetId) throw AppError.notFound('Guest');
    const guest = await this.prisma.guest.findFirst({
      where: { id: qr.targetId, eventId, deletedAt: null },
      include: {
        groups: { include: { group: { select: { id: true, name: true, slug: true } } } },
        seats: { select: { functionId: true, tableLabel: true, seatLabel: true } },
        stay: { select: { hotelName: true, roomNumber: true } },
        rsvps: { select: { functionId: true, status: true, attendeeCount: true } },
        checkIns: { select: { functionId: true, checkedInAt: true, headcount: true } },
      },
    });
    if (!guest) throw AppError.notFound('Guest');
    return guest;
  }

  /** Reception-desk lookup: who is this, what are they invited to, VIP, dietary needs, table, room. */
  async lookup(access: EventAccessContext, code: string) {
    const guest = await this.guestByCode(access.eventId, code);
    const [eventFacts, [facts]] = await Promise.all([
      this.audience.loadEventFacts(access.eventId),
      this.audience.loadGuestFacts(access.eventId, [guest.id]),
    ]);
    const matrix = facts ? AudienceService.accessMatrix(eventFacts, facts) : new Map();
    const functions = await this.prisma.eventFunction.findMany({
      where: { eventId: access.eventId, deletedAt: null },
      select: { id: true, name: true, startsAt: true },
      orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }],
    });
    return {
      guest: { id: guest.id, name: guest.name, phone: guest.phone, notes: guest.notes, dietary: guest.dietary },
      groups: guest.groups.map((g) => g.group),
      vip: guest.isVip || guest.groups.some((g) => g.group.slug === 'vip'),
      stay: guest.stay,
      functions: functions
        .filter((f) => matrix.get(f.id)?.allowed)
        .map((f) => {
          const seat = guest.seats.find((a) => a.functionId === f.id);
          return {
            id: f.id,
            name: f.name,
            startsAt: f.startsAt,
            tableLabel: seat?.tableLabel ?? null,
            seatLabel: seat?.seatLabel ?? null,
            rsvp: guest.rsvps.find((r) => r.functionId === f.id) ?? null,
            checkedIn: guest.checkIns.filter((c) => c.functionId === f.id),
          };
        }),
    };
  }

  async checkIn(access: EventAccessContext, input: CheckInInput, meta: RequestMeta) {
    const guest = await this.guestByCode(access.eventId, input.code);
    const functionId = input.functionId ?? null;
    if (functionId) {
      const [eventFacts, [facts]] = await Promise.all([
        this.audience.loadEventFacts(access.eventId),
        this.audience.loadGuestFacts(access.eventId, [guest.id]),
      ]);
      if (!facts || !AudienceService.accessMatrix(eventFacts, facts).get(functionId)?.allowed) {
        throw new AppError('FUNCTION_NOT_AUTHORIZED', 'This guest is not invited to that function.');
      }
    }
    const previous = guest.checkIns.find((c) => c.functionId === functionId);
    if (previous && !input.allowReentry) {
      throw new AppError('ALREADY_CHECKED_IN', `${guest.name} was already checked in.`, { checkedInAt: previous.checkedInAt });
    }
    const row = await this.prisma.checkIn.create({
      data: { eventId: access.eventId, guestId: guest.id, functionId, headcount: input.headcount, checkedInBy: access.userId, method: 'QR' },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: access.userId,
      action: previous ? 'checkin.reentry' : 'checkin.created',
      targetType: 'Guest',
      targetId: guest.id,
      eventId: access.eventId,
      metadata: { functionId, headcount: input.headcount },
      meta,
    });
    return { id: row.id, guestName: guest.name, checkedInAt: row.checkedInAt, reentry: !!previous };
  }

  async settings(access: EventAccessContext): Promise<{ entryPasses: boolean }> {
    const event = await this.prisma.event.findUniqueOrThrow({ where: { id: access.eventId }, select: { entryPasses: true } });
    return { entryPasses: event.entryPasses };
  }

  /** Turns QR entry passes on or off; invitations show the pass only while it is on. */
  async updateSettings(access: EventAccessContext, input: { entryPasses: boolean }, meta: RequestMeta): Promise<{ entryPasses: boolean }> {
    await this.prisma.$transaction(async (tx) => {
      await tx.event.update({ where: { id: access.eventId }, data: { entryPasses: input.entryPasses } });
      await this.audit.record(
        { actorType: 'USER', actorId: access.userId, action: 'checkin.settings_updated', targetType: 'Event', targetId: access.eventId, eventId: access.eventId, metadata: { entryPasses: input.entryPasses }, meta },
        tx,
      );
    });
    return { entryPasses: input.entryPasses };
  }

  /** Attendance dashboard: checked-in guests and headcount per function vs expected. */
  async summary(access: EventAccessContext) {
    const [functions, checkIns, rsvps] = await Promise.all([
      this.prisma.eventFunction.findMany({ where: { eventId: access.eventId, deletedAt: null }, select: { id: true, name: true }, orderBy: [{ sortOrder: 'asc' }] }),
      this.prisma.checkIn.findMany({ where: { eventId: access.eventId }, select: { functionId: true, guestId: true, headcount: true } }),
      this.prisma.rSVP.findMany({ where: { eventId: access.eventId, status: 'ATTENDING', guest: { deletedAt: null } }, select: { functionId: true, attendeeCount: true } }),
    ]);
    const row = (functionId: string | null, name: string) => {
      const c = checkIns.filter((x) => x.functionId === functionId);
      return {
        functionId,
        name,
        guestsCheckedIn: new Set(c.map((x) => x.guestId)).size,
        headcount: c.reduce((s, x) => s + x.headcount, 0),
        expectedHeadcount: rsvps.filter((r) => r.functionId === functionId).reduce((s, r) => s + r.attendeeCount, 0),
      };
    };
    return functions.map((f) => row(f.id, f.name));
  }
}
