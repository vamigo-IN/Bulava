import type { Prisma } from '@bulava/database';

type Tx = Prisma.TransactionClient;

/** Registrants join this system group so hosts can target functions, announcements and galleries at them. */
export const REGISTERED_GROUP_SLUG = 'registered-guests';

/** The Registered guests group, created on first use. */
export async function ensureRegisteredGroup(tx: Tx, eventId: string): Promise<string> {
  const existing = await tx.guestGroup.findUnique({ where: { eventId_slug: { eventId, slug: REGISTERED_GROUP_SLUG } }, select: { id: true } });
  if (existing) return existing.id;
  const group = await tx.guestGroup.create({
    data: { eventId, name: 'Registered guests', slug: REGISTERED_GROUP_SLUG, description: 'People who registered on the public event page.', kind: 'SYSTEM' },
  });
  return group.id;
}

/**
 * Link-shared events (public, private link, secret link) take registrations by
 * default, so a host can share one link without adding guests first.
 *
 * - `always`: the event has just become link-shared (created that way, or
 *   switched from invite-only or group-only): registration is switched on, even
 *   if an earlier setting had it off.
 * - otherwise registration is switched on only when the host has never saved a
 *   setting, so an explicit "off" is respected.
 *
 * Returns true when registration was switched on.
 */
export async function openRegistrationByDefault(tx: Tx, eventId: string, options: { always?: boolean } = {}): Promise<boolean> {
  const current = await tx.eventRegistrationSettings.findUnique({ where: { eventId }, select: { enabled: true } });
  if (current && (current.enabled || !options.always)) return false;
  const groupId = await ensureRegisteredGroup(tx, eventId);
  await tx.eventRegistrationSettings.upsert({
    where: { eventId },
    create: { eventId, enabled: true, groupId },
    update: { enabled: true, groupId },
  });
  return true;
}
