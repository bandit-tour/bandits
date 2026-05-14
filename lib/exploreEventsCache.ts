import AsyncStorage from '@react-native-async-storage/async-storage';

import { getEvents } from '@/app/services/events';
import type { Database } from '@/lib/database.types';
import { fetchSWR, readCacheStale, seedAppDataCache } from '@/lib/appDataCache';

type Event = Database['public']['Tables']['event']['Row'];

const DISK_KEY = '@bandits_explore_events_v1';
const EXPLORE_TTL_MS = 90 * 1000;
/** Disk snapshot survives process kill — warm first Explore paint on cold iOS/Android launch. */
const DISK_TTL_MS = 24 * 60 * 60 * 1000;

export function exploreEventsCacheKey(city?: string, banditId?: string, genre?: string): string {
  return `events:explore:${city ?? ''}|${banditId ?? ''}|${genre ?? ''}`;
}

type DiskPayload = {
  storedAt: number;
  byKey: Record<string, Event[]>;
};

let diskHydrateStarted = false;

export async function hydrateExploreEventsFromDisk(): Promise<void> {
  if (diskHydrateStarted) return;
  diskHydrateStarted = true;
  try {
    const raw = await AsyncStorage.getItem(DISK_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as DiskPayload;
    if (!parsed?.byKey || Date.now() - (parsed.storedAt ?? 0) > DISK_TTL_MS) return;
    for (const [key, rows] of Object.entries(parsed.byKey)) {
      if (Array.isArray(rows) && rows.length > 0 && readCacheStale<Event[]>(key) === undefined) {
        seedAppDataCache(key, rows);
      }
    }
  } catch {
    /* non-blocking */
  }
}

async function persistExploreEventsToDisk(key: string, rows: Event[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const raw = await AsyncStorage.getItem(DISK_KEY);
    const prev = raw ? (JSON.parse(raw) as DiskPayload) : { storedAt: Date.now(), byKey: {} };
    const byKey = { ...(prev.byKey ?? {}), [key]: rows };
    const payload: DiskPayload = { storedAt: Date.now(), byKey };
    await AsyncStorage.setItem(DISK_KEY, JSON.stringify(payload));
  } catch {
    /* non-blocking */
  }
}

function fetchExploreEvents(city?: string, banditId?: string, genre?: string): Promise<Event[]> {
  return getEvents({
    ...(city ? { city } : {}),
    ...(banditId ? { banditId } : {}),
    ...(genre ? { genre } : {}),
  }).then((rows) => rows || []);
}

/**
 * Warm Explore while the user is on Home / other tabs — also persists to disk for next cold start.
 */
export function preloadExploreEvents(city?: string, banditId?: string, genre?: string): void {
  const key = exploreEventsCacheKey(city, banditId, genre);
  void fetchSWR<Event[]>(
    key,
    EXPLORE_TTL_MS,
    () => fetchExploreEvents(city, banditId, genre),
    (rows) => {
      void persistExploreEventsToDisk(key, rows);
    },
  );
}

export async function persistExploreEventsSnapshot(key: string, rows: Event[]): Promise<void> {
  await persistExploreEventsToDisk(key, rows);
}

/** App open: hydrate disk → memory, then prefetch default Explore queries in parallel. */
export async function bootstrapExploreEventsCache(city?: string): Promise<void> {
  await hydrateExploreEventsFromDisk();
  preloadExploreEvents(city);
  preloadExploreEvents();
  if (city) preloadExploreEvents('Athens');
}
