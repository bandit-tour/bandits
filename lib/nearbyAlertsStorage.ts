import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_INBOX = '@bandits_nearby_inbox_v1';
const SEEN_KEYS = '@bandits_nearby_seen_v1';
const LAST_SCAN = '@bandits_nearby_last_scan_v1';

export type NearbyInboxEntry = {
  id: string;
  type: 'nearby_spot' | 'nearby_event' | 'nearby_mood' | 'nearby_scam';
  title: string;
  message: string;
  created_at: string;
  /** Encoded for router.push */
  route: { pathname: string; params?: Record<string, string> };
};

function parseSeen(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as unknown;
    if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, number>;
  } catch {
    /* ignore */
  }
  return {};
}

export async function getNearbyStoredNotifications(): Promise<NearbyInboxEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_INBOX);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as NearbyInboxEntry[]) : [];
  } catch {
    return [];
  }
}

export async function getLastNearbyScanAt(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SCAN);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function setLastNearbyScanAt(ts: number): Promise<void> {
  await AsyncStorage.setItem(LAST_SCAN, String(ts));
}

export async function wasNearbyKeyRecent(key: string, windowMs: number): Promise<boolean> {
  const raw = await AsyncStorage.getItem(SEEN_KEYS);
  const seen = parseSeen(raw);
  const at = seen[key];
  if (typeof at !== 'number') return false;
  return Date.now() - at < windowMs;
}

export async function markNearbyKeySeen(key: string): Promise<void> {
  const raw = await AsyncStorage.getItem(SEEN_KEYS);
  const seen = parseSeen(raw);
  seen[key] = Date.now();
  const keys = Object.keys(seen);
  if (keys.length > 400) {
    const sorted = keys.sort((a, b) => (seen[b] ?? 0) - (seen[a] ?? 0));
    for (const k of sorted.slice(200)) {
      delete seen[k];
    }
  }
  await AsyncStorage.setItem(SEEN_KEYS, JSON.stringify(seen));
}

export async function appendNearbyNotification(entry: NearbyInboxEntry): Promise<void> {
  const cur = await getNearbyStoredNotifications();
  const next = [entry, ...cur.filter((e) => e.id !== entry.id)].slice(0, 80);
  await AsyncStorage.setItem(STORAGE_INBOX, JSON.stringify(next));
}
