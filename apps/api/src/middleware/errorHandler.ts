import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../lib/errors';
import { formatZod } from './validate';
import { isProd } from '../env';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  if (err instanceof ZodError) {
    return res
      .status(400)
      .json({ error: { code: 'bad_request', message: 'Validation failed', details: formatZod(err) } });
  }
  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 8 MB).' : 'Upload failed.';
    return res.status(400).json({ error: { code: 'upload_error', message } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: { code: 'conflict', message: 'A record with these details already exists.' },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { code: 'not_found', message: 'Record not found' } });
    }
  }
  if (err instanceof Error && err.message === 'Unsupported or corrupt file') {
    return res.status(400).json({ error: { code: 'bad_file', message: err.message } });
  }

  console.error('[unhandled]', err);
  res.status(500).json({
    error: {
      code: 'internal',
      message: isProd ? 'Something went wrong on our side.' : String((err as Error)?.message ?? err),
    },
  });
}
