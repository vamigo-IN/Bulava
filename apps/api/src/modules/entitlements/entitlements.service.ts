import { Global, Injectable, Module } from '@nestjs/common';
import { featureLimit, loadEventFeatures, loadUserFeatures, type FeatureValue } from '@bulava/database';
import { FEATURE_KEYS, TEMPLATE_TIER_RANK, type FeatureKey } from '@bulava/validation';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

export type { FeatureValue } from '@bulava/database';

/**
 * Plan / Feature / Entitlement resolution. Nothing about pricing or limits is
 * hard-coded: the FREE plan's PlanFeature rows are the baseline, and paid
 * grants (Entitlement rows from verified payments or complimentary upgrades)
 * override it. The rules live in @bulava/database so the workers share them.
 */
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Effective features for an event: FREE baseline, overridden by event purchases and the owner's subscription. */
  async forEvent(eventId: string): Promise<Map<string, FeatureValue>> {
    const features = await loadEventFeatures(this.prisma, eventId);
    if (!features) throw AppError.notFound('Event');
    return features;
  }

  /** Features for creating new events (user-level): FREE baseline + subscription. */
  forUser(userId: string): Promise<Map<string, FeatureValue>> {
    return loadUserFeatures(this.prisma, userId);
  }

  static limit(features: Map<string, FeatureValue>, key: FeatureKey): number | null {
    return featureLimit(features, key);
  }

  static enabled(features: Map<string, FeatureValue>, key: FeatureKey): boolean {
    return features.get(key)?.enabled ?? false;
  }

  /** Throws PLAN_LIMIT_REACHED when `current + adding` would exceed the limit. */
  static assertWithinLimit(features: Map<string, FeatureValue>, key: FeatureKey, current: number, adding = 1): void {
    const limit = EntitlementsService.limit(features, key);
    if (limit !== null && current + adding > limit) {
      throw new AppError('PLAN_LIMIT_REACHED', `Your plan allows up to ${limit} for this feature. Unlock more with a plan.`, { feature: key, limit });
    }
  }

  static assertTemplateTier(features: Map<string, FeatureValue>, tier: keyof typeof TEMPLATE_TIER_RANK): void {
    const maxTier = EntitlementsService.limit(features, FEATURE_KEYS.TEMPLATES_MAX_TIER) ?? 2;
    if (TEMPLATE_TIER_RANK[tier] > maxTier) {
      throw new AppError('PLAN_UPGRADE_REQUIRED', `This is a ${tier.toLowerCase()} template. Unlock it with a plan.`, { tier });
    }
  }

  /** Serializable summary for the dashboard. */
  static summary(features: Map<string, FeatureValue>) {
    return Object.fromEntries([...features].map(([k, v]) => [k, { enabled: v.enabled, limit: v.limit, source: v.source }]));
  }
}

@Global()
@Module({ providers: [EntitlementsService], exports: [EntitlementsService] })
export class EntitlementsModule {}
