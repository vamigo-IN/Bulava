import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import pino from 'pino';
import * as Sentry from '@sentry/node';
import { initSentry } from './sentry';
import { ensureBrowser } from '@remotion/renderer';
import { createPrismaClient } from '@bulava/database';
import { connectionFromUrl, createWorker, QueueName } from '@bulava/queue';
import { ObjectStorage } from '@bulava/storage';
import { DEFAULT_BUNDLE_DIR } from './bundle';
import { renderVideoJob } from './render';

/**
 * Video worker (spec §48): a dedicated, independently scalable container.
 * Concurrency is bounded (VIDEO_WORKER_CONCURRENCY jobs, each using
 * VIDEO_RENDER_THREADS browser tabs) so one worker never overloads its host.
 */
async function main(): Promise<void> {
  const log = pino({ name: 'bulava-video-worker', level: process.env.LOG_LEVEL ?? 'info' });
  initSentry('video-worker');
  // A promise nobody awaited must not stop the worker (Node's default): it is logged instead,
  // and Sentry (when set up) reports it through its own handler.
  process.on('unhandledRejection', (reason) => log.error({ err: reason }, 'Unhandled promise rejection'));
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error('REDIS_URL is required');

  const prisma = createPrismaClient();
  const storage = ObjectStorage.fromEnv();
  const jobConcurrency = Number(process.env.VIDEO_WORKER_CONCURRENCY ?? 1);
  const renderThreads = Number(process.env.VIDEO_RENDER_THREADS ?? 2);

  log.info('Preparing headless browser');
  await ensureBrowser();
  // Production images ship a bundle made at build time (node dist/bundle.js);
  // in development the project is bundled on start, so a leftover local bundle
  // never renders stale templates.
  const prebuilt = process.env.REMOTION_BUNDLE_DIR ?? (process.env.NODE_ENV === 'production' ? DEFAULT_BUNDLE_DIR : undefined);
  let serveUrl: string;
  if (prebuilt && existsSync(path.join(prebuilt, 'index.html'))) {
    serveUrl = prebuilt;
    log.info({ serveUrl }, 'Using prebuilt Remotion bundle');
  } else {
    // The bundler (webpack, rspack) is a dev dependency: production images ship the bundle and
    // leave the bundler out, so one without its bundle fails here rather than bundling.
    log.info('Bundling Remotion project');
    const { bundle } = await import('@remotion/bundler');
    serveUrl = await bundle({ entryPoint: path.resolve(__dirname, '../remotion/index.ts') });
    log.info({ serveUrl }, 'Bundle ready');
  }

  const worker = createWorker(
    QueueName.VIDEO_RENDER,
    (job) =>
      renderVideoJob({ prisma, storage, serveUrl, concurrency: renderThreads, log }, job.data.videoJobId, {
        made: job.attemptsMade,
        max: job.opts.attempts ?? 1,
      }),
    connectionFromUrl(redisUrl),
    { concurrency: jobConcurrency, lockDuration: 10 * 60_000 },
  );
  worker.on('failed', (job, error) => {
    log.error({ err: error, jobId: job?.id }, 'Render failed');
    if (process.env.SENTRY_DSN) Sentry.captureException(error);
  });
  log.info({ jobConcurrency, renderThreads }, 'Video worker started');

  const health = createServer((_, res) => {
    const ok = worker.isRunning();
    res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' }).end(JSON.stringify({ status: ok ? 'ok' : 'down' }));
  }).listen(Number(process.env.WORKER_HEALTH_PORT ?? 4103));

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
