import { PrismaClient } from '../generated/client';

const globalForPrisma = globalThis as unknown as { __bulavaPrisma?: PrismaClient };

/**
 * Create a PrismaClient. Apps should create exactly one per process
 * (the API wraps this in PrismaService); scripts may use getPrismaClient().
 */
export function createPrismaClient(options?: ConstructorParameters<typeof PrismaClient>[0]): PrismaClient {
  return new PrismaClient(options);
}

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.__bulavaPrisma) {
    globalForPrisma.__bulavaPrisma = createPrismaClient();
  }
  return globalForPrisma.__bulavaPrisma;
}
