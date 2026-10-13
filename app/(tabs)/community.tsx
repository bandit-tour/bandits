import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
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
import { deleteEntireChatConversation } from '@/lib/chatThreadManage';
import { loadChatThreadSummaries, type ChatThreadSummary } from '@/lib/chatThreads';
import { formatInboxSentAt } from '@/lib/inboxSentAtLabel';
import { ensureAnonymousSession, resolveTravelerSession } from '@/lib/pilotSession';
import { BANDITS_NOTIFICATIONS_REFRESH } from '@/lib/notificationEvents';
import { markChatSurfaceOpened } from '@/lib/osAppBadge';
import { syncOsAppIconBadge } from '@/lib/pushNotifications';
import { useAppBackScreenOptions } from '@/hooks/useAppBackScreenOptions';
import { APP_HOME_HREF } from '@/lib/appNavigation';

function threadDeleteRootId(t: ChatThreadSummary): string {
  const rt = String(t.openReferenceType || '').trim();
  if (
    rt === 'bandit_question_guest_echo' ||
    rt === 'local_friend_guest_echo' ||
    rt === 'bandit_question_request' ||
    rt === 'local_friend_request'
  ) {
    return String(t.openReferenceId || t.openNotificationId || '').trim();
  }
  if (t.threadKey.startsWith('ask:')) return t.threadKey.slice(4);
  if (t.threadKey.startsWith('local_friend:')) return t.threadKey.slice('local_friend:'.length);
  return String(t.openNotificationId || t.openReferenceId || '').trim();
}

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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [bulkWorking, setBulkWorking] = useState(false);

  const loadThreads = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    try {
      await ensureAnonymousSession().catch(() => undefined);
      const traveler = await resolveTravelerSession();
      const userId = traveler?.user?.id || '';
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

  const toggleSelected = useCallback((threadKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(threadKey)) next.delete(threadKey);
      else next.add(threadKey);
      return next;
    });
  }, []);

  const deleteSelectedThreads = useCallback(() => {
    if (bulkWorking || selectedKeys.size === 0) return;
    const targets = threads.filter((t) => selectedKeys.has(t.threadKey));
    Alert.alert(
      'Delete conversations',
      `Remove ${targets.length} conversation${targets.length === 1 ? '' : 's'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBulkWorking(true);
              try {
                for (const t of targets) {
                  const root = threadDeleteRootId(t);
                  if (root) await deleteEntireChatConversation(root);
                }
                setSelectMode(false);
                setSelectedKeys(new Set());
                await loadThreads(true);
                await refreshNotifications();
                DeviceEventEmitter.emit(BANDITS_NOTIFICATIONS_REFRESH);
              } catch (e) {
                Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.');
              } finally {
                setBulkWorking(false);
              }
            })();
          },
        },
      ],
    );
  }, [bulkWorking, loadThreads, refreshNotifications, selectedKeys, threads]);

  const chatHeaderRight = useCallback(
    () => (
      <View style={styles.headerActions}>
        {selectMode ? (
          <>
            <Pressable
              onPress={deleteSelectedThreads}
              disabled={selectedKeys.size === 0 || bulkWorking}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Delete selected conversations"
            >
              <Text
                style={[
                  styles.headerActionText,
                  (selectedKeys.size === 0 || bulkWorking) && styles.headerActionTextDisabled,
                ]}
              >
                Delete{selectedKeys.size > 0 ? ` (${selectedKeys.size})` : ''}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setSelectMode(false);
                setSelectedKeys(new Set());
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Done selecting"
            >
              <Text style={styles.headerActionText}>Done</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={() => setSelectMode(true)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Select conversations"
          >
            <Text style={styles.headerActionText}>Select</Text>
          </Pressable>
        )}
      </View>
    ),
    [bulkWorking, deleteSelectedThreads, selectMode, selectedKeys.size],
  );

  const communityScreenOptions = useAppBackScreenOptions({
    title: selectMode ? `${selectedKeys.size} selected` : 'Chat',
    fallback: APP_HOME_HREF,
    showBack: false,
    headerRight: chatHeaderRight,
  });

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

  const listEmpty = useMemo(
    () => (
      <View style={styles.center}>
        <View style={styles.heroIconBubble}>
          <IconSymbol name="bubble.left.and.bubble.right.fill" size={36} color="#111111" />
        </View>
        <Text style={styles.emptyTitle}>No conversations yet</Text>
        <Text style={styles.emptyBody}>
          When you reveal or reply to a message in a bottle, the thread appears here — the same chat
          everywhere in the app.
        </Text>
      </View>
    ),
    [],
  );

  return (
    <>
      <Stack.Screen options={communityScreenOptions} />
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : threads.length === 0 ? (
          listEmpty
        ) : (
          <FlatList
            data={threads}
            keyExtractor={(item) => item.threadKey}
            refreshControl={refreshControl}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const selected = selectedKeys.has(item.threadKey);
              return (
                <Pressable
                  style={[styles.row, selected && styles.rowSelected]}
                  onPress={() => {
                    if (selectMode) {
                      toggleSelected(item.threadKey);
                      return;
                    }
                    openThread(item);
                  }}
                >
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
              );
            }}
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
  rowSelected: {
    borderColor: '#111111',
    backgroundColor: '#F0F8FC',
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
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadPillText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 4 },
  headerActionText: { fontSize: 15, fontWeight: '600', color: '#111111' },
  headerActionTextDisabled: { opacity: 0.4 },
});
