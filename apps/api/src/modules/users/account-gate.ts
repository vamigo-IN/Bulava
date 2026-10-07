import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

/**
 * An account made from a WhatsApp number alone (the quick start) can design and
 * preview, but publishing, paying and inviting others wait until the person
 * secures it: a verified code, an email and password, or Google.
 */
export async function assertVerifiedAccount(prisma: Pick<PrismaService, 'user'>, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { provisional: true } });
  if (!user || user.provisional) {
    throw new AppError('ACCOUNT_UNVERIFIED', 'Secure your account first: verify your WhatsApp number, or add an email and password.');
  }
}
