import { RequestMethod, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { APP_CONFIG, type AppConfig } from './config/env';
import { CSRF_HEADER } from './common/guards/csrf.guard';

/** Shared by main.ts and the e2e tests so both run the exact same HTTP stack. */
export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, rawBody: true });
  configureApp(app);
  return app;
}

export function configureApp(app: NestExpressApplication): void {
  const config = app.get<AppConfig>(APP_CONFIG);
  app.useLogger(app.get(Logger));

  if (config.TRUST_PROXY !== false) app.set('trust proxy', config.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API only serves JSON (plus Swagger UI in non-production).
      contentSecurityPolicy: config.swaggerEnabled ? false : { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '256kb' });

  app.enableCors({
    origin: (origin, callback) => callback(null, !origin || config.allowedOrigins.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', CSRF_HEADER],
    maxAge: 600,
  });

  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/db', method: RequestMethod.GET },
      { path: 'health/redis', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
    ],
  });
  app.enableShutdownHooks();

  if (config.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app as INestApplication,
      new DocumentBuilder()
        .setTitle('Bulava API')
        .setDescription(
          'REST API for Bulava. Responses are wrapped as { success, data } or { success: false, error: { code, message } }. ' +
            `Cookie-authenticated mutations must send the "${CSRF_HEADER}: 1" header.`,
        )
        .setVersion('1')
        .addBearerAuth()
        .addCookieAuth('bulava_at')
        .build(),
    );
    SwaggerModule.setup('api/docs', app as INestApplication, document);
  }
}
