import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@bandits_dismissed_notification_ids_v1';

export async function getDismissedNotificationIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
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
  await AsyncStorage.setItem(KEY, JSON.stringify([...set]));
}
