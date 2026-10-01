import { Injectable } from '@nestjs/common';
import type { EventRole } from '@bulava/database';
import type { AddMemberInput, UpdateMemberInput } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import type { EventAccessContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TeamInvitesService } from './team-invites.service';

/**
 * The event team: co-hosts, planners and event-day staff (spec roles). Someone
 * with a Bulava account joins at once; anyone else gets an emailed invitation
 * with a code (TeamInvitesService). The OWNER cannot be changed or removed, and
 * only the OWNER can grant, change or remove ADMIN, so admins cannot escalate
 * or lock each other out.
 */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly invites: TeamInvitesService,
  ) {}

  /** The team, plus invitations still waiting for people who manage it. */
  async list(access: EventAccessContext) {
    const rows = await this.prisma.eventMember.findMany({
      where: { eventId: access.eventId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      members: rows.map((m) => ({ id: m.id, role: m.role, functionIds: m.functionIds, createdAt: m.createdAt, user: m.user, isYou: m.userId === access.userId })),
      invites: access.permissions.includes('member.manage') ? await this.invites.list(access.eventId) : [],
    };
  }

  /**
   * Adds a member who has an account, or emails an invitation to someone who
   * does not yet (they join with the code from the email).
   */
  async add(access: EventAccessContext, input: AddMemberInput, meta: RequestMeta) {
    if (input.role === 'ADMIN' && access.role !== 'OWNER') throw AppError.forbidden('Only the owner can add admins.');
    const functionIds = await this.checkFunctions(access.eventId, input.role, input.functionIds);
    const user = await this.prisma.user.findFirst({ where: { email: input.email, deletedAt: null, status: 'ACTIVE' }, select: { id: true, name: true } });
    if (!user) {
      const taken = await this.prisma.user.count({ where: { email: input.email } });
      if (taken) throw new AppError('MEMBER_NOT_REGISTERED', 'This account is closed or suspended, so it cannot join the team.');
      return { kind: 'INVITED' as const, invite: await this.invites.create(access, { email: input.email, role: input.role, functionIds }, meta) };
    }
    const existing = await this.prisma.eventMember.findUnique({ where: { eventId_userId: { eventId: access.eventId, userId: user.id } } });
    if (existing) throw new AppError('CONFLICT', `${user.name} is already on the team.`);

    const member = await this.prisma.$transaction(async (tx) => {
      const created = await tx.eventMember.create({ data: { eventId: access.eventId, userId: user.id, role: input.role, functionIds } });
      await this.audit.record(
        { actorType: 'USER', actorId: access.userId, action: 'member.added', targetType: 'User', targetId: user.id, eventId: access.eventId, metadata: { role: input.role }, meta },
        tx,
      );
      return created;
    });
    const event = await this.prisma.event.findUniqueOrThrow({ where: { id: access.eventId }, select: { title: true } });
    await this.notifications.notify({ type: 'MEMBER_ADDED', channel: 'IN_APP', eventId: access.eventId, userId: user.id, payload: { eventTitle: event.title, role: input.role } });
    return { kind: 'MEMBER' as const, member: { id: member.id, role: member.role, functionIds: member.functionIds, user: { id: user.id, name: user.name, email: input.email } } };
  }

  async update(access: EventAccessContext, memberId: string, input: UpdateMemberInput, meta: RequestMeta) {
    const member = await this.findEditable(access, memberId);
    if (input.role === 'ADMIN' && access.role !== 'OWNER') throw AppError.forbidden('Only the owner can make someone an admin.');
    const role = input.role ?? member.role;
    const functionIds = input.functionIds !== undefined || input.role ? await this.checkFunctions(access.eventId, role, input.functionIds ?? member.functionIds) : member.functionIds;
    const updated = await this.prisma.eventMember.update({ where: { id: member.id }, data: { role, functionIds } });
    await this.audit.record({
      actorType: 'USER',
      actorId: access.userId,
      action: 'member.updated',
      targetType: 'User',
      targetId: member.userId,
      eventId: access.eventId,
      metadata: { from: member.role, to: role },
      meta,
    });
    return { id: updated.id, role: updated.role, functionIds: updated.functionIds };
  }

  async remove(access: EventAccessContext, memberId: string, meta: RequestMeta) {
    const member = await this.findEditable(access, memberId);
    await this.prisma.eventMember.delete({ where: { id: member.id } });
    await this.audit.record({ actorType: 'USER', actorId: access.userId, action: 'member.removed', targetType: 'User', targetId: member.userId, eventId: access.eventId, metadata: { role: member.role }, meta });
  }

  private async findEditable(access: EventAccessContext, memberId: string) {
    const member = await this.prisma.eventMember.findFirst({ where: { id: memberId, eventId: access.eventId } });
    if (!member) throw AppError.notFound('Team member');
    if (member.role === 'OWNER') throw AppError.forbidden('The owner cannot be changed or removed.');
    if (member.role === 'ADMIN' && access.role !== 'OWNER') throw AppError.forbidden('Only the owner can change or remove an admin.');
    if (member.userId === access.userId) throw AppError.forbidden('You cannot change your own role.');
    return member;
  }

  /** FUNCTION_MANAGER may be limited to some functions; other roles never are. */
  private async checkFunctions(eventId: string, role: EventRole, functionIds: string[]): Promise<string[]> {
    if (role !== 'FUNCTION_MANAGER' || !functionIds.length) return [];
    const unique = [...new Set(functionIds)];
    const found = await this.prisma.eventFunction.count({ where: { eventId, id: { in: unique }, deletedAt: null } });
    if (found !== unique.length) throw new AppError('INVALID_REFERENCE', 'Some functions do not belong to this event.');
    return unique;
  }
}
