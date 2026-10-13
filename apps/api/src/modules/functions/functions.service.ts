import { Injectable } from '@nestjs/common';
import { slugify, type CreateFunctionInput, type UpdateFunctionInput, type VenueInput } from '@bulava/validation';
import type { Prisma } from '@bulava/database';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { FEATURE_KEYS } from '@bulava/validation';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

const functionInclude = {
  venue: true,
  accessPolicy: { select: { mode: true } },
  audienceGroups: { select: { groupId: true } },
  event: { select: { accessPolicy: { select: { mode: true } } } },
} satisfies Prisma.EventFunctionInclude;

type FunctionRow = Prisma.EventFunctionGetPayload<{ include: typeof functionInclude }>;

export interface VenueDto {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  /** The link guests open for directions. */
  mapUrl: string | null;
}

export interface FunctionDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  startsAt: Date | null;
  /** Kept for older clients: a function has a start only (ADR-072), and the dashboard never sets an end. */
  endsAt: Date | null;
  status: string;
  visibility: string;
  sortOrder: number;
  /** The function's own mode, or INHERIT. */
  accessMode: string;
  effectiveAccessMode: string;
  venue: VenueDto | null;
  audienceGroupIds: string[];
}

function toVenueDto(venue: NonNullable<FunctionRow['venue']>): VenueDto {
  return {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    city: venue.city,
    state: venue.state,
    postalCode: venue.postalCode,
    country: venue.country,
    latitude: venue.latitude === null ? null : Number(venue.latitude),
    longitude: venue.longitude === null ? null : Number(venue.longitude),
    mapUrl: venue.mapUrl,
  };
}

/**
 * The venue row for what the host sent: the whole venue (a field left out is
 * cleared), as the venue field always sends it.
 */
function venueData(input: VenueInput) {
  return {
    name: input.name,
    address: input.address ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postalCode: input.postalCode ?? null,
    country: input.country ?? 'IN',
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    mapUrl: input.mapUrl ?? null,
  } satisfies Prisma.VenueUncheckedUpdateInput;
}

function toDto(fn: FunctionRow): FunctionDto {
  return {
    id: fn.id,
    name: fn.name,
    slug: fn.slug,
    description: fn.description,
    startsAt: fn.startsAt,
    endsAt: fn.endsAt,
    status: fn.status,
    visibility: fn.visibility,
    sortOrder: fn.sortOrder,
    accessMode: fn.accessPolicy?.mode ?? 'INHERIT',
    effectiveAccessMode: fn.accessPolicy?.mode ?? fn.event.accessPolicy.mode,
    venue: fn.venue ? toVenueDto(fn.venue) : null,
    audienceGroupIds: fn.audienceGroups.map((g) => g.groupId),
  };
}

@Injectable()
export class FunctionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(access: EventAccessContext): Promise<FunctionDto[]> {
    const rows = await this.prisma.eventFunction.findMany({
      where: { eventId: access.eventId, deletedAt: null },
      include: functionInclude,
      orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toDto);
  }

  async create(access: EventAccessContext, input: CreateFunctionInput, meta: RequestMeta): Promise<FunctionDto> {
    if (access.role === 'FUNCTION_MANAGER' && access.functionIds.length > 0) {
      throw AppError.forbidden('You can only manage your assigned functions.');
    }
    await this.assertGroupsInEvent(access.eventId, input.audienceGroupIds);
    if (input.startsAt) await this.assertRoomForDated(access.eventId);

    const created = await this.prisma.$transaction(async (tx) => {
      const slug = await this.uniqueSlug(tx, access.eventId, input.slug ?? slugify(input.name));
      const sortOrder =
        input.sortOrder ?? (await tx.eventFunction.count({ where: { eventId: access.eventId, deletedAt: null } }));
      const venue = input.venue ? await tx.venue.create({ data: { eventId: access.eventId, ...venueData(input.venue) } }) : null;
      const policy =
        input.accessMode !== 'INHERIT' ? await tx.accessPolicy.create({ data: { mode: input.accessMode } }) : null;

      const fn = await tx.eventFunction.create({
        data: {
          eventId: access.eventId,
          name: input.name,
          slug,
          description: input.description ?? null,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          venueId: venue?.id ?? null,
          visibility: input.visibility,
          accessPolicyId: policy?.id ?? null,
          status: input.status,
          sortOrder,
          audienceGroups: { create: input.audienceGroupIds.map((groupId) => ({ groupId })) },
        },
      });
      await this.refreshEventDates(tx, access.eventId);
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: access.userId,
          action: 'function.created',
          targetType: 'EventFunction',
          targetId: fn.id,
          eventId: access.eventId,
          meta,
        },
        tx,
      );
      return tx.eventFunction.findUniqueOrThrow({ where: { id: fn.id }, include: functionInclude });
    });
    return toDto(created);
  }

  /**
   * The functions guests see are the plan's (ADR-054, ADR-062): a draft holds
   * as many as the host likes, placeholders and dated ones alike (publishing
   * checks them), and a published event takes one more function with a date
   * only while its plan has room for it.
   */
  private async assertRoomForDated(eventId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { status: true } });
    if (!event || event.status === 'DRAFT') return;
    EntitlementsService.assertWithinLimit(
      await this.entitlements.forEvent(eventId),
      FEATURE_KEYS.FUNCTIONS_MAX,
      await this.prisma.eventFunction.count({ where: { eventId, deletedAt: null, startsAt: { not: null } } }),
    );
  }

  async update(
    access: EventAccessContext,
    functionId: string,
    input: UpdateFunctionInput,
    meta: RequestMeta,
  ): Promise<FunctionDto> {
    this.assertCanManage(access, functionId);
    const existing = await this.prisma.eventFunction.findFirst({
      where: { id: functionId, eventId: access.eventId, deletedAt: null },
      include: functionInclude,
    });
    if (!existing) throw AppError.notFound('Function');
    if (input.audienceGroupIds) await this.assertGroupsInEvent(access.eventId, input.audienceGroupIds);

    const startsAt = input.startsAt === undefined ? existing.startsAt : input.startsAt ? new Date(input.startsAt) : null;
    // A function has a start only (ADR-072): a start sent without an end drops the old end, which
    // belonged to the old start (the dashboard never shows or sends one). Older clients may still send both.
    const endsAt = input.endsAt !== undefined ? (input.endsAt ? new Date(input.endsAt) : null) : input.startsAt !== undefined ? null : existing.endsAt;
    const endsAtChange = input.endsAt !== undefined || input.startsAt !== undefined ? endsAt : undefined;
    // A placeholder given a date becomes a function guests see.
    if (startsAt && !existing.startsAt) await this.assertRoomForDated(access.eventId);
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new AppError('VALIDATION_FAILED', 'End time must be after start time.', [
        { path: 'endsAt', message: 'End time must be after start time' },
      ]);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const accessChanges: Record<string, unknown> = {};

      // Venue: replaced as a whole (the venue field sends all of it), or removed with null.
      let venueId: string | null | undefined;
      if (input.venue === null) {
        venueId = null;
      } else if (input.venue) {
        if (existing.venueId) {
          await tx.venue.update({ where: { id: existing.venueId }, data: venueData(input.venue) });
        } else {
          venueId = (await tx.venue.create({ data: { eventId: access.eventId, ...venueData(input.venue) } })).id;
        }
      }

      // Access policy override
      let accessPolicyId: string | null | undefined;
      const currentMode = existing.accessPolicy?.mode ?? 'INHERIT';
      if (input.accessMode && input.accessMode !== currentMode) {
        accessChanges.accessMode = { from: currentMode, to: input.accessMode };
        if (input.accessMode === 'INHERIT') {
          accessPolicyId = null;
        } else if (existing.accessPolicyId) {
          await tx.accessPolicy.update({ where: { id: existing.accessPolicyId }, data: { mode: input.accessMode } });
        } else {
          accessPolicyId = (await tx.accessPolicy.create({ data: { mode: input.accessMode } })).id;
        }
      }

      // Audience groups (replace set)
      if (input.audienceGroupIds) {
        const before = existing.audienceGroups.map((g) => g.groupId).sort();
        const after = [...new Set(input.audienceGroupIds)].sort();
        if (before.join() !== after.join()) {
          accessChanges.audienceGroupIds = { from: before, to: after };
          await tx.functionAudienceGroup.deleteMany({ where: { functionId } });
          await tx.functionAudienceGroup.createMany({ data: after.map((groupId) => ({ functionId, groupId })) });
        }
      }

      const slug =
        input.slug && input.slug !== existing.slug ? await this.uniqueSlug(tx, access.eventId, input.slug) : undefined;

      await tx.eventFunction.update({
        where: { id: functionId },
        data: {
          name: input.name,
          slug,
          description: input.description,
          startsAt: input.startsAt === undefined ? undefined : startsAt,
          endsAt: endsAtChange,
          visibility: input.visibility,
          status: input.status,
          sortOrder: input.sortOrder,
          ...(venueId !== undefined ? { venueId } : {}),
          ...(accessPolicyId !== undefined ? { accessPolicyId } : {}),
        },
      });

      if (accessPolicyId === null && existing.accessPolicyId) {
        await tx.accessPolicy.delete({ where: { id: existing.accessPolicyId } });
      }
      if (venueId === null && existing.venueId) {
        await tx.venue.delete({ where: { id: existing.venueId } });
      }
      await this.refreshEventDates(tx, access.eventId);

      if (Object.keys(accessChanges).length > 0 || (input.visibility && input.visibility !== existing.visibility)) {
        await this.audit.record(
          {
            actorType: 'USER',
            actorId: access.userId,
            action: 'function.access_changed',
            targetType: 'EventFunction',
            targetId: functionId,
            eventId: access.eventId,
            metadata: {
              ...accessChanges,
              ...(input.visibility && input.visibility !== existing.visibility
                ? { visibility: { from: existing.visibility, to: input.visibility } }
                : {}),
            } as Prisma.InputJsonValue,
            meta,
          },
          tx,
        );
      }
      return tx.eventFunction.findUniqueOrThrow({ where: { id: functionId }, include: functionInclude });
    });
    return toDto(updated);
  }

  async softDelete(access: EventAccessContext, functionId: string, meta: RequestMeta): Promise<void> {
    this.assertCanManage(access, functionId);
    await this.prisma.$transaction(async (tx) => {
      const fn = await tx.eventFunction.findFirst({
        where: { id: functionId, eventId: access.eventId, deletedAt: null },
      });
      if (!fn) throw AppError.notFound('Function');
      // Free the slug so a function with the same name can be recreated.
      await tx.eventFunction.update({
        where: { id: functionId },
        data: { deletedAt: new Date(), slug: `${fn.slug}~deleted~${fn.id.slice(-8)}` },
      });
      // Function-specific invitations die with the function.
      await tx.invitation.updateMany({
        where: { functionId, status: { not: 'REVOKED' } },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      await tx.invitationToken.updateMany({
        where: { invitation: { functionId }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.refreshEventDates(tx, access.eventId);
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: access.userId,
          action: 'function.deleted',
          targetType: 'EventFunction',
          targetId: functionId,
          eventId: access.eventId,
          meta,
        },
        tx,
      );
    });
  }

  private assertCanManage(access: EventAccessContext, functionId: string): void {
    if (access.role === 'FUNCTION_MANAGER' && access.functionIds.length > 0 && !access.functionIds.includes(functionId)) {
      throw AppError.forbidden('You can only manage your assigned functions.');
    }
  }

  private async assertGroupsInEvent(eventId: string, groupIds: readonly string[]): Promise<void> {
    const unique = [...new Set(groupIds)];
    if (unique.length === 0) return;
    const count = await this.prisma.guestGroup.count({ where: { eventId, id: { in: unique } } });
    if (count !== unique.length) throw new AppError('INVALID_REFERENCE', 'One or more guest groups do not exist.');
  }

  private async uniqueSlug(tx: Tx, eventId: string, desired: string): Promise<string> {
    const base = desired || 'function';
    const taken = new Set(
      (
        await tx.eventFunction.findMany({
          where: { eventId, slug: { startsWith: base } },
          select: { slug: true },
        })
      ).map((f) => f.slug),
    );
    if (!taken.has(base)) return base;
    for (let i = 2; ; i++) {
      const candidate = `${base}-${i}`;
      if (!taken.has(candidate)) return candidate;
    }
  }

  /**
   * Keep Event.startDate/endDate in sync with its functions: the first start,
   * and the last start or (older functions) end, whichever is later.
   */
  private async refreshEventDates(tx: Tx, eventId: string): Promise<void> {
    const agg = await tx.eventFunction.aggregate({
      where: { eventId, deletedAt: null, status: { not: 'CANCELLED' } },
      _min: { startsAt: true },
      _max: { endsAt: true, startsAt: true },
    });
    const ends = [agg._max.endsAt, agg._max.startsAt].filter((d): d is Date => d !== null);
    await tx.event.update({
      where: { id: eventId },
      data: { startDate: agg._min.startsAt, endDate: ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null },
    });
  }
}
