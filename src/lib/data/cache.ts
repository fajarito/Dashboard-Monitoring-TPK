/**
 * Cache in-memory TTL singkat untuk agregat home.
 * Default 60 detik — selaras prinsip performa dashboard.
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();
/** Singleflight: request paralel dengan key sama berbagi 1 promise (anti-stampede). */
const inflight = new Map<string, Promise<unknown>>();

export const DEFAULT_CACHE_TTL_SEC = 60;

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(
  key: string,
  value: T,
  ttlSec: number = DEFAULT_CACHE_TTL_SEC,
): T {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSec * 1000,
  });
  return value;
}

/**
 * Cache hit → return. Miss → jalankan loader sekali; caller paralel menunggu yang sama.
 * Tidak menyimpan hasil error (agar retry berikutnya bisa jalan).
 */
export async function getOrLoadCached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSec: number = DEFAULT_CACHE_TTL_SEC,
): Promise<T> {
  const hit = getCached<T>(key);
  if (hit) return hit;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = (async () => {
    try {
      const value = await loader();
      return setCached(key, value, ttlSec);
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

export function cacheKey(parts: Array<string | number | null | undefined>) {
  return parts.map((part) => String(part ?? "")).join(":");
}

/** Header Cache-Control untuk respons API agregat. */
export function cacheControlHeader(ttlSec: number = DEFAULT_CACHE_TTL_SEC) {
  return `public, s-maxage=${ttlSec}, stale-while-revalidate=${ttlSec}`;
}
