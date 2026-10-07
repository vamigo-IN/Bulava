import { createServer } from 'node:http';
import pino from 'pino';
import * as Sentry from '@sentry/node';
import { initSentry } from './sentry';
import { createPrismaClient } from '@bulava/database';
import { connectionFromUrl, createWorker, QueueName } from '@bulava/queue';
import { ObjectStorage } from '@bulava/storage';
import { processTemplateAsset } from './assets';
import { processMediaItem } from './processor';

/** Media worker: consumes media-processing jobs (photos and design assets). Scale horizontally; concurrency ~ CPU cores. */
async function main(): Promise<void> {
  const log = pino({ name: 'bulava-media-worker', level: process.env.LOG_LEVEL ?? 'info' });
  initSentry('media-worker');
  // A promise nobody awaited must not stop the worker (Node's default): it is logged instead,
  // and Sentry (when set up) reports it through its own handler.
  process.on('unhandledRejection', (reason) => log.error({ err: reason }, 'Unhandled promise rejection'));
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error('REDIS_URL is required');

  const prisma = createPrismaClient();
  const storage = ObjectStorage.fromEnv();
  const concurrency = Number(process.env.MEDIA_WORKER_CONCURRENCY ?? 2);

  const worker = createWorker(
    QueueName.MEDIA_PROCESSING,
    async (job) => ('assetId' in job.data ? processTemplateAsset({ prisma, storage, log }, job.data.assetId) : processMediaItem({ prisma, storage, log }, job.data.mediaItemId)),
    connectionFromUrl(redisUrl),
    { concurrency },
  );
  worker.on('failed', async (job, error) => {
    log.error({ err: error, jobId: job?.id }, 'Media job failed');
    if (process.env.SENTRY_DSN) Sentry.captureException(error);
    // After the final attempt, leave a clear state instead of PROCESSING forever.
    if (job && 'mediaItemId' in job.data && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await prisma.mediaItem
        .updateMany({ where: { id: job.data.mediaItemId, status: 'PROCESSING' }, data: { status: 'REJECTED', moderationNotes: 'Processing failed' } })
        .catch(() => undefined);
    }
  });
  log.info({ concurrency }, 'Media worker started');

  const health = createServer((_, res) => {
    const ok = worker.isRunning();
    res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' }).end(JSON.stringify({ status: ok ? 'ok' : 'down' }));
  }).listen(Number(process.env.WORKER_HEALTH_PORT ?? 4102));

  const shutdown = async () => {
    log.info('Shutting down');
    health.close();
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
