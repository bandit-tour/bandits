import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { getNotificationsBackendStatus } from '@/services/localFriend';

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
  const t = n.title?.trim() || '';
  const fromReply = /^reply\s+from\s+(.+)/i.exec(t);
  if (fromReply) return fromReply[1].trim();
  const localFriend = /local friend/i.test(t) ? 'Local Friend' : '';
  if (localFriend) return 'bandiTour';
  if (t.length > 0 && t.length < 40) return t;
  return 'banDit';
}

function notificationToInboxItem(n: NotificationRow): InboxListItem {
  return {
    id: n.id,
    banditName: banditNameFromNotification(n),
    preview: n.message?.trim() || n.title || 'New update',
    timestampLabel: formatTimestamp(n.created_at),
    sortKey: new Date(n.created_at).getTime(),
    fromServer: true,
  };
}

export default function InboxScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [serverItems, setServerItems] = useState<InboxListItem[]>([]);
  const [backendDisabledReason, setBackendDisabledReason] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
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
        const rows = ((data as NotificationRow[]) || []).map(notificationToInboxItem);
        setServerItems(rows);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        setBackendDisabledReason(msg || 'Inbox is unavailable right now.');
        setServerItems([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const rows = useMemo(
    () => [...serverItems].sort((a, b) => b.sortKey - a.sortKey),
    [serverItems],
  );

  const openChat = useCallback(
    (item: InboxListItem) => {
      router.push({
        pathname: '/chat',
        params: { banditName: item.banditName },
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
      <Stack.Screen options={{ headerShown: true, title: 'Inbox' }} />
      <View style={styles.container}>
        <Text style={styles.subtitle}>
          Replies and alerts from local banDits and the bandiTour crew.
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : backendDisabledReason ? (
          <View style={styles.center}>
            <Text style={styles.emptyHeading}>Inbox unavailable</Text>
            <Text style={styles.emptyText}>{backendDisabledReason}</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyHeading}>No messages yet</Text>
            <Text style={styles.emptyText}>When local replies arrive, they appear here.</Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
    marginBottom: 14,
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
