import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import {
  BANDIT_QUESTION_GUEST_ECHO_REF,
  bodyAfterAskMeAboutLine,
  parseAboutBanditFromAskMessage,
} from '@/lib/askMeMessageFormat';
import { useAppState } from '@/contexts/AppStateContext';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { supabase } from '@/lib/supabase';
import {
  type DemoNotificationStorage,
  getAmbientDemoNotifications,
  getStoredDemoNotifications,
  isDemoMode,
} from '@/lib/demoMode';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { getNearbyStoredNotifications, type NearbyInboxEntry } from '@/lib/nearbyAlertsStorage';
import { getNotificationsBackendStatus } from '@/services/localFriend';
import { getOperatorUserId } from '@/lib/operatorConfig';
import { trackEvent } from '@/lib/analytics';
import { perfMark, perfStart, perfTraceNetwork } from '@/lib/perfTiming';
import { getDismissedNotificationIds } from '@/lib/dismissedThreads';
import { formatInboxSentAt } from '@/lib/inboxSentAtLabel';
import { dismissInboxNotifications } from '@/lib/inboxNotificationManage';
import { BANDITS_NOTIFICATIONS_REFRESH } from '@/lib/notificationEvents';
import {
  isLocalFriendBottleInboxType,
  isLocalFriendOceanClaimRef,
  isLocalFriendOceanFoundRef,
} from '@/lib/localFriendOcean';
import { OCEAN_THREAD_REPLY_REF } from '@/lib/oceanBottleChat';
import { inboxPreviewForType, isSignalBottleInboxType } from '@/lib/bottleThreadText';
import { isDeletedThreadRef } from '@/lib/threadDelete';
import { markInboxSurfaceOpened } from '@/lib/osAppBadge';
import { syncOsAppIconBadge } from '@/lib/pushNotifications';
import { LifecycleInboxHeader } from '@/components/LifecycleInboxHeader';
import { useAppBackScreenOptions } from '@/hooks/useAppBackScreenOptions';

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: string;
  live_alert_broadcast_id?: string | null;
};

type InboxListItem = {
  id: string;
  banditName: string;
  preview: string;
  timestampLabel: string;
  sortKey: number;
  fromServer: boolean;
  notification: NotificationRow;
};

/**
 * Historically this predicate suppressed Ask Me / Local Friend operator-bound
 * rows from the operator's Notifications tab on the theory that they already
 * appeared on Pilot Desk. In practice it meant operators only saw bandiTEAM
 * reports in the inbox and would miss new guest messages until they manually
 * opened Pilot Desk.
 *
 * We now show those rows in the operator's Notifications tab too, exactly
 * like bandiTEAM reports — tap opens the full chat thread, and the unread
 * badge tracks them so the operator sees a count without needing to poll the
 * desk. The helper is kept so callers can opt back into legacy behavior, but
 * by default it always returns `false`.
 */
function isOperatorInboundRequestRowForDualRoleUser(
  _n: NotificationRow,
  _currentUserId: string,
  _operatorUserId: string,
): boolean {
  return false;
}

const ASK_ME_GUEST_BANDIT_REPLY_REFS = new Set(['operator_reply', 'operator_reply_bandit_question']);

function isAskMeGuestSideNotification(n: NotificationRow): boolean {
  const rt = String(n.reference_type || '').trim();
  if (rt === BANDIT_QUESTION_GUEST_ECHO_REF) return true;
  const t = String(n.type || '').trim();
  return t === 'bandit_reply' && ASK_ME_GUEST_BANDIT_REPLY_REFS.has(rt);
}

function shouldHideAskGuestMirrorForPilotOperator(
  n: NotificationRow,
  currentUserId: string,
  operatorUserId: string,
): boolean {
  if (!currentUserId || !operatorUserId) return false;
  if (currentUserId.toLowerCase() !== operatorUserId.toLowerCase()) return false;
  return isAskMeGuestSideNotification(n);
}

function dedupeAskMeGuestNotifications(rows: NotificationRow[]): {
  rows: NotificationRow[];
  supersededIds: string[];
} {
  const askGuest = rows.filter(isAskMeGuestSideNotification);
  const rest = rows.filter((n) => !isAskMeGuestSideNotification(n));
  const byRoot = new Map<string, NotificationRow[]>();
  for (const n of askGuest) {
    const root = String(n.reference_id || '').trim();
    if (!root) {
      rest.push(n);
      continue;
    }
    const g = byRoot.get(root) ?? [];
    g.push(n);
    byRoot.set(root, g);
  }
  const supersededIds: string[] = [];
  const kept: NotificationRow[] = [];
  for (const group of byRoot.values()) {
    group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    kept.push(group[0]);
    for (let i = 1; i < group.length; i++) supersededIds.push(group[i].id);
  }
  return { rows: [...rest, ...kept], supersededIds };
}

function banditNameFromNotification(n: NotificationRow): string {
  if (n.reference_type === 'nearby_route') return 'Around You';
  const t = n.title?.trim() || '';
  if (n.reference_type === BANDIT_QUESTION_GUEST_ECHO_REF) {
    if (t.length > 0 && t.length < 80) return t;
    return 'You asked';
  }
  if (n.type === 'demo_banditeam') return 'bandiTEAM';
  if (n.type === 'live_alert') return 'bandiTour LIVE';
  if (n.type === 'bandit_question') {
    if (t.length > 0 && t.length < 64) return `Ask Me · ${t}`;
    return 'Ask Me';
  }
  if (n.type === 'local_friend' && t.length > 0 && t.length < 64) {
    return `Local Friend · ${t}`;
  }
  if (isLocalFriendBottleInboxType(n.type)) {
    if (t.length > 0 && t.length < 64 && !/^message in a bottle$/i.test(t)) return t;
    return 'Message in a bottle';
  }
  if (n.type === 'guest_moment') {
    if (t.length > 0 && t.length < 64 && !/^a moment from the city$/i.test(t)) return t;
    return 'A Moment';
  }
  const fromReply = /^reply\s+from\s+(.+)/i.exec(t);
  if (fromReply) return fromReply[1].trim();
  const localFriend = /local friend/i.test(t) ? 'Local Friend' : '';
  if (localFriend) return 'bandiTour';
  if (t.length > 0 && t.length < 40) return t;
  return 'banDit';
}

function notificationToInboxItem(n: NotificationRow, fromServer = true): InboxListItem {
  const raw = n.message?.trim() || '';
  const previewBody =
    n.reference_type === BANDIT_QUESTION_GUEST_ECHO_REF
      ? raw
      : n.type === 'bandit_question' && raw
        ? bodyAfterAskMeAboutLine(raw)
        : inboxPreviewForType(n.type, raw, n.title || '');
  return {
    id: n.id,
    banditName: banditNameFromNotification(n),
    preview: previewBody || n.title || 'New update',
    timestampLabel: formatInboxSentAt(n.created_at),
    sortKey: new Date(n.created_at).getTime(),
    fromServer,
    notification: n,
  };
}

function demoStorageToRow(d: DemoNotificationStorage): NotificationRow {
  return {
    id: d.id,
    user_id: 'demo-local',
    type: d.type,
    title: d.title,
    message: d.message,
    reference_id: null,
    reference_type: d.type === 'demo_banditeam' ? 'demo' : null,
    is_read: true,
    created_at: d.created_at,
  };
}

function nearbyToRow(e: NearbyInboxEntry): NotificationRow {
  return {
    id: e.id,
    user_id: 'nearby-local',
    type: e.type,
    title: e.title,
    message: e.message,
    reference_id: JSON.stringify(e.route),
    reference_type: 'nearby_route',
    is_read: true,
    created_at: e.created_at,
  };
}

async function markNotificationsReadByIds(ids: string[]): Promise<void> {
  const unique = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
  const chunkSize = 200;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const slice = unique.slice(i, i + chunkSize);
    const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', slice);
    if (error) throw new Error(error.message || 'Could not update notifications.');
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;
  const { refreshNotifications, markNotificationRead, unreadCount, chatUnreadCount } = useAppState();
  const inboxInitialFocusDoneRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [serverItems, setServerItems] = useState<InboxListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [demoExtras, setDemoExtras] = useState<InboxListItem[]>([]);
  const [nearbyExtras, setNearbyExtras] = useState<InboxListItem[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkWorking, setBulkWorking] = useState(false);

  const removeFromLocalState = useCallback((ids: Iterable<string>) => {
    const idSet = new Set([...ids].map((id) => String(id || '').trim()).filter(Boolean));
    if (idSet.size === 0) return;
    setServerItems((prev) => prev.filter((row) => !idSet.has(row.id)));
    setDemoExtras((prev) => prev.filter((row) => !idSet.has(row.id)));
    setNearbyExtras((prev) => prev.filter((row) => !idSet.has(row.id)));
  }, []);

  const deleteInboxItems = useCallback(
    async (items: InboxListItem[]) => {
      if (items.length === 0) return;
      const ids = items.map((item) => item.id);
      removeFromLocalState(ids);
      await dismissInboxNotifications(
        items.map((item) => ({
          id: item.id,
          fromServer: item.fromServer,
          referenceType: item.notification.reference_type,
          wasUnread: item.fromServer && !item.notification.is_read,
        })),
      );
      await refreshNotifications();
      DeviceEventEmitter.emit(BANDITS_NOTIFICATIONS_REFRESH);
    },
    [refreshNotifications, removeFromLocalState],
  );

  const deleteInboxItem = useCallback(
    async (item: InboxListItem) => {
      await deleteInboxItems([item]);
    },
    [deleteInboxItems],
  );

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Native SectionList skips row updates unless `extraData` changes (select UI). */
  const inboxListExtraData = useMemo(
    () => `${selectMode ? 1 : 0}:${[...selectedIds].sort().join(',')}`,
    [selectMode, selectedIds],
  );

  const refreshNearbyExtras = useCallback(async () => {
    const stored = await getNearbyStoredNotifications();
    setNearbyExtras(stored.map((s) => notificationToInboxItem(nearbyToRow(s), false)));
  }, []);

  const refreshDemoExtras = useCallback(async () => {
    if (!isDemoMode()) {
      setDemoExtras([]);
      return;
    }
    const stored = await getStoredDemoNotifications();
    const ambient = getAmbientDemoNotifications();
    const seen = new Set<string>();
    const rowsOut: InboxListItem[] = [];
    for (const d of [...stored, ...ambient]) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      rowsOut.push(notificationToInboxItem(demoStorageToRow(d), false));
    }
    setDemoExtras(rowsOut);
  }, []);

  useEffect(() => {
    void refreshDemoExtras();
  }, [refreshDemoExtras]);

  useEffect(() => {
    void refreshNearbyExtras();
  }, [refreshNearbyExtras]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('nearby_inbox_updated', () => void refreshNearbyExtras());
    return () => sub.remove();
  }, [refreshNearbyExtras]);

  useEffect(() => {
    if (!isDemoMode()) return;
    const t = setInterval(() => void refreshDemoExtras(), 5000);
    return () => clearInterval(t);
  }, [refreshDemoExtras]);

  const loadInbox = useCallback(async (phase: 'initial' | 'refresh') => {
    const endLoad = perfStart(`notifications_load:${phase}`, phase === 'initial' ? 'render' : 'network');
    try {
      if (phase === 'initial') setLoading(true);
      else setRefreshing(true);
      perfMark(`notifications_load:${phase}:start`, 'network');
      await ensureAnonymousSession().catch(() => undefined);
      const status = await perfTraceNetwork('notifications_backend_status', () =>
        getNotificationsBackendStatus(),
      );
      if (!status.enabled) {
        setServerItems([]);
        await refreshNotifications();
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setServerItems([]);
        await refreshNotifications();
        return;
      }
      const { data, error: qError } = await perfTraceNetwork('notifications_query', async () =>
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      );

      if (qError) {
        throw new Error(qError.message || 'Could not load notifications right now.');
      }
      const uid = String(user.id || '').trim();
      const opId = String(getOperatorUserId() || '').trim();
      const rawRows = (data as NotificationRow[]) || [];
      const dismissed = await getDismissedNotificationIds();

      let filteredRows = rawRows.filter(
        (n) =>
          !dismissed.has(String(n.id || '').trim()) &&
          !isDeletedThreadRef(n.reference_type) &&
          !isOperatorInboundRequestRowForDualRoleUser(n, uid, opId),
      );

      const pilotMirrorHiddenIds = filteredRows
        .filter((n) => shouldHideAskGuestMirrorForPilotOperator(n, uid, opId))
        .map((n) => n.id);

      filteredRows = filteredRows.filter((n) => !shouldHideAskGuestMirrorForPilotOperator(n, uid, opId));

      const { rows: dedupedAsk, supersededIds } = dedupeAskMeGuestNotifications(filteredRows);
      filteredRows = dedupedAsk.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      const unreadRepliesBeforeRead = filteredRows.filter(
        (n) => !n.is_read && n.type === 'bandit_reply',
      );
      const unreadVisibleIds = filteredRows.filter((n) => !n.is_read).map((n) => n.id);
      const idsToMarkRead = [
        ...new Set([...supersededIds, ...pilotMirrorHiddenIds, ...unreadVisibleIds]),
      ].filter(Boolean);
      let displayRows = filteredRows;
      if (idsToMarkRead.length > 0) {
        try {
          await markNotificationsReadByIds(idsToMarkRead);
          displayRows = filteredRows.map((n) => ({ ...n, is_read: true }));
        } catch (e) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[notifications] mark read failed', e);
          }
        }
      }

      const rows = displayRows.map((n) => notificationToInboxItem(n));
      setServerItems(rows);
      perfMark(`notifications_load:${phase}:rows_ready`, 'render', { count: rows.length });
      await refreshNotifications();
      unreadRepliesBeforeRead.forEach((n) => {
        if (n.reference_type === 'operator_reply_local_friend') {
          void trackEvent({
            eventName: 'local_friend_reply_received',
            referenceType: 'notification',
            referenceId: n.id,
          });
        } else {
          void trackEvent({
            eventName: 'bandit_reply_received',
            referenceType: 'notification',
            referenceId: n.id,
          });
        }
      });
    } catch {
      setServerItems([]);
      await refreshNotifications();
    } finally {
      if (phase === 'initial') setLoading(false);
      else setRefreshing(false);
      inboxInitialFocusDoneRef.current = true;
      endLoad({ phase });
    }
  }, [refreshNotifications]);

  const onRefreshInbox = useCallback(async () => {
    await loadInbox('refresh');
    await refreshDemoExtras();
    await refreshNearbyExtras();
  }, [loadInbox, refreshDemoExtras, refreshNearbyExtras]);

  const inboxRefreshControl = usePremiumRefreshControl(refreshing, onRefreshInbox);

  const rows = useMemo(() => {
    const merged = [...serverItems, ...demoExtras, ...nearbyExtras];
    const byId = new Map<string, InboxListItem>();
    merged.forEach((item) => {
      byId.set(item.id, item);
    });
    return [...byId.values()].sort((a, b) => b.sortKey - a.sortKey);
  }, [serverItems, demoExtras, nearbyExtras]);

  const markAllVisibleRead = useCallback(async () => {
    if (bulkWorking) return;
    setBulkWorking(true);
    try {
      const unreadServer = serverItems.filter((row) => row.fromServer && !row.notification.is_read);
      const ids = unreadServer.map((row) => row.id);
      if (ids.length > 0) {
        setServerItems((prev) =>
          prev.map((row) =>
            row.fromServer && !row.notification.is_read
              ? { ...row, notification: { ...row.notification, is_read: true } }
              : row,
          ),
        );
        await markNotificationsReadByIds(ids);
        await refreshNotifications();
      }
    } finally {
      setBulkWorking(false);
    }
  }, [bulkWorking, refreshNotifications, serverItems]);

  const clearAllVisible = useCallback(() => {
    if (bulkWorking || rows.length === 0) return;
    Alert.alert(
      'Clear all notifications?',
      'This removes every item from your inbox on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBulkWorking(true);
              try {
                const snapshot = rows;
                setSelectMode(false);
                setSelectedIds(new Set());
                removeFromLocalState(snapshot.map((row) => row.id));
                await dismissInboxNotifications(
                  snapshot.map((item) => ({
                    id: item.id,
                    fromServer: item.fromServer,
                    referenceType: item.notification.reference_type,
                  })),
                );
                await refreshNotifications();
                DeviceEventEmitter.emit(BANDITS_NOTIFICATIONS_REFRESH);
              } finally {
                setBulkWorking(false);
              }
            })();
          },
        },
      ],
    );
  }, [bulkWorking, removeFromLocalState, refreshNotifications, rows]);

  const deleteSelected = useCallback(() => {
    if (bulkWorking || selectedIds.size === 0) return;
    const targets = rows.filter((row) => selectedIds.has(row.id));
    void (async () => {
      setBulkWorking(true);
      try {
        await deleteInboxItems(targets);
        setSelectMode(false);
        setSelectedIds(new Set());
      } finally {
        setBulkWorking(false);
      }
    })();
  }, [bulkWorking, deleteInboxItems, rows, selectedIds]);

  const inboxHeaderRight = useCallback(
    () => (
      <View style={styles.headerActions}>
        {selectMode ? (
          <>
            <Pressable
              onPress={deleteSelected}
              disabled={selectedIds.size === 0 || bulkWorking}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Delete selected notifications"
            >
              <Text
                style={[
                  styles.headerActionText,
                  (selectedIds.size === 0 || bulkWorking) && styles.headerActionTextDisabled,
                ]}
              >
                Delete{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setSelectMode(false);
                setSelectedIds(new Set());
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Done selecting"
            >
              <Text style={styles.headerActionText}>Done</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => void markAllVisibleRead()}
              disabled={bulkWorking}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
            >
              <Text style={styles.headerActionText}>Read all</Text>
            </Pressable>
            <Pressable
              onPress={clearAllVisible}
              disabled={bulkWorking || rows.length === 0}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Clear all notifications"
            >
              <Text
                style={[
                  styles.headerActionText,
                  (bulkWorking || rows.length === 0) && styles.headerActionTextDisabled,
                ]}
              >
                Clear
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectMode(true)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Select notifications"
            >
              <Text style={styles.headerActionText}>Select</Text>
            </Pressable>
          </>
        )}
      </View>
    ),
    [
      bulkWorking,
      clearAllVisible,
      deleteSelected,
      markAllVisibleRead,
      rows.length,
      selectMode,
      selectedIds.size,
    ],
  );

  const notificationsScreenOptions = useAppBackScreenOptions({
    title: selectMode ? `${selectedIds.size} selected` : 'Notifications',
    fallback: '/menu',
    showBack: true,
    escapeShortcuts: true,
    headerRight: inboxHeaderRight,
  });

  useFocusEffect(
    useCallback(() => {
      perfMark('notifications_screen_focus', 'navigation');
      const phase = inboxInitialFocusDoneRef.current ? 'refresh' : 'initial';
      void loadInbox(phase);
      void markInboxSurfaceOpened(unreadCount).then(() =>
        syncOsAppIconBadge(unreadCount, chatUnreadCount),
      );
    }, [loadInbox, unreadCount, chatUnreadCount]),
  );

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const sub = DeviceEventEmitter.addListener(BANDITS_NOTIFICATIONS_REFRESH, () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        void loadInbox('refresh');
      }, 350);
    });
    return () => {
      sub.remove();
      if (t) clearTimeout(t);
    };
  }, [loadInbox]);

  const sections = useMemo(() => {
    const nearby = rows.filter((r) => r.notification.reference_type === 'nearby_route');
    const rest = rows.filter((r) => r.notification.reference_type !== 'nearby_route');
    const out: { title: string | null; data: InboxListItem[] }[] = [];
    if (nearby.length > 0) {
      out.push({ title: 'Around You', data: nearby });
    }
    if (rest.length > 0) {
      out.push({ title: null, data: rest });
    }
    return out;
  }, [rows]);

  const openItem = useCallback(
    (item: InboxListItem) => {
      void trackEvent({
        eventName: 'notification_opened',
        referenceType: 'notification',
        referenceId: item.notification.id,
      });

      // Mark as read locally + on the server so the badge clears immediately.
      const wasUnread = item.fromServer && !item.notification.is_read;
      if (wasUnread) {
        setServerItems((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, notification: { ...row.notification, is_read: true } } : row,
          ),
        );
        void markNotificationRead(item.notification.id);
      }

      if (!item.fromServer) return;

      // Operator-side: tapping an Ask Me / Local Friend request opens the
      // chat thread with the exact same param block Pilot Desk uses. This
      // gives the operator a one-tap path to reply directly from the
      // Notifications tab — previously they had to navigate to Pilot Desk
      // first.
      const n = item.notification;
      const t = String(n.type || '').trim();
      const rt = String(n.reference_type || '').trim();
      const isOperatorAskMe = t === 'bandit_question' && rt === 'bandit_question_request';
      const isOperatorLocalFriend = t === 'local_friend' && rt === 'local_friend_request';
      const floatRef = String(n.reference_id || '').trim();
      const isOceanFoundOnly = isLocalFriendBottleInboxType(t) && isLocalFriendOceanFoundRef(rt);
      const isOceanActiveChat =
        floatRef.length >= 32 &&
        (isLocalFriendOceanClaimRef(rt) ||
          rt === 'local_friend_ocean_peer' ||
          (t === 'bandit_reply' && rt === OCEAN_THREAD_REPLY_REF));

      /** Sender “Someone found your bottle” — informational only until the guest replies. */
      if (isOceanFoundOnly) {
        return;
      }

      if (isOperatorAskMe || isOperatorLocalFriend || isOceanActiveChat) {
        const aboutBandit = isOperatorAskMe ? parseAboutBanditFromAskMessage(n.message || '') : null;
        let banditNameParam = isOperatorAskMe ? aboutBandit || 'Ask' : 'Local Friend';
        if (isOceanActiveChat) {
          const oceanTitle = String(n.title || '').trim();
          banditNameParam =
            oceanTitle && !/^message in a bottle$/i.test(oceanTitle) ? oceanTitle : 'Message in a bottle';
        }
        router.push({
          pathname: '/chat',
          params: {
            banditName: banditNameParam,
            notificationId: n.id,
            notificationType: isOceanActiveChat ? 'local_friend_bottle' : n.type,
            referenceId: floatRef,
            referenceType: isOceanActiveChat ? 'local_friend_ocean_claim' : (n.reference_type ?? ''),
            notificationTitle: n.title ?? '',
            notificationMessage: n.message ?? '',
          },
        });
        return;
      }

      if (isSignalBottleInboxType(t)) {
        router.push({
          pathname: '/chat',
          params: {
            banditName: banditNameFromNotification(n),
            notificationId: n.id,
            notificationType: n.type,
            referenceId: n.reference_id ?? '',
            referenceType: n.reference_type ?? '',
            notificationTitle: n.title ?? '',
            notificationMessage: n.message ?? '',
          },
        });
        return;
      }

      const isGuestAskEcho = t === 'bandit_question' && rt === BANDIT_QUESTION_GUEST_ECHO_REF;
      const isGuestLocalFriendEcho = t === 'local_friend' && rt === 'local_friend_guest_echo';
      if (isGuestAskEcho || isGuestLocalFriendEcho) {
        router.push({
          pathname: '/chat',
          params: {
            banditName: banditNameFromNotification(n),
            notificationId: n.id,
            notificationType: n.type,
            referenceId: n.reference_id ?? '',
            referenceType: n.reference_type ?? '',
            notificationTitle: n.title ?? '',
            notificationMessage: n.message ?? '',
          },
        });
        return;
      }

      /** Mode A Moment discovery — open bridge (reveal) or continue Chat. */
      if (t === 'guest_moment') {
        if (rt === 'guest_moment_thread' && floatRef) {
          router.push({
            pathname: '/chat',
            params: {
              banditName: banditNameFromNotification(n),
              notificationId: floatRef,
              notificationType: 'guest_moment',
              referenceId: floatRef,
              referenceType: 'guest_moment_thread',
              notificationTitle: n.title ?? '',
              notificationMessage: n.message ?? '',
            },
          });
          return;
        }
        router.push('/bottleDiscover');
        return;
      }

      const isGuestAskReply = t === 'bandit_reply' && ASK_ME_GUEST_BANDIT_REPLY_REFS.has(rt);
      const isGuestLocalFriendReply = t === 'bandit_reply' && rt === 'operator_reply_local_friend';
      if (isGuestAskReply || isGuestLocalFriendReply) {
        router.push({
          pathname: '/chat',
          params: {
            banditName: banditNameFromNotification(n),
            notificationId: n.id,
            notificationType: n.type,
            referenceId: n.reference_id ?? '',
            referenceType: n.reference_type ?? '',
            notificationTitle: n.title ?? '',
            notificationMessage: n.message ?? '',
          },
        });
      }
    },
    [markNotificationRead, router],
  );

  const renderItem = useCallback(
    ({ item }: { item: InboxListItem }) => {
      const isLive = item.notification.type === 'live_alert';
      const selected = selectedIds.has(item.id);
      const inner = (
        <Pressable
          style={[styles.card, selected && styles.cardSelected]}
          onPress={() => {
            if (selectMode) {
              toggleSelected(item.id);
              return;
            }
            openItem(item);
          }}
          onLongPress={() => {
            if (!selectMode) setSelectMode(true);
            toggleSelected(item.id);
          }}
        >
          <View style={styles.cardRow}>
            {selectMode ? (
              <View style={[styles.selectDot, selected && styles.selectDotOn]}>
                {selected ? <Text style={styles.selectDotMark}>✓</Text> : null}
              </View>
            ) : null}
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.banditName}>{item.banditName}</Text>
                <Text style={styles.time}>{item.timestampLabel}</Text>
              </View>
              {isLive && item.notification.title?.trim() ? (
                <Text style={styles.liveTitle} numberOfLines={2}>
                  {item.notification.title.trim()}
                </Text>
              ) : null}
              <Text style={styles.preview} numberOfLines={isLive ? 5 : 2} ellipsizeMode="tail">
                {isLive ? item.notification.message?.trim() || item.preview : item.preview}
              </Text>
            </View>
          </View>
        </Pressable>
      );

      if (Platform.OS === 'web' || selectMode) {
        return inner;
      }

      return (
        <Swipeable
          overshootRight={false}
          renderRightActions={() => (
            <Pressable
              style={styles.swipeDelete}
              onPress={() => void deleteInboxItem(item)}
              accessibilityRole="button"
              accessibilityLabel="Delete notification"
            >
              <Text style={styles.swipeDeleteText}>Delete</Text>
            </Pressable>
          )}
        >
          {inner}
        </Swipeable>
      );
    },
    [deleteInboxItem, openItem, selectMode, selectedIds, toggleSelected],
  );

  return (
    <>
      <Stack.Screen options={notificationsScreenOptions} />
      <View style={[styles.container, isDesktopWeb && styles.containerDesktop]}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          extraData={inboxListExtraData}
          renderItem={renderItem}
          renderSectionHeader={({ section }) =>
            section.title ? <Text style={styles.sectionHeader}>{section.title}</Text> : null
          }
          SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          stickySectionHeadersEnabled={false}
          refreshControl={inboxRefreshControl}
          ListHeaderComponent={<LifecycleInboxHeader />}
          ListEmptyComponent={
            loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#111111" />
              </View>
            ) : (
              <View style={styles.center}>
                <Text style={styles.emptyHeading}>No notifications yet</Text>
              </View>
            )
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    width: '100%',
    overflow: 'hidden',
  },
  containerDesktop: {
    maxWidth: 1120,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#6B6B6B',
    marginBottom: 10,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyHeading: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  list: {
    paddingBottom: 96,
  },
  card: {
    backgroundColor: '#F6F7F9',
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8E8',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  banditName: {
    flex: 1,
    marginRight: 8,
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
  },
  time: {
    fontSize: 12,
    color: '#777',
    fontWeight: '600',
    flexShrink: 0,
  },
  liveTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111',
    marginBottom: 6,
  },
  preview: {
    fontSize: 14,
    color: '#3C3C3C',
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: Platform.OS === 'ios' ? 2 : 6,
    flexShrink: 1,
  },
  headerActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },
  headerActionTextDisabled: {
    opacity: 0.45,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardSelected: {
    borderColor: '#111111',
    backgroundColor: '#EEF7FA',
  },
  selectDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#C8C8C8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  selectDotOn: {
    borderColor: '#111111',
    backgroundColor: '#111111',
  },
  selectDotMark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  swipeDelete: {
    backgroundColor: '#C62828',
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    borderRadius: 14,
    marginLeft: 8,
  },
  swipeDeleteText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
