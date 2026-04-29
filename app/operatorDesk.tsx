import { useFocusEffect } from '@react-navigation/native';
import { Redirect, Stack, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScrollView as GHScrollView, Swipeable } from 'react-native-gesture-handler';

import { parseAboutBanditFromAskMessage } from '@/lib/askMeMessageFormat';
import { useAppState } from '@/contexts/AppStateContext';
import { resolvePilotDeskAccess } from '@/lib/pilotDeskGate';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { renderSafeText } from '@/lib/renderSafeText';
import { requestNotificationsRefresh } from '@/lib/notificationEvents';
import { supabase } from '@/lib/supabase';
import { addDismissedNotificationId } from '@/lib/dismissedThreads';
import { deleteNotificationThread } from '@/lib/threadDelete';
import {
  pilotDeleteScamAlert,
  pilotSetScamAlertModeration,
  pilotVerifyScamAlert,
} from '@/services/pilotScamAlertModeration';
import { sendPilotLiveAlert } from '@/services/localFriend';

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
  ask_target_bandit_id?: string | null;
};

type ReportRow = {
  id: string;
  city: string;
  location: string;
  title: string;
  description: string;
  created_at: string;
  reported_by: string | null;
  image_url: string | null;
  category: string | null;
  severity: number | null;
  admin_verified?: boolean | null;
  moderation_status?: string | null;
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function deskNotificationKindLabel(type: string): string {
  switch (type) {
    case 'local_friend':
      return 'Local Friend';
    case 'bandit_question':
      return 'Ask Me';
    case 'live_alert':
      return 'Live alert';
    case 'bandit_reply':
      return 'Bandit reply';
    case 'signal_peer_delivery':
      return 'Signal';
    default:
      return type.replace(/_/g, ' ') || 'Notification';
  }
}

function normalizeReportRow(raw: Record<string, unknown>): ReportRow {
  return {
    id: renderSafeText(raw.id, ''),
    city: renderSafeText(raw.city, ''),
    location: renderSafeText(raw.location, ''),
    title: renderSafeText(raw.title, '(untitled)'),
    description: renderSafeText(raw.description, ''),
    created_at: renderSafeText(raw.created_at, ''),
    reported_by: raw.reported_by != null ? renderSafeText(raw.reported_by, '') : null,
    image_url: raw.image_url != null ? renderSafeText(raw.image_url, '') : null,
    category: raw.category != null ? renderSafeText(raw.category, '') : null,
    severity: typeof raw.severity === 'number' ? raw.severity : Number(raw.severity) || 2,
    admin_verified: raw.admin_verified === true,
    moderation_status: raw.moderation_status != null ? renderSafeText(raw.moderation_status, 'published') : 'published',
  };
}

export default function OperatorDeskScreen() {
  const router = useRouter();
  const { refreshNotifications } = useAppState();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOperator, setIsOperator] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveMessage, setLiveMessage] = useState('');
  const [sendingLive, setSendingLive] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deletingNotificationId, setDeletingNotificationId] = useState<string | null>(null);
  const [deskOperatorId, setDeskOperatorId] = useState<string | null>(null);
  const [reportBusyId, setReportBusyId] = useState<string | null>(null);
  const [deskSelectMode, setDeskSelectMode] = useState(false);
  const [deskSelected, setDeskSelected] = useState<Set<string>>(new Set());
  const [reportSelectMode, setReportSelectMode] = useState(false);
  const [reportSelected, setReportSelected] = useState<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    const { operatorId, canUsePilotDesk: ok } = await resolvePilotDeskAccess();
    setIsOperator(ok);
    setDeskOperatorId(ok ? operatorId : null);
    if (!ok) {
      setNotifications([]);
      setReports([]);
      return;
    }
    if (!operatorId) {
      setNotifications([]);
      return;
    }

    const operatorUserId = operatorId;
    const [{ data: notifRows }, { data: reportRows, error: reportErr }] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', operatorUserId)
        .or('reference_type.is.null,reference_type.neq.deleted_thread')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('scam_alerts').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setNotifications((notifRows as NotificationRow[]) || []);
    if (reportErr) {
      console.warn('[PilotDesk] scam_alerts load:', reportErr.message);
      setReports([]);
    } else {
      const list = (reportRows as Record<string, unknown>[]) || [];
      setReports(list.map((r) => normalizeReportRow(r)));
    }
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

  useFocusEffect(
    React.useCallback(() => {
      if (loading || !isOperator) return undefined;
      const id = setInterval(() => {
        void loadAll();
      }, 14_000);
      return () => clearInterval(id);
    }, [loading, isOperator, loadAll]),
  );

  React.useEffect(() => {
    if (!deskOperatorId || !isOperator) return;
    const uid = deskOperatorId;
    const ch = supabase
      .channel(`pilot-desk-nt-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => {
          void loadAll();
        },
      )
      .subscribe();
    const ch2 = supabase
      .channel('pilot-desk-sa')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scam_alerts' }, () => void loadAll())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
      void supabase.removeChannel(ch2);
    };
  }, [deskOperatorId, isOperator, loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  const deskRefreshControl = usePremiumRefreshControl(refreshing, onRefresh);

  const sendLive = useCallback(async () => {
    if (sendingLive) return;
    setSendingLive(true);
    setFeedback(null);
    try {
      const r = await sendPilotLiveAlert({ title: liveTitle, message: liveMessage });
      setFeedback(`Live alert sent to ${r.recipientCount} users.`);
      setLiveTitle('');
      setLiveMessage('');
      requestNotificationsRefresh();
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

  const otherDeskNotifications = useMemo(
    () => notifications.filter((n) => n.type !== 'local_friend' && n.type !== 'bandit_question'),
    [notifications],
  );

  const onDeleteDeskNotification = useCallback(
    (item: NotificationRow) => {
      if (deletingNotificationId) return;
      const runDelete = async () => {
        setDeletingNotificationId(item.id);
        try {
          await addDismissedNotificationId(item.id);
          await deleteNotificationThread(item.id);
          setNotifications((prev) => prev.filter((n) => n.id !== item.id));
          requestNotificationsRefresh();
          void refreshNotifications();
          await loadAll();
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Could not delete.';
          if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(msg);
          else Alert.alert('Delete failed', msg);
          await loadAll();
        } finally {
          setDeletingNotificationId(null);
        }
      };
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const ok = window.confirm('Remove item permanently from the database?');
        if (!ok) return;
        void runDelete();
        return;
      }
      Alert.alert('Remove item?', 'This permanently deletes this notification row.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void runDelete() },
      ]);
    },
    [deletingNotificationId, refreshNotifications, loadAll],
  );

  const runReportAction = useCallback(
    async (item: ReportRow, action: 'verify' | 'hide' | 'delete') => {
      if (reportBusyId === item.id) return;
      setReportBusyId(item.id);
      try {
        if (action === 'verify') {
          setReports((p) => p.map((r) => (r.id === item.id ? { ...r, admin_verified: true } : r)));
          await pilotVerifyScamAlert(item.id);
        } else if (action === 'hide') {
          setReports((p) => p.map((r) => (r.id === item.id ? { ...r, moderation_status: 'hidden' } : r)));
          await pilotSetScamAlertModeration(item.id, 'hidden');
        } else {
          setReports((p) => p.filter((r) => r.id !== item.id));
          await pilotDeleteScamAlert(item.id);
        }
        await loadAll();
        requestNotificationsRefresh();
      } catch (e) {
        await loadAll();
        const msg = e instanceof Error ? e.message : 'Action failed';
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(msg);
        else Alert.alert('Moderation', msg);
      } finally {
        setReportBusyId(null);
      }
    },
    [loadAll, reportBusyId],
  );

  const confirmDelete = (item: ReportRow) => {
    const go = () => void runReportAction(item, 'delete');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Permanently delete this report from the database?')) go();
      return;
    }
    Alert.alert('Delete report?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  };

  const deleteDeskSelected = useCallback(() => {
    if (deskSelected.size === 0) return;
    const selectedSnapshot = new Set(deskSelected);
    const n = selectedSnapshot.size;
    const run = async () => {
      let firstErr: string | null = null;
      for (const id of selectedSnapshot) {
        try {
          await addDismissedNotificationId(id);
          await deleteNotificationThread(id);
        } catch (e) {
          firstErr = e instanceof Error ? e.message : String(e);
          break;
        }
      }
      setDeskSelected(new Set());
      setDeskSelectMode(false);
      requestNotificationsRefresh();
      void refreshNotifications();
      await loadAll();
      if (firstErr) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(firstErr);
        else Alert.alert('Delete failed', firstErr);
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Permanently delete ${n} notification item(s)?`)) void run();
      return;
    }
    Alert.alert('Delete selected?', `Permanently delete ${n} notification item(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void run() },
    ]);
  }, [deskSelected, refreshNotifications, loadAll]);

  const clearAllDeskNotifications = useCallback(() => {
    if (notifications.length === 0) return;
    const snapshot = [...notifications];
    const run = async () => {
      let firstErr: string | null = null;
      for (const row of snapshot) {
        try {
          await addDismissedNotificationId(row.id);
          await deleteNotificationThread(row.id);
        } catch (e) {
          firstErr = e instanceof Error ? e.message : String(e);
          break;
        }
      }
      setDeskSelected(new Set());
      setDeskSelectMode(false);
      requestNotificationsRefresh();
      void refreshNotifications();
      await loadAll();
      if (firstErr) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(firstErr);
        else Alert.alert('Clear all failed', firstErr);
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Permanently clear all ${snapshot.length} Pilot Desk notification item(s)?`)) void run();
      return;
    }
    Alert.alert('Clear all?', `Permanently remove all ${snapshot.length} notification item(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: () => void run() },
    ]);
  }, [notifications, refreshNotifications, loadAll]);

  const clearAllReports = useCallback(() => {
    if (reports.length === 0) return;
    const run = async () => {
      let firstErr: string | null = null;
      for (const r of reports) {
        try {
          await pilotDeleteScamAlert(r.id);
        } catch (e) {
          firstErr = e instanceof Error ? e.message : String(e);
          break;
        }
      }
      setReportSelected(new Set());
      setReportSelectMode(false);
      await loadAll();
      requestNotificationsRefresh();
      if (firstErr) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(firstErr);
        else Alert.alert('Delete failed', firstErr);
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Permanently delete all ${reports.length} bandiTEAM report(s)?`)) void run();
      return;
    }
    Alert.alert('Delete all reports?', `This removes ${reports.length} report(s) permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete all', style: 'destructive', onPress: () => void run() },
    ]);
  }, [reports, loadAll]);

  const deleteSelectedReports = useCallback(() => {
    if (reportSelected.size === 0) return;
    const run = async () => {
      let firstErr: string | null = null;
      for (const id of reportSelected) {
        try {
          await pilotDeleteScamAlert(id);
        } catch (e) {
          firstErr = e instanceof Error ? e.message : String(e);
          break;
        }
      }
      setReportSelected(new Set());
      setReportSelectMode(false);
      await loadAll();
      requestNotificationsRefresh();
      if (firstErr) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(firstErr);
        else Alert.alert('Delete failed', firstErr);
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Permanently delete ${reportSelected.size} report(s)?`)) void run();
      return;
    }
    Alert.alert('Delete reports?', `Delete ${reportSelected.size} report(s)? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void run() },
    ]);
  }, [reportSelected, loadAll]);

  if (!loading && !isOperator) {
    return <Redirect href="/+not-found" />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Pilot Desk', headerBackTitle: 'Back' }} />
      <GHScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={deskRefreshControl}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <>
            <View style={styles.quickNavRow}>
              <Pressable style={styles.quickNavBtn} onPress={() => router.replace('/menu')}>
                <Text style={styles.quickNavBtnText}>Back to Menu</Text>
              </Pressable>
              <Pressable style={styles.quickNavBtn} onPress={() => router.replace('/bandits')}>
                <Text style={styles.quickNavBtnText}>Go Home</Text>
              </Pressable>
            </View>
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
            {notifications.length > 0 ? (
              <View style={styles.bulkRow}>
                <Pressable
                  testID="pilot-desk-incoming-select"
                  onPress={() => {
                    setDeskSelectMode((m) => !m);
                    setDeskSelected(new Set());
                  }}
                  style={styles.bulkPill}
                >
                  <Text style={styles.bulkPillText}>{deskSelectMode ? 'Done' : 'Select'}</Text>
                </Pressable>
                {deskSelectMode ? (
                  <>
                    <Pressable
                      testID="pilot-desk-incoming-select-all"
                      onPress={() => setDeskSelected(new Set(notifications.map((n) => n.id)))}
                      style={styles.bulkPill}
                    >
                      <Text style={styles.bulkPillText}>Select all</Text>
                    </Pressable>
                    <Pressable
                      testID="pilot-desk-incoming-delete-selected"
                      onPress={deleteDeskSelected}
                      style={[styles.bulkPill, styles.bulkPillDanger, deskSelected.size === 0 && { opacity: 0.5 }]}
                      disabled={deskSelected.size === 0}
                    >
                      <Text style={[styles.bulkPillText, { color: '#B71C1C' }]}>Delete selected</Text>
                    </Pressable>
                  </>
                ) : null}
                <Pressable testID="pilot-desk-incoming-clear-all" onPress={clearAllDeskNotifications} style={styles.bulkPill}>
                  <Text style={[styles.bulkPillText, { color: '#B71C1C' }]}>Clear all</Text>
                </Pressable>
              </View>
            ) : null}
            {incoming.length === 0 ? (
              <Text style={styles.empty}>No incoming messages.</Text>
            ) : (
              <View style={styles.stackGap8}>
                {incoming.map((item) => {
                  const selected = deskSelectMode && deskSelected.has(item.id);
                  const aboutBandit =
                    item.type === 'bandit_question' ? parseAboutBanditFromAskMessage(item.message || '') : null;
                  const banditNameParam =
                    item.type === 'bandit_question'
                      ? aboutBandit || 'Ask'
                      : item.type === 'local_friend'
                        ? 'Local Friend'
                        : 'Ask';
                  const rowTitle =
                    item.type === 'bandit_question'
                      ? `Operator inbox for ${aboutBandit || 'Neo'}`
                      : item.type === 'local_friend'
                        ? 'Operator inbox for Local Friend'
                        : 'Operator inbox';
                  const inner = (
                    <View style={[styles.row, selected && styles.rowSelected]}>
                      <Pressable
                        testID={`pilot-desk-open-thread-${item.id}`}
                        onPress={() => {
                          if (deskSelectMode) {
                            setDeskSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                            return;
                          }
                          router.push({
                            pathname: '/chat',
                            params: {
                              banditName: banditNameParam,
                              notificationId: item.id,
                              notificationType: item.type,
                              referenceId: item.reference_id ?? '',
                              referenceType: item.reference_type ?? '',
                              notificationTitle: item.title ?? '',
                              notificationMessage: item.message ?? '',
                            },
                          });
                        }}
                        onLongPress={() => {
                          setDeskSelectMode(true);
                          setDeskSelected((prev) => {
                            const next = new Set(prev);
                            next.add(item.id);
                            return next;
                          });
                        }}
                        delayLongPress={380}
                      >
                        <Text style={styles.rowTitle}>{rowTitle}</Text>
                        <Text style={styles.rowMeta}>
                          From: {renderSafeText(item.title, '—')}
                          {item.type === 'bandit_question' && aboutBandit
                            ? ` · Re: ${renderSafeText(aboutBandit)}`
                            : item.type === 'local_friend'
                              ? ' · direct to Pilot'
                              : ''}
                        </Text>
                        <Text style={styles.rowMsg} numberOfLines={3}>
                          {renderSafeText(item.message)}
                        </Text>
                        <Text style={styles.rowSendAs}>
                          Replies in Chat use the bandit persona for this thread (set when you open it).
                        </Text>
                        <Text style={styles.rowMeta}>
                          {fmtTime(item.created_at)} · {deskSelectMode ? 'tap to select' : 'tap to open thread'}
                        </Text>
                      </Pressable>
                      {!deskSelectMode ? (
                        <Pressable
                          style={[styles.deleteChip, deletingNotificationId === item.id && styles.deleteChipDisabled]}
                          onPress={() => onDeleteDeskNotification(item)}
                          disabled={deletingNotificationId === item.id}
                        >
                          <Text style={styles.deleteChipText}>
                            {deletingNotificationId === item.id ? 'Deleting…' : 'Delete'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                  const rowEl =
                    Platform.OS === 'web' ? (
                      inner
                    ) : (
                      <Swipeable
                        overshootRight={false}
                        renderRightActions={() => (
                          <Pressable
                            style={styles.incomingSwipeDelete}
                            onPress={() => onDeleteDeskNotification(item)}
                            accessibilityLabel="Delete incoming question"
                          >
                            <Text style={styles.incomingSwipeDeleteText}>Delete</Text>
                          </Pressable>
                        )}
                      >
                        {inner}
                      </Swipeable>
                    );
                  return (
                    <View key={item.id} collapsable={false}>
                      {rowEl}
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={styles.title}>Other notifications</Text>
            {otherDeskNotifications.length === 0 ? (
              <Text style={styles.empty}>No other notification rows.</Text>
            ) : (
              <View style={styles.stackGap8}>
                {otherDeskNotifications.map((item) => {
                  const selected = deskSelectMode && deskSelected.has(item.id);
                  const inner = (
                    <View style={[styles.row, selected && styles.rowSelected]}>
                      <Pressable
                        testID={`pilot-desk-open-other-${item.id}`}
                        onPress={() => {
                          if (deskSelectMode) {
                            setDeskSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                            return;
                          }
                          router.push({
                            pathname: '/chat',
                            params: {
                              banditName: deskNotificationKindLabel(item.type),
                              notificationId: item.id,
                              notificationType: item.type,
                              referenceId: item.reference_id ?? '',
                              referenceType: item.reference_type ?? '',
                              notificationTitle: item.title ?? '',
                              notificationMessage: item.message ?? '',
                            },
                          });
                        }}
                        onLongPress={() => {
                          setDeskSelectMode(true);
                          setDeskSelected((prev) => {
                            const next = new Set(prev);
                            next.add(item.id);
                            return next;
                          });
                        }}
                        delayLongPress={380}
                      >
                        <Text style={styles.rowTitle}>{deskNotificationKindLabel(item.type)}</Text>
                        <Text style={styles.rowMeta}>{renderSafeText(item.title)}</Text>
                        <Text style={styles.rowMsg} numberOfLines={4}>
                          {renderSafeText(item.message)}
                        </Text>
                        <Text style={styles.rowMeta}>
                          {fmtTime(item.created_at)} · {deskSelectMode ? 'tap to select' : 'tap to open'}
                        </Text>
                      </Pressable>
                      {!deskSelectMode ? (
                        <Pressable
                          style={[styles.deleteChip, deletingNotificationId === item.id && styles.deleteChipDisabled]}
                          onPress={() => onDeleteDeskNotification(item)}
                          disabled={deletingNotificationId === item.id}
                        >
                          <Text style={styles.deleteChipText}>
                            {deletingNotificationId === item.id ? 'Deleting…' : 'Delete'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                  const rowEl =
                    Platform.OS === 'web' ? (
                      inner
                    ) : (
                      <Swipeable
                        overshootRight={false}
                        renderRightActions={() => (
                          <Pressable
                            style={styles.incomingSwipeDelete}
                            onPress={() => onDeleteDeskNotification(item)}
                            accessibilityLabel="Delete notification"
                          >
                            <Text style={styles.incomingSwipeDeleteText}>Delete</Text>
                          </Pressable>
                        )}
                      >
                        {inner}
                      </Swipeable>
                    );
                  return (
                    <View key={item.id} collapsable={false}>
                      {rowEl}
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={styles.title}>bandiTEAM reports</Text>
            <Text style={styles.sectionHint}>
              Tap a row to open traveler-facing details. Use actions to verify, hide, or remove reports.
            </Text>
            {reports.length > 0 ? (
              <View style={styles.bulkRow}>
                <Pressable
                  onPress={() => {
                    setReportSelectMode((m) => !m);
                    setReportSelected(new Set());
                  }}
                  style={styles.bulkPill}
                >
                  <Text style={styles.bulkPillText}>{reportSelectMode ? 'Cancel' : 'Select'}</Text>
                </Pressable>
                {reportSelectMode ? (
                  <>
                    <Pressable
                      onPress={() => setReportSelected(new Set(reports.map((r) => r.id)))}
                      style={styles.bulkPill}
                    >
                      <Text style={styles.bulkPillText}>Select all</Text>
                    </Pressable>
                    <Pressable
                      onPress={deleteSelectedReports}
                      style={[styles.bulkPill, styles.bulkPillDanger, reportSelected.size === 0 && { opacity: 0.5 }]}
                      disabled={reportSelected.size === 0}
                    >
                      <Text style={[styles.bulkPillText, { color: '#B71C1C' }]}>Delete</Text>
                    </Pressable>
                  </>
                ) : null}
                <Pressable onPress={clearAllReports} style={styles.bulkPill}>
                  <Text style={[styles.bulkPillText, { color: '#B71C1C' }]}>Clear all reports</Text>
                </Pressable>
              </View>
            ) : null}
            {reports.length === 0 ? (
              <Text style={styles.empty}>No reports yet.</Text>
            ) : (
              <View style={styles.stackGap10}>
                {reports.map((item) => {
                  const busy = reportBusyId === item.id;
                  const status = renderSafeText(item.moderation_status, 'published');
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.reportCard,
                        reportSelectMode && reportSelected.has(item.id) && styles.rowSelected,
                      ]}
                      testID={`pilot-desk-report-${item.id}`}
                    >
                      <Pressable
                        onPress={() => {
                          if (reportSelectMode) {
                            setReportSelected((prev) => {
                              const n = new Set(prev);
                              if (n.has(item.id)) n.delete(item.id);
                              else n.add(item.id);
                              return n;
                            });
                            return;
                          }
                          router.push(`/scam-alert/${item.id}` as never);
                        }}
                        style={({ pressed }) => [styles.reportMain, pressed && { opacity: 0.92 }]}
                      >
                        <Text style={styles.rowTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={styles.rowMsg} numberOfLines={3}>
                          {item.description}
                        </Text>
                        <Text style={styles.rowMeta}>
                          {item.city} · {item.location}
                        </Text>
                        <Text style={styles.rowMeta}>
                          Posted {fmtDateTime(item.created_at)} · Reporter {item.reported_by ?? '—'}
                        </Text>
                        <Text style={styles.statusLine}>
                          Status: {status}
                          {item.admin_verified ? ' · Verified' : ''}
                        </Text>
                        {item.image_url ? (
                          <Image source={{ uri: item.image_url }} style={styles.thumb} resizeMode="cover" />
                        ) : null}
                      </Pressable>
                      <View style={styles.actionRow} testID={`pilot-desk-actions-${item.id}`}>
                        <Pressable
                          style={[styles.actionChip, busy && styles.actionChipDisabled]}
                          disabled={busy}
                          onPress={() => router.push(`/scam-alert/${item.id}` as never)}
                        >
                          <Text style={styles.actionChipText}>Open</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.actionChip, busy && styles.actionChipDisabled]}
                          disabled={busy}
                          onPress={() => void runReportAction(item, 'verify')}
                        >
                          <Text style={styles.actionChipText}>Verify</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.actionChip, busy && styles.actionChipDisabled]}
                          disabled={busy}
                          onPress={() => void runReportAction(item, 'hide')}
                        >
                          <Text style={styles.actionChipText}>Hide</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.actionChipDanger, busy && styles.actionChipDisabled]}
                          disabled={busy}
                          onPress={() => confirmDelete(item)}
                        >
                          <Text style={styles.actionChipDangerText}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </GHScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 10, marginTop: 4 },
  subtitle: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 18 },
  quickNavRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  quickNavBtn: {
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  quickNavBtnText: {
    color: '#0a7ea4',
    fontSize: 12,
    fontWeight: '800',
  },
  /** Single ScrollView scroll surface — avoid nesting VirtualizedList inside ScrollView (mobile freeze). */
  stackGap8: { gap: 8 },
  stackGap10: { gap: 10 },
  sectionHint: { fontSize: 12, color: '#666', lineHeight: 17, marginBottom: 12 },
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
  rowSelected: { borderColor: '#0a7ea4', borderWidth: 2 },
  bulkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10, alignItems: 'center' },
  bulkPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ECEFF1',
  },
  bulkPillDanger: { backgroundColor: '#FFEBEE' },
  bulkPillText: { fontSize: 13, fontWeight: '800', color: '#0a7ea4' },
  reportCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  reportMain: { padding: 12 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: '#111', marginBottom: 4 },
  rowMsg: { fontSize: 13, color: '#333', lineHeight: 18, marginBottom: 4 },
  rowMeta: { fontSize: 12, color: '#666', marginBottom: 2 },
  rowSendAs: { fontSize: 13, fontWeight: '700', color: '#111', marginBottom: 4 },
  statusLine: { fontSize: 11, fontWeight: '700', color: '#444', marginTop: 4 },
  thumb: { width: '100%', height: 120, marginTop: 8, borderRadius: 8, backgroundColor: '#EEE' },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
    paddingTop: 10,
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#111',
  },
  actionChipDanger: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#C62828',
  },
  actionChipDisabled: { opacity: 0.5 },
  actionChipText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  actionChipDangerText: { color: '#C62828', fontSize: 12, fontWeight: '800' },
  deleteChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D32F2F',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#FFF',
  },
  deleteChipDisabled: { opacity: 0.6 },
  deleteChipText: { color: '#D32F2F', fontSize: 12, fontWeight: '700' },
  incomingSwipeDelete: {
    backgroundColor: '#C62828',
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    marginVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  incomingSwipeDeleteText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  empty: { fontSize: 13, color: '#777', marginBottom: 10 },
});
