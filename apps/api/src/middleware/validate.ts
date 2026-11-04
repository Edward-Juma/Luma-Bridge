import type { NextFunction, Request, Response } from 'express';
import { z, ZodError, ZodTypeAny } from 'zod';
import { badRequest } from '../lib/errors';

type Source = 'body' | 'query' | 'params';

/**
 * Validates and REPLACES req[source] with the parsed (stripped, coerced) result so handlers
 * only ever see sanitised input.
 */
export const validate =
  <T extends ZodTypeAny>(schema: T, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(badRequest('Validation failed', formatZod(result.error)));
    }
    (req as unknown as Record<Source, unknown>)[source] = result.data;
    next();
  };

export function formatZod(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export type Infer<T extends ZodTypeAny> = z.infer<T>;
