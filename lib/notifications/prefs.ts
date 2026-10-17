/**
 * Preferences for the existing inbox. Not a second notification database.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import {
  DEFAULT_NOTICE_PREFS,
  NOTICE_PREFS_KEY,
  type NoticePrefs,
} from "@/lib/notifications/policy";

function clampHour(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(23, Math.round(n)));
}

export async function readNoticePrefs(): Promise<NoticePrefs> {
  try {
    const raw =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.localStorage.getItem(NOTICE_PREFS_KEY)
        : await AsyncStorage.getItem(NOTICE_PREFS_KEY);
    if (!raw) return { ...DEFAULT_NOTICE_PREFS, marketingSentAt: [] };
    const parsed = JSON.parse(raw) as Partial<NoticePrefs>;
    return {
      serviceEnabled: parsed.serviceEnabled !== false,
      socialEnabled: parsed.socialEnabled !== false,
      marketingEnabled: parsed.marketingEnabled === true,
      quietStartHour: clampHour(Number(parsed.quietStartHour), 22),
      quietEndHour: clampHour(Number(parsed.quietEndHour), 8),
      marketingSentAt: Array.isArray(parsed.marketingSentAt) ? parsed.marketingSentAt.map(String) : [],
    };
  } catch {
    return { ...DEFAULT_NOTICE_PREFS, marketingSentAt: [] };
  }
}

export async function writeNoticePrefs(prefs: NoticePrefs): Promise<void> {
  const raw = JSON.stringify(prefs);
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.localStorage.setItem(NOTICE_PREFS_KEY, raw);
    return;
  }
  await AsyncStorage.setItem(NOTICE_PREFS_KEY, raw);
}

export async function noteMarketingSent(at = new Date().toISOString()): Promise<void> {
  const prefs = await readNoticePrefs();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const marketingSentAt = [...prefs.marketingSentAt, at].filter((iso) => {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t >= weekAgo;
  });
  await writeNoticePrefs({ ...prefs, marketingSentAt });
}
