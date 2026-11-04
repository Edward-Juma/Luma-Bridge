import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env, isProd } from '../env';
import { forbidden } from '../lib/errors';
import { randomToken, timingSafeEqualStr } from '../lib/crypto';

/** Resolve the client IP once (trust proxy is configured in app.ts). */
export function clientIp(req: Request, _res: Response, next: NextFunction) {
  req.clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  next();
}

const json429 = (message: string) => ({
  status: 429,
  message: { error: { code: 'rate_limited', message } },
});

export const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  ...json429('Too many requests. Please slow down.'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  skipSuccessfulRequests: true, // only failed attempts count toward the limit
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  ...json429('Too many attempts. Try again in a few minutes.'),
});

export const donationLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  ...json429('Too many donation attempts. Please try again shortly.'),
});

export const uploadLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  ...json429('Too many uploads. Please try again shortly.'),
});

export const publicWriteLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  ...json429('Too many submissions. Please try again later.'),
});

/**
 * CSRF protection (double-submit cookie).
 *
 * Access tokens travel in the Authorization header, which browsers never attach automatically,
 * so those requests are not CSRF-able. The refresh/logout endpoints DO rely on a cookie, so they
 * require the X-CSRF-Token header to match the readable `hb_csrf` cookie.
 */
export const CSRF_COOKIE = 'hb_csrf';

export function issueCsrf(res: Response): string {
  const token = randomToken(24);
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: 'strict',
    secure: isProd,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  return token;
}

export function requireCsrf(req: Request, _res: Response, next: NextFunction) {
  const cookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const header = req.header('x-csrf-token');
  if (!cookie || !header || !timingSafeEqualStr(cookie, header)) {
    return next(forbidden('Invalid CSRF token'));
  }
  next();
}

/** Reject cross-site browser requests that carry cookies from unexpected origins. */
export function originGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.header('origin');
  if (origin && origin !== env.WEB_ORIGIN) {
    // Webhooks are server-to-server and have no Origin header; browsers always send one.
    return next(forbidden('Origin not allowed'));
  }
  next();
}
