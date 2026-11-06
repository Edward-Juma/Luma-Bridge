import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { z } from 'zod';
import { prisma } from '../db';
import { wrap, badRequest, conflict, unauthorized, HttpError } from '../lib/errors';
import { validate } from '../middleware/validate';
import { loginSchema, mfaVerifySchema, registerSchema } from '../schemas';
import { authLimiter, emailAvailabilityLimiter, issueCsrf, requireCsrf, CSRF_COOKIE } from '../middleware/security';
import { requireAuth, requireRole } from '../middleware/auth';
import { encrypt, decrypt, fingerprint, sha256, randomToken } from '../lib/crypto';
import {
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
  signAccess,
  signMfaChallenge,
  verifyMfaChallenge,
} from '../lib/jwt';
import { audit, notify } from '../lib/audit';
import { isProd } from '../env';
import { computeCompletion } from '../services/profile';
import { scoreBeneficiary } from '../lib/fraud';
import type { Role, User } from '@prisma/client';

export const authRouter = Router();
// Strict limits apply to credential-guessing surfaces only. Session refresh/logout/me run on every page
// load for signed-in users, so they rely on the (generous) global limiter instead.
for (const route of ['/register', '/login', '/mfa/verify', '/2fa/enable']) authRouter.use(route, authLimiter);

const RT_COOKIE = 'hb_rt';
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

authenticator.options = { window: 1 };

authRouter.post(
  '/email-availability',
  emailAvailabilityLimiter,
  validate(z.object({ email: z.string().trim().toLowerCase().email().max(200) })),
  wrap(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email }, select: { id: true } });
    res.json({ available: !user });
  }),
);

function setRefreshCookie(res: Response, token: string) {
  res.cookie(RT_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd,
    path: '/api/auth',
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
}

async function issueSession(req: Request, res: Response, user: Pick<User, 'id' | 'role'>, mfa: boolean) {
  const accessToken = signAccess({ sub: user.id, role: user.role, mfa });
  const refresh = randomToken(48);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refresh),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      mfa,
      userAgent: req.header('user-agent')?.slice(0, 200),
      ip: req.clientIp,
    },
  });
  setRefreshCookie(res, refresh);
  issueCsrf(res);
  return { accessToken, expiresIn: ACCESS_TTL_SECONDS };
}

function sessionUser(u: Pick<User, 'id' | 'email' | 'role' | 'twoFactorEnabled'>, mfa: boolean) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    twoFactorEnabled: u.twoFactorEnabled,
    mfaVerified: mfa,
    needsMfaSetup: (u.role === 'AUDITOR' || u.role === 'ADMIN') && !u.twoFactorEnabled,
  };
}

// ───────────── Register (beneficiaries only; auditors are created by admins) ─────────────
authRouter.post(
  '/register',
  validate(registerSchema),
  wrap(async (req, res) => {
    const b = req.body as z.infer<typeof registerSchema>;

    const idFp = fingerprint(b.nationalId);
    const phoneFp = fingerprint(b.phone);

    const [dupId, dupPhone, dupEmail] = await Promise.all([
      prisma.beneficiary.findUnique({ where: { nationalIdFingerprint: idFp }, select: { id: true } }),
      prisma.beneficiary.findUnique({ where: { phoneFingerprint: phoneFp }, select: { id: true } }),
      prisma.user.findUnique({ where: { email: b.email }, select: { id: true } }),
    ]);

    if (dupId || dupPhone) {
      // Record for auditors, but never reveal to the requester which field matched.
      await prisma.fraudAlert.create({
        data: {
          beneficiaryId: (dupId ?? dupPhone)!.id,
          type: dupId ? 'DUPLICATE_ID_ATTEMPT' : 'DUPLICATE_PHONE_ATTEMPT',
          severity: 'MEDIUM',
          score: 45,
          details: { ip: req.clientIp, email: b.email },
        },
      });
      throw conflict('We could not create this account. If you already registered, please sign in or contact support.');
    }
    if (dupEmail) throw conflict('An account with this email already exists.');

    const passwordHash = await bcrypt.hash(b.password, 12);
    const user = await prisma.user.create({
      data: {
        email: b.email,
        passwordHash,
        role: 'BENEFICIARY',
        signupIp: req.clientIp,
        lastIp: req.clientIp,
        beneficiary: {
          create: {
            fullName: b.fullName,
            nationalIdEnc: encrypt(b.nationalId),
            nationalIdFingerprint: idFp,
            phone: b.phone,
            phoneFingerprint: phoneFp,
            gender: b.gender,
            dateOfBirth: b.dateOfBirth,
            country: b.country,
            city: b.city,
            address: b.address,
            incomeLevel: b.incomeLevel,
            occupation: b.occupation,
            familySize: b.familySize,
            emergencyContactName: b.emergencyContactName,
            emergencyContactPhone: b.emergencyContactPhone,
            about: b.about,
          },
        },
      },
      include: { beneficiary: true },
    });

    await prisma.beneficiary.update({
      where: { id: user.beneficiary!.id },
      data: { profileCompletion: await computeCompletion(user.beneficiary!.id) },
    });
    await scoreBeneficiary(user.beneficiary!.id);
    await audit({ actorId: user.id, action: 'auth.register', entity: 'User', entityId: user.id, ip: req.clientIp });
    await notify(user.id, 'Welcome to Luma Bridge', 'Your account is ready. Complete your profile and submit your request for auditor review.');

    const session = await issueSession(req, res, user, false);
    res.status(201).json({ ...session, user: sessionUser(user, false) });
  }),
);

// ───────────── Login ─────────────
authRouter.post(
  '/login',
  validate(loginSchema),
  wrap(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const user = await prisma.user.findUnique({ where: { email } });

    // Same work + same message for unknown email and bad password (no account enumeration).
    const dummy = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5pT6w2n0u0v8tqkQmQ3wGJZ4sA1pQ8y';
    const ok = await bcrypt.compare(password, user?.passwordHash ?? dummy);

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpError(429, 'Too many failed attempts. Try again in a few minutes.', 'locked');
    }
    if (!user || !ok) {
      if (user) {
        const failed = user.failedLogins + 1;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLogins: failed,
            ...(failed >= MAX_FAILED
              ? { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000), failedLogins: 0 }
              : {}),
          },
        });
        await audit({ actorId: user.id, action: 'auth.login_failed', entity: 'User', entityId: user.id, ip: req.clientIp });
      }
      throw unauthorized('Incorrect email or password');
    }
    if (user.status === 'BANNED') throw new HttpError(403, 'This account has been permanently banned.', 'banned');
    if (user.status === 'SUSPENDED' && (!user.suspendedUntil || user.suspendedUntil > new Date())) {
      throw new HttpError(403, 'This account is temporarily suspended.', 'suspended');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastIp: req.clientIp, lastLoginAt: new Date() },
    });

    if (user.twoFactorEnabled) {
      return res.json({ mfaRequired: true, challenge: signMfaChallenge(user.id) });
    }

    await audit({ actorId: user.id, action: 'auth.login', entity: 'User', entityId: user.id, ip: req.clientIp });
    const session = await issueSession(req, res, user, false);
    res.json({ ...session, user: sessionUser(user, false) });
  }),
);

authRouter.post(
  '/mfa/verify',
  validate(mfaVerifySchema),
  wrap(async (req, res) => {
    const { challenge, code } = req.body as z.infer<typeof mfaVerifySchema>;
    let userId: string;
    try {
      userId = verifyMfaChallenge(challenge);
    } catch {
      throw unauthorized('Your sign-in expired. Please start again.');
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) throw unauthorized();
    if (!authenticator.check(code, decrypt(user.twoFactorSecret))) {
      await audit({ actorId: user.id, action: 'auth.mfa_failed', entity: 'User', entityId: user.id, ip: req.clientIp });
      throw unauthorized('That code is not correct');
    }
    await audit({ actorId: user.id, action: 'auth.login_mfa', entity: 'User', entityId: user.id, ip: req.clientIp });
    const session = await issueSession(req, res, user, true);
    res.json({ ...session, user: sessionUser(user, true) });
  }),
);

// ───────────── 2FA enrolment (staff) ─────────────
authRouter.post(
  '/2fa/setup',
  requireAuth,
  requireRole('AUDITOR', 'ADMIN'),
  wrap(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (user.twoFactorEnabled) throw conflict('Two-factor authentication is already enabled.');
    const secret = authenticator.generateSecret();
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: encrypt(secret) } });
    const otpauth = authenticator.keyuri(user.email, 'LumaBridge', secret);
    res.json({ secret, otpauth, qr: await QRCode.toDataURL(otpauth, { margin: 1, width: 220 }) });
  }),
);

authRouter.post(
  '/2fa/enable',
  requireAuth,
  requireRole('AUDITOR', 'ADMIN'),
  validate(z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') })),
  wrap(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!user.twoFactorSecret) throw badRequest('Start 2FA setup first.');
    if (!authenticator.check(req.body.code, decrypt(user.twoFactorSecret))) {
      throw badRequest('That code is not correct');
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    await audit({ actorId: user.id, action: 'auth.2fa_enabled', entity: 'User', entityId: user.id, ip: req.clientIp });
    // Upgrade the current session: they just proved possession of the authenticator.
    const session = await issueSession(req, res, user, true);
    res.json({ ...session, user: sessionUser(updated, true) });
  }),
);

// ───────────── Refresh / logout / me ─────────────
authRouter.post(
  '/refresh',
  requireCsrf,
  wrap(async (req, res) => {
    const token = req.cookies?.[RT_COOKIE] as string | undefined;
    if (!token) throw unauthorized();
    const row = await prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      // Reuse of a revoked token suggests theft: kill every session for that user.
      if (row?.revokedAt) {
        await prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      res.clearCookie(RT_COOKIE, { path: '/api/auth' });
      throw unauthorized('Session expired');
    }
    if (row.user.status === 'BANNED') throw unauthorized();

    // Rotate. The MFA flag is carried over only if this refresh chain originated from a TOTP-verified login.
    await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    const mfa = row.mfa && row.user.twoFactorEnabled;
    const session = await issueSession(req, res, row.user, mfa);
    res.json({ ...session, user: sessionUser(row.user, mfa) });
  }),
);

authRouter.post(
  '/logout',
  wrap(async (req, res) => {
    const token = req.cookies?.[RT_COOKIE] as string | undefined;
    if (token) {
      await prisma.refreshToken.updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date() } });
    }
    res.clearCookie(RT_COOKIE, { path: '/api/auth' });
    res.clearCookie(CSRF_COOKIE, { path: '/' });
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    res.json({ user: sessionUser(user, req.user!.mfa) });
  }),
);

export type { Role };
