import { hashPassword } from '@bulava/auth';
import type { PrismaClient } from '../generated/client';

export interface PlatformAdminSeed {
  email: string;
  password: string;
  name?: string;
  /** Overwrite the password of an existing account (otherwise it is left alone). */
  resetPassword?: boolean;
}

export interface PlatformAdminSeedResult {
  outcome: 'created' | 'updated';
  role: 'SUPER_ADMIN' | 'PLATFORM_ADMIN';
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Ensure the platform's owner account exists (from ADMIN_EMAIL / ADMIN_PASSWORD at seed time).
 *
 * The account becomes the Super Admin when the platform has none yet; a database
 * index allows only one. When the role has since been handed to someone else
 * (Staff > Transfer), the seeded account stays a Platform admin: seed runs never
 * take the role back, and never demote the current Super Admin.
 *
 * Idempotent: a new account is created with the password; an existing account is
 * promoted and re-activated, but its password is only replaced when
 * `resetPassword` is set, so a password changed after the first deploy is never
 * silently reverted by later seed runs.
 */
export async function seedPlatformAdmin(prisma: PrismaClient, input: PlatformAdminSeed): Promise<PlatformAdminSeedResult> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new Error('ADMIN_EMAIL is not a valid email address');
  // Same minimum as customer signup.
  if (input.password.length < 10) throw new Error('ADMIN_PASSWORD must be at least 10 characters');

  const existing = await prisma.user.findUnique({ where: { email } });
  const superAdmin = await prisma.user.findFirst({ where: { platformRole: 'SUPER_ADMIN' }, select: { id: true } });
  const role = !superAdmin || superAdmin.id === existing?.id ? 'SUPER_ADMIN' : 'PLATFORM_ADMIN';

  if (!existing) {
    const user = await prisma.user.create({
      data: {
        email,
        name: input.name?.trim() || 'Platform Admin',
        passwordHash: await hashPassword(input.password),
        emailVerifiedAt: new Date(),
        platformRole: role,
      },
    });
    await prisma.auditLog.create({ data: { actorType: 'SYSTEM', action: 'admin.seeded', targetType: 'User', targetId: user.id, metadata: { created: true, role } } });
    return { outcome: 'created', role };
  }

  const passwordHash = input.resetPassword ? await hashPassword(input.password) : undefined;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: existing.id },
      data: { platformRole: role, status: 'ACTIVE', deletedAt: null, ...(passwordHash ? { passwordHash } : {}) },
    }),
    // A password reset signs the account out everywhere.
    ...(passwordHash ? [prisma.session.updateMany({ where: { userId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } })] : []),
    prisma.auditLog.create({
      data: {
        actorType: 'SYSTEM',
        action: 'admin.seeded',
        targetType: 'User',
        targetId: existing.id,
        metadata: { created: false, passwordReset: !!passwordHash, previousRole: existing.platformRole, role },
      },
    }),
  ]);
  return { outcome: 'updated', role };
}
