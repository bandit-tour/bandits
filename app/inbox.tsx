import { Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Platform,
  SectionList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { BANDIT_QUESTION_GUEST_ECHO_REF, bodyAfterAskMeAboutLine } from '@/lib/askMeMessageFormat';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { supabase } from '@/lib/supabase';
import {
  type DemoNotificationStorage,
  getAmbientDemoNotifications,
  getStoredDemoNotifications,
  isDemoMode,
} from '@/lib/demoMode';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { requestNotificationsRefresh } from '@/lib/notificationEvents';
import { getNearbyStoredNotifications, type NearbyInboxEntry } from '@/lib/nearbyAlertsStorage';
import { getNotificationsBackendStatus } from '@/services/localFriend';
import { getOperatorUserId } from '@/lib/operatorConfig';
import { trackEvent } from '@/lib/analytics';
import { getDismissedNotificationIds } from '@/lib/dismissedThreads';

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

function isOperatorInboundRequestRowForDualRoleUser(
  n: NotificationRow,
  currentUserId: string,
  operatorUserId: string,
): boolean {
  if (!currentUserId || !operatorUserId) return false;
  if (currentUserId.toLowerCase() !== operatorUserId.toLowerCase()) return false;
  const t = String(n.type || '').trim();
  const rt = String(n.reference_type || '').trim();
  /**
   * Same account (traveler + operator): keep traveler-side inbox clean.
   * Pilot Desk still reads these rows from `/operatorDesk`.
   */
  return (
    (t === 'bandit_question' && rt === 'bandit_question_request') ||
    (t === 'local_friend' && rt === 'local_friend_request')
  );
}

/** Guest-side Ask rows (echo + banDit replies), keyed by operator thread root `reference_id`. */
const ASK_ME_GUEST_BANDIT_REPLY_REFS = new Set(['operator_reply', 'operator_reply_bandit_question']);

function isAskMeGuestSideNotification(n: NotificationRow): boolean {
  const rt = String(n.reference_type || '').trim();
  if (rt === BANDIT_QUESTION_GUEST_ECHO_REF) return true;
  const t = String(n.type || '').trim();
  return t === 'bandit_reply' && ASK_ME_GUEST_BANDIT_REPLY_REFS.has(rt);
}

/**
 * Pilot operator account: Ask “traveler mirror” rows belong in Pilot Desk + Chat from there only —
 * do not list duplicate threads in Notifications.
 */
function shouldHideAskGuestMirrorForPilotOperator(
  n: NotificationRow,
  currentUserId: string,
  operatorUserId: string,
): boolean {
  if (!currentUserId || !operatorUserId) return false;
  if (currentUserId.toLowerCase() !== operatorUserId.toLowerCase()) return false;
  return isAskMeGuestSideNotification(n);
}

/**
 * One Notifications row per Ask thread: latest row wins (usually `bandit_reply` over guest echo).
 */
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

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `Today · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const ySame =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (ySame) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
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
        : raw;
  return {
    id: n.id,
    banditName: banditNameFromNotification(n),
    preview: previewBody || n.title || 'New update',
    timestampLabel: formatTimestamp(n.created_at),
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

export default function InboxScreen() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;
  const [loading, setLoading] = useState(true);
  const [serverItems, setServerItems] = useState<InboxListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [demoExtras, setDemoExtras] = useState<InboxListItem[]>([]);
  const [nearbyExtras, setNearbyExtras] = useState<InboxListItem[]>([]);
  const hasInboxMergedRowsRef = useRef(false);

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

  const loadInbox = useCallback(async (silent?: boolean) => {
    try {
      if (!silent) setLoading(true);
      await ensureAnonymousSession().catch(() => undefined);
      const status = await getNotificationsBackendStatus();
      if (!status.enabled) {
        setServerItems([]);
        requestNotificationsRefresh();
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setServerItems([]);
        requestNotificationsRefresh();
        return;
      }
      const { data, error: qError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (qError) {
        throw new Error(qError.message || 'Could not load inbox right now.');
      }
      const uid = String(user.id || '').trim();
      const opId = String(getOperatorUserId() || '').trim();
      const rawRows = (data as NotificationRow[]) || [];
      const dismissed = await getDismissedNotificationIds();

      let filteredRows = rawRows.filter(
        (n) => !dismissed.has(String(n.id || '').trim()) && !isOperatorInboundRequestRowForDualRoleUser(n, uid, opId),
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
            console.warn('[inbox] mark read failed', e);
          }
        }
      }

      const rows = displayRows.map((n) => notificationToInboxItem(n));
      setServerItems(rows);
      requestNotificationsRefresh();
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
      requestNotificationsRefresh();
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const onRefreshInbox = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadInbox(true);
      await refreshDemoExtras();
      await refreshNearbyExtras();
    } finally {
      setRefreshing(false);
    }
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

  useEffect(() => {
    hasInboxMergedRowsRef.current = rows.length > 0;
  }, [rows.length]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        if (hasInboxMergedRowsRef.current) {
          setRefreshing(true);
          try {
            await loadInbox(true);
          } finally {
            setRefreshing(false);
          }
          return;
        }
        await loadInbox(false);
      })();
    }, [loadInbox]),
  );

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
      if (!item.fromServer) return;
      setServerItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, notification: { ...row.notification, is_read: true } } : row,
        ),
      );
      void supabase.from('notifications').update({ is_read: true }).eq('id', item.notification.id);
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: InboxListItem }) => (
      <Pressable style={styles.card} onPress={() => openItem(item)}>
        <View style={styles.cardTop}>
          <Text style={styles.banditName}>{item.banditName}</Text>
          <Text style={styles.time}>{item.timestampLabel}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={2} ellipsizeMode="tail">
          {item.preview}
        </Text>
      </Pressable>
    ),
    [openItem],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Inbox', headerBackTitle: 'Back' }} />
      <View style={[styles.container, isDesktopWeb && styles.containerDesktop]}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyHeading}>No notifications yet</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={({ section }) =>
              section.title ? <Text style={styles.sectionHeader}>{section.title}</Text> : null
            }
            SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            stickySectionHeadersEnabled={false}
            refreshControl={inboxRefreshControl}
          />
        )}
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
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
  },
  time: {
    fontSize: 12,
    color: '#777',
    fontWeight: '600',
  },
  preview: {
    fontSize: 14,
    color: '#3C3C3C',
    lineHeight: 20,
  },
});
