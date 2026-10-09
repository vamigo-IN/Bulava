import { Global, Inject, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { connectionFromUrl, createQueue, QueueEvents, QueueName, type JobPayloads, type JobsOptions, type Queue, type TypedQueue } from '@bulava/queue';
import { APP_CONFIG, type AppConfig } from '../../config/env';

/**
 * Producer side of BullMQ. The API only enqueues; workers (apps/worker,
 * apps/media-worker, apps/video-worker) consume. Jobs carry ids, not PII.
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<QueueName, TypedQueue<QueueName>>();
  private readonly connection;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.connection = connectionFromUrl(config.REDIS_URL);
  }

  private queue<N extends QueueName>(name: N): TypedQueue<N> {
    let q = this.queues.get(name);
    if (!q) {
      q = createQueue(name, this.connection) as unknown as TypedQueue<QueueName>;
      this.queues.set(name, q);
    }
    return q as unknown as TypedQueue<N>;
  }

  async add<N extends QueueName>(name: N, payload: JobPayloads[N], options: JobsOptions = {}): Promise<string | undefined> {
    // BullMQ types job names generically; payloads are typed by JobPayloads above.
    const queue = this.queue(name) as unknown as Queue<JobPayloads[N]>;
    const job = await queue.add(name as never, payload as never, options);
    return job.id;
  }

  /** Best effort: analytics must never break a user request. */
  async addQuietly<N extends QueueName>(name: N, payload: JobPayloads[N], options: JobsOptions = {}): Promise<void> {
    try {
      await this.add(name, payload, options);
    } catch (error) {
      this.logger.warn({ err: error, queue: name }, 'Failed to enqueue job');
    }
  }

  /**
   * Enqueue one attempt and wait for a worker to finish it, returning the
   * worker's result or throwing its error. For admin connection tests only.
   */
  async runAndWait<N extends QueueName>(name: N, payload: JobPayloads[N], timeoutMs: number): Promise<unknown> {
    const events = new QueueEvents(name, { connection: this.connection, prefix: 'bulava' });
    try {
      await events.waitUntilReady();
      const queue = this.queue(name) as unknown as Queue<JobPayloads[N]>;
      const job = await queue.add(name as never, payload as never, { attempts: 1, removeOnComplete: true, removeOnFail: 50 });
      return await job.waitUntilFinished(events, timeoutMs);
    } finally {
      await events.close().catch(() => undefined);
    }
  }

  /** A job's state and its worker's result, to report progress; never its data. Null once it is gone. */
  async jobState<N extends QueueName>(name: N, jobId: string): Promise<{ state: string; result: unknown } | null> {
    const job = await this.queue(name).getJob(jobId);
    if (!job) return null;
    return { state: await job.getState(), result: job.returnvalue };
  }

  async counts(): Promise<Record<string, Record<string, number>>> {
    const out: Record<string, Record<string, number>> = {};
    for (const name of Object.values(QueueName)) {
      out[name] = await this.queue(name).getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    }
    return out;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close().catch(() => undefined)));
  }
}

@Global()
@Module({ providers: [QueueService], exports: [QueueService] })
export class QueueModule {}
