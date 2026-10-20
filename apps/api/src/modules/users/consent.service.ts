import { Injectable } from '@nestjs/common';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';

/** Consents recorded when an account is created (one row per policy). */
export const SIGNUP_CONSENTS = [
  { kind: 'terms_of_service', slug: 'terms' },
  { kind: 'privacy_policy', slug: 'privacy' },
] as const;

/**
 * Consent records (DPDP Act): who agreed to which policy, which version of
 * its text, when, and where. The version is the policy page's last change, so
 * an edited policy is told apart from the one someone accepted.
 */
@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  /** "terms@2026-10-07T10:00:00.000Z;refund@…" for the given site pages. */
  async versions(slugs: readonly string[]): Promise<Record<string, string>> {
    const pages = await this.prisma.sitePage.findMany({ where: { slug: { in: [...slugs] } }, select: { slug: true, updatedAt: true } });
    return Object.fromEntries(slugs.map((slug) => [slug, `${slug}@${pages.find((p) => p.slug === slug)?.updatedAt.toISOString() ?? 'unpublished'}`]));
  }

  /** The Terms and the Privacy Policy, accepted when an account is created. */
  async recordSignup(tx: Tx, userId: string, versions: Record<string, string>, source: 'signup' | 'signup_google' | 'signup_whatsapp' | 'quick_start' | 'team_invite'): Promise<void> {
    await tx.consent.createMany({
      data: SIGNUP_CONSENTS.map(({ kind, slug }) => ({ userId, kind, granted: true, version: versions[slug] ?? `${slug}@unknown`, source })),
    });
  }

  /**
   * A preview request (ADR-076): the requester's tick for the Terms, the Privacy Policy and being contacted about it
   * (`versions` of those policies), or staff confirming a customer from outside agreed (`staff-confirmed`).
   */
  async recordPreviewContact(tx: Tx, previewRequestId: string, consent: { version: string; source: string; userId?: string | null }): Promise<void> {
    await tx.consent.create({ data: { previewRequestId, userId: consent.userId ?? null, kind: 'preview_contact', granted: true, version: consent.version, source: consent.source } });
  }

  /** Updates on WhatsApp: an optional consent of its own, given or withdrawn, never bundled with the Terms. */
  async recordWhatsAppUpdates(tx: Tx, userId: string, granted: boolean, source: 'signup' | 'quick_start' | 'account'): Promise<void> {
    await tx.consent.create({ data: { userId, kind: 'whatsapp_updates', granted, version: 'whatsapp_updates@1', source } });
  }
}
