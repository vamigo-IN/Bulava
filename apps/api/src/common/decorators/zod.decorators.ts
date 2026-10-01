import { applyDecorators, Body, Query } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { toJSONSchema, type ZodType } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

/** Validated request body param: `@ZodBody(Schema) body: Input`. */
export const ZodBody = (schema: ZodType) => Body(new ZodValidationPipe(schema));

/** Validated query param object. */
export const ZodQuery = (schema: ZodType) => Query(new ZodValidationPipe(schema));

/** Documents a Zod schema as the OpenAPI request body. */
export function ApiZodBody(schema: ZodType) {
  let jsonSchema: Record<string, unknown>;
  try {
    jsonSchema = toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  } catch {
    jsonSchema = { type: 'object' };
  }
  delete jsonSchema.$schema;
  return applyDecorators(ApiBody({ schema: jsonSchema }));
}
