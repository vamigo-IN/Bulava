import { Injectable } from '@nestjs/common';
import { slugify, type CreateFunctionInput, type UpdateFunctionInput } from '@bulava/validation';
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

export interface FunctionDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  status: string;
  visibility: string;
  sortOrder: number;
  /** The function's own mode, or INHERIT. */
  accessMode: string;
  effectiveAccessMode: string;
  venue: { id: string; name: string; address: string | null; city: string | null; mapUrl: string | null } | null;
  audienceGroupIds: string[];
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
    venue: fn.venue
      ? { id: fn.venue.id, name: fn.venue.name, address: fn.venue.address, city: fn.venue.city, mapUrl: fn.venue.mapUrl }
      : null,
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
    EntitlementsService.assertWithinLimit(
      await this.entitlements.forEvent(access.eventId),
      FEATURE_KEYS.FUNCTIONS_MAX,
      await this.prisma.eventFunction.count({ where: { eventId: access.eventId, deletedAt: null } }),
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const slug = await this.uniqueSlug(tx, access.eventId, input.slug ?? slugify(input.name));
      const sortOrder =
        input.sortOrder ?? (await tx.eventFunction.count({ where: { eventId: access.eventId, deletedAt: null } }));
      const venue = input.venue
        ? await tx.venue.create({ data: { eventId: access.eventId, ...input.venue } })
        : null;
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
    const endsAt = input.endsAt === undefined ? existing.endsAt : input.endsAt ? new Date(input.endsAt) : null;
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new AppError('VALIDATION_FAILED', 'End time must be after start time.', [
        { path: 'endsAt', message: 'End time must be after start time' },
      ]);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const accessChanges: Record<string, unknown> = {};

      // Venue
      let venueId: string | null | undefined;
      if (input.venue === null) {
        venueId = null;
      } else if (input.venue) {
        if (existing.venueId) {
          await tx.venue.update({ where: { id: existing.venueId }, data: input.venue });
        } else {
          venueId = (await tx.venue.create({ data: { eventId: access.eventId, ...input.venue } })).id;
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
          endsAt: input.endsAt === undefined ? undefined : endsAt,
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

  /** Keep Event.startDate/endDate in sync with its functions. */
  private async refreshEventDates(tx: Tx, eventId: string): Promise<void> {
    const agg = await tx.eventFunction.aggregate({
      where: { eventId, deletedAt: null, status: { not: 'CANCELLED' } },
      _min: { startsAt: true },
      _max: { endsAt: true, startsAt: true },
    });
    await tx.event.update({
      where: { id: eventId },
      data: { startDate: agg._min.startsAt, endDate: agg._max.endsAt ?? agg._max.startsAt },
    });
  }
}
