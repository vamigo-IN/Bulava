import { Injectable } from '@nestjs/common';
import { slugify, type CreateGroupInput, type UpdateGroupInput } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';

export interface GroupDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  kind: string;
  color: string | null;
  sortOrder: number;
  memberCount: number;
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(access: EventAccessContext): Promise<GroupDto[]> {
    const groups = await this.prisma.guestGroup.findMany({
      where: { eventId: access.eventId },
      include: { _count: { select: { members: { where: { guest: { deletedAt: null } } } } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return groups.map(({ _count, ...g }) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      description: g.description,
      kind: g.kind,
      color: g.color,
      sortOrder: g.sortOrder,
      memberCount: _count.members,
    }));
  }

  async create(access: EventAccessContext, input: CreateGroupInput, meta: RequestMeta): Promise<GroupDto> {
    const base = input.slug ?? (slugify(input.name) || 'group');
    const existing = new Set(
      (
        await this.prisma.guestGroup.findMany({
          where: { eventId: access.eventId, slug: { startsWith: base } },
          select: { slug: true },
        })
      ).map((g) => g.slug),
    );
    let slug = base;
    for (let i = 2; existing.has(slug); i++) slug = `${base}-${i}`;

    const sortOrder = await this.prisma.guestGroup.count({ where: { eventId: access.eventId } });
    const group = await this.prisma.guestGroup.create({
      data: {
        eventId: access.eventId,
        name: input.name,
        slug,
        description: input.description ?? null,
        color: input.color ?? null,
        sortOrder,
      },
    });
    await this.audit.record({
      actorType: 'USER',
      actorId: access.userId,
      action: 'group.created',
      targetType: 'GuestGroup',
      targetId: group.id,
      eventId: access.eventId,
      meta,
    });
    return { ...group, memberCount: 0 };
  }

  async update(access: EventAccessContext, groupId: string, input: UpdateGroupInput): Promise<GroupDto> {
    const group = await this.prisma.guestGroup.findFirst({ where: { id: groupId, eventId: access.eventId } });
    if (!group) throw AppError.notFound('Group');
    const updated = await this.prisma.guestGroup.update({
      where: { id: groupId },
      data: {
        name: input.name,
        description: input.description,
        color: input.color,
        // System group slugs are stable identifiers.
        slug: group.kind === 'SYSTEM' ? undefined : input.slug,
      },
      include: { _count: { select: { members: { where: { guest: { deletedAt: null } } } } } },
    });
    const { _count, ...rest } = updated;
    return { ...rest, memberCount: _count.members };
  }

  async remove(access: EventAccessContext, groupId: string, meta: RequestMeta): Promise<void> {
    const group = await this.prisma.guestGroup.findFirst({ where: { id: groupId, eventId: access.eventId } });
    if (!group) throw AppError.notFound('Group');
    if (group.kind === 'SYSTEM') throw new AppError('SYSTEM_GROUP_PROTECTED', 'System groups cannot be deleted.');
    await this.prisma.$transaction(async (tx) => {
      await tx.guestGroup.delete({ where: { id: groupId } });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: access.userId,
          action: 'group.deleted',
          targetType: 'GuestGroup',
          targetId: groupId,
          eventId: access.eventId,
          metadata: { name: group.name },
          meta,
        },
        tx,
      );
    });
  }
}
