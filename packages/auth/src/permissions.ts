/**
 * Granular permissions. Roles map to permission sets; code checks permissions,
 * never role names, so roles can be re-shaped without touching call sites.
 */
export const EVENT_PERMISSIONS = [
  'event.read',
  'event.update',
  'event.delete',
  'event.publish',
  'member.manage',
  'function.read',
  'function.manage',
  'guest.read',
  'guest.write',
  'group.manage',
  'invitation.read',
  'invitation.send',
  'invitation.revoke',
  'rsvp.read',
  'rsvp.write',
  'media.view',
  'media.upload',
  'media.delete',
  'media.moderate',
  'payment.read',
  'audit.read',
] as const;

export const PLATFORM_PERMISSIONS = [
  'admin.read',
  'template.manage',
  'asset.manage',
  'pricing.manage',
  'user.manage',
  'content.manage',
  'media.moderate',
  /** Orders, payments and customers' payment history. */
  'billing.read',
  'payment.refund',
  /** Super Admin only: complimentary plan upgrades. */
  'plan.grant',
  /** Super Admin only: site settings, SEO, tracking, custom code and integrations. */
  'settings.manage',
  /** Super Admin only: staff roles, two-step resets, handing over the Super Admin role. */
  'staff.manage',
] as const;

export type EventPermission = (typeof EVENT_PERMISSIONS)[number];
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export type EventRole =
  | 'OWNER'
  | 'ADMIN'
  | 'CO_HOST'
  | 'FUNCTION_MANAGER'
  | 'GUEST_MANAGER'
  | 'MEDIA_MANAGER'
  | 'PHOTOGRAPHER';

export type PlatformRole = 'USER' | 'SUPPORT' | 'CONTENT_MANAGER' | 'FINANCE_MANAGER' | 'PLATFORM_ADMIN' | 'SUPER_ADMIN';

/** Staff roles the Super Admin can assign (SUPER_ADMIN only changes hands by transfer). */
export const ASSIGNABLE_PLATFORM_ROLES = ['USER', 'SUPPORT', 'CONTENT_MANAGER', 'FINANCE_MANAGER', 'PLATFORM_ADMIN'] as const;

/** Only the Super Admin holds these. */
const SUPER_ONLY: readonly PlatformPermission[] = ['plan.grant', 'settings.manage', 'staff.manage'];

const ALL_EVENT: readonly EventPermission[] = EVENT_PERMISSIONS;

export const EVENT_ROLE_PERMISSIONS: Record<EventRole, readonly EventPermission[]> = {
  OWNER: ALL_EVENT,
  ADMIN: ALL_EVENT.filter((p) => p !== 'event.delete'),
  CO_HOST: [
    'event.read',
    'event.update',
    'event.publish',
    'function.read',
    'function.manage',
    'guest.read',
    'guest.write',
    'group.manage',
    'invitation.read',
    'invitation.send',
    'invitation.revoke',
    'rsvp.read',
    'rsvp.write',
    'media.view',
    'media.upload',
    'media.delete',
    'media.moderate',
  ],
  FUNCTION_MANAGER: ['event.read', 'function.read', 'function.manage', 'guest.read', 'rsvp.read', 'media.view'],
  GUEST_MANAGER: [
    'event.read',
    'function.read',
    'guest.read',
    'guest.write',
    'group.manage',
    'invitation.read',
    'invitation.send',
    'invitation.revoke',
    'rsvp.read',
    'rsvp.write',
  ],
  MEDIA_MANAGER: ['event.read', 'function.read', 'media.view', 'media.upload', 'media.delete', 'media.moderate'],
  PHOTOGRAPHER: ['event.read', 'function.read', 'media.view', 'media.upload'],
};

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, readonly PlatformPermission[]> = {
  USER: [],
  SUPPORT: ['admin.read', 'billing.read', 'media.moderate'],
  CONTENT_MANAGER: ['admin.read', 'template.manage', 'asset.manage', 'content.manage', 'media.moderate'],
  FINANCE_MANAGER: ['admin.read', 'billing.read', 'payment.refund', 'pricing.manage'],
  PLATFORM_ADMIN: PLATFORM_PERMISSIONS.filter((p) => !SUPER_ONLY.includes(p)),
  SUPER_ADMIN: PLATFORM_PERMISSIONS,
};

export function eventRoleHasPermission(role: EventRole, permission: EventPermission): boolean {
  return EVENT_ROLE_PERMISSIONS[role].includes(permission);
}

export function platformRoleHasPermission(role: PlatformRole, permission: PlatformPermission): boolean {
  return PLATFORM_ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsForEventRole(role: EventRole): EventPermission[] {
  return [...EVENT_ROLE_PERMISSIONS[role]];
}
