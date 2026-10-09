'use client';

import { can } from '@/lib/permissions';
import { useInvitations, useRsvpSummary } from '@/lib/queries';
import { setupSteps, type SetupStep } from '@/lib/setup-steps';
import type { EventSummary } from '@/lib/types';

/**
 * An event's setup steps with everything the member may see: invitations sent
 * and replies received load only for roles that include them (the others count
 * as not done yet).
 */
export function useSetupSteps(event: EventSummary | undefined): SetupStep[] | null {
  const id = event?.id ?? '';
  const invitations = useInvitations(id, !!event && can(event, 'invitation.read'));
  const summary = useRsvpSummary(id, !!event && can(event, 'rsvp.read'));
  if (!event) return null;
  return setupSteps({
    status: event.status,
    accessMode: event.accessMode,
    designChosen: event.design !== null,
    readyFunctions: event.counts.readyFunctions,
    guests: event.counts.guests,
    invitationsSent: invitations.data?.some((i) => i.sentAt) ?? false,
    responses: summary.data?.functions.reduce((sum, f) => sum + f.attending + f.declined + f.maybe, 0) ?? 0,
  });
}
