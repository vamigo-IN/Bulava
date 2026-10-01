import { Global, Injectable, Module } from '@nestjs/common';
import { QueueService } from '../../infrastructure/queue/queue.service';

/** Product analytics events (spec §58). Tracked server-side where they happen. */
export type AnalyticsEventName =
  | 'signup'
  | 'event_created'
  | 'function_created'
  | 'template_selected'
  | 'invitation_created'
  | 'invitation_sent'
  | 'invitation_opened'
  | 'whatsapp_clicked'
  | 'rsvp_completed'
  | 'qr_scanned'
  | 'media_uploaded'
  | 'gallery_viewed'
  | 'video_generation_started'
  | 'video_generated'
  | 'video_downloaded'
  | 'checkout_started'
  | 'payment_success'
  | 'payment_failed';

/**
 * Enqueues analytics events; the worker stores them (AnalyticsEvent) and
 * forwards them to PostHog when configured. Never blocks or fails a request.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly queues: QueueService) {}

  track(
    name: AnalyticsEventName,
    ids: { eventId?: string | null; userId?: string | null; guestId?: string | null } = {},
    properties: Record<string, unknown> = {},
  ): void {
    void this.queues.addQuietly('analytics', {
      name,
      eventId: ids.eventId ?? null,
      userId: ids.userId ?? null,
      guestId: ids.guestId ?? null,
      distinctId: ids.userId ?? ids.guestId ?? null,
      properties,
      occurredAt: new Date().toISOString(),
    });
  }
}

@Global()
@Module({ providers: [AnalyticsService], exports: [AnalyticsService] })
export class AnalyticsModule {}
