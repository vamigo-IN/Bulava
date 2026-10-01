import { Injectable } from '@nestjs/common';
import type { Prisma } from '@bulava/database';
import type { CreateRSVPQuestionInput, UpdateRSVPQuestionInput } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { EventAccessContext } from '../../common/request-context';
import { AudienceService } from '../audience/audience.service';

export interface FunctionRsvpSummary {
  functionId: string;
  name: string;
  status: string;
  /** Guests who can see this function with an event-wide invitation. */
  invited: number;
  attending: number;
  declined: number;
  maybe: number;
  pending: number;
  /** Sum of attendeeCount for ATTENDING responses. */
  headcount: number;
}

@Injectable()
export class RsvpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audience: AudienceService,
  ) {}

  async summary(access: EventAccessContext): Promise<{ functions: FunctionRsvpSummary[]; totalGuests: number }> {
    const [eventFacts, guests, functions, rsvps] = await Promise.all([
      this.audience.loadEventFacts(access.eventId),
      this.audience.loadGuestFacts(access.eventId),
      this.prisma.eventFunction.findMany({
        where: { eventId: access.eventId, deletedAt: null },
        select: { id: true, name: true, status: true },
        orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }],
      }),
      this.prisma.rSVP.findMany({
        where: { eventId: access.eventId, functionId: { not: null }, guest: { deletedAt: null } },
        select: { guestId: true, functionId: true, status: true, attendeeCount: true },
      }),
    ]);

    const invitedByFunction = new Map<string, Set<string>>();
    for (const guest of guests) {
      for (const [functionId, decision] of AudienceService.accessMatrix(eventFacts, guest)) {
        if (!decision.allowed) continue;
        const set = invitedByFunction.get(functionId) ?? new Set<string>();
        set.add(guest.guestId);
        invitedByFunction.set(functionId, set);
      }
    }

    return {
      totalGuests: guests.length,
      functions: functions.map((fn) => {
        const invited = invitedByFunction.get(fn.id) ?? new Set<string>();
        // Count only responses from guests who are still in the audience.
        const responses = rsvps.filter((r) => r.functionId === fn.id && invited.has(r.guestId));
        const count = (s: string) => responses.filter((r) => r.status === s).length;
        const attendingRows = responses.filter((r) => r.status === 'ATTENDING');
        return {
          functionId: fn.id,
          name: fn.name,
          status: fn.status,
          invited: invited.size,
          attending: attendingRows.length,
          declined: count('DECLINED'),
          maybe: count('MAYBE'),
          pending: invited.size - responses.filter((r) => r.status !== 'PENDING').length,
          headcount: attendingRows.reduce((sum, r) => sum + r.attendeeCount, 0),
        };
      }),
    };
  }

  async list(access: EventAccessContext) {
    const rows = await this.prisma.rSVP.findMany({
      where: { eventId: access.eventId, guest: { deletedAt: null } },
      include: {
        guest: { select: { id: true, name: true, phone: true } },
        function: { select: { id: true, name: true } },
        answers: { include: { question: { select: { key: true } } } },
      },
      orderBy: { respondedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      guest: r.guest,
      function: r.function,
      status: r.status,
      attendeeCount: r.attendeeCount,
      message: r.message,
      answers: Object.fromEntries(r.answers.map((a) => [a.question.key, a.value])),
      respondedAt: r.respondedAt,
    }));
  }

  // ───── Custom RSVP questions ─────

  listQuestions(access: EventAccessContext) {
    return this.prisma.rSVPQuestion.findMany({
      where: { eventId: access.eventId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createQuestion(access: EventAccessContext, input: CreateRSVPQuestionInput) {
    if (input.functionId) await this.assertFunction(access.eventId, input.functionId);
    return this.prisma.rSVPQuestion.create({
      data: {
        eventId: access.eventId,
        functionId: input.functionId,
        key: input.key,
        label: input.label,
        type: input.type,
        options: input.options as Prisma.InputJsonValue,
        required: input.required,
        sortOrder: input.sortOrder,
      },
    });
  }

  async updateQuestion(access: EventAccessContext, questionId: string, input: UpdateRSVPQuestionInput) {
    const q = await this.prisma.rSVPQuestion.findFirst({ where: { id: questionId, eventId: access.eventId } });
    if (!q) throw AppError.notFound('Question');
    if (input.functionId) await this.assertFunction(access.eventId, input.functionId);
    const type = input.type ?? q.type;
    const options = input.options ?? (q.options as unknown[]);
    if ((type === 'SINGLE_CHOICE' || type === 'MULTI_CHOICE') && (!Array.isArray(options) || options.length < 2)) {
      throw new AppError('VALIDATION_FAILED', 'Choice questions need at least two options.');
    }
    return this.prisma.rSVPQuestion.update({
      where: { id: questionId },
      data: {
        functionId: input.functionId,
        label: input.label,
        type: input.type,
        options: input.options as Prisma.InputJsonValue | undefined,
        required: input.required,
        sortOrder: input.sortOrder,
        active: input.active,
      },
    });
  }

  async deleteQuestion(access: EventAccessContext, questionId: string): Promise<void> {
    const result = await this.prisma.rSVPQuestion.deleteMany({ where: { id: questionId, eventId: access.eventId } });
    if (result.count === 0) throw AppError.notFound('Question');
  }

  private async assertFunction(eventId: string, functionId: string): Promise<void> {
    const fn = await this.prisma.eventFunction.findFirst({ where: { id: functionId, eventId, deletedAt: null } });
    if (!fn) throw new AppError('INVALID_REFERENCE', 'Function does not exist.');
  }
}
