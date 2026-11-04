import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { clerkMiddleware } from '@clerk/express';
import { env, isProd } from './env';
import { clientIp, globalLimiter, originGuard } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { LOCAL_PUBLIC_DIR, cloudEnabled } from './lib/storage';
import { authRouter } from './routes/auth';
import { publicRouter } from './routes/public';
import { donationsRouter } from './routes/donations';
import { webhooksRouter } from './routes/webhooks';
import { meRouter } from './routes/me';
import { staffRouter } from './routes/staff';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // One proxy hop in front (Vercel / Render / Cloudflare). Adjust if you add more.
  app.set('trust proxy', isProd ? 1 : false);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // uploaded public images are embedded by the web app
      contentSecurityPolicy: {
        useDefaults: true,
        directives: { 'default-src': ["'none'"], 'frame-ancestors': ["'none'"] },
      },
      hsts: isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
    }),
  );
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(clientIp);
  if (env.CLERK_SECRET_KEY) app.use(clerkMiddleware());

  // Webhooks need the untouched body for signature verification, so mount before express.json().
  app.use('/api/webhooks', webhooksRouter);

  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  app.use(originGuard);
  app.use('/api', globalLimiter);

  if (!cloudEnabled) {
    app.use(
      '/files',
      express.static(LOCAL_PUBLIC_DIR, {
        maxAge: '7d',
        setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
      }),
    );
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  app.use('/api/auth', authRouter);
  app.use('/api/donations', donationsRouter);
  app.use('/api/me', meRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api', publicRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
