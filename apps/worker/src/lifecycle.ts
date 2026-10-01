import type { PrismaClient } from '@bulava/database';

const DAY = 86_400_000;

export interface LifecycleOptions {
  /** An event completes this long after its last function (default 2 days). */
  completeAfterDays: number;
  /** A completed event is archived this long after its last function (default 180 days). */
  archiveAfterDays: number;
  /** Soft-deleted events are purged permanently after this long (default 30 days; spec §83). */
  retentionDays: number;
}

export function lifecycleOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): LifecycleOptions {
  const num = (v: string | undefined, fallback: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : fallback);
  return {
    completeAfterDays: num(env.EVENT_COMPLETE_AFTER_DAYS, 2),
    archiveAfterDays: num(env.EVENT_ARCHIVE_AFTER_DAYS, 180),
    retentionDays: num(env.EVENT_RETENTION_DAYS, 30),
  };
}

/** Latest end (or start) among an event's non-draft functions. */
async function lastFunctionAt(prisma: PrismaClient, eventId: string): Promise<Date | null> {
  const fns = await prisma.eventFunction.findMany({ where: { eventId, deletedAt: null, status: { not: 'DRAFT' } }, select: { startsAt: true, endsAt: true } });
  const times = fns.map((f) => (f.endsAt ?? f.startsAt)?.getTime()).filter((t): t is number => typeof t === 'number');
  return times.length ? new Date(Math.max(...times)) : null;
}

/**
 * Event lifecycle (spec §100): ACTIVE → COMPLETED once every function is over,
 * COMPLETED → ARCHIVED later. Guests can still open completed and archived
 * invitations; RSVPs close with COMPLETED. Undated events are left alone.
 */
export async function advanceEventLifecycle(
  prisma: PrismaClient,
  options: LifecycleOptions,
  now = Date.now(),
  /** Limit to these events (tests); all events by default. */
  only?: string[],
): Promise<{ completed: number; archived: number }> {
  let completed = 0;
  let archived = 0;
  const candidates = await prisma.event.findMany({
    where: { deletedAt: null, status: { in: ['ACTIVE', 'COMPLETED'] }, ...(only ? { id: { in: only } } : {}) },
    select: { id: true, status: true },
    orderBy: { updatedAt: 'asc' },
    take: 1000,
  });
  for (const event of candidates) {
    const last = await lastFunctionAt(prisma, event.id);
    if (!last) continue;
    const next =
      event.status === 'ACTIVE' && last.getTime() + options.completeAfterDays * DAY < now
        ? last.getTime() + options.archiveAfterDays * DAY < now
          ? 'ARCHIVED'
          : 'COMPLETED'
        : event.status === 'COMPLETED' && last.getTime() + options.archiveAfterDays * DAY < now
          ? 'ARCHIVED'
          : null;
    if (!next) continue;
    // Conditional update: a host changing the status meanwhile wins.
    const changed = await prisma.event.updateMany({ where: { id: event.id, status: event.status }, data: { status: next } });
    if (!changed.count) continue;
    await prisma.auditLog.create({
      data: { actorType: 'SYSTEM', action: `event.${next.toLowerCase()}`, targetType: 'Event', targetId: event.id, eventId: event.id, metadata: { from: event.status } },
    });
    if (next === 'COMPLETED') completed++;
    else archived++;
  }
  return { completed, archived };
}

/**
 * Permanently delete events soft-deleted longer than the retention period:
 * their stored photos and videos first, then the rows (cascading to guests,
 * RSVPs, media rows…). Orders, entitlements and the audit log keep the event
 * id as a plain value, so financial and audit records survive.
 */
export async function purgeDeletedEvents(
  prisma: PrismaClient,
  deleteObject: (key: string) => Promise<void>,
  options: LifecycleOptions,
  now = Date.now(),
  /** Releases a custom domain's certificate at the TLS provider (Cloudflare). */
  removeHostname: (providerId: string) => Promise<void> = async () => undefined,
): Promise<number> {
  const cutoff = new Date(now - options.retentionDays * DAY);
  const events = await prisma.event.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true, accessPolicyId: true }, take: 20 });
  for (const event of events) {
    const domain = await prisma.eventDomain.findUnique({ where: { eventId: event.id }, select: { providerId: true } });
    if (domain?.providerId) await removeHostname(domain.providerId).catch(() => undefined);
    const [media, videos, functions] = await Promise.all([
      prisma.mediaItem.findMany({ where: { eventId: event.id }, select: { originalKey: true, optimizedKey: true, thumbnailKey: true } }),
      prisma.generatedVideo.findMany({ where: { videoJob: { eventId: event.id } }, select: { storageKey: true } }),
      prisma.eventFunction.findMany({ where: { eventId: event.id, accessPolicyId: { not: null } }, select: { accessPolicyId: true } }),
    ]);
    const keys = [...media.flatMap((m) => [m.originalKey, m.optimizedKey, m.thumbnailKey]), ...videos.map((v) => v.storageKey)].filter((k): k is string => !!k);
    for (const key of keys) await deleteObject(key).catch(() => undefined);
    const policyIds = [event.accessPolicyId, ...functions.map((f) => f.accessPolicyId).filter((id): id is string => !!id)];
    await prisma.$transaction([
      prisma.event.delete({ where: { id: event.id } }),
      prisma.accessPolicy.deleteMany({ where: { id: { in: policyIds } } }),
      prisma.auditLog.create({ data: { actorType: 'SYSTEM', action: 'event.purged', targetType: 'Event', targetId: event.id, eventId: event.id, metadata: { objects: keys.length } } }),
    ]);
  }
  return events.length;
}
