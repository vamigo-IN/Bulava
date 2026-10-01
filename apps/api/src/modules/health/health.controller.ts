import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { Public } from '../../common/decorators/auth.decorators';
import { RAW_RESPONSE } from '../../common/interceptors/response-envelope.interceptor';
import { SetMetadata } from '@nestjs/common';

/** Liveness and dependency health. Mounted outside /api/v1 for load balancers and Docker. */
@ApiTags('health')
@Public()
@SkipThrottle()
@SetMetadata(RAW_RESPONSE, true)
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async health(@Res({ passthrough: true }) res: Response) {
    const [db, redis] = await Promise.all([this.checkDb(), this.redis.ping()]);
    const ok = db && redis;
    res.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: ok ? 'ok' : 'degraded', checks: { db: db ? 'up' : 'down', redis: redis ? 'up' : 'down' } };
  }

  @Get('db')
  async db(@Res({ passthrough: true }) res: Response) {
    const up = await this.checkDb();
    res.status(up ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: up ? 'up' : 'down' };
  }

  @Get('redis')
  async redisHealth(@Res({ passthrough: true }) res: Response) {
    const up = await this.redis.ping();
    res.status(up ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: up ? 'up' : 'down' };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
