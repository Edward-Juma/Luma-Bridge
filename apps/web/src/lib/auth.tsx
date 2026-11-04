'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, refreshSession, setAccessToken, type SessionResponse, type SessionUser } from './api';

interface LoginResult {
  mfaChallenge?: string;
  user?: SessionUser;
}

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyMfa: (challenge: string, code: string) => Promise<SessionUser>;
  register: (body: Record<string, unknown>) => Promise<SessionUser>;
  applySession: (s: SessionResponse) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    refreshSession()
      .then((s) => alive && setUser(s?.user ?? null))
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const applySession = useCallback((s: SessionResponse) => {
    setAccessToken(s.accessToken);
    setUser(s.user);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      applySession,
      async login(email, password) {
        const r = await api<{ mfaRequired?: boolean; challenge?: string } & Partial<SessionResponse>>('/api/auth/login', { method: 'POST', json: { email, password }, auth: false });
        if (r.mfaRequired && r.challenge) return { mfaChallenge: r.challenge };
        applySession(r as SessionResponse);
        return { user: r.user };
      },
      async verifyMfa(challenge, code) {
        const r = await api<SessionResponse>('/api/auth/mfa/verify', { method: 'POST', json: { challenge, code }, auth: false });
        applySession(r);
        return r.user;
      },
      async register(body) {
        const r = await api<SessionResponse>('/api/auth/register', { method: 'POST', json: body, auth: false });
        applySession(r);
        return r.user;
      },
      async logout() {
        const csrf = document.cookie.match(/(?:^|;\s*)hb_csrf=([^;]+)/)?.[1];
        await api('/api/auth/logout', { method: 'POST', auth: false, headers: csrf ? { 'X-CSRF-Token': csrf } : {} }).catch(() => undefined);
        setAccessToken(null);
        setUser(null);
      },
    }),
    [user, loading, applySession],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

export const homeFor = (u: SessionUser) => (u.role === 'BENEFICIARY' ? '/dashboard' : u.needsMfaSetup || !u.mfaVerified ? '/staff/2fa' : '/staff');
