'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { homeFor, useAuth } from './auth';
import type { SessionUser } from './api';

type Role = SessionUser['role'];

/**
 * Client-side route guard. The API enforces every rule again server-side; this only decides which
 * screen to show. Returns `ready` once the signed-in user is known and allowed on this page.
 *
 * Staff pages additionally need a TOTP-verified session (`mfa`), otherwise they are sent to /staff/2fa.
 */
export function useRequireRole(roles: Role[], opts: { mfa?: boolean } = {}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(path)}`);
      return;
    }
    if (!roles.includes(user.role)) {
      router.replace(homeFor(user));
      return;
    }
    if (opts.mfa && (user.needsMfaSetup || !user.mfaVerified) && path !== '/staff/2fa') {
      router.replace('/staff/2fa');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, path]);

  const allowed = Boolean(user && roles.includes(user.role) && (!opts.mfa || (!user.needsMfaSetup && user.mfaVerified)));
  return { user, ready: !loading && allowed, loading };
}

/** Only follow same-site relative redirects (prevents open-redirect via ?next=). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
  return next;
}
