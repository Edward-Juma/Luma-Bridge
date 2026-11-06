import type { NextFunction, Request, Response } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import { Role } from '@prisma/client';
import { prisma } from '../db';
import { verifyAccess } from '../lib/jwt';
import { env } from '../env';
import { forbidden, unauthorized, unavailable } from '../lib/errors';

export interface AuthUser {
  id: string;
  role: Role;
  mfa: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    clientIp: string;
    clerkUserId?: string;
  }
}

async function localUserForClerkId(clerkUserId: string) {
  const linked = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
  if (linked) return linked;

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const externalUser = clerkUser.externalId
    ? await prisma.user.findUnique({ where: { id: clerkUser.externalId } })
    : null;
  const primaryEmail = clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId);
  const emailUser = !externalUser && primaryEmail?.verification?.status === 'verified'
    ? await prisma.user.findUnique({ where: { email: primaryEmail.emailAddress.toLowerCase() } })
    : null;
  const existing = externalUser ?? emailUser;

  if (existing) {
    return prisma.user.update({ where: { id: existing.id }, data: { clerkId: clerkUserId } });
  }

  return null;
}

/** Requires a valid Clerk session without requiring a local profile record. */
export function requireClerkAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!env.CLERK_SECRET_KEY) throw unavailable('Clerk authentication is not configured.');
    const { userId } = getAuth(req);
    if (!userId) throw unauthorized();
    req.clerkUserId = userId;
    next();
  } catch (error) {
    next(error);
  }
}

/** Populates the Clerk subject when present without rejecting public requests. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    req.clerkUserId = getAuth(req).userId ?? undefined;
  } catch {
    req.clerkUserId = undefined;
  }
  next();
}

/** Requires a valid token AND an active (non-suspended, non-banned) account. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw unauthorized('Session expired');

    let claims;
    try {
      claims = verifyAccess(token);
    } catch {
      throw unauthorized('Session expired');
    }

    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || user.role !== claims.role) throw unauthorized('Session expired');
    if (user.status === 'BANNED') throw forbidden('This account has been permanently banned.');
    if (user.status === 'SUSPENDED') {
      if (!user.suspendedUntil || user.suspendedUntil > new Date()) {
        throw forbidden('This account is temporarily suspended.');
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', suspendedUntil: null, statusReason: null },
      });
    }
    req.user = { id: user.id, role: user.role, mfa: Boolean(claims.mfa) };
    next();
  } catch (e) {
    next(e);
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };

/** Auditors/admins must additionally have completed 2FA this session. */
export const requireStaff = [
  requireAuth,
  requireRole('AUDITOR', 'ADMIN'),
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.mfa) return next(forbidden('Two-factor authentication required'));
    next();
  },
];
