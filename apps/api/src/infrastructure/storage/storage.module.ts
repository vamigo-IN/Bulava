import { Global, Logger, Module } from '@nestjs/common';
import { ObjectStorage, storageConfigFromEnv } from '@bulava/storage';
import { APP_CONFIG, type AppConfig } from '../../config/env';

export const STORAGE = Symbol('STORAGE');

/** Private object storage (R2 / S3-compatible). Access only through signed URLs. */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE,
      inject: [APP_CONFIG],
      useFactory: async (config: AppConfig) => {
        const storage = new ObjectStorage(storageConfigFromEnv(process.env));
        if (config.STORAGE_AUTO_CREATE_BUCKET) {
          await storage.ensureBucket().catch((error: unknown) => new Logger('Storage').warn(`Could not ensure bucket: ${String(error)}`));
        }
        return storage;
      },
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
