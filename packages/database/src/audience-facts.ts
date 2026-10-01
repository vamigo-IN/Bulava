import type { FunctionFacts, PolicyFacts } from '@bulava/auth';
import type { PrismaClient } from '../generated/client';

/**
 * The single place that turns database rows into the facts the pure access
 * evaluator (`evaluateFunctionAccess` in @bulava/auth) needs. The API and the
 * workers both load facts here, so a reminder email and the guest page can
 * never disagree about who is invited to what.
 */

export interface GuestAudienceFacts {
  guestId: string;
  groupIds: string[];
  assignments: Map<string, { allowed: boolean; guestLimit: number; plusOneAllowed: boolean }>;
}

export interface EventAudienceFacts {
  eventPolicy: PolicyFacts;
  functions: FunctionFacts[];
}

type Db = Pick<PrismaClient, 'event' | 'guest'>;

export async function loadEventAudienceFacts(prisma: Db, eventId: string): Promise<EventAudienceFacts> {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      accessPolicy: { select: { mode: true, pinHash: true } },
      functions: {
        where: { deletedAt: null },
        select: {
          id: true,
          status: true,
          visibility: true,
          accessPolicy: { select: { mode: true, pinHash: true } },
          audienceGroups: { select: { groupId: true } },
        },
      },
    },
  });
  return {
    eventPolicy: { mode: event.accessPolicy.mode, hasPin: event.accessPolicy.pinHash !== null },
    functions: event.functions.map((f) => ({
      id: f.id,
      status: f.status,
      visibility: f.visibility,
      policy: f.accessPolicy ? { mode: f.accessPolicy.mode, hasPin: f.accessPolicy.pinHash !== null } : null,
      audienceGroupIds: f.audienceGroups.map((g) => g.groupId),
    })),
  };
}

/** Facts for every active guest of the event, or only the given guests. */
export async function loadGuestAudienceFacts(prisma: Db, eventId: string, guestIds?: string[]): Promise<GuestAudienceFacts[]> {
  const guests = await prisma.guest.findMany({
    where: { eventId, deletedAt: null, ...(guestIds ? { id: { in: guestIds } } : {}) },
    select: {
      id: true,
      groups: { select: { groupId: true } },
      functions: { select: { functionId: true, allowed: true, guestLimit: true, plusOneAllowed: true } },
    },
  });
  return guests.map((g) => ({
    guestId: g.id,
    groupIds: g.groups.map((x) => x.groupId),
    assignments: new Map(g.functions.map((f) => [f.functionId, { allowed: f.allowed, guestLimit: f.guestLimit, plusOneAllowed: f.plusOneAllowed }])),
  }));
}
