/**
 * API client.
 * - Access token lives in memory only (never localStorage), so XSS cannot exfiltrate a long-lived secret.
 * - The refresh token is an httpOnly cookie; /auth/refresh is CSRF-protected with a double-submit header.
 * - One in-flight refresh is shared by concurrent requests.
 */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, string>;
  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<(t: string | null) => void>();

export const setAccessToken = (t: string | null) => {
  accessToken = t;
  listeners.forEach((l) => l(t));
};
export const getAccessToken = () => accessToken;
export const onTokenChange = (fn: (t: string | null) => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function csrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)hb_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]!) : null;
}

export interface SessionResponse {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}
export interface SessionUser {
  id: string;
  email: string;
  role: 'BENEFICIARY' | 'AUDITOR' | 'ADMIN';
  twoFactorEnabled: boolean;
  mfaVerified: boolean;
  needsMfaSetup: boolean;
}

export async function refreshSession(): Promise<SessionResponse | null> {
  const csrf = csrfCookie();
  if (!csrf) return null;
  const res = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'X-CSRF-Token': csrf }, credentials: 'same-origin' });
  if (!res.ok) {
    setAccessToken(null);
    return null;
  }
  const data = (await res.json()) as SessionResponse;
  setAccessToken(data.accessToken);
  return data;
}

async function tryRefresh(): Promise<boolean> {
  refreshing ??= refreshSession()
    .then((s) => Boolean(s))
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type Opts = Omit<RequestInit, 'body'> & { json?: unknown; form?: FormData; auth?: boolean };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const { json, form, auth = true, headers, ...rest } = opts;
  const run = async () => {
    const h = new Headers(headers);
    if (json !== undefined) h.set('Content-Type', 'application/json');
    if (auth && accessToken) h.set('Authorization', `Bearer ${accessToken}`);
    return fetch(path.startsWith('/') ? path : `/${path}`, {
      credentials: 'same-origin',
      ...rest,
      headers: h,
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
    });
  };

  let res = await run();
  if (res.status === 401 && auth && (await tryRefresh())) res = await run();

  const type = res.headers.get('content-type') ?? '';
  const body = type.includes('json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const e = (body as { error?: { code?: string; message?: string; details?: Record<string, string> } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? 'Something went wrong. Please try again.', e?.details);
  }
  return body as T;
}

/** Fetch a protected binary (auditor document viewer) and return an object URL. */
export async function fetchBlobUrl(path: string): Promise<string> {
  const run = () => fetch(path, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, credentials: 'same-origin' });
  let res = await run();
  if (res.status === 401 && (await tryRefresh())) res = await run();
  if (!res.ok) throw new ApiError(res.status, 'error', 'Could not open the document.');
  if ((res.headers.get('content-type') ?? '').includes('json')) {
    const j = (await res.json()) as { url: string };
    return j.url;
  }
  return URL.createObjectURL(await res.blob());
}

/** Server-side fetch for RSC / metadata. Talks to the API directly and caches briefly. */
export async function serverApi<T>(path: string, revalidate = 30): Promise<T | null> {
  const base = process.env.API_URL ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${base}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
