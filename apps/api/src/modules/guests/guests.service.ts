import { Injectable } from '@nestjs/common';
import type { Prisma } from '@bulava/database';
import type {
  CreateGuestInput,
  PaginationInput,
  SetGuestFunctionsInput,
  SetGuestGroupsInput,
  UpdateGuestInput,
} from '@bulava/validation';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { FEATURE_KEYS } from '@bulava/validation';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AudienceService, type EventAudienceFacts, type GuestAudienceFacts } from '../audience/audience.service';
import { ALL_GUESTS_SLUG } from '../events/events.service';

const guestInclude = {
  groups: { select: { groupId: true } },
  functions: {
    select: {
      functionId: true,
      allowed: true,
      guestLimit: true,
      plusOneAllowed: true,
      invitationStatus: true,
      rsvpStatus: true,
      notes: true,
    },
  },
  invitations: {
    where: { status: { not: 'REVOKED' } },
    select: { id: true, status: true, functionId: true, openedAt: true, sentAt: true },
    orderBy: { createdAt: 'desc' },
  },
  rsvps: { select: { functionId: true, status: true, attendeeCount: true, respondedAt: true } },
} satisfies Prisma.GuestInclude;

type GuestRow = Prisma.GuestGetPayload<{ include: typeof guestInclude }>;

export interface GuestDto {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  guestType: string;
  preferredLanguage: string | null;
  isVip: boolean;
  dietary: string | null;
  groupIds: string[];
  assignments: Array<{
    functionId: string;
    allowed: boolean;
    guestLimit: number;
    plusOneAllowed: boolean;
    notes: string | null;
  }>;
  /** Effective access for an event-wide invitation, per function id. */
  access: Record<string, { allowed: boolean; reason: string }>;
  invitations: Array<{ id: string; status: string; functionId: string | null; openedAt: Date | null; sentAt: Date | null }>;
  rsvps: Array<{ functionId: string | null; status: string; attendeeCount: number; respondedAt: Date }>;
  createdAt: Date;
}

@Injectable()
export class GuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly audience: AudienceService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(access: EventAccessContext, page: PaginationInput): Promise<{ items: GuestDto[]; nextCursor: string | null }> {
    const where: Prisma.GuestWhereInput = { eventId: access.eventId, deletedAt: null };
    if (page.q) {
      where.OR = [
        { name: { contains: page.q, mode: 'insensitive' } },
        { phone: { contains: page.q.replace(/\s/g, '') } },
        { email: { contains: page.q, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.guest.findMany({
      where,
      include: guestInclude,
      orderBy: { id: 'asc' },
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > page.limit;
    const items = hasMore ? rows.slice(0, page.limit) : rows;
    const facts = await this.audience.loadEventFacts(access.eventId);
    return {
      items: items.map((g) => this.toDto(g, facts)),
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  async get(access: EventAccessContext, guestId: string): Promise<GuestDto> {
    const guest = await this.prisma.guest.findFirst({
      where: { id: guestId, eventId: access.eventId, deletedAt: null },
      include: guestInclude,
    });
    if (!guest) throw AppError.notFound('Guest');
    return this.toDto(guest, await this.audience.loadEventFacts(access.eventId));
  }

  async create(access: EventAccessContext, input: CreateGuestInput, meta: RequestMeta): Promise<GuestDto> {
    const allGuests = await this.prisma.guestGroup.findUnique({
      where: { eventId_slug: { eventId: access.eventId, slug: ALL_GUESTS_SLUG } },
      select: { id: true },
    });
    const groupIds = [...new Set([...(allGuests ? [allGuests.id] : []), ...input.groupIds])];
    await this.assertGroupsInEvent(access.eventId, groupIds);
    EntitlementsService.assertWithinLimit(
      await this.entitlements.forEvent(access.eventId),
      FEATURE_KEYS.GUESTS_MAX,
      await this.prisma.guest.count({ where: { eventId: access.eventId, deletedAt: null } }),
    );

    const guest = await this.prisma.$transaction(async (tx) => {
      const created = await tx.guest.create({
        data: {
          eventId: access.eventId,
          name: input.name,
          phone: input.phone ?? null,
          email: input.email ?? null,
          address: input.address ?? null,
          notes: input.notes ?? null,
          guestType: input.guestType,
          preferredLanguage: input.preferredLanguage ?? null,
          isVip: input.isVip,
          dietary: input.dietary ?? null,
          groups: { create: groupIds.map((groupId) => ({ groupId, eventId: access.eventId })) },
        },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: access.userId,
          action: 'guest.created',
          targetType: 'Guest',
          targetId: created.id,
          eventId: access.eventId,
          meta,
        },
        tx,
      );
      return tx.guest.findUniqueOrThrow({ where: { id: created.id }, include: guestInclude });
    });
    return this.toDto(guest, await this.audience.loadEventFacts(access.eventId));
  }

  async update(access: EventAccessContext, guestId: string, input: UpdateGuestInput): Promise<GuestDto> {
    await this.findOrThrow(access.eventId, guestId);
    const guest = await this.prisma.guest.update({
      where: { id: guestId },
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email,
        address: input.address,
        notes: input.notes,
        guestType: input.guestType,
        preferredLanguage: input.preferredLanguage,
        isVip: input.isVip,
        dietary: input.dietary,
      },
      include: guestInclude,
    });
    return this.toDto(guest, await this.audience.loadEventFacts(access.eventId));
  }

  async softDelete(access: EventAccessContext, guestId: string, meta: RequestMeta): Promise<void> {
    const guest = await this.findOrThrow(access.eventId, guestId);
    await this.prisma.$transaction(async (tx) => {
      await tx.guest.update({ where: { id: guestId }, data: { deletedAt: new Date() } });
      await this.revokeGuestInvitations(tx, guestId);
      // Stay, travel and seats are personal details with no use once the guest is removed.
      await tx.guestStay.deleteMany({ where: { guestId } });
      await tx.guestTravel.deleteMany({ where: { guestId } });
      await tx.seatAssignment.deleteMany({ where: { guestId } });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: access.userId,
          action: 'guest.removed',
          targetType: 'Guest',
          targetId: guestId,
          eventId: access.eventId,
          metadata: { name: guest.name },
          meta,
        },
        tx,
      );
    });
  }

  async setGroups(
    access: EventAccessContext,
    guestId: string,
    input: SetGuestGroupsInput,
    meta: RequestMeta,
  ): Promise<GuestDto> {
    await this.findOrThrow(access.eventId, guestId);
    const groupIds = [...new Set(input.groupIds)];
    await this.assertGroupsInEvent(access.eventId, groupIds);

    await this.prisma.$transaction(async (tx) => {
      const before = (await tx.guestGroupMember.findMany({ where: { guestId }, select: { groupId: true } }))
        .map((m) => m.groupId)
        .sort();
      await tx.guestGroupMember.deleteMany({ where: { guestId, groupId: { notIn: groupIds } } });
      await tx.guestGroupMember.createMany({
        data: groupIds.map((groupId) => ({ groupId, guestId, eventId: access.eventId })),
        skipDuplicates: true,
      });
      if (before.join() !== [...groupIds].sort().join()) {
        await this.audit.record(
          {
            actorType: 'USER',
            actorId: access.userId,
            action: 'guest.groups_changed',
            targetType: 'Guest',
            targetId: guestId,
            eventId: access.eventId,
            metadata: { from: before, to: [...groupIds].sort() },
            meta,
          },
          tx,
        );
      }
    });
    return this.get(access, guestId);
  }

  /** Replace the guest's direct function assignments, preserving RSVP/invitation state of kept rows. */
  async setFunctions(
    access: EventAccessContext,
    guestId: string,
    input: SetGuestFunctionsInput,
    meta: RequestMeta,
  ): Promise<GuestDto> {
    await this.findOrThrow(access.eventId, guestId);
    const functionIds = input.assignments.map((a) => a.functionId);
    if (functionIds.length > 0) {
      const count = await this.prisma.eventFunction.count({
        where: { eventId: access.eventId, deletedAt: null, id: { in: functionIds } },
      });
      if (count !== functionIds.length) throw new AppError('INVALID_REFERENCE', 'One or more functions do not exist.');
    }

    await this.prisma.$transaction(async (tx) => {
      const before = await tx.functionGuest.findMany({
        where: { guestId },
        select: { functionId: true, allowed: true, guestLimit: true },
      });
      await tx.functionGuest.deleteMany({ where: { guestId, functionId: { notIn: functionIds } } });
      for (const a of input.assignments) {
        const data = {
          allowed: a.allowed,
          plusOneAllowed: a.plusOneAllowed,
          guestLimit: a.guestLimit,
          notes: a.notes ?? null,
        };
        await tx.functionGuest.upsert({
          where: { functionId_guestId: { functionId: a.functionId, guestId } },
          create: { functionId: a.functionId, guestId, eventId: access.eventId, ...data },
          update: data,
        });
      }
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: access.userId,
          action: 'guest.function_access_changed',
          targetType: 'Guest',
          targetId: guestId,
          eventId: access.eventId,
          metadata: {
            from: before,
            to: input.assignments.map((a) => ({ functionId: a.functionId, allowed: a.allowed, guestLimit: a.guestLimit })),
          },
          meta,
        },
        tx,
      );
    });
    return this.get(access, guestId);
  }

  private async findOrThrow(eventId: string, guestId: string) {
    const guest = await this.prisma.guest.findFirst({ where: { id: guestId, eventId, deletedAt: null } });
    if (!guest) throw AppError.notFound('Guest');
    return guest;
  }

  private async assertGroupsInEvent(eventId: string, groupIds: readonly string[]): Promise<void> {
    if (groupIds.length === 0) return;
    const count = await this.prisma.guestGroup.count({ where: { eventId, id: { in: [...groupIds] } } });
    if (count !== groupIds.length) throw new AppError('INVALID_REFERENCE', 'One or more guest groups do not exist.');
  }

  private async revokeGuestInvitations(tx: Tx, guestId: string): Promise<void> {
    const now = new Date();
    await tx.invitation.updateMany({
      where: { guestId, status: { not: 'REVOKED' } },
      data: { status: 'REVOKED', revokedAt: now },
    });
    await tx.invitationToken.updateMany({
      where: { invitation: { guestId }, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  private toDto(g: GuestRow, facts: EventAudienceFacts): GuestDto {
    const audienceFacts: GuestAudienceFacts = {
      guestId: g.id,
      groupIds: g.groups.map((x) => x.groupId),
      assignments: new Map(g.functions.map((f) => [f.functionId, f])),
    };
    const matrix = AudienceService.accessMatrix(facts, audienceFacts);
    return {
      id: g.id,
      name: g.name,
      phone: g.phone,
      email: g.email,
      address: g.address,
      notes: g.notes,
      guestType: g.guestType,
      preferredLanguage: g.preferredLanguage,
      isVip: g.isVip,
      dietary: g.dietary,
      groupIds: audienceFacts.groupIds,
      assignments: g.functions.map((f) => ({
        functionId: f.functionId,
        allowed: f.allowed,
        guestLimit: f.guestLimit,
        plusOneAllowed: f.plusOneAllowed,
        notes: f.notes,
      })),
      access: Object.fromEntries(matrix),
      invitations: g.invitations,
      rsvps: g.rsvps,
      createdAt: g.createdAt,
    };
  }
}
