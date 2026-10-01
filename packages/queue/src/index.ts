import { Queue, Worker, type ConnectionOptions, type JobsOptions, type Processor, type WorkerOptions } from 'bullmq';

/**
 * Queue names and typed payloads. Payloads carry ids only (never PII);
 * workers load what they need from the database, and handlers are idempotent.
 */
export const QueueName = {
  MEDIA_PROCESSING: 'media-processing',
  VIDEO_RENDER: 'video-render',
  NOTIFICATIONS: 'notifications',
  EMAIL: 'email',
  ANALYTICS: 'analytics',
  EXPORTS: 'exports',
  CLEANUP: 'cleanup',
} as const;
export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export interface JobPayloads {
  /** A guest or host photo, or a template design asset (web renditions of painted art). */
  'media-processing': { mediaItemId: string } | { assetId: string };
  'video-render': { videoJobId: string };
  notifications: { notificationId: string };
  email: { to: string; subject: string; html: string; text: string; notificationId?: string };
  analytics: {
    name: string;
    eventId?: string | null;
    userId?: string | null;
    guestId?: string | null;
    distinctId?: string | null;
    properties?: Record<string, unknown>;
    occurredAt: string;
  };
  exports: { exportType: 'GUESTS_CSV' | 'RSVPS_CSV'; eventId: string; requestedById: string };
  cleanup: { task: 'expired-sessions' | 'stale-uploads' | 'deleted-events' | 'event-lifecycle' | 'reminders' | 'domains' };
}

/** Sensible defaults per queue: retries with exponential backoff, bounded history. */
export const DEFAULT_JOB_OPTIONS: Record<QueueName, JobsOptions> = {
  'media-processing': { attempts: 4, backoff: { type: 'exponential', delay: 5_000 }, removeOnComplete: 1000, removeOnFail: 5000 },
  'video-render': { attempts: 2, backoff: { type: 'exponential', delay: 30_000 }, removeOnComplete: 500, removeOnFail: 2000 },
  notifications: { attempts: 5, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: 5000, removeOnFail: 5000 },
  email: { attempts: 5, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: 5000, removeOnFail: 5000 },
  analytics: { attempts: 3, backoff: { type: 'exponential', delay: 5_000 }, removeOnComplete: 10_000, removeOnFail: 1000 },
  exports: { attempts: 2, backoff: { type: 'fixed', delay: 10_000 }, removeOnComplete: 200, removeOnFail: 500 },
  cleanup: { attempts: 1, removeOnComplete: 100, removeOnFail: 100 },
};

/** BullMQ connection options from a redis:// URL. */
export function connectionFromUrl(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    db: url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : 0,
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

export type TypedQueue<N extends QueueName> = Queue<JobPayloads[N], unknown, string>;

export function createQueue<N extends QueueName>(name: N, connection: ConnectionOptions, prefix = 'bulava'): TypedQueue<N> {
  return new Queue<JobPayloads[N], unknown, string>(name, {
    connection,
    prefix,
    defaultJobOptions: DEFAULT_JOB_OPTIONS[name],
  });
}

export function createWorker<N extends QueueName>(
  name: N,
  processor: Processor<JobPayloads[N], unknown, string>,
  connection: ConnectionOptions,
  options: Omit<WorkerOptions, 'connection'> = {},
  prefix = 'bulava',
): Worker<JobPayloads[N], unknown, string> {
  return new Worker<JobPayloads[N], unknown, string>(name, processor, { connection, prefix, ...options });
}

export { Queue, QueueEvents, Worker } from 'bullmq';
export type { Queue as QueueType } from 'bullmq';
export type { Job, JobsOptions } from 'bullmq';
