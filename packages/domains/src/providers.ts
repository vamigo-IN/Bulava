import { resolve4, resolveCname, resolveTxt } from 'node:dns/promises';

/** DNS lookups used for verification; swappable in tests. Missing records resolve to []. */
export interface DnsResolver {
  txt(name: string): Promise<string[]>;
  cname(name: string): Promise<string[]>;
  a(name: string): Promise<string[]>;
}

const MISSING = new Set(['ENOTFOUND', 'ENODATA', 'ESERVFAIL', 'ENOTIMP', 'EREFUSED', 'ETIMEOUT']);
async function orEmpty<T>(lookup: Promise<T[]>): Promise<T[]> {
  try {
    return await lookup;
  } catch (error) {
    if (MISSING.has((error as NodeJS.ErrnoException).code ?? '')) return [];
    throw error;
  }
}

export const systemResolver: DnsResolver = {
  txt: async (name) => (await orEmpty(resolveTxt(name))).map((chunks) => chunks.join('')),
  cname: async (name) => (await orEmpty(resolveCname(name))).map((c) => c.toLowerCase().replace(/\.$/, '')),
  a: (name) => orEmpty(resolve4(name)),
};

export interface HostnameState {
  /** Provider's id for the hostname (null when the operator handles TLS). */
  id: string | null;
  /** Serving traffic with a valid certificate. */
  ready: boolean;
  sslStatus: string;
}

/**
 * Where certificates for customer domains come from. Cloudflare for SaaS
 * issues and renews them at the edge; "manual" means the operator's own
 * setup (for example certificates on the load balancer) and trusts DNS alone.
 */
export interface HostnameProvider {
  readonly name: string;
  ensure(hostname: string, existingId: string | null): Promise<HostnameState>;
  remove(id: string): Promise<void>;
}

export class ManualHostnameProvider implements HostnameProvider {
  readonly name = 'manual';
  async ensure(): Promise<HostnameState> {
    return { id: null, ready: true, sslStatus: 'operator' };
  }
  async remove(): Promise<void> {}
}

interface CloudflareHostname {
  id: string;
  hostname: string;
  status: string;
  ssl?: { status?: string };
}

/** Cloudflare for SaaS custom hostnames (https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/). */
export class CloudflareSaasProvider implements HostnameProvider {
  readonly name = 'cloudflare';

  constructor(
    private readonly options: { apiToken: string; zoneId: string; apiBase?: string },
    private readonly http: typeof fetch = fetch,
  ) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.http(`${this.options.apiBase ?? 'https://api.cloudflare.com/client/v4'}/zones/${this.options.zoneId}/custom_hostnames${path}`, {
      method,
      headers: { authorization: `Bearer ${this.options.apiToken}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean; result?: T; errors?: Array<{ code: number; message: string }> } | null;
    if (!res.ok || !json?.success) {
      const error = new Error(`Cloudflare ${method} ${path || '/'}: ${json?.errors?.map((e) => `${e.code} ${e.message}`).join('; ') ?? res.status}`);
      (error as Error & { status?: number }).status = res.status;
      throw error;
    }
    return json.result as T;
  }

  private state(h: CloudflareHostname): HostnameState {
    const ssl = h.ssl?.status ?? 'unknown';
    return { id: h.id, ready: h.status === 'active' && ssl === 'active', sslStatus: ssl };
  }

  async ensure(hostname: string, existingId: string | null): Promise<HostnameState> {
    if (existingId) {
      try {
        return this.state(await this.call<CloudflareHostname>('GET', `/${existingId}`));
      } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error;
      }
    }
    try {
      const created = await this.call<CloudflareHostname>('POST', '', { hostname, ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } } });
      return this.state(created);
    } catch (error) {
      // Already registered (for example after a retry): look it up instead.
      const found = await this.call<CloudflareHostname[]>('GET', `?hostname=${encodeURIComponent(hostname)}`);
      if (found[0]) return this.state(found[0]);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.call('DELETE', `/${id}`);
    } catch (error) {
      if ((error as { status?: number }).status !== 404) throw error;
    }
  }
}

/** Cloudflare when configured, otherwise the operator's own TLS. */
/**
 * Where customer-domain certificates come from: Cloudflare for SaaS when configured,
 * the operator when CUSTOM_DOMAIN_TLS=manual (they install certificates themselves),
 * otherwise nowhere, and then custom domains are unavailable. Going live without a
 * certificate would move guests' links to an https:// address that cannot connect.
 */
export function hostnameProviderFromEnv(env: NodeJS.ProcessEnv = process.env): HostnameProvider | null {
  if (env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ZONE_ID) {
    return new CloudflareSaasProvider({ apiToken: env.CLOUDFLARE_API_TOKEN, zoneId: env.CLOUDFLARE_ZONE_ID, apiBase: env.CLOUDFLARE_API_BASE || undefined });
  }
  if (env.CUSTOM_DOMAIN_TLS === 'manual') return new ManualHostnameProvider();
  return null;
}
