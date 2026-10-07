import { createServer } from 'node:http';
import pino from 'pino';
import * as Sentry from '@sentry/node';
import { initSentry } from './sentry';
import { createPrismaClient } from '@bulava/database';
import { connectionFromUrl, createQueue, createWorker, QueueName } from '@bulava/queue';
import { ObjectStorage } from '@bulava/storage';
import { processAnalytics, processCleanup, processEmail, processNotification, processWhatsApp, type WorkerDeps } from './processors';
import { SettingsProviders } from './providers';
import { systemResolver } from '@bulava/domains';
import { SettingsStore, type SettingsDb } from '@bulava/settings';

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is required`);
  return v;
}

/** General worker: notifications, email, analytics and scheduled cleanup. */
async function main(): Promise<void> {
  const log = pino({ name: 'bulava-worker', level: process.env.LOG_LEVEL ?? 'info' });
  initSentry('worker');
  // A promise nobody awaited must not stop the worker (Node's default): it is logged instead,
  // and Sentry (when set up) reports it through its own handler.
  process.on('unhandledRejection', (reason) => log.error({ err: reason }, 'Unhandled promise rejection'));

  const connection = connectionFromUrl(required('REDIS_URL'));
  const prisma = createPrismaClient();
  const storage = ObjectStorage.fromEnv();
  const notificationsQueue = createQueue(QueueName.NOTIFICATIONS, connection);
  // Email, WhatsApp and custom-domain providers follow the Super Admin's settings (admin console),
  // falling back to the environment until those are first saved.
  const settings = new SettingsStore(prisma as unknown as SettingsDb, required('TOKEN_ENCRYPTION_KEY'));
  const providers = new SettingsProviders(settings, {
    webHost: new URL(required('WEB_ORIGIN')).hostname,
    whatsappApiBase: process.env.WHATSAPP_API_BASE || undefined,
    cloudflareApiBase: process.env.CLOUDFLARE_API_BASE || undefined,
  });
  const deps: WorkerDeps = {
    prisma,
    email: () => providers.email(),
    siteName: async () => (await settings.get('site')).value.name,
    whatsapp: () => providers.whatsapp(),
    // Without a certificate source (settings: Custom domains) the domain checks are skipped.
    domains: async () => {
      const routing = await providers.domains();
      return routing ? { resolver: systemResolver, ...routing } : null;
    },
    enqueueNotification: async (id) => {
      await notificationsQueue.add(QueueName.NOTIFICATIONS as never, { notificationId: id } as never, { jobId: `notification-${id}` });
    },
    env: {
      WEB_ORIGIN: required('WEB_ORIGIN'),
      TOKEN_ENCRYPTION_KEY: required('TOKEN_ENCRYPTION_KEY'),
      POSTHOG_KEY: process.env.POSTHOG_KEY || undefined,
      POSTHOG_HOST: process.env.POSTHOG_HOST || undefined,
    },
    log,
  };
  if (!(await deps.email())) log.warn('Email is not configured (admin console > Integrations): email notifications will be marked SKIPPED');
  const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 10);

  const workers = [
    createWorker(QueueName.NOTIFICATIONS, (job) => processNotification(deps, job.data), connection, { concurrency }),
    createWorker(QueueName.EMAIL, (job) => processEmail(deps, job.data), connection, { concurrency }),
    createWorker(QueueName.WHATSAPP, (job) => processWhatsApp(deps, job.data), connection, { concurrency }),
    createWorker(QueueName.ANALYTICS, (job) => processAnalytics(deps, job.data), connection, { concurrency: concurrency * 2 }),
    createWorker(QueueName.CLEANUP, (job) => processCleanup({ ...deps, deleteObject: (k) => storage.delete(k) }, job.data), connection, { concurrency: 1 }),
  ];
  for (const w of workers) {
    w.on('failed', (job, error) => {
      log.error({ err: error, queue: w.name, jobId: job?.id }, 'Job failed');
      if (process.env.SENTRY_DSN) Sentry.captureException(error);
    });
  }

  // Repeatable housekeeping jobs (deduplicated by BullMQ across worker replicas).
  const cleanup = createQueue(QueueName.CLEANUP, connection);
  await cleanup.add('expired-sessions', { task: 'expired-sessions' }, { repeat: { pattern: '17 3 * * *' }, jobId: 'cleanup-sessions' });
  await cleanup.add('stale-uploads', { task: 'stale-uploads' }, { repeat: { pattern: '0 * * * *' }, jobId: 'cleanup-uploads' });
  await cleanup.add('event-lifecycle', { task: 'event-lifecycle' }, { repeat: { pattern: '40 2 * * *' }, jobId: 'cleanup-event-lifecycle' });
  await cleanup.add('deleted-events', { task: 'deleted-events' }, { repeat: { pattern: '10 4 * * *' }, jobId: 'cleanup-deleted-events' });
  await cleanup.add('reminders', { task: 'reminders' }, { repeat: { pattern: '* * * * *' }, jobId: 'cleanup-reminders' });
  await cleanup.add('domains', { task: 'domains' }, { repeat: { pattern: '*/10 * * * *' }, jobId: 'cleanup-domains' });
  log.info({ concurrency }, 'Worker started');

  const health = createServer((_, res) => {
    const ok = workers.every((w) => w.isRunning());
    res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' }).end(JSON.stringify({ status: ok ? 'ok' : 'down' }));
  }).listen(Number(process.env.WORKER_HEALTH_PORT ?? 4101));

  const shutdown = async () => {
    log.info('Shutting down');
    health.close();
    await Promise.all(workers.map((w) => w.close()));
    await cleanup.close();
    await notificationsQueue.close();
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
