import type { MessageKey, Translator } from '@bulava/localization';
import { ApiError } from './api';

/** A plan limit reached (PLAN_LIMIT_REACHED) or a paid feature (PLAN_UPGRADE_REQUIRED): something a plan unlocks. */
export const isPlanLimit = (error: unknown): error is ApiError => error instanceof ApiError && (error.code === 'PLAN_LIMIT_REACHED' || error.code === 'PLAN_UPGRADE_REQUIRED');

/** The limit's own words, by the feature the API names (`details.feature`). */
const LIMIT_KEYS: Record<string, MessageKey> = {
  'events.max': 'limit.events.max',
  'functions.max': 'limit.functions.max',
  'guests.max': 'limit.guests.max',
  'media.photos.max': 'limit.media.photos.max',
  'video.renders.max': 'limit.video.renders.max',
  'messaging.whatsapp.max': 'limit.messaging.whatsapp.max',
};

/** What a plan without the feature says (PLAN_UPGRADE_REQUIRED), by the feature the API names. */
const UPGRADE_KEYS: Record<string, MessageKey> = {
  'messaging.whatsapp.max': 'limit.upgrade.whatsapp',
  'music.enabled': 'limit.upgrade.music',
  'link.custom': 'limit.upgrade.link',
  'domain.custom': 'limit.upgrade.domain',
};

const detailsOf = (error: ApiError) => (error.details ?? {}) as { feature?: string; limit?: number | null; tier?: string };

/** A plan limit in words: which limit, and how many the plan allows (never "upgrade": plans unlock more). */
export function planLimitMessage(t: Translator, error: ApiError): string {
  const { feature, limit } = detailsOf(error);
  if (error.code === 'PLAN_LIMIT_REACHED') {
    // A plan without videos: they come with a bigger plan or as an add-on (ADR-062).
    if (feature === 'video.renders.max' && limit === 0) return t('limit.video.none');
    const key = feature ? LIMIT_KEYS[feature] : undefined;
    return key && typeof limit === 'number' ? t(key, { limit: limit.toLocaleString('en-IN') }) : t('error.PLAN_LIMIT_REACHED');
  }
  // A design of a bigger tier, or a feature the plan does not have.
  if (detailsOf(error).tier) return t('limit.upgrade.design');
  const upgrade = feature ? UPGRADE_KEYS[feature] : undefined;
  return upgrade ? t(upgrade) : t('error.PLAN_UPGRADE_REQUIRED');
}

/**
 * Where to unlock more: from an event, its plan page (the account's plans and
 * add-ons, with what the event has; the number of events too, which the
 * account's plan sets); elsewhere, the account's plan page.
 */
export function unlockHref(_error: ApiError, eventId?: string | null): string {
  return eventId ? `/dashboard/events/${eventId}/unlock` : '/dashboard/plan';
}

/** Sent by the API client when a request meets a plan limit, so the dashboard can offer to unlock it. */
export const PLAN_LIMIT_EVENT = 'bulava:plan-limit';
export interface PlanLimitDetail {
  code: string;
  feature?: string;
  limit?: number | null;
}
