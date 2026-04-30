import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/** Normalize `intro` query (handles typos like `?intro=1=` from pasted links). */
function normalizeIntroQueryValue(raw: string | null): string {
  if (raw == null) return '';
  return String(raw).trim().replace(/=+$/, '').trim();
}

/** QA: `?intro=1` forces the opening flow even if intro was already completed. */
export function urlSearchHasIntroOne(search: string): boolean {
  try {
    const q = search.startsWith('?') ? search.slice(1) : search;
    return normalizeIntroQueryValue(new URLSearchParams(q).get('intro')) === '1';
  } catch {
    return false;
  }
}

/** When redirecting to the intro gate, preserve the `intro=1` query for QA. */
export function getOpeningIntroEntryHref(currentSearch: string): '/' | '/?intro=1' {
  return urlSearchHasIntroOne(currentSearch) ? '/?intro=1' : '/';
}

/** Legacy key — still honored so returning users are not forced through intro again. */
const KEY_V1 = '@bandits_opening_intro_v1';
/**
 * Current key — set **only** from `markOpeningIntroSeen` after Enter / Skip (or migrated from v1 read).
 */
const KEY_V2 = '@bandits_opening_intro_v2';

/**
 * Web, first paint: `false` = show intro (default). `true` = skip to Home (already completed in a past session).
 * Any `localStorage` error → do not skip (show intro). No async.
 */
export function getShouldSkipIntroWebSync(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }
  try {
    const s = window.localStorage;
    if (s.getItem(KEY_V2) === '1') return true;
    if (s.getItem(KEY_V1) === '1') return true;
    return false;
  } catch {
    return false;
  }
}

/** @deprecated use getShouldSkipIntroWebSync */
export function getOpeningIntroSeenWebSync(): boolean {
  return getShouldSkipIntroWebSync();
}

export async function hasSeenOpeningIntro(): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return getShouldSkipIntroWebSync();
  }
  const v2 = await AsyncStorage.getItem(KEY_V2);
  if (v2 === '1') return true;
  const v1 = await AsyncStorage.getItem(KEY_V1);
  return v1 === '1';
}

export async function markOpeningIntroSeen(): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEY_V2, '1');
    } catch {
      /* ignore */
    }
    return;
  }
  await AsyncStorage.setItem(KEY_V2, '1');
}
