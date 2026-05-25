import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAppState } from '@/contexts/AppStateContext';
import { BANDITS_NOTIFICATIONS_REFRESH } from '@/lib/notificationEvents';
import {
  addPushNotificationListeners,
  initPushNotifications,
  registerPushTokenIfPossible,
  syncOsAppIconBadge,
  unregisterPushToken,
} from '@/lib/pushNotifications';
import { supabase } from '@/lib/supabase';
import { DeviceEventEmitter } from 'react-native';

function navigateFromPushData(
  router: ReturnType<typeof useRouter>,
  data: Record<string, string>,
): void {
  const surface = String(data.surface || '').trim();
  const kind = String(data.kind || '').trim();
  const floatId = String(data.floatId || data.referenceId || '').trim();
  const refType = String(data.referenceType || '').trim();
  const title = String(data.notificationTitle || data.title || 'Chat').trim();

  if (
    surface === 'inbox' ||
    kind === 'bottle_found' ||
    kind === 'bottle_claim' ||
    kind === 'inbox_message'
  ) {
    router.push('/(tabs)/notifications');
    return;
  }

  if (
    (surface === 'chat' || kind === 'guest_replied' || kind === 'chat_message') &&
    floatId &&
    refType === 'local_friend_ocean_thread'
  ) {
    router.push({
      pathname: '/chat',
      params: {
        banditName: title,
        referenceId: floatId,
        referenceType: refType,
        notificationTitle: title,
      },
    });
    return;
  }

  if (surface === 'chat') {
    router.push('/(tabs)/community');
    return;
  }

  router.push('/(tabs)/notifications');
}

/**
 * Registers Expo push tokens, OS icon badge sync, and notification tap routing.
 */
export default function PushNotificationBootstrap() {
  const router = useRouter();
  const { unreadCount, chatUnreadCount, refreshNotifications } = useAppState();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void initPushNotifications();
    const removeListeners = addPushNotificationListeners((data) => {
      navigateFromPushData(router, data);
      DeviceEventEmitter.emit(BANDITS_NOTIFICATIONS_REFRESH);
      void refreshNotifications();
    });
    return removeListeners;
  }, [router, refreshNotifications]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void registerPushTokenIfPossible();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        void unregisterPushToken();
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        void registerPushTokenIfPossible();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void syncOsAppIconBadge(unreadCount, chatUnreadCount);
  }, [unreadCount, chatUnreadCount]);

  return null;
}
