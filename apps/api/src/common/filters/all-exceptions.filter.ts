import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@bulava/database';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { Sentry } from '../../sentry';

interface ErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
  requestId?: string;
}

/**
 * Converts every error into the structured envelope:
 *   { success: false, error: { code, message, details? }, requestId }
 * Stack traces and internal messages are never sent to clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string | number }>();
    const { status, body } = this.toResponse(exception);
    if (request.id !== undefined) body.requestId = String(request.id);

    if (status >= 500) {
      this.logger.error({ err: exception, requestId: body.requestId }, 'Unhandled error');
      if (process.env.SENTRY_DSN) Sentry.captureException(exception);
    }
    response.status(status).json(body);
  }

  private toResponse(exception: unknown): { status: number; body: ErrorBody } {
    const make = (status: number, code: string, message: string, details?: unknown) => ({
      status,
      body: {
        success: false as const,
        error: { code, message, ...(details === undefined ? {} : { details }) },
      },
    });

    if (exception instanceof AppError) {
      return make(exception.status, exception.code, exception.message, exception.details);
    }
    if (exception instanceof ThrottlerException) {
      return make(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Too many requests. Please try again shortly.');
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return make(HttpStatus.CONFLICT, 'CONFLICT', 'This record already exists.');
      if (exception.code === 'P2025') return make(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found.');
      if (exception.code === 'P2003') return make(HttpStatus.BAD_REQUEST, 'INVALID_REFERENCE', 'Invalid reference.');
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const codeByStatus: Record<number, string> = {
        401: 'UNAUTHENTICATED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        413: 'PAYLOAD_TOO_LARGE',
      };
      const code = codeByStatus[status] ?? (status < 500 ? 'BAD_REQUEST' : 'INTERNAL_ERROR');
      const message = status < 500 ? exception.message : 'An unexpected error occurred.';
      return make(status, code, message);
    }
    return make(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'An unexpected error occurred.');
  }
}
