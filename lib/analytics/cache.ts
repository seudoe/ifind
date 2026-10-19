/**
 * Read-through cache with stale fallback for GA reports.
 *
 * SERVER-ONLY. Each successful fetch writes two copies: `key` (short TTL) and `{key}:last`
 * (long TTL). If Google later fails, the last-good copy is served with `stale: true`. Store
 * errors never break a request: reads degrade to a direct fetch, writes are best-effort.
 */

export interface CacheStore {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

export interface Cached<T> {
  data: T;
  stale: boolean;
  fetchedAt: string;
}

const DEFAULT_STALE_TTL_SECONDS = 24 * 60 * 60;

/** What is actually stored: the data plus when Google was asked. */
interface Envelope<T> {
  data: T;
  fetchedAt: string;
}

/** A cache value is usable only as an envelope: an object with non-null `data` and a string `fetchedAt`. */
function isEnvelope(v: unknown): v is Envelope<unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return o.data !== null && o.data !== undefined && typeof o.fetchedAt === "string";
}

/** Reads a key, swallowing store errors. Anything that is not a well-formed envelope counts as a miss. */
async function readCopy<T>(store: CacheStore | null, key: string): Promise<Envelope<T> | null> {
  if (!store) return null;
  try {
    const v = await store.get(key);
    return isEnvelope(v) ? (v as Envelope<T>) : null;
  } catch {
    return null;
  }
}

/** Concurrent callers on the same cold key within one instance share one fetch. */
const inFlight = new Map<string, Promise<Cached<unknown>>>();

export function cachedReport<T>(o: {
  key: string;
  ttlSeconds: number;
  staleTtlSeconds?: number;
  fetcher: () => Promise<T>;
  store: CacheStore | null;
}): Promise<Cached<T>> {
  const existing = inFlight.get(o.key);
  if (existing) return existing as Promise<Cached<T>>;
  const p = load(o).finally(() => {
    inFlight.delete(o.key);
  });
  inFlight.set(o.key, p as Promise<Cached<unknown>>);
  return p;
}

async function load<T>(o: {
  key: string;
  ttlSeconds: number;
  staleTtlSeconds?: number;
  fetcher: () => Promise<T>;
  store: CacheStore | null;
}): Promise<Cached<T>> {
  const { key, ttlSeconds, store, fetcher } = o;
  const staleTtl = o.staleTtlSeconds ?? DEFAULT_STALE_TTL_SECONDS;

  const hit = await readCopy<T>(store, key);
  if (hit) return { data: hit.data, stale: false, fetchedAt: hit.fetchedAt };

  let data: T;
  try {
    data = await fetcher();
  } catch (err) {
    const last = await readCopy<T>(store, `${key}:last`);
    if (last) return { data: last.data, stale: true, fetchedAt: last.fetchedAt };
    throw err;
  }

  const fetchedAt = new Date().toISOString();
  if (store) {
    const envelope: Envelope<T> = { data, fetchedAt };
    // Best-effort: a failing store must not fail the request.
    await Promise.allSettled([store.set(key, envelope, ttlSeconds), store.set(`${key}:last`, envelope, staleTtl)]);
  }
  return { data, stale: false, fetchedAt };
}
