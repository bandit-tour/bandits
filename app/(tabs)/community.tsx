import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAppState } from '@/contexts/AppStateContext';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { loadChatThreadSummaries, type ChatThreadSummary } from '@/lib/chatThreads';
import { formatInboxSentAt } from '@/lib/inboxSentAtLabel';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { supabase } from '@/lib/supabase';
import { BANDITS_NOTIFICATIONS_REFRESH } from '@/lib/notificationEvents';
import { DeviceEventEmitter } from 'react-native';
import { markChatSurfaceOpened } from '@/lib/osAppBadge';
import { syncOsAppIconBadge } from '@/lib/pushNotifications';

/**
 * Bottom Chat tab — unified conversation threads (same /chat route as Notifications deep links).
 */
export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refreshNotifications, markNotificationRead, unreadCount, chatUnreadCount } = useAppState();
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadThreads = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    try {
      await ensureAnonymousSession().catch(() => undefined);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id || '';
      const list = userId ? await loadChatThreadSummaries(userId) : [];
      setThreads(list);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadThreads(false);
      void refreshNotifications();
      void markChatSurfaceOpened(chatUnreadCount).then(() =>
        syncOsAppIconBadge(unreadCount, chatUnreadCount),
      );
    }, [loadThreads, refreshNotifications, unreadCount, chatUnreadCount]),
  );

  useFocusEffect(
    useCallback(() => {
      const sub = DeviceEventEmitter.addListener(BANDITS_NOTIFICATIONS_REFRESH, () => {
        void loadThreads(true);
      });
      return () => sub.remove();
    }, [loadThreads]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadThreads(true);
      await refreshNotifications();
    } finally {
      setRefreshing(false);
    }
  }, [loadThreads, refreshNotifications]);

  const refreshControl = usePremiumRefreshControl(refreshing, onRefresh);

  const openThread = useCallback(
    (t: ChatThreadSummary) => {
      void markNotificationRead(t.openNotificationId);
      router.push({
        pathname: '/chat',
        params: {
          banditName: t.title,
          notificationId: t.openNotificationId,
          notificationType: t.openNotificationType,
          referenceId: t.openReferenceId,
          referenceType: t.openReferenceType,
          notificationTitle: t.openTitle,
          notificationMessage: t.openMessage,
        },
      });
    },
    [markNotificationRead, router],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Chat', headerBackTitle: 'Back' }} />
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : threads.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.heroIconBubble}>
              <IconSymbol name="bubble.left.and.bubble.right.fill" size={36} color="#0A7EA4" />
            </View>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyBody}>
              When you reveal or reply to a message in a bottle, the thread appears here — the same chat
              everywhere in the app.
            </Text>
          </View>
        ) : (
          <FlatList
            data={threads}
            keyExtractor={(item) => item.threadKey}
            refreshControl={refreshControl}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => openThread(item)}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.rowTime}>{formatInboxSentAt(item.lastAt)}</Text>
                </View>
                <Text style={styles.rowPreview} numberOfLines={2}>
                  {item.preview}
                </Text>
                {item.unreadCount > 0 ? (
                  <View style={styles.unreadPill}>
                    <Text style={styles.unreadPillText}>
                      {item.unreadCount > 9 ? '9+' : item.unreadCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            )}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  heroIconBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F1FA',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginBottom: 10, color: '#111' },
  emptyBody: { fontSize: 15, lineHeight: 22, textAlign: 'center', color: '#555' },
  list: { paddingVertical: 8 },
  row: {
    backgroundColor: '#FFF',
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6E6E6',
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111' },
  rowTime: { fontSize: 12, color: '#888' },
  rowPreview: { fontSize: 14, lineHeight: 20, color: '#444', paddingRight: 36 },
  unreadPill: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadPillText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
});
