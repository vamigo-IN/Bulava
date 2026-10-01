import { Injectable } from '@nestjs/common';
import type {
  GuestStayInput,
  GuestTravelInput,
  GuestTravelSelfInput,
  LogisticsSettingsInput,
  SetGuestLogisticsInput,
  SetSeatingInput,
  TravelDirection,
} from '@bulava/validation';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { AudienceService } from '../audience/audience.service';

const stayFields = {
  hotelName: true,
  address: true,
  mapUrl: true,
  roomNumber: true,
  roomType: true,
  checkInAt: true,
  checkOutAt: true,
  notes: true,
} as const;

const travelFields = {
  direction: true,
  mode: true,
  carrier: true,
  reference: true,
  at: true,
  place: true,
  travellers: true,
  pickupRequested: true,
  pickupNote: true,
  enteredByGuest: true,
  updatedAt: true,
} as const;

/** Upper bound for the one-page logistics board (a large Indian wedding is ~1,500 guests). */
const MAX_BOARD_GUESTS = 5000;

/**
 * Guest logistics (spec §52–53): VIP and dietary flags, where each guest
 * stays, how they arrive and leave, and table plans per function.
 * Everything is per guest and shown only to that guest; seating never
 * affects who may attend a function.
 */
@Injectable()
export class LogisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly audience: AudienceService,
  ) {}

  /** The host's board: every active guest with stay and travel, plus totals. */
  async overview(access: EventAccessContext) {
    const [event, guests] = await Promise.all([
      this.prisma.event.findUniqueOrThrow({ where: { id: access.eventId }, select: { collectGuestTravel: true, timezone: true } }),
      this.prisma.guest.findMany({
        where: { eventId: access.eventId, deletedAt: null },
        select: {
          id: true,
          name: true,
          phone: true,
          isVip: true,
          dietary: true,
          stay: { select: stayFields },
          travel: { select: travelFields },
        },
        orderBy: { name: 'asc' },
        take: MAX_BOARD_GUESTS,
      }),
    ]);
    const rows = guests.map((g) => ({
      id: g.id,
      name: g.name,
      phone: g.phone,
      isVip: g.isVip,
      dietary: g.dietary,
      stay: g.stay,
      arrival: g.travel.find((t) => t.direction === 'ARRIVAL') ?? null,
      departure: g.travel.find((t) => t.direction === 'DEPARTURE') ?? null,
    }));
    const hotels = new Map<string, number>();
    for (const r of rows) if (r.stay) hotels.set(r.stay.hotelName, (hotels.get(r.stay.hotelName) ?? 0) + 1);
    const pickups = (d: 'arrival' | 'departure') =>
      rows.reduce((n, r) => n + (r[d]?.pickupRequested ? r[d]!.travellers : 0), 0);
    return {
      settings: { collectGuestTravel: event.collectGuestTravel, timezone: event.timezone },
      summary: {
        guests: rows.length,
        vip: rows.filter((r) => r.isVip).length,
        dietary: rows.filter((r) => r.dietary).length,
        withStay: rows.filter((r) => r.stay).length,
        arrivals: rows.filter((r) => r.arrival).length,
        departures: rows.filter((r) => r.departure).length,
        pickupTravellers: pickups('arrival'),
        dropTravellers: pickups('departure'),
        hotels: [...hotels].map(([hotelName, count]) => ({ hotelName, guests: count })).sort((a, b) => b.guests - a.guests),
      },
      guests: rows,
    };
  }

  async updateSettings(access: EventAccessContext, input: LogisticsSettingsInput, meta: RequestMeta) {
    await this.prisma.$transaction(async (tx) => {
      await tx.event.update({ where: { id: access.eventId }, data: { collectGuestTravel: input.collectGuestTravel } });
      await this.audit.record(
        { actorType: 'USER', actorId: access.userId, action: 'logistics.settings_updated', targetType: 'Event', targetId: access.eventId, eventId: access.eventId, metadata: input, meta },
        tx,
      );
    });
    return { collectGuestTravel: input.collectGuestTravel };
  }

  /** Host edit of one guest. Keys present replace that part; null removes it. */
  async setGuestLogistics(access: EventAccessContext, guestId: string, input: SetGuestLogisticsInput, meta: RequestMeta) {
    const guest = await this.prisma.guest.findFirst({ where: { id: guestId, eventId: access.eventId, deletedAt: null }, select: { id: true } });
    if (!guest) throw AppError.notFound('Guest');
    await this.prisma.$transaction(async (tx) => {
      if (input.isVip !== undefined || input.dietary !== undefined) {
        await tx.guest.update({ where: { id: guestId }, data: { isVip: input.isVip, dietary: input.dietary } });
      }
      if (input.stay !== undefined) await this.writeStay(tx, access.eventId, guestId, input.stay);
      if (input.arrival !== undefined) await this.writeTravel(tx, access.eventId, guestId, 'ARRIVAL', input.arrival, false);
      if (input.departure !== undefined) await this.writeTravel(tx, access.eventId, guestId, 'DEPARTURE', input.departure, false);
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: access.userId,
          action: 'guest.logistics_updated',
          targetType: 'Guest',
          targetId: guestId,
          eventId: access.eventId,
          // Which parts changed, not the personal details themselves.
          metadata: { parts: Object.keys(input) },
          meta,
        },
        tx,
      );
    });
    return this.guestLogistics(access.eventId, guestId);
  }

  /** One function's seating plan and the guests who may attend it. */
  async seating(access: EventAccessContext, functionId: string) {
    const fn = await this.assertFunction(access, functionId);
    const [facts, guestFacts, guests, seats] = await Promise.all([
      this.audience.loadEventFacts(access.eventId),
      this.audience.loadGuestFacts(access.eventId),
      this.prisma.guest.findMany({
        where: { eventId: access.eventId, deletedAt: null },
        select: { id: true, name: true, isVip: true, dietary: true, rsvps: { where: { functionId }, select: { status: true, attendeeCount: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.seatAssignment.findMany({ where: { functionId }, select: { guestId: true, tableLabel: true, seatLabel: true } }),
    ]);
    const eligible = new Set(guestFacts.filter((g) => AudienceService.accessMatrix(facts, g).get(functionId)?.allowed).map((g) => g.guestId));
    const seated = new Set(seats.map((s) => s.guestId));
    return {
      function: fn,
      seats,
      // Guests who can attend, plus anyone already seated (access may have changed since).
      guests: guests
        .filter((g) => eligible.has(g.id) || seated.has(g.id))
        .map((g) => ({ id: g.id, name: g.name, isVip: g.isVip, dietary: g.dietary, invited: eligible.has(g.id), rsvp: g.rsvps[0] ?? null })),
    };
  }

  async setSeating(access: EventAccessContext, functionId: string, input: SetSeatingInput, meta: RequestMeta) {
    await this.assertFunction(access, functionId);
    const guestIds = input.seats.map((s) => s.guestId);
    if (guestIds.length) {
      const found = await this.prisma.guest.count({ where: { eventId: access.eventId, deletedAt: null, id: { in: guestIds } } });
      if (found !== guestIds.length) throw new AppError('INVALID_REFERENCE', 'One or more guests do not exist.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.seatAssignment.deleteMany({ where: { functionId, guestId: { notIn: guestIds } } });
      for (const seat of input.seats) {
        const data = { tableLabel: seat.tableLabel, seatLabel: seat.seatLabel ?? null };
        await tx.seatAssignment.upsert({
          where: { functionId_guestId: { functionId, guestId: seat.guestId } },
          create: { functionId, guestId: seat.guestId, eventId: access.eventId, ...data },
          update: data,
        });
      }
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: access.userId,
          action: 'seating.updated',
          targetType: 'EventFunction',
          targetId: functionId,
          eventId: access.eventId,
          metadata: { seats: input.seats.length, tables: new Set(input.seats.map((s) => s.tableLabel)).size },
          meta,
        },
        tx,
      );
    });
    return this.seating(access, functionId);
  }

  // ───── Guest side ─────

  /**
   * What one guest sees about their own logistics. Seats are limited to the
   * functions the caller already decided this guest may see.
   */
  async forGuest(eventId: string, guestId: string, visibleFunctionIds: readonly string[]) {
    const [event, guest] = await Promise.all([
      this.prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { collectGuestTravel: true } }),
      this.prisma.guest.findUniqueOrThrow({
        where: { id: guestId },
        select: {
          stay: { select: stayFields },
          travel: { select: travelFields },
          seats: { where: { functionId: { in: [...visibleFunctionIds] } }, select: { functionId: true, tableLabel: true, seatLabel: true } },
        },
      }),
    ]);
    const stripped = (t: (typeof guest.travel)[number] | undefined) => (t ? { ...t, updatedAt: undefined } : null);
    return {
      collectTravel: event.collectGuestTravel,
      stay: guest.stay,
      arrival: stripped(guest.travel.find((t) => t.direction === 'ARRIVAL')),
      departure: stripped(guest.travel.find((t) => t.direction === 'DEPARTURE')),
      seats: guest.seats,
    };
  }

  /** A guest's own arrival/departure from the invitation page (host notes are kept). */
  async saveGuestTravel(eventId: string, guestId: string, input: GuestTravelSelfInput, meta: RequestMeta) {
    const event = await this.prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { collectGuestTravel: true } });
    if (!event.collectGuestTravel) throw AppError.forbidden('This host is not collecting travel details.');
    await this.prisma.$transaction(async (tx) => {
      if (input.arrival !== undefined) await this.writeTravel(tx, eventId, guestId, 'ARRIVAL', input.arrival, true);
      if (input.departure !== undefined) await this.writeTravel(tx, eventId, guestId, 'DEPARTURE', input.departure, true);
      await this.audit.record(
        { actorType: 'GUEST', actorId: guestId, action: 'guest.travel_submitted', targetType: 'Guest', targetId: guestId, eventId, metadata: { parts: Object.keys(input) }, meta },
        tx,
      );
    });
  }

  // ───── Internals ─────

  private async guestLogistics(eventId: string, guestId: string) {
    const g = await this.prisma.guest.findFirstOrThrow({
      where: { id: guestId, eventId },
      select: { id: true, name: true, phone: true, isVip: true, dietary: true, stay: { select: stayFields }, travel: { select: travelFields } },
    });
    return {
      id: g.id,
      name: g.name,
      phone: g.phone,
      isVip: g.isVip,
      dietary: g.dietary,
      stay: g.stay,
      arrival: g.travel.find((t) => t.direction === 'ARRIVAL') ?? null,
      departure: g.travel.find((t) => t.direction === 'DEPARTURE') ?? null,
    };
  }

  private async writeStay(tx: Tx, eventId: string, guestId: string, stay: GuestStayInput | null) {
    if (!stay) {
      await tx.guestStay.deleteMany({ where: { guestId } });
      return;
    }
    const data = {
      hotelName: stay.hotelName,
      address: stay.address ?? null,
      mapUrl: stay.mapUrl ?? null,
      roomNumber: stay.roomNumber ?? null,
      roomType: stay.roomType ?? null,
      checkInAt: stay.checkInAt ? new Date(stay.checkInAt) : null,
      checkOutAt: stay.checkOutAt ? new Date(stay.checkOutAt) : null,
      notes: stay.notes ?? null,
    };
    await tx.guestStay.upsert({ where: { guestId }, create: { eventId, guestId, ...data }, update: data });
  }

  private async writeTravel(
    tx: Tx,
    eventId: string,
    guestId: string,
    direction: TravelDirection,
    travel: (Omit<GuestTravelInput, 'pickupNote'> & { pickupNote?: string }) | null,
    byGuest: boolean,
  ) {
    const where = { guestId_direction: { guestId, direction } };
    if (!travel) {
      await tx.guestTravel.deleteMany({ where: { guestId, direction } });
      return;
    }
    const data = {
      mode: travel.mode,
      carrier: travel.carrier ?? null,
      reference: travel.reference ?? null,
      at: new Date(travel.at),
      place: travel.place ?? null,
      travellers: travel.travellers,
      pickupRequested: travel.pickupRequested,
      enteredByGuest: byGuest,
      // Guests see the host's pickup arrangement but cannot change it.
      ...(byGuest ? {} : { pickupNote: travel.pickupNote ?? null }),
    };
    await tx.guestTravel.upsert({ where, create: { eventId, guestId, direction, ...data }, update: data });
  }

  private async assertFunction(access: EventAccessContext, functionId: string) {
    // Function managers only handle the functions assigned to them.
    if (access.functionIds.length && !access.functionIds.includes(functionId)) throw AppError.forbidden();
    const fn = await this.prisma.eventFunction.findFirst({
      where: { id: functionId, eventId: access.eventId, deletedAt: null },
      select: { id: true, name: true, startsAt: true },
    });
    if (!fn) throw AppError.notFound('Function');
    return fn;
  }
}
