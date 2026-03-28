import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  SectionList,
  TextInput,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import {
  type DemoNotificationStorage,
  getAmbientDemoNotifications,
  getStoredDemoNotifications,
  isDemoMode,
} from '@/lib/demoMode';
import { getNearbyStoredNotifications, type NearbyInboxEntry } from '@/lib/nearbyAlertsStorage';
import { getNotificationsBackendStatus, getOperatorUserId, sendPilotLiveAlert } from '@/services/localFriend';
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
  if (n.type === 'demo_banditeam') return 'bandiTEAM';
  if (n.type === 'live_alert') return 'bandiTour LIVE';
  const fromReply = /^reply\s+from\s+(.+)/i.exec(t);
  if (fromReply) return fromReply[1].trim();
  const localFriend = /local friend/i.test(t) ? 'Local Friend' : '';
  if (localFriend) return 'bandiTour';
  if (t.length > 0 && t.length < 40) return t;
  return 'banDit';
}

function notificationToInboxItem(n: NotificationRow, fromServer = true): InboxListItem {
  return {
    id: n.id,
    banditName: banditNameFromNotification(n),
    preview: n.message?.trim() || n.title || 'New update',
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
  const [isOperator, setIsOperator] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveMessage, setLiveMessage] = useState('');
  const [sendingLive, setSendingLive] = useState(false);
  const [liveFeedback, setLiveFeedback] = useState<string | null>(null);
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
      const status = await getNotificationsBackendStatus();
      if (!status.enabled) {
        setBackendDisabledReason(status.reason || 'Inbox is unavailable right now.');
        setServerItems([]);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const operatorUserId = getOperatorUserId();
      setIsOperator(!!operatorUserId && user?.id === operatorUserId);
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
      const rows = ((data as NotificationRow[]) || []).map((n) => notificationToInboxItem(n));
      setServerItems(rows);
      const unreadIds = ((data as NotificationRow[]) || []).filter((n) => !n.is_read).map((n) => n.id);
      const unreadReplies = ((data as NotificationRow[]) || []).filter(
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

  const sendLiveAlertNow = useCallback(async () => {
    if (sendingLive) return;
    try {
      setSendingLive(true);
      setLiveFeedback(null);
      const result = await sendPilotLiveAlert({
        title: liveTitle,
        message: liveMessage,
      });
      setLiveFeedback(`Live alert sent to ${result.recipientCount} users.`);
      setLiveTitle('');
      setLiveMessage('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not send live alert.';
      setLiveFeedback(msg);
    } finally {
      setSendingLive(false);
    }
  }, [sendingLive, liveTitle, liveMessage]);

  const openChat = useCallback(
    (item: InboxListItem) => {
      void trackEvent({
        eventName: 'notification_opened',
        referenceType: 'notification',
        referenceId: item.notification.id,
      });
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
      router.push({
        pathname: '/chat',
        params: {
          banditName: item.banditName,
          notificationId: item.notification.id,
          notificationType: item.notification.type,
          referenceId: item.notification.reference_id ?? '',
          referenceType: item.notification.reference_type ?? '',
          notificationTitle: item.notification.title ?? '',
        },
      });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: InboxListItem }) => (
      <Pressable style={styles.card} onPress={() => openChat(item)}>
        <View style={styles.cardTop}>
          <Text style={styles.banditName}>{item.banditName}</Text>
          <Text style={styles.time}>{item.timestampLabel}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={2} ellipsizeMode="tail">
          {item.preview}
        </Text>
      </Pressable>
    ),
    [openChat],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Inbox', headerBackTitle: 'Back' }} />
      <View style={styles.container}>
        <Text style={styles.subtitle}>
          Replies and alerts from local banDits and the bandiTour crew.
        </Text>
        <Text style={styles.tagline}>Right here, right now.</Text>
        {isDemoMode() ? (
          <Text style={styles.demoPill}>
            Pilot demo mode — sample activity is mixed in; nothing here overwrites real user data.
          </Text>
        ) : null}
        {isOperator && (
          <View style={styles.operatorCard}>
            <Text style={styles.operatorTitle}>Pilot live alert</Text>
            <TextInput
              style={styles.operatorInput}
              placeholder="Alert title (e.g. Tonight: rooftop party)"
              value={liveTitle}
              onChangeText={setLiveTitle}
              placeholderTextColor="#888"
            />
            <TextInput
              style={[styles.operatorInput, styles.operatorTextarea]}
              placeholder="Alert message..."
              value={liveMessage}
              onChangeText={setLiveMessage}
              placeholderTextColor="#888"
              multiline
            />
            <Pressable
              style={[
                styles.operatorButton,
                (sendingLive || !liveTitle.trim() || !liveMessage.trim()) && styles.operatorButtonDisabled,
              ]}
              onPress={sendLiveAlertNow}
              disabled={sendingLive || !liveTitle.trim() || !liveMessage.trim()}
            >
              <Text style={styles.operatorButtonText}>{sendingLive ? 'Sending…' : 'Send live alert'}</Text>
            </Pressable>
            {!!liveFeedback && <Text style={styles.operatorFeedback}>{liveFeedback}</Text>}
          </View>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : backendDisabledReason && rows.length === 0 && !isDemoMode() ? (
          <View style={styles.center}>
            <Text style={styles.emptyHeading}>Inbox unavailable</Text>
            <Text style={styles.emptyText}>{backendDisabledReason}</Text>
          </View>
        ) : backendDisabledReason && isDemoMode() && rows.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyHeading}>Loading demo inbox…</Text>
            <Text style={styles.emptyText}>{backendDisabledReason}</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyHeading}>No messages yet</Text>
            <Text style={styles.emptyText}>When local replies arrive, they appear here.</Text>
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefreshInbox()} />}
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
  operatorCard: {
    borderWidth: 1,
    borderColor: '#E3E6EB',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#F8FAFD',
    marginBottom: 12,
  },
  operatorTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A2430',
    marginBottom: 8,
  },
  operatorInput: {
    borderWidth: 1,
    borderColor: '#D9DEE5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111',
    backgroundColor: '#FFF',
    marginBottom: 8,
  },
  operatorTextarea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  operatorButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#111',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  operatorButtonDisabled: {
    opacity: 0.55,
  },
  operatorButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  operatorFeedback: {
    marginTop: 8,
    fontSize: 12,
    color: '#2E3D4E',
    lineHeight: 18,
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
