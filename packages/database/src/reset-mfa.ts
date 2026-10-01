/**
 * Turn off two-step sign-in for a user who lost their authenticator and
 * recovery codes (operators only, after verifying the person out of band).
 *
 *   pnpm --filter @bulava/database reset-mfa <email>
 *
 * The secret and recovery codes are deleted, every session is revoked and the
 * reset is written to the audit log. Staff must enrol again before they can
 * use the admin console.
 */
import { createPrismaClient } from './client';

async function main(): Promise<void> {
  const [email] = process.argv.slice(2);
  if (!email) {
    console.error('Usage: reset-mfa <email>');
    process.exit(2);
  }
  const prisma = createPrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || user.deletedAt) {
      console.error(`No active user with email ${email}.`);
      process.exit(1);
    }
    if (!user.totpEnabledAt) {
      console.log(`${user.email} does not use two-step sign-in. Nothing to do.`);
      return;
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { totpSecretCiphertext: null, totpEnabledAt: null, totpLastStep: null } }),
      prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.id } }),
      prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.auditLog.create({ data: { actorType: 'SYSTEM', action: 'admin.mfa_reset_cli', targetType: 'User', targetId: user.id } }),
    ]);
    console.log(`${user.email}: two-step sign-in was reset and all sessions were signed out.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
