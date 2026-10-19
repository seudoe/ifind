/** Upstash Redis-backed CacheStore. SERVER-ONLY. */
import { Redis } from "@upstash/redis";
import type { CacheStore } from "./cache";

const OP_TIMEOUT_MS = 1000;

/** Rejects if `promise` has not settled within `ms`; the timer is always cleared. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`cache operation timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Returns null when either Upstash variable is unset or blank. Makes no network call until used. */
export function redisStore(env: Record<string, string | undefined> = process.env): CacheStore | null {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  // No client retries (the defaults back off for several seconds) and a hard per-operation timeout, so a
  // slow or unreachable Redis costs at most OP_TIMEOUT_MS; cache.ts treats the rejection as a miss / skipped write.
  const redis = new Redis({ url, token, retry: { retries: 0 } });
  return {
    // The REST client serializes JSON automatically, so values round-trip as objects.
    get: (key) => withTimeout(redis.get<unknown>(key), OP_TIMEOUT_MS),
    set: async (key, value, ttlSeconds) => {
      await withTimeout(redis.set(key, value, { ex: ttlSeconds }), OP_TIMEOUT_MS);
    },
  };
}
