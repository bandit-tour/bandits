import AsyncStorage from '@react-native-async-storage/async-storage';

import { getBanditsWithTags } from '@/app/services/bandits';
import { getBanditEventCategoriesBulk } from '@/app/services/events';
import { fetchCached, readCacheStale, seedAppDataCache } from '@/lib/appDataCache';
import { ensureAnonymousSession } from '@/lib/pilotSession';

export const BANDITS_ROWS_CACHE_KEY = 'bandits:rows:withCategories';
const BANDITS_ROWS_TTL_MS = 90 * 1000;
const DISK_KEY = '@bandits_home_rows_v1';
/** Disk snapshot survives process kill — warm first Local banDits paint on cold iOS/Android launch. */
const DISK_TTL_MS = 24 * 60 * 60 * 1000;

type Row = {
  bandit: Awaited<ReturnType<typeof getBanditsWithTags>>[number];
  categories: { genre: string; count: number }[];
};

type DiskPayload = {
  storedAt: number;
  rows: Row[];
};

let diskHydrateStarted = false;

export async function hydrateBanditsHomeFromDisk(): Promise<void> {
  if (diskHydrateStarted) return;
  diskHydrateStarted = true;
  try {
    const raw = await AsyncStorage.getItem(DISK_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as DiskPayload;
    if (!parsed?.rows?.length || Date.now() - (parsed.storedAt ?? 0) > DISK_TTL_MS) return;
    if (readCacheStale<Row[]>(BANDITS_ROWS_CACHE_KEY) === undefined) {
      seedAppDataCache(BANDITS_ROWS_CACHE_KEY, parsed.rows);
    }
  } catch {
    /* non-blocking */
  }
}

async function persistBanditsHomeToDisk(rows: Row[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const payload: DiskPayload = { storedAt: Date.now(), rows };
    await AsyncStorage.setItem(DISK_KEY, JSON.stringify(payload));
  } catch {
    /* non-blocking */
  }
}

/** Warm Local banDits list during app bootstrap so Home paints without pull-to-refresh. */
export async function warmBanditsHomeCache(): Promise<void> {
  await ensureAnonymousSession().catch(() => undefined);
  await fetchCached(BANDITS_ROWS_CACHE_KEY, BANDITS_ROWS_TTL_MS, async () => {
    const data = await getBanditsWithTags();
    const list = data || [];
    const catByBandit = await getBanditEventCategoriesBulk(list.map((b) => b.id));
    const rows = list.map((b) => ({
      bandit: b,
      categories: catByBandit.get(b.id) ?? [],
    }));
    void persistBanditsHomeToDisk(rows);
    return rows;
  }).catch(() => undefined);
}

export async function persistBanditsHomeSnapshot(rows: Row[]): Promise<void> {
  await persistBanditsHomeToDisk(rows);
}
