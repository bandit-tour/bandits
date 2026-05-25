import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { DeviceEventEmitter, Platform } from 'react-native';

import { BANDITS_NOTIFICATIONS_REFRESH } from '@/lib/notificationEvents';

import { computeOsAppBadgeCount } from '@/lib/osAppBadge';
import { getPilotApiBaseUrl } from '@/lib/pilotApiBase';
import { supabase } from '@/lib/supabase';

const DEFAULT_PROD = 'https://bandits-two.vercel.app';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function resolveApiBase(): string | null {
  const base = getPilotApiBaseUrl();
  if (base) return base;
  if (__DEV__) return DEFAULT_PROD;
  return DEFAULT_PROD;
}

function resolveProjectId(): string | undefined {
  const eas = Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined;
  const fromEas = eas?.projectId;
  if (fromEas) return fromEas;
  const legacy = Constants.easConfig?.projectId;
  return legacy || undefined;
}

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 120, 80, 120],
    lightColor: '#E85D04',
    showBadge: true,
  });
  await Notifications.setNotificationChannelAsync('bottle', {
    name: 'Message in a Bottle',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 160, 100, 160],
    lightColor: '#1E3A5F',
    showBadge: true,
  });
}

export async function initPushNotifications(): Promise<void> {
  await ensureAndroidChannels();
}

export async function syncOsAppIconBadge(inboxUnread: number, chatUnread: number): Promise<void> {
  const count = await computeOsAppBadgeCount(inboxUnread, chatUnread);
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (e) {
    if (__DEV__) {
      console.warn('[push] setBadgeCountAsync:', e instanceof Error ? e.message : e);
    }
  }
}

let lastRegisteredToken: string | null = null;

export async function registerPushTokenIfPossible(): Promise<void> {
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const projectId = resolveProjectId();
  if (!projectId) {
    console.warn('[push] Missing EAS projectId in app config');
    return;
  }

  let tokenData: Notifications.ExpoPushToken;
  try {
    tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  } catch (e) {
    console.warn('[push] getExpoPushTokenAsync:', e instanceof Error ? e.message : e);
    return;
  }

  const expoPushToken = tokenData.data?.trim();
  if (!expoPushToken || expoPushToken === lastRegisteredToken) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  const apiBase = resolveApiBase();
  if (!apiBase) return;

  const res = await fetch(`${apiBase}/api/push?action=register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      expoPushToken,
      platform: Platform.OS,
      deviceId: Constants.sessionId || Constants.installationId || undefined,
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    console.warn('[push] register failed:', (j as { error?: string }).error || res.status);
    return;
  }
  lastRegisteredToken = expoPushToken;
}

export async function unregisterPushToken(): Promise<void> {
  const token = lastRegisteredToken;
  lastRegisteredToken = null;
  if (!token) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return;
  const apiBase = resolveApiBase();
  if (!apiBase) return;
  await fetch(`${apiBase}/api/push?action=register`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ expoPushToken: token }),
  }).catch(() => undefined);
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    /* ignore */
  }
}

export function addPushNotificationListeners(
  onNavigate: (data: Record<string, string>) => void,
): () => void {
  const subs: { remove: () => void }[] = [];

  subs.push(
    Notifications.addNotificationReceivedListener(() => {
      DeviceEventEmitter.emit(BANDITS_NOTIFICATIONS_REFRESH);
    }),
  );

  subs.push(
    Notifications.addNotificationResponseReceivedListener((response) => {
      const raw = response.notification.request.content.data;
      const data: Record<string, string> = {};
      if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw)) {
          if (typeof v === 'string') data[k] = v;
        }
      }
      onNavigate(data);
    }),
  );

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response) return;
    const raw = response.notification.request.content.data;
    const data: Record<string, string> = {};
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === 'string') data[k] = v;
      }
    }
    if (Object.keys(data).length) onNavigate(data);
  });

  return () => {
    for (const s of subs) s.remove();
  };
}
