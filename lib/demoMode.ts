import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

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

const REPLY_LINES = [
  'You should try a small wine bar in Psyrri tonight.',
  'Start in Exarchia for coffee, then drift toward the square — something usually pops up after dark.',
  'There’s a basement jazz spot near the market; ask for the late set.',
  'Walk Psyrri slowly tonight — a pop-up gallery sometimes opens unmarked doors.',
  'If you want quiet: a back-street kafeneio in Koukaki, no name on the sign.',
] as const;

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

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

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

/**
 * After a real Local Friend send succeeds, schedules a fake reply (30–90s). Stored locally only.
 */
export function scheduleDemoLocalFriendReply(): void {
  if (!isDemoMode()) return;
  const delayMs = 30_000 + Math.random() * 60_000;
  setTimeout(() => {
    void (async () => {
      const name = pick(DEMO_LOCAL_FRIEND_NAMES);
      const message = pick(REPLY_LINES);
      await appendDemoNotification({
        id: `demo-lf-${Date.now()}`,
        type: 'bandit_reply',
        title: `Reply from ${name}`,
        message,
      });
    })();
  }, delayMs);
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
