import type { GuestInvitationView } from './types';

/** Whether a guest has any stay, travel or table details to see, or travel plans to share. */
export function hasGuestLogistics(view: GuestInvitationView): boolean {
  const l = view.logistics;
  return Boolean(l.stay || l.arrival || l.departure || l.collectTravel || view.functions.some((f) => f.seat));
}
