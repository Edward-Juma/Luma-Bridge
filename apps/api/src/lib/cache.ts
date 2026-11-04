import Redis from 'ioredis';
import { env } from '../env';

/**
 * Tiny cache with Redis when REDIS_URL is set, falling back to an in-process Map
 * so local development works without any infrastructure.
 */
let redis: Redis | null = null;
if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
  redis.on('error', (err) => {
    console.warn('[redis] error, falling back to memory cache:', err.message);
  });
  redis.connect().catch(() => {
    redis = null;
  });
}

const memory = new Map<string, { value: string; expires: number }>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    if (redis && redis.status === 'ready') {
      const v = await redis.get(key);
      return v ? (JSON.parse(v) as T) : null;
    }
  } catch {
    /* fall through to memory */
  }
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    memory.delete(key);
    return null;
  }
  return JSON.parse(hit.value) as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const raw = JSON.stringify(value);
  try {
    if (redis && redis.status === 'ready') {
      await redis.set(key, raw, 'EX', ttlSeconds);
      return;
    }
  } catch {
    /* fall through */
  }
  memory.set(key, { value: raw, expires: Date.now() + ttlSeconds * 1000 });
}

export async function cacheDel(key: string): Promise<void> {
  memory.delete(key);
  try {
    if (redis && redis.status === 'ready') await redis.del(key);
  } catch {
    /* ignore */
  }
}

/** Atomic-ish counter used for per-key velocity checks (e.g. donations per IP). */
export async function bump(key: string, windowSeconds: number): Promise<number> {
  try {
    if (redis && redis.status === 'ready') {
      const n = await redis.incr(key);
      if (n === 1) await redis.expire(key, windowSeconds);
      return n;
    }
  } catch {
    /* fall through */
  }
  const hit = memory.get(key);
  const now = Date.now();
  if (!hit || hit.expires < now) {
    memory.set(key, { value: '1', expires: now + windowSeconds * 1000 });
    return 1;
  }
  const next = Number(hit.value) + 1;
  memory.set(key, { value: String(next), expires: hit.expires });
  return next;
}
