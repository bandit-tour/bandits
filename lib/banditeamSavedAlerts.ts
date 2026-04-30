import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'banditeam_saved_alert_ids_v1';

async function readIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x) => String(x)).filter(Boolean);
  } catch {
    return [];
  }
}

async function writeIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // ignore
  }
}

export async function getSavedAlertIds(): Promise<string[]> {
  return readIds();
}

export async function isAlertSaved(id: string): Promise<boolean> {
  const ids = await readIds();
  return ids.includes(id);
}

/** @returns next saved state */
export async function toggleSavedAlertId(id: string): Promise<boolean> {
  const ids = await readIds();
  const has = ids.includes(id);
  const next = has ? ids.filter((x) => x !== id) : [...ids, id];
  await writeIds(next);
  return !has;
}
