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

const detailsOf = (error: ApiError) => (error.details ?? {}) as { feature?: string; limit?: number | null };

/** A plan limit in words: which limit, and how many the plan allows (never "upgrade": plans unlock more). */
export function planLimitMessage(t: Translator, error: ApiError): string {
  const { feature, limit } = detailsOf(error);
  if (error.code === 'PLAN_LIMIT_REACHED') {
    const key = feature ? LIMIT_KEYS[feature] : undefined;
    return key && typeof limit === 'number' ? t(key, { limit: limit.toLocaleString('en-IN') }) : t('error.PLAN_LIMIT_REACHED');
  }
  return t('error.PLAN_UPGRADE_REQUIRED');
}

/**
 * Where to unlock more: an event's plans for an event's limits (guests,
 * functions, photos, films, designs), the plans page for the account's own
 * (how many events it can have).
 */
export function unlockHref(error: ApiError, eventId?: string | null): string {
  const { feature } = detailsOf(error);
  return feature === 'events.max' || !eventId ? '/pricing' : `/dashboard/events/${eventId}/unlock`;
}

/** Sent by the API client when a request meets a plan limit, so the dashboard can offer to unlock it. */
export const PLAN_LIMIT_EVENT = 'bulava:plan-limit';
export interface PlanLimitDetail {
  code: string;
  feature?: string;
  limit?: number | null;
}
