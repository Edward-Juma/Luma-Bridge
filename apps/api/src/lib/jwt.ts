import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../env';

export interface AccessClaims {
  sub: string;
  role: Role;
  /** true once the auditor has passed the TOTP check for this session */
  mfa?: boolean;
}

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export function signAccess(claims: AccessClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TTL_SECONDS,
    issuer: 'lumabridge',
    audience: 'lumabridge-web',
  });
}

export function verifyAccess(token: string): AccessClaims & jwt.JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'lumabridge',
    audience: 'lumabridge-web',
  }) as AccessClaims & jwt.JwtPayload;
}

/** Short-lived token proving the password step passed, to be exchanged with a TOTP code. */
export function signMfaChallenge(userId: string): string {
  return jwt.sign({ sub: userId, purpose: 'mfa' }, env.JWT_ACCESS_SECRET, {
    expiresIn: 5 * 60,
    issuer: 'lumabridge',
    audience: 'lumabridge-mfa',
  });
}

export function verifyMfaChallenge(token: string): string {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'lumabridge',
    audience: 'lumabridge-mfa',
  }) as jwt.JwtPayload;
  if (payload.purpose !== 'mfa' || !payload.sub) throw new Error('Invalid challenge');
  return payload.sub;
}
