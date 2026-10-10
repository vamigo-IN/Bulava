import type { EventSummary } from './types';

/** Event permissions (packages/auth EVENT_PERMISSIONS); the API sends the caller's in `event.permissions`. */
export type EventPermission =
  | 'event.read'
  | 'event.update'
  | 'event.delete'
  | 'event.publish'
  | 'member.manage'
  | 'function.read'
  | 'function.manage'
  | 'guest.read'
  | 'guest.write'
  | 'group.manage'
  | 'invitation.read'
  | 'invitation.send'
  | 'invitation.revoke'
  | 'rsvp.read'
  | 'rsvp.write'
  | 'media.view'
  | 'media.upload'
  | 'media.delete'
  | 'media.moderate'
  | 'payment.read'
  | 'audit.read';

/**
 * Can the signed-in member do this in the event? The API enforces every
 * permission; the dashboard uses this only to show people what they can use.
 */
export function can(event: Pick<EventSummary, 'permissions'> | null | undefined, permission: EventPermission): boolean {
  return !!event?.permissions?.includes(permission);
}

/**
 * What each dashboard section needs to be useful. A photographer (event.read,
 * function.read, media.view, media.upload) therefore sees only Photos.
 * The overview is shown to anyone who manages guests, invitations or the event.
 */
export const SECTION_PERMISSIONS: Record<string, EventPermission[]> = {
  '': ['event.update', 'guest.read', 'invitation.read'],
  '/design': ['event.update'],
  '/functions': ['function.manage'],
  '/groups': ['group.manage'],
  '/guests': ['guest.read'],
  '/invitations': ['invitation.read'],
  '/rsvps': ['rsvp.read'],
  '/registrations': ['guest.read'],
  '/logistics': ['guest.read'],
  '/updates': ['invitation.send'],
  '/photos': ['media.view'],
  '/video': ['event.update'],
  '/checkin': ['guest.read'],
  '/settings': ['event.update'],
  '/unlock': ['payment.read'],
};

/** May the member open this section (any one of its permissions)? Unknown sections are left to the API. */
export function canOpenSection(event: Pick<EventSummary, 'permissions'> | null | undefined, section: string): boolean {
  const needed = SECTION_PERMISSIONS[section];
  return !needed || needed.some((p) => can(event, p));
}
