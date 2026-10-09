import { seedPlatformAdmin } from './admin-seed';
import { createPrismaClient } from './client';
import { seedOriginalMusic } from './music-seed';
import { seedReferenceData, seedTemplates } from './seed-data';
import { seedSitePages } from './site-pages';

/**
 * Idempotent seed: reference data, the template catalog, and (when ADMIN_EMAIL
 * and ADMIN_PASSWORD are set) the platform owner account, which becomes the
 * Super Admin while the platform has none.
 *
 *   node dist/seed.js [--update-templates] [--templates-only] [--dry-run]
 *
 * --templates-only runs just the template catalog's migration (seedTemplates);
 * --dry-run (templates only) lists what it would create, update, sync or retire
 * and writes nothing. The deploy's migrate job runs the full seed.
 *
 * Admin variables: ADMIN_EMAIL, ADMIN_PASSWORD, optional ADMIN_NAME, and
 * ADMIN_RESET_PASSWORD=true to overwrite an existing admin's password.
 *
 * SEED_ORIGINAL_MUSIC=true (set by the production migrate job, with the R2_*
 * storage variables) also uploads Bulava's original tracks and adds them to the
 * music library. Off by default so local seeds never write to a real bucket.
 */
const flag = (name: string) => process.argv.includes(name);

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  try {
    const dryRun = flag('--dry-run');
    if (flag('--templates-only') || dryRun) {
      const result = await seedTemplates(prisma, { updateChanged: flag('--update-templates'), dryRun });
      for (const c of result.changes) console.log(`  ${c.change.padEnd(6)} ${c.key}`);
      console.log(`${dryRun ? 'Dry run (nothing written). Would change' : 'Templates'}: ${templateSummary(result)}.`);
      return;
    }
    await seedReferenceData(prisma);
    const result = await seedTemplates(prisma, { updateChanged: flag('--update-templates') });
    const pages = await seedSitePages(prisma);
    console.log(`Reference data seeded. Templates: ${templateSummary(result)}. Site pages: ${pages} created.`);

    const email = process.env.ADMIN_EMAIL?.trim();
    const password = process.env.ADMIN_PASSWORD;
    if (email && password) {
      const { outcome, role } = await seedPlatformAdmin(prisma, {
        email,
        password,
        name: process.env.ADMIN_NAME,
        resetPassword: process.env.ADMIN_RESET_PASSWORD === 'true',
      });
      console.log(`Platform owner ${email}: ${outcome} (${role === 'SUPER_ADMIN' ? 'Super Admin' : 'Platform admin; the Super Admin role belongs to another account'}).`);
    } else if (email || password) {
      console.warn('Set both ADMIN_EMAIL and ADMIN_PASSWORD to seed the platform admin; skipping.');
    }

    if (process.env.SEED_ORIGINAL_MUSIC === 'true') {
      // Optional: a storage problem is reported, not fatal, so it cannot keep the whole site from
      // starting. Nothing is added to the library unless the upload succeeds, so the next deploy retries.
      try {
        // Loaded only here, so ordinary seeds need no storage configuration.
        const { ObjectStorage } = await import('@bulava/storage');
        const music = await seedOriginalMusic(prisma, ObjectStorage.fromEnv());
        console.log(`Original music: ${music.created} added to the library, ${music.uploaded} uploaded.`);
      } catch (error) {
        console.error(
          `Original music was NOT uploaded: ${error instanceof Error ? error.message : String(error)}\n` +
            'Check R2_ENDPOINT (https://<Cloudflare account ID>.r2.cloudflarestorage.com; a wrong account ID fails the TLS handshake), ' +
            'R2_BUCKET (the bucket must exist), R2_ACCESS_KEY and R2_SECRET_KEY. The admin console tests storage under Website > Integrations > Storage. ' +
            'The next deploy tries again.',
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

function templateSummary(r: { created: number; updated: number; synced: number; retired: number }): string {
  return `${r.created} created, ${r.updated} updated, ${r.synced} listings synced, ${r.retired} retired`;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
