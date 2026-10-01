import { decryptSecret, encryptSecret } from '@bulava/auth';
import {
  SETTING_SCHEMAS,
  SETTING_SECRETS,
  type SettingCheckResult,
  type SettingGroup,
  type SettingSecretName,
  type SettingValues,
} from '@bulava/validation';
import { envFallback } from './env';

/** One stored row (platform_settings). */
export interface SettingRow {
  key: string;
  value: unknown;
  secrets: unknown;
  lastCheck: unknown;
  updatedAt: Date;
  updatedById: string | null;
}

/** The slice of the Prisma client the store uses, so tests can pass a fake. */
export interface SettingsDb {
  platformSetting: {
    findUnique(args: { where: { key: string } }): Promise<SettingRow | null>;
    upsert(args: {
      where: { key: string };
      create: { key: string; value: object; secrets: object; lastCheck?: object; updatedById?: string | null };
      update: { value?: object; secrets?: object; lastCheck?: object; updatedById?: string | null };
    }): Promise<unknown>;
  };
}

/** Where the effective values come from. */
export type SettingSource = 'admin' | 'environment' | 'default';

export interface ResolvedSetting<G extends SettingGroup> {
  group: G;
  value: SettingValues[G];
  secrets: Partial<Record<SettingSecretName<G>, string>>;
  source: SettingSource;
  updatedAt: Date | null;
  updatedById: string | null;
  lastCheck: SettingCheckResult | null;
  /** Stored or environment values that no longer pass validation and were ignored. */
  ignored: string[];
}

export class SettingsValidationError extends Error {
  constructor(readonly issues: Array<{ path: string; message: string }>) {
    super('Invalid settings');
  }
}

/** Parse, dropping any top-level field that fails, so one bad value never disables a whole group. */
function lenientParse<G extends SettingGroup>(group: G, input: unknown): { value: SettingValues[G]; ignored: string[] } {
  const schema = SETTING_SCHEMAS[group];
  const first = schema.safeParse(input ?? {});
  if (first.success) return { value: first.data as SettingValues[G], ignored: [] };
  const bad = new Set(first.error.issues.map((i) => String(i.path[0] ?? '')));
  const cleaned = Object.fromEntries(Object.entries((input ?? {}) as Record<string, unknown>).filter(([k]) => !bad.has(k)));
  const second = schema.safeParse(cleaned);
  return second.success ? { value: second.data as SettingValues[G], ignored: [...bad] } : { value: schema.parse({}) as SettingValues[G], ignored: Object.keys(cleaned) };
}

/** Show only the last four characters of a secret. */
export function maskSecret(secret: string | undefined): string | null {
  if (!secret) return null;
  return secret.length >= 12 ? `••••${secret.slice(-4)}` : '••••';
}

/**
 * Platform settings: one row per group. The console's values win; a group
 * that was never saved falls back to environment variables, then to the
 * schema defaults. Secrets are AES-GCM encrypted with TOKEN_ENCRYPTION_KEY.
 * Reads are cached briefly, so every process sees a change within `ttlMs`.
 */
export class SettingsStore {
  private readonly cache = new Map<SettingGroup, { at: number; value: ResolvedSetting<SettingGroup> }>();

  constructor(
    private readonly db: SettingsDb,
    private readonly encryptionKey: string,
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly ttlMs = 15_000,
  ) {}

  async get<G extends SettingGroup>(group: G): Promise<ResolvedSetting<G>> {
    const hit = this.cache.get(group);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value as ResolvedSetting<G>;
    const row = await this.db.platformSetting.findUnique({ where: { key: group } });
    const resolved = this.resolve(group, row);
    this.cache.set(group, { at: Date.now(), value: resolved as ResolvedSetting<SettingGroup> });
    return resolved;
  }

  invalidate(group?: SettingGroup): void {
    if (group) this.cache.delete(group);
    else this.cache.clear();
  }

  private resolve<G extends SettingGroup>(group: G, row: SettingRow | null): ResolvedSetting<G> {
    const lastCheck = (row?.lastCheck as SettingCheckResult | null | undefined) ?? null;
    const saved = row !== null && typeof row.value === 'object' && row.value !== null && Object.keys(row.value).length > 0;
    if (saved) {
      const { value, ignored } = lenientParse(group, row.value);
      const secrets: Record<string, string> = {};
      for (const [name, ciphertext] of Object.entries((row.secrets ?? {}) as Record<string, string>)) {
        try {
          secrets[name] = decryptSecret(ciphertext, this.encryptionKey);
        } catch {
          ignored.push(`secret:${name}`);
        }
      }
      return { group, value, secrets: secrets as ResolvedSetting<G>['secrets'], source: 'admin', updatedAt: row.updatedAt, updatedById: row.updatedById, lastCheck, ignored };
    }
    const fallback = envFallback(group, this.env);
    const { value, ignored } = lenientParse(group, fallback?.value ?? {});
    return {
      group,
      value,
      secrets: (fallback?.secrets ?? {}) as ResolvedSetting<G>['secrets'],
      source: fallback ? 'environment' : 'default',
      updatedAt: null,
      updatedById: null,
      lastCheck,
      ignored,
    };
  }

  /**
   * Replace a group. `secretChanges`: a string sets a secret, null clears it,
   * a missing key keeps the current one (including one from the environment,
   * which the first save copies into the database).
   */
  async save<G extends SettingGroup>(group: G, value: unknown, secretChanges: Record<string, string | null | undefined>, userId: string | null): Promise<ResolvedSetting<G>> {
    const parsed = SETTING_SCHEMAS[group].safeParse(value);
    if (!parsed.success) throw new SettingsValidationError(parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
    const allowed = SETTING_SECRETS[group] as readonly string[];
    const unknown = Object.keys(secretChanges).filter((k) => !allowed.includes(k));
    if (unknown.length) throw new SettingsValidationError(unknown.map((k) => ({ path: `secrets.${k}`, message: 'Not a secret of this group' })));

    this.invalidate(group);
    const current = await this.get(group);
    const secrets: Record<string, string> = {};
    for (const name of allowed) {
      const change = secretChanges[name];
      const keep = (current.secrets as Record<string, string | undefined>)[name];
      if (change === null) continue;
      const plain = typeof change === 'string' ? change : keep;
      if (plain) secrets[name] = encryptSecret(plain, this.encryptionKey);
    }
    await this.db.platformSetting.upsert({
      where: { key: group },
      create: { key: group, value: parsed.data as object, secrets, updatedById: userId },
      update: { value: parsed.data as object, secrets, updatedById: userId },
    });
    this.invalidate(group);
    return this.get(group);
  }

  /** Remember the last connection check (also for 'storage', which has no settings of its own). */
  async recordCheck(key: SettingGroup | 'storage', result: SettingCheckResult): Promise<void> {
    await this.db.platformSetting.upsert({
      where: { key },
      create: { key, value: {}, secrets: {}, lastCheck: result as unknown as object },
      update: { lastCheck: result as unknown as object },
    });
    if (key !== 'storage') this.invalidate(key);
  }

  async lastCheck(key: 'storage'): Promise<SettingCheckResult | null> {
    const row = await this.db.platformSetting.findUnique({ where: { key } });
    return (row?.lastCheck as SettingCheckResult | null | undefined) ?? null;
  }
}
