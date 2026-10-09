import { createServer } from 'node:http';
import pino from 'pino';
import * as Sentry from '@sentry/node';
import { initSentry } from './sentry';
import { createPrismaClient } from '@bulava/database';
import { connectionFromUrl, createQueue, createWorker, QueueName } from '@bulava/queue';
import { ObjectStorage } from '@bulava/storage';
import { processTemplateAsset } from './assets';
import { cardRenderFailed, processCardUpload, renderCard } from './cards';
import { processMediaItem } from './processor';

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is required`);
  return v;
}

/**
 * Media worker: consumes media-processing jobs (photos, design assets and
 * photos placed in digital cards) and card-render jobs (digital cards drawn
 * by Chromium). Scale horizontally; concurrency ~ CPU cores.
 */
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

  const connection = connectionFromUrl(redisUrl);
  const worker = createWorker(
    QueueName.MEDIA_PROCESSING,
    async (job) =>
      'assetId' in job.data
        ? processTemplateAsset({ prisma, storage, log }, job.data.assetId)
        : 'cardUploadId' in job.data
          ? processCardUpload({ prisma, storage, log }, job.data.cardUploadId)
          : processMediaItem({ prisma, storage, log }, job.data.mediaItemId),
    connection,
    { concurrency },
  );
  // Digital cards: one Chromium at a time by default (it is the heaviest job on a small server).
  const emails = createQueue(QueueName.EMAIL, connection);
  const cardDeps = {
    prisma,
    storage,
    log,
    webUrl: process.env.WEB_INTERNAL_URL || 'http://127.0.0.1:3000',
    tokenKey: required('TOKEN_ENCRYPTION_KEY'),
    enqueueEmail: async (cardOrderId: string) => {
      await emails.add(QueueName.EMAIL as never, { cardOrderId } as never, { jobId: `card-email-${cardOrderId}` });
    },
  };
  const cards = createWorker(QueueName.CARD_RENDER, async (job) => renderCard(cardDeps, job.data.exportId), connection, {
    concurrency: Number(process.env.CARD_RENDER_CONCURRENCY ?? 1),
    // A render waits for fonts and photos; give it time before BullMQ thinks the worker died.
    lockDuration: 120_000,
  });
  cards.on('failed', async (job, error) => {
    log.error({ err: error, jobId: job?.id }, 'Card render failed');
    if (process.env.SENTRY_DSN) Sentry.captureException(error);
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) await cardRenderFailed(prisma, job.data.exportId, error).catch(() => undefined);
  });
  worker.on('failed', async (job, error) => {
    log.error({ err: error, jobId: job?.id }, 'Media job failed');
    if (process.env.SENTRY_DSN) Sentry.captureException(error);
    // After the final attempt, leave a clear state instead of PROCESSING forever.
    if (job && 'mediaItemId' in job.data && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await prisma.mediaItem
        .updateMany({ where: { id: job.data.mediaItemId, status: 'PROCESSING' }, data: { status: 'REJECTED', moderationNotes: 'Processing failed' } })
        .catch(() => undefined);
    }
    if (job && 'cardUploadId' in job.data && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await prisma.cardUpload
        .updateMany({ where: { id: job.data.cardUploadId, status: 'PROCESSING' }, data: { status: 'REJECTED', error: 'This photo could not be processed.' } })
        .catch(() => undefined);
    }
  });
  log.info({ concurrency }, 'Media worker started');

  const health = createServer((_, res) => {
    const ok = worker.isRunning() && cards.isRunning();
    res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' }).end(JSON.stringify({ status: ok ? 'ok' : 'down' }));
  }).listen(Number(process.env.WORKER_HEALTH_PORT ?? 4102));

  const shutdown = async () => {
    log.info('Shutting down');
    health.close();
    await Promise.all([worker.close(), cards.close()]);
    await emails.close();
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
