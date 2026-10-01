import { Global, Injectable, Module } from '@nestjs/common';
import {
  authorizedFunctions,
  evaluateFunctionAccess,
  type AccessDecision,
  type Viewer,
} from '@bulava/auth';
import { loadEventAudienceFacts, loadGuestAudienceFacts, type EventAudienceFacts, type GuestAudienceFacts } from '@bulava/database';
import type { AnnouncementAudience } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type { EventAudienceFacts, GuestAudienceFacts } from '@bulava/database';

/**
 * Access facts for host-side views (who is invited to what) and guest-side
 * resolution. Loading is shared with the workers (@bulava/database), so the
 * dashboard, the guest page and reminder emails can never disagree.
 */
@Injectable()
export class AudienceService {
  constructor(private readonly prisma: PrismaService) {}

  loadEventFacts(eventId: string): Promise<EventAudienceFacts> {
    return loadEventAudienceFacts(this.prisma, eventId);
  }

  loadGuestFacts(eventId: string, guestIds?: string[]): Promise<GuestAudienceFacts[]> {
    return loadGuestAudienceFacts(this.prisma, eventId, guestIds);
  }

  static viewerFor(guest: GuestAudienceFacts, invitationFunctionId: string | null): Viewer {
    return {
      kind: 'guest',
      guestId: guest.guestId,
      groupIds: guest.groupIds,
      assignments: guest.assignments,
      invitationFunctionId,
    };
  }

  /** Decision per function for a guest holding an event-wide invitation. */
  static accessMatrix(event: EventAudienceFacts, guest: GuestAudienceFacts): Map<string, AccessDecision> {
    const viewer = AudienceService.viewerFor(guest, null);
    return new Map(event.functions.map((fn) => [fn.id, evaluateFunctionAccess(fn, event.eventPolicy, viewer)]));
  }

  /** Does an announcement audience include this guest? Uses the same access rules as invitations. */
  static announcementIncludes(audience: AnnouncementAudience, guest: GuestAudienceFacts, event: EventAudienceFacts): boolean {
    if ('all' in audience) return true;
    if ('guestIds' in audience) return audience.guestIds.includes(guest.guestId);
    if ('groupIds' in audience) return audience.groupIds.some((g) => guest.groupIds.includes(g));
    const visible = new Set(authorizedFunctions(event.functions, event.eventPolicy, AudienceService.viewerFor(guest, null)).map((f) => f.id));
    return audience.functionIds.some((id) => visible.has(id));
  }

  /** Max attendees (including the guest) for a function. */
  static attendeeLimit(guest: GuestAudienceFacts, functionId: string): number {
    const a = guest.assignments.get(functionId);
    if (!a) return 1;
    return Math.max(a.guestLimit, a.plusOneAllowed ? 2 : 1);
  }
}

@Global()
@Module({ providers: [AudienceService], exports: [AudienceService] })
export class AudienceModule {}
