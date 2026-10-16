import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEY_IDS = '@bandits_dismissed_notification_ids_v1';
const KEY_THREAD_KEYS = '@bandits_dismissed_chat_thread_keys_v1';

async function readRaw(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem(key);
    }
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeRaw(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch {
    /* best-effort */
  }
}

export async function getDismissedNotificationIds(): Promise<Set<string>> {
  try {
    const raw = await readRaw(KEY_IDS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => String(x || '').trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

export async function addDismissedNotificationId(id: string): Promise<void> {
  await addDismissedNotificationIds([id]);
}

export async function addDismissedNotificationIds(ids: string[]): Promise<void> {
  const cleaned = [...new Set(ids.map((x) => String(x || '').trim()).filter(Boolean))];
  if (!cleaned.length) return;
  const set = await getDismissedNotificationIds();
  for (const id of cleaned) set.add(id);
  await writeRaw(KEY_IDS, JSON.stringify([...set]));
}

/** threadKey → ISO dismissedAt (delete-for-me timestamp). */
export async function getDismissedChatThreadKeys(): Promise<Map<string, string>> {
  try {
    const raw = await readRaw(KEY_THREAD_KEYS);
    if (!raw) return new Map();
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return new Map();
    const out = new Map<string, string>();
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const key = String(k || '').trim();
      const at = String(v || '').trim();
      if (key && at) out.set(key, at);
    }
    return out;
  } catch {
    return new Map();
  }
}

/**
 * Hide a Chat thread from this device until a newer message arrives.
 * Product rule: stay hidden while lastAt <= dismissedAt; a genuinely new
 * message (created_at > dismissedAt) resurrects the conversation.
 */
export async function addDismissedChatThreadKey(
  threadKey: string,
  dismissedAt?: string,
): Promise<void> {
  const key = String(threadKey || '').trim();
  if (!key) return;
  const at = String(dismissedAt || new Date().toISOString()).trim() || new Date().toISOString();
  const map = await getDismissedChatThreadKeys();
  map.set(key, at);
  const obj: Record<string, string> = {};
  for (const [k, v] of map.entries()) obj[k] = v;
  await writeRaw(KEY_THREAD_KEYS, JSON.stringify(obj));
}

/** True when this thread is still hidden (no newer activity than dismiss time). */
export function isChatThreadStillDismissed(
  threadKey: string,
  lastAt: string,
  dismissed: Map<string, string>,
): boolean {
  const key = String(threadKey || '').trim();
  if (!key) return false;
  const at = dismissed.get(key);
  if (!at) return false;
  const lastMs = new Date(lastAt).getTime();
  const dismissMs = new Date(at).getTime();
  if (!Number.isFinite(lastMs) || !Number.isFinite(dismissMs)) return true;
  return lastMs <= dismissMs;
}
