import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  SectionList,
  TextInput,
  Pressable,
  StyleSheet,
  Text,
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
import { getNearbyStoredNotifications, type NearbyInboxEntry } from '@/lib/nearbyAlertsStorage';
import { getNotificationsBackendStatus } from '@/services/localFriend';
import { getOperatorUserId } from '@/lib/operatorConfig';
import { trackEvent } from '@/lib/analytics';

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
    if (t.length > 0 && t.length < 64) return `Chat · ${t}`;
    return 'Chat';
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

export default function InboxScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [serverItems, setServerItems] = useState<InboxListItem[]>([]);
  const [backendDisabledReason, setBackendDisabledReason] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [demoExtras, setDemoExtras] = useState<InboxListItem[]>([]);
  const [nearbyExtras, setNearbyExtras] = useState<InboxListItem[]>([]);

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
      setBackendDisabledReason(null);
      await ensureAnonymousSession().catch(() => undefined);
      const status = await getNotificationsBackendStatus();
      if (!status.enabled) {
        setBackendDisabledReason(status.reason || 'Inbox is unavailable right now.');
        setServerItems([]);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setServerItems([]);
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
      const filteredRows = ((data as NotificationRow[]) || []).filter(
        (n) => !isOperatorInboundRequestRowForDualRoleUser(n, uid, opId),
      );
      const rows = filteredRows.map((n) => notificationToInboxItem(n));
      setServerItems(rows);
      const unreadIds = filteredRows.filter((n) => !n.is_read).map((n) => n.id);
      const unreadReplies = filteredRows.filter(
        (n) => !n.is_read && n.type === 'bandit_reply',
      );
      unreadReplies.forEach((n) => {
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
      if (unreadIds.length > 0) {
        await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setBackendDisabledReason(msg || 'Inbox is unavailable right now.');
      setServerItems([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInbox(false);
  }, [loadInbox]);

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

  const sections = useMemo(() => {
    const nearby = rows.filter((r) => r.notification.reference_type === 'nearby_route');
    const rest = rows.filter((r) => r.notification.reference_type !== 'nearby_route');
    const out: { title: string | null; data: InboxListItem[] }[] = [];
    if (nearby.length > 0) {
      out.push({ title: 'Around You', data: nearby });
    }
    if (rest.length > 0) {
      out.push({ title: nearby.length > 0 ? 'Nearby from the City' : null, data: rest });
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
      if (item.notification.type === 'live_alert') {
        router.push({
          pathname: '/notification/[id]',
          params: {
            id: item.notification.id,
            title: item.notification.title ?? '',
            message: item.notification.message ?? '',
            createdAt: item.notification.created_at ?? '',
          },
        });
        return;
      }
      if (item.notification.reference_type === 'nearby_route' && item.notification.reference_id) {
        try {
          const route = JSON.parse(item.notification.reference_id) as {
            pathname: string;
            params?: Record<string, string>;
          };
          if (route?.pathname) {
            void trackEvent({
              eventName: 'nearby_inbox_opened',
              referenceType: 'nearby',
              referenceId: item.notification.id,
            });
            router.push(route as never);
            return;
          }
        } catch {
          /* ignore */
        }
      }
      if (!item.fromServer) {
        router.push({
          pathname: '/chat',
          params: {
            banditName: item.banditName,
            demoMode: '1',
            demoBody: item.notification.message ?? '',
            demoTitle: item.notification.title ?? '',
          },
        });
        return;
      }
      const chatBanditHeader =
        item.notification.reference_type === BANDIT_QUESTION_GUEST_ECHO_REF
          ? item.notification.title?.trim() || item.banditName
          : item.banditName;
      router.push({
        pathname: '/chat',
        params: {
          banditName: chatBanditHeader,
          notificationId: item.notification.id,
          notificationType: item.notification.type,
          referenceId: item.notification.reference_id ?? '',
          referenceType: item.notification.reference_type ?? '',
          notificationTitle: item.notification.title ?? '',
          notificationMessage: item.notification.message ?? '',
        },
      });
    },
    [router],
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
      <Stack.Screen options={{ headerShown: true, title: 'Notifications', headerBackTitle: 'Back' }} />
      <View style={styles.container}>
        <Text style={styles.subtitle}>
          Notifications: one-off updates. Open a thread in Chat to reply in a two-way chat with Pilot.
        </Text>
        <Text style={styles.tagline}>Live alerts open as details only, not a chat thread.</Text>
        {isDemoMode() ? (
          <Text style={styles.demoPill}>
            Pilot demo mode — sample activity is mixed in; nothing here overwrites real user data.
          </Text>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : backendDisabledReason && rows.length === 0 && !isDemoMode() ? (
          <View style={styles.center}>
            <Text style={styles.emptyHeading}>Notifications unavailable</Text>
            <Text style={styles.emptyText}>{backendDisabledReason}</Text>
          </View>
        ) : backendDisabledReason && isDemoMode() && rows.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyHeading}>Loading demo notifications…</Text>
            <Text style={styles.emptyText}>{backendDisabledReason}</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyHeading}>No notifications yet</Text>
            <Text style={styles.emptyText}>Live updates from Pilot Desk will appear here.</Text>
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
  subtitle: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#7a7a7a',
    lineHeight: 17,
    marginBottom: 14,
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
  demoPill: {
    fontSize: 12,
    color: '#5a4a00',
    backgroundColor: '#FFF8E6',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 12,
    lineHeight: 17,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyHeading: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 18 },
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
