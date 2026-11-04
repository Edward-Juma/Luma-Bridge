import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new HttpError(400, msg, 'bad_request', details);
export const unauthorized = (msg = 'Authentication required') =>
  new HttpError(401, msg, 'unauthorized');
export const forbidden = (msg = 'You do not have permission to do that') =>
  new HttpError(403, msg, 'forbidden');
export const unavailable = (msg = 'This service is temporarily unavailable') =>
  new HttpError(503, msg, 'service_unavailable');
export const notFound = (msg = 'Not found') => new HttpError(404, msg, 'not_found');
export const conflict = (msg: string, details?: unknown) =>
  new HttpError(409, msg, 'conflict', details);

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wraps an async route so rejected promises reach the error middleware (Express 4). */
export const wrap =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
