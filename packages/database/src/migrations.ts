import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '../generated/client';

/**
 * This release's migrations (the folders in `prisma/migrations`) that the
 * database has not applied yet, oldest first: all of them while it has never
 * been migrated. The deploy's template preview runs before the migrations, so
 * it reads the database with this release's code only when none are pending.
 */
export async function pendingMigrations(prisma: Pick<PrismaClient, '$queryRaw'>, migrationsDir: string): Promise<string[]> {
  const release = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(migrationsDir, entry.name, 'migration.sql')))
    .map((entry) => entry.name)
    .sort();
  let applied: Array<{ migration_name: string }>;
  try {
    applied = await prisma.$queryRaw<Array<{ migration_name: string }>>`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  } catch (error) {
    // No migration table (Postgres 42P01, "relation does not exist"): nothing has been applied.
    if (/42P01|_prisma_migrations" does not exist/.test(error instanceof Error ? error.message : String(error))) return release;
    throw error;
  }
  const done = new Set(applied.map((row) => row.migration_name));
  return release.filter((name) => !done.has(name));
}
