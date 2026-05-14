import { readCacheStale } from '@/lib/appDataCache';
import type { Database } from '@/lib/database.types';
import { exploreEventsCacheKey } from '@/lib/exploreEventsCache';

type Event = Database['public']['Tables']['event']['Row'];

/** Seed Explore / city map with the same list cache Explore already warmed. */
export function readExploreMapSeedEvents(city?: string, banditId?: string): Event[] {
  const key = exploreEventsCacheKey(city, banditId, undefined);
  return readCacheStale<Event[]>(key) ?? [];
}
