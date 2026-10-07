import 'reflect-metadata';
import { initSentry } from './sentry';
import { createApp } from './bootstrap';
import { APP_CONFIG, type AppConfig } from './config/env';

// A promise nobody awaited (a background notification, an analytics call) must not take the whole
// API down, which is Node's default: it is logged (and reported to Sentry when set up) instead.
// Request errors never get here: Nest's exception filter answers them.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

async function main(): Promise<void> {
  initSentry('bulava-api');
  const app = await createApp();
  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.API_PORT, '0.0.0.0');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
