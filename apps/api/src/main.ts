import 'reflect-metadata';
import { initSentry } from './sentry';
import { createApp } from './bootstrap';
import { APP_CONFIG, type AppConfig } from './config/env';

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
