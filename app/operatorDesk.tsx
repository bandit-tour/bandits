import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { getOperatorUserId, sendPilotLiveAlert } from '@/services/localFriend';

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

type ReportRow = {
  id: string;
  city: string;
  location: string;
  title: string;
  description: string;
  created_at: string;
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function OperatorDeskScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOperator, setIsOperator] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveMessage, setLiveMessage] = useState('');
  const [sendingLive, setSendingLive] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const operatorId = getOperatorUserId();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const ok = !!operatorId && !!user && user.id === operatorId;
    setIsOperator(ok);
    if (!ok) {
      setNotifications([]);
      setReports([]);
      return;
    }

    const [{ data: notifRows }, { data: reportRows }] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', operatorId)
        .in('type', ['local_friend', 'bandit_question'])
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('scam_alerts').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setNotifications((notifRows as NotificationRow[]) || []);
    setReports((reportRows as ReportRow[]) || []);
  }, []);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        await loadAll();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  const sendLive = useCallback(async () => {
    if (sendingLive) return;
    setSendingLive(true);
    setFeedback(null);
    try {
      const r = await sendPilotLiveAlert({ title: liveTitle, message: liveMessage });
      setFeedback(`Live alert sent to ${r.recipientCount} users.`);
      setLiveTitle('');
      setLiveMessage('');
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Could not send live alert.');
    } finally {
      setSendingLive(false);
    }
  }, [liveTitle, liveMessage, sendingLive]);

  const incoming = useMemo(
    () => notifications.filter((n) => n.type === 'local_friend' || n.type === 'bandit_question'),
    [notifications],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Pilot Desk', headerBackTitle: 'Back' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : !isOperator ? (
          <View style={styles.center}>
            <Text style={styles.title}>Operator access only</Text>
            <Text style={styles.subtitle}>Log in with your operator account to use Pilot Desk.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Live Alerts</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                placeholder="Alert title"
                value={liveTitle}
                onChangeText={setLiveTitle}
              />
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Alert message"
                value={liveMessage}
                onChangeText={setLiveMessage}
                multiline
              />
              <Pressable
                style={[styles.btn, (!liveTitle.trim() || !liveMessage.trim() || sendingLive) && styles.btnDisabled]}
                disabled={!liveTitle.trim() || !liveMessage.trim() || sendingLive}
                onPress={sendLive}
              >
                <Text style={styles.btnText}>{sendingLive ? 'Sending…' : 'Send live alert'}</Text>
              </Pressable>
              {!!feedback && <Text style={styles.feedback}>{feedback}</Text>}
            </View>

            <Text style={styles.title}>Incoming Questions</Text>
            <FlatList
              scrollEnabled={false}
              data={incoming}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.row}
                  onPress={() =>
                    router.push({
                      pathname: '/chat',
                      params: {
                        banditName: item.type === 'local_friend' ? 'Local Friend' : 'Ask',
                        notificationId: item.id,
                        notificationType: item.type,
                        referenceId: item.reference_id ?? '',
                        referenceType: item.reference_type ?? '',
                        notificationTitle: item.title ?? '',
                      },
                    })
                  }
                >
                  <Text style={styles.rowTitle}>{item.type === 'local_friend' ? 'Local Friend' : 'Ask Me'}</Text>
                  <Text style={styles.rowMsg} numberOfLines={2}>{item.message}</Text>
                  <Text style={styles.rowMeta}>{fmtTime(item.created_at)} · tap to reply</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No incoming messages.</Text>}
            />

            <Text style={styles.title}>bandiTEAM Reports</Text>
            <FlatList
              scrollEnabled={false}
              data={reports}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowMsg} numberOfLines={2}>{item.description}</Text>
                  <Text style={styles.rowMeta}>{item.city} · {item.location}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No reports yet.</Text>}
            />
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 10, marginTop: 4 },
  subtitle: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 18 },
  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 10,
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D9DEE5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    marginBottom: 8,
    fontSize: 14,
  },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  btn: {
    backgroundColor: '#111',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  feedback: { marginTop: 8, fontSize: 12, color: '#334155' },
  row: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    padding: 12,
  },
  rowTitle: { fontSize: 15, fontWeight: '800', color: '#111', marginBottom: 4 },
  rowMsg: { fontSize: 13, color: '#333', lineHeight: 18, marginBottom: 4 },
  rowMeta: { fontSize: 12, color: '#777' },
  empty: { fontSize: 13, color: '#777', marginBottom: 10 },
});

