import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { finalize, type Observable } from 'rxjs';
import { httpDuration, httpRequests } from '../../modules/metrics/metrics.controller';

/** Records request counts and latency per route template (not per raw URL, to bound cardinality). */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const route = (req.route as { path?: string } | undefined)?.path ?? 'unknown';
    const end = httpDuration.startTimer({ method: req.method, route });
    return next.handle().pipe(
      finalize(() => {
        end();
        httpRequests.inc({ method: req.method, route, status: String(res.statusCode) });
      }),
    );
  }
}
