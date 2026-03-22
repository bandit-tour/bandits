import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

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

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function InboxScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationRow[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('[Inbox] load start');

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error('[Inbox] getUser error', userError);
          throw userError;
        }

        if (!user) {
          console.log('[Inbox] no authenticated user');
          setItems([]);
          return;
        }

        const { data, error: qError } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (qError) {
          if (qError.code === 'PGRST205' || qError.code === '42P01') {
            setItems([]);
            return;
          }
          console.error('[Inbox] fetch notifications error', qError);
          throw qError;
        }

        setItems((data as any) || []);
        console.log('[Inbox] notifications loaded', { count: data?.length ?? 0 });
      } catch (err: any) {
        console.error('[Inbox] load failed', err);
        setError(err?.message ?? 'Failed to load inbox');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const empty = useMemo(() => items.length === 0, [items.length]);

  const handlePress = async (n: NotificationRow) => {
    try {
      // Optimistically mark as read
      if (!n.is_read) {
        setItems((prev) =>
          prev.map((it) => (it.id === n.id ? { ...it, is_read: true } : it))
        );
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', n.id);
      }

      // Navigate based on type / reference
      if (n.type === 'local_friend' || n.type === 'ask_bandit') {
        router.push('/chat');
        return;
      }

      if ((n.type === 'bandit_reply' || n.type === 'local_friend_reply') && n.reference_type === 'chat') {
        router.push('/chat');
        return;
      }

      if (n.type === 'event_alert' && n.reference_type === 'event' && n.reference_id) {
        router.push(`/spot/${n.reference_id}` as any);
        return;
      }

      if (n.type === 'scam_alert' && n.reference_type === 'scam_alert' && n.reference_id) {
        router.push('/bandiTeam');
        return;
      }

      // Fallback: stay on inbox if no route
    } catch (err) {
      console.error('[Inbox] failed to handle notification press', err);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '' }} />

      <View style={styles.container}>
        <Text style={styles.title}>Inbox</Text>
        <Text style={styles.subtitle}>
          New replies and alerts from the city.
        </Text>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        )}

        {!loading && error && (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && empty && (
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              No new messages or alerts.
            </Text>
          </View>
        )}

        {!loading && !error && !empty && (
          <ScrollView contentContainerStyle={styles.listContent}>
            {items.map((n) => (
              <View
                key={n.id}
                style={[
                  styles.card,
                  !n.is_read && styles.cardUnread,
                ]}
              >
                <Text style={styles.notificationTitle}>{n.title}</Text>
                <Text
                  style={styles.notificationMessage}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {n.message}
                </Text>
                <View style={styles.rowBottom}>
                  <Text style={styles.dateText}>{formatDate(n.created_at)}</Text>
                  <Text style={styles.actionText} onPress={() => handlePress(n)}>
                    Open
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
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
    paddingTop: 16,
  },
  title: {
    fontFamily: 'Caros',
    fontWeight: '800',
    fontSize: 24,
    color: '#3C3C3C',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 96, // keep clear of persistent bottom nav
    gap: 10,
  },
  card: {
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 12,
  },
  cardUnread: {
    backgroundColor: '#ECEFFC',
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
    gap: 10,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#3C3C3C',
    marginBottom: 6,
  },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#777',
  },
  label: {
    fontSize: 12,
    color: '#777',
    marginBottom: 2,
  },
  actionText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '600',
  },
});

