import type { EventDomain, PrismaClient } from '@bulava/database';
import { challengeName, challengeValue } from './hostname';
import type { DnsResolver, HostnameProvider } from './providers';

/** Where customer domains must point. */
export interface RoutingTarget {
  /** CNAME target, e.g. "domains.bulava.in". */
  cname: string;
  /** Accepted A records for apex domains that cannot use a CNAME. */
  addresses: readonly string[];
}

export interface CheckDeps {
  prisma: Pick<PrismaClient, 'eventDomain'>;
  resolver: DnsResolver;
  provider: HostnameProvider;
  target: RoutingTarget;
  now?: Date;
}

/** A pending domain that never verifies is given up after a week. */
const PENDING_LIMIT_MS = 7 * 86_400_000;
/** An active domain whose DNS stops pointing at us is switched off after this many checks in a row. */
const ACTIVE_FAILURE_LIMIT = 3;

export type DomainError = 'TXT_MISSING' | 'ROUTING_MISSING' | 'SSL_PENDING' | 'PROVIDER_ERROR' | 'EXPIRED' | 'TAKEN';

async function routed(deps: CheckDeps, hostname: string): Promise<boolean> {
  const cnames = await deps.resolver.cname(hostname);
  if (cnames.includes(deps.target.cname.toLowerCase())) return true;
  if (!deps.target.addresses.length) return false;
  const addresses = await deps.resolver.a(hostname);
  return addresses.length > 0 && addresses.every((a) => deps.target.addresses.includes(a));
}

/**
 * Another event's claim on the same hostname that proved ownership earlier.
 * It keeps the name while it works; a lapsed claim (switched off, or its event
 * deleted) gives way to a newer proof of ownership.
 */
async function claimOwner(deps: CheckDeps, domain: EventDomain) {
  const owner = await deps.prisma.eventDomain.findFirst({
    where: { hostname: domain.hostname, id: { not: domain.id }, verifiedAt: { not: null } },
    select: { id: true, status: true, providerId: true, event: { select: { deletedAt: true } } },
  });
  if (!owner) return null;
  return { ...owner, lapsed: owner.status === 'FAILED' || owner.event.deletedAt !== null };
}

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === 'P2002';

/**
 * Checks one domain and records the outcome:
 * 1. ownership: the TXT record `_bulava-challenge.<host>` holds `bulava-verify=<token>`
 *    (needed once, before activation). Unverified claims never block anyone,
 *    so a name cannot be squatted; only one claim per hostname can be verified;
 * 2. routing: the host CNAMEs to the target (or its A records are ours);
 * 3. TLS: the provider has an active certificate.
 * Only then is it ACTIVE. Active domains that stop pointing at Bulava are
 * switched off after a few checks, so a lapsed domain can never serve an event.
 */
export async function checkDomain(deps: CheckDeps, domainId: string): Promise<EventDomain> {
  const now = deps.now ?? new Date();
  const domain = await deps.prisma.eventDomain.findUniqueOrThrow({ where: { id: domainId } });
  const save = async (data: Partial<EventDomain>) => {
    try {
      return await deps.prisma.eventDomain.update({ where: { id: domainId }, data: { ...data, lastCheckedAt: now } });
    } catch (error) {
      // Another claim on the hostname was verified at the same moment.
      if (!isUniqueViolation(error)) throw error;
      return deps.prisma.eventDomain.update({ where: { id: domainId }, data: { lastError: 'TAKEN', lastCheckedAt: now } });
    }
  };

  const expired = domain.status === 'PENDING' && now.getTime() - domain.createdAt.getTime() > PENDING_LIMIT_MS;
  let verifiedAt = domain.verifiedAt;
  if (!verifiedAt) {
    const txt = await deps.resolver.txt(challengeName(domain.hostname));
    if (txt.includes(challengeValue(domain.verificationToken))) {
      const owner = await claimOwner(deps, domain);
      if (owner && !owner.lapsed) return save({ lastError: 'TAKEN', status: expired ? 'FAILED' : domain.status });
      if (owner) {
        // The name changed hands: the old claim stops being verified and loses its certificate.
        if (owner.providerId) await deps.provider.remove(owner.providerId).catch(() => undefined);
        await deps.prisma.eventDomain.update({
          where: { id: owner.id },
          data: { verifiedAt: null, providerId: null, sslStatus: null, status: 'FAILED', lastError: 'TAKEN', lastCheckedAt: now },
        });
      }
      verifiedAt = now;
    }
  }
  const pointsHere = verifiedAt ? await routed(deps, domain.hostname) : false;

  if (!verifiedAt || !pointsHere) {
    const error: DomainError = !verifiedAt ? 'TXT_MISSING' : 'ROUTING_MISSING';
    if (domain.status === 'ACTIVE') {
      const failedChecks = domain.failedChecks + 1;
      return save({ lastError: error, failedChecks, status: failedChecks >= ACTIVE_FAILURE_LIMIT ? 'FAILED' : 'ACTIVE' });
    }
    return save({ verifiedAt, lastError: expired ? 'EXPIRED' : error, status: expired ? 'FAILED' : domain.status === 'FAILED' ? 'FAILED' : 'PENDING' });
  }

  try {
    const state = await deps.provider.ensure(domain.hostname, domain.providerId);
    return save({
      verifiedAt,
      providerId: state.id,
      sslStatus: state.sslStatus,
      status: state.ready ? 'ACTIVE' : domain.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING',
      lastError: state.ready ? null : 'SSL_PENDING',
      failedChecks: 0,
    });
  } catch {
    return save({ verifiedAt, lastError: 'PROVIDER_ERROR' });
  }
}

/**
 * The worker's periodic pass: pending domains every run, active ones daily.
 * Returns how many were checked and how many are active afterwards.
 */
export async function checkDueDomains(deps: CheckDeps, limit = 100): Promise<{ checked: number; active: number }> {
  const now = deps.now ?? new Date();
  const due = await deps.prisma.eventDomain.findMany({
    where: {
      OR: [
        { status: 'PENDING' },
        { status: 'ACTIVE', OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(now.getTime() - 86_400_000) } }] },
      ],
    },
    select: { id: true },
    orderBy: { lastCheckedAt: { sort: 'asc', nulls: 'first' } },
    take: limit,
  });
  let active = 0;
  for (const d of due) {
    try {
      if ((await checkDomain(deps, d.id)).status === 'ACTIVE') active++;
    } catch {
      /* one broken domain must not stop the rest */
    }
  }
  return { checked: due.length, active };
}
