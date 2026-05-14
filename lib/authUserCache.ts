import { supabase } from '@/lib/supabase';

/**
 * Lightweight cache around `supabase.auth.getUser()`.
 *
 * The supabase client serializes auth operations through a single FIFO lock
 * (see `serializedAuthLock` in `lib/supabase.ts`). When multiple screens or
 * card components each call `supabase.auth.getUser()` at the same time, those
 * calls queue up — which we noticed could add 100+ ms of latency to the first
 * paint of a list that performs `toggleEventLike`, `isEventLiked`,
 * `getUserLikedEvents`, etc. in quick succession.
 *
 * This module:
 *   - serves the cached user immediately if known
 *   - collapses concurrent callers to a single in-flight Promise
 *   - listens for `onAuthStateChange` to invalidate when the user signs in /
 *     out / refreshes a token
 *
 * The cached object is intentionally minimal (`{ id }`) because that's all the
 * service callers need.
 */
type CachedUser = { id: string } | null;

let cachedUser: CachedUser | undefined; // undefined => "we don't know yet"
let inflight: Promise<CachedUser> | null = null;

async function loadUser(): Promise<CachedUser> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      return null;
    }
    if (!data?.user) return null;
    return { id: data.user.id };
  } catch {
    return null;
  }
}

/**
 * Get the current authenticated user (cached). Returns `null` if not signed
 * in. Promise resolves to `{ id }` if signed in.
 */
export async function getCachedAuthUser(): Promise<CachedUser> {
  if (cachedUser !== undefined) return cachedUser;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const u = await loadUser();
      cachedUser = u;
      return u;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Drop the cache so the next call hits Supabase. */
export function invalidateAuthUserCache(): void {
  cachedUser = undefined;
  inflight = null;
}

let listenerInstalled = false;
function ensureListener(): void {
  if (listenerInstalled) return;
  listenerInstalled = true;
  try {
    supabase.auth.onAuthStateChange((_event, session) => {
      cachedUser = session?.user ? { id: session.user.id } : null;
    });
  } catch {
    // If the listener cannot be attached, fall back to manual invalidation.
    listenerInstalled = false;
  }
}

ensureListener();
