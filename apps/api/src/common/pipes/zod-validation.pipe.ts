import { Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error';

/** Validates and transforms input with a shared @bulava/validation schema. */
@Injectable()
export class ZodValidationPipe implements PipeTransform<unknown, unknown> {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppError(
        'VALIDATION_FAILED',
        'Request validation failed.',
        result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      );
    }
    return result.data;
  }
}

/** Validates a route param as a UUID so malformed ids never reach the database. */
@Injectable()
export class ParseIdPipe implements PipeTransform<string, string> {
  private static readonly UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  transform(value: string): string {
    if (!ParseIdPipe.UUID.test(value)) throw new AppError('NOT_FOUND', 'Not found.');
    return value.toLowerCase();
  }
}
