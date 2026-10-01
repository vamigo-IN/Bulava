/**
 * Grant or revoke a platform role from the command line (operators only).
 *
 *   pnpm --filter @bulava/database set-role <email> <ROLE> [--replace]
 *
 * ROLE is USER, SUPPORT, CONTENT_MANAGER, FINANCE_MANAGER, PLATFORM_ADMIN or
 * SUPER_ADMIN. Day-to-day role changes belong in the admin console (Staff); this
 * command is for recovery, e.g. when the only Super Admin has lost access. There
 * is exactly one Super Admin: making someone else Super Admin needs --replace,
 * which demotes the current one to PLATFORM_ADMIN in the same transaction.
 *
 * The user must already have signed up. The change is written to the audit log
 * and the affected users' sessions are revoked so the new role takes effect on
 * the next sign-in.
 */
import { createPrismaClient } from './client';

const ROLES = ['USER', 'SUPPORT', 'CONTENT_MANAGER', 'FINANCE_MANAGER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'] as const;
type Role = (typeof ROLES)[number];

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const replace = args.includes('--replace');
  const [email, role] = args.filter((a) => !a.startsWith('--'));
  if (!email || !role || !ROLES.includes(role as Role)) {
    console.error(`Usage: set-role <email> <${ROLES.join('|')}> [--replace]`);
    process.exit(2);
  }
  const prisma = createPrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || user.deletedAt) {
      console.error(`No active user with email ${email}. Ask them to sign up first.`);
      process.exit(1);
    }
    const previous = user.platformRole;
    const current = await prisma.user.findFirst({ where: { platformRole: 'SUPER_ADMIN' }, select: { id: true, email: true } });
    const displaced = role === 'SUPER_ADMIN' && current && current.id !== user.id ? current : null;
    if (displaced && !replace) {
      console.error(`${displaced.email} is the Super Admin. There can be only one: add --replace to demote them to PLATFORM_ADMIN.`);
      process.exit(1);
    }
    const now = new Date();
    await prisma.$transaction([
      ...(displaced
        ? [
            // Demote first: a unique index allows one Super Admin at a time.
            prisma.user.update({ where: { id: displaced.id }, data: { platformRole: 'PLATFORM_ADMIN' } }),
            prisma.session.updateMany({ where: { userId: displaced.id, revokedAt: null }, data: { revokedAt: now } }),
          ]
        : []),
      prisma.user.update({ where: { id: user.id }, data: { platformRole: role as Role } }),
      prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } }),
      prisma.auditLog.create({
        data: {
          actorType: 'SYSTEM',
          action: 'admin.role_set_cli',
          targetType: 'User',
          targetId: user.id,
          metadata: { previous, role, ...(displaced ? { demotedSuperAdminId: displaced.id } : {}) },
        },
      }),
    ]);
    console.log(`${user.email}: ${previous} -> ${role}. Existing sessions were signed out.`);
    if (displaced) console.log(`${displaced.email}: SUPER_ADMIN -> PLATFORM_ADMIN.`);
    if (previous === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
      console.warn('The platform now has no Super Admin: site settings and staff roles are locked until one is set.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
