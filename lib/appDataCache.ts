/**
 * Tiny in-memory TTL cache for async fetchers. Designed for "stale-while-
 * revalidate" UX: tab screens read cached data instantly on focus, then
 * silently revalidate in the background so changes appear within the TTL
 * window without showing a spinner.
 *
 * Why not @tanstack/react-query? Keeps the diff minimal and avoids pulling
 * in a 30 KB dependency we don't need for ~5 cache keys. If usage grows
 * we'll swap to react-query in a future pass.
 *
 * Usage:
 *   const data = await fetchCached('events:athens', 60_000, () => getEvents({ city: 'Athens' }));
 *
 * The cached entry holds the resolved value AND the most recent in-flight
 * Promise so two callers asking for the same key concurrently share the work.
 */

type CacheEntry<T> = {
  /** Last successfully resolved value (used for "stale while revalidate"). */
  value: T | undefined;
  /** Epoch ms when `value` was stored. */
  storedAt: number;
  /** Live in-flight promise, if a fetch is currently running for this key. */
  inflight: Promise<T> | null;
};

const CACHE = new Map<string, CacheEntry<unknown>>();

function getEntry<T>(key: string): CacheEntry<T> {
  let e = CACHE.get(key) as CacheEntry<T> | undefined;
  if (!e) {
    e = { value: undefined, storedAt: 0, inflight: null };
    CACHE.set(key, e as CacheEntry<unknown>);
  }
  return e;
}

/** Returns the cached value if fresh (within ttl); otherwise undefined. */
export function readCacheFresh<T>(key: string, ttlMs: number): T | undefined {
  const e = CACHE.get(key) as CacheEntry<T> | undefined;
  if (!e || e.value === undefined) return undefined;
  if (Date.now() - e.storedAt > ttlMs) return undefined;
  return e.value;
}

/** Always returns the last stored value if any (ignoring TTL). For optimistic paint. */
export function readCacheStale<T>(key: string): T | undefined {
  const e = CACHE.get(key) as CacheEntry<T> | undefined;
  return e?.value;
}

/** Seed memory cache (e.g. after reading AsyncStorage on cold start). */
export function seedAppDataCache<T>(key: string, value: T): void {
  const entry = getEntry<T>(key);
  entry.value = value;
  entry.storedAt = Date.now();
}

/**
 * Fetch with cache:
 *   - If a fresh entry exists, return it without invoking the fetcher.
 *   - If a fetch is already in flight for this key, await it (single-flight).
 *   - Otherwise, run the fetcher, store the result, and return it.
 */
export async function fetchCached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const entry = getEntry<T>(key);
  if (entry.value !== undefined && Date.now() - entry.storedAt <= ttlMs) {
    return entry.value;
  }
  if (entry.inflight) return entry.inflight;
  const p = (async () => {
    try {
      const v = await fetcher();
      entry.value = v;
      entry.storedAt = Date.now();
      return v;
    } finally {
      entry.inflight = null;
    }
  })();
  entry.inflight = p;
  return p;
}

/**
 * Stale-while-revalidate: invokes `onValue` immediately with the cached value
 * (if any), and again after a background revalidation. Use to paint a tab
 * instantly on focus and then upgrade silently when fresh data arrives.
 *
 * Returns a `cancel()` function that aborts the revalidation callback (the
 * underlying fetch still completes and updates the cache).
 */
export function fetchSWR<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  onValue: (value: T, meta: { fromCache: boolean }) => void,
  onError?: (err: unknown) => void,
): { cancel: () => void } {
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };
  const cached = readCacheStale<T>(key);
  if (cached !== undefined) onValue(cached, { fromCache: true });
  void (async () => {
    try {
      const fresh = await fetchCached<T>(key, ttlMs, fetcher);
      if (cancelled) return;
      // If the fetcher returned the same reference we already painted, skip the
      // second callback (callers can rely on this to avoid extra renders).
      if (cached !== fresh) onValue(fresh, { fromCache: false });
    } catch (err) {
      if (!cancelled && onError) onError(err);
    }
  })();
  return { cancel };
}

/** Drop one key or the entire cache. Use after writes that invalidate. */
export function invalidateAppDataCache(key?: string): void {
  if (key) CACHE.delete(key);
  else CACHE.clear();
}

/** Snapshot for diagnostics. */
export function snapshotAppDataCache(): { size: number; keys: string[] } {
  return { size: CACHE.size, keys: Array.from(CACHE.keys()) };
}
