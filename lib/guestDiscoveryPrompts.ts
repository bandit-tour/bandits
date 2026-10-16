/**
 * Contextual discovery prompts — lightweight, dismissible, frequency-capped.
 * Surfaces City Memory, My Moments, Local Insider outside the More graveyard.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type DiscoveryPromptId =
  | 'home_city_memory'
  | 'home_my_moments'
  | 'home_local_insider'
  | 'home_impact'
  | 'home_dream_destinations'
  | 'between_trips_city_memory'
  | 'bandit_local_insider';

type PromptRecord = {
  dismissedAt?: string;
  lastShownAt?: string;
  showCount?: number;
};

const KEY = '@bandits_discovery_prompts_v1';
/** Min days between re-shows after dismiss. */
const COOLDOWN_DAYS = 14;
/** Cap shows before soft-stop (still reappears after long cooldown). */
const MAX_SHOWS = 4;

async function readAll(): Promise<Record<string, PromptRecord>> {
  try {
    const raw =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.localStorage.getItem(KEY)
        : await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, PromptRecord>;
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

async function writeAll(map: Record<string, PromptRecord>): Promise<void> {
  const raw = JSON.stringify(map);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEY, raw);
    } catch {
      /* ignore */
    }
    return;
  }
  await AsyncStorage.setItem(KEY, raw);
}

function daysSince(iso?: string): number {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 999;
  return (Date.now() - t) / (24 * 60 * 60 * 1000);
}

export async function shouldShowDiscoveryPrompt(id: DiscoveryPromptId): Promise<boolean> {
  const all = await readAll();
  const rec = all[id] || {};
  if (rec.dismissedAt && daysSince(rec.dismissedAt) < COOLDOWN_DAYS) return false;
  if ((rec.showCount || 0) >= MAX_SHOWS && daysSince(rec.lastShownAt) < COOLDOWN_DAYS * 2) {
    return false;
  }
  return true;
}

export async function markDiscoveryPromptShown(id: DiscoveryPromptId): Promise<void> {
  const all = await readAll();
  const rec = all[id] || {};
  all[id] = {
    ...rec,
    lastShownAt: new Date().toISOString(),
    showCount: (rec.showCount || 0) + 1,
  };
  await writeAll(all);
}

export async function dismissDiscoveryPrompt(id: DiscoveryPromptId): Promise<void> {
  const all = await readAll();
  const rec = all[id] || {};
  all[id] = {
    ...rec,
    dismissedAt: new Date().toISOString(),
  };
  await writeAll(all);
}
