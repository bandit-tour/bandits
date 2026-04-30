import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { buildPilotDemoReplyBody, pickNextSender } from '@/lib/pilotConversation';

const STORAGE_INBOX = '@bandits_demo_inbox_v1';

/** Enable with EXPO_PUBLIC_DEMO_MODE=true — client-only simulated inbox/replies; no writes to real user rows beyond normal flows. */
export function isDemoMode(): boolean {
  const raw = String(process.env.EXPO_PUBLIC_DEMO_MODE ?? '').trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  const extra = (Constants.expoConfig?.extra as Record<string, string> | undefined)?.EXPO_PUBLIC_DEMO_MODE;
  if (typeof extra === 'string') return extra.trim().toLowerCase() === 'true';
  return false;
}

export const DEMO_LOCAL_FRIEND_NAMES = ['Niko', 'Yanni', 'Sofia', 'Alex'] as const;

const AMBIENT_ROTATING: Omit<DemoNotificationStorage, 'created_at'>[] = [
  {
    id: 'demo-ambient-gallery',
    type: 'live_alert',
    title: 'Tonight in Psyrri',
    message: 'Pop-up gallery tonight in Psyrri — follow the lanterns off the main strip.',
  },
  {
    id: 'demo-ambient-market',
    type: 'live_alert',
    title: 'Street food',
    message: 'Street food night market today — Monastiraki side, from sunset.',
  },
  {
    id: 'demo-ambient-dj',
    type: 'live_alert',
    title: 'Late set',
    message: 'Secret DJ set in Exarchia — small door, no poster. Ask locals after 11.',
  },
  {
    id: 'demo-ambient-banditeam',
    type: 'demo_banditeam',
    title: 'bandiTEAM alert',
    message: 'Scam alert reported near Monastiraki metro — stay with official taxis and marked venues.',
  },
];

export type DemoNotificationStorage = {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
};

export async function getStoredDemoNotifications(): Promise<DemoNotificationStorage[]> {
  if (!isDemoMode()) return [];
  try {
    const raw = await AsyncStorage.getItem(STORAGE_INBOX);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function removeStoredDemoNotification(id: string): Promise<void> {
  if (!isDemoMode()) return;
  const t = String(id || '').trim();
  if (!t) return;
  const cur = await getStoredDemoNotifications();
  const next = cur.filter((x) => x.id !== t);
  await AsyncStorage.setItem(STORAGE_INBOX, JSON.stringify(next));
}

export async function clearStoredDemoNotifications(): Promise<void> {
  if (!isDemoMode()) return;
  await AsyncStorage.setItem(STORAGE_INBOX, JSON.stringify([]));
}

export async function appendDemoNotification(
  entry: Omit<DemoNotificationStorage, 'created_at'> & { created_at?: string },
): Promise<void> {
  const full: DemoNotificationStorage = {
    ...entry,
    created_at: entry.created_at ?? new Date().toISOString(),
  };
  const existing = await getStoredDemoNotifications();
  const next = [full, ...existing].filter(
    (x, i, a) => a.findIndex((y) => y.id === x.id) === i,
  ).slice(0, 40);
  await AsyncStorage.setItem(STORAGE_INBOX, JSON.stringify(next));
}

let demoLastSender: string | null = null;

/**
 * After a real Local Friend send succeeds, schedules 1–2 short replies with human-like spacing.
 * Avoids same name twice in a row and avoids instant double-bubbles.
 */
export function scheduleDemoLocalFriendReply(): void {
  if (!isDemoMode()) return;

  const scheduleOne = (delayMs: number, idSuffix: string) => {
    setTimeout(() => {
      void (async () => {
        const names = [...DEMO_LOCAL_FRIEND_NAMES];
        const name = pickNextSender(names, demoLastSender);
        demoLastSender = name;
        const message = buildPilotDemoReplyBody();
        await appendDemoNotification({
          id: `demo-lf-${Date.now()}-${idSuffix}`,
          type: 'bandit_reply',
          title: `Reply from ${name}`,
          message,
        });
      })();
    }, delayMs);
  };

  const firstAt = 28_000 + Math.random() * 52_000;
  scheduleOne(firstAt, 'a');

  if (Math.random() < 0.42) {
    const secondAt = firstAt + 22_000 + Math.random() * 48_000;
    scheduleOne(secondAt, 'b');
  }
}

/** Example inbox lines (rotate headline emphasis every few minutes). */
export function getAmbientDemoNotifications(): DemoNotificationStorage[] {
  if (!isDemoMode()) return [];
  const bucket = Math.floor(Date.now() / 240_000) % AMBIENT_ROTATING.length;
  const rotated = [...AMBIENT_ROTATING.slice(bucket), ...AMBIENT_ROTATING.slice(0, bucket)];
  const now = Date.now();
  return rotated.map((n, i) => ({
    ...n,
    created_at: new Date(now - (i + 1) * 90_000).toISOString(),
  }));
}
