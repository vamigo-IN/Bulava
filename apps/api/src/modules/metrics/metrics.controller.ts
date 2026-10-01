import { Controller, Get, Header, Inject, Req, SetMetadata } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { collectDefaultMetrics, Counter, Gauge, Histogram, register } from 'prom-client';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { Public } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { RAW_RESPONSE } from '../../common/interceptors/response-envelope.interceptor';
import { QueueService } from '../../infrastructure/queue/queue.service';

collectDefaultMetrics({ prefix: 'bulava_api_' });

export const httpRequests = new Counter({
  name: 'bulava_api_http_requests_total',
  help: 'HTTP requests by method, route and status',
  labelNames: ['method', 'route', 'status'] as const,
});
export const httpDuration = new Histogram({
  name: 'bulava_api_http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

/** Prometheus metrics. Protected by METRICS_TOKEN (bearer) when set; excluded from the public docs. */
@ApiExcludeController()
@Public()
@SkipThrottle()
@SetMetadata(RAW_RESPONSE, true)
@Controller('metrics')
export class MetricsController {
  private readonly queueJobs: Gauge<'queue' | 'state'>;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    queues: QueueService,
  ) {
    // Queue depth per state, read from Redis at scrape time (spec §70: queue monitoring).
    const existing = register.getSingleMetric('bulava_queue_jobs') as Gauge<'queue' | 'state'> | undefined;
    this.queueJobs =
      existing ??
      new Gauge({
        name: 'bulava_queue_jobs',
        help: 'BullMQ jobs per queue and state',
        labelNames: ['queue', 'state'] as const,
        async collect() {
          const counts = await queues.counts().catch(() => ({}) as Record<string, Record<string, number>>);
          this.reset();
          for (const [queue, states] of Object.entries(counts)) {
            for (const [state, n] of Object.entries(states)) this.set({ queue, state }, n);
          }
        },
      });
  }

  @Get()
  @Header('Content-Type', register.contentType)
  async metrics(@Req() req: Request) {
    if (this.config.METRICS_TOKEN && req.get('authorization') !== `Bearer ${this.config.METRICS_TOKEN}`) throw AppError.notFound('Page');
    if (!this.config.METRICS_TOKEN && this.config.NODE_ENV === 'production') throw AppError.notFound('Page');
    return register.metrics();
  }
}
