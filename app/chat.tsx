import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { getOperatorUserId } from '@/services/localFriend';
import { trackEvent } from '@/lib/analytics';

type Role = 'user' | 'bandit';

type ChatMessage = {
  id: string;
  role: Role;
  body: string;
  sentAt: string;
};

const INITIAL_THREAD: ChatMessage[] = [
  {
    id: 'm1',
    role: 'bandit',
    body: 'Hey — I saw your note in the city. Want a quieter corner than the main strip tonight?',
    sentAt: '10:02',
  },
  {
    id: 'm2',
    role: 'user',
    body: 'Yes — somewhere with live music but not a club line.',
    sentAt: '10:04',
  },
  {
    id: 'm3',
    role: 'bandit',
    body: 'Got it. Start at the small square two blocks east of the market — there’s a basement bar that opens late.',
    sentAt: '10:05',
  },
  {
    id: 'm4',
    role: 'bandit',
    body: 'If you’re still around after midnight, message me and I’ll send the second stop.',
    sentAt: '10:06',
  },
];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const {
    banditName: rawName,
    notificationId: rawNotificationId,
    notificationType: rawNotificationType,
    referenceId: rawReferenceId,
    demoMode: rawDemoMode,
    demoBody: rawDemoBody,
    demoTitle: rawDemoTitle,
  } = useLocalSearchParams<{
    banditName?: string;
    notificationId?: string;
    notificationType?: string;
    referenceId?: string;
    demoMode?: string;
    demoBody?: string;
    demoTitle?: string;
  }>();
  const banditName = useMemo(() => {
    const v = Array.isArray(rawName) ? rawName[0] : rawName;
    return (v && v.trim()) || 'Local banDit';
  }, [rawName]);
  const notificationId = Array.isArray(rawNotificationId) ? rawNotificationId[0] : rawNotificationId;
  const notificationType = Array.isArray(rawNotificationType) ? rawNotificationType[0] : rawNotificationType;
  const referenceId = Array.isArray(rawReferenceId) ? rawReferenceId[0] : rawReferenceId;
  const demoMode = Array.isArray(rawDemoMode) ? rawDemoMode[0] : rawDemoMode;
  const demoBody = Array.isArray(rawDemoBody) ? rawDemoBody[0] : rawDemoBody;
  const demoTitle = Array.isArray(rawDemoTitle) ? rawDemoTitle[0] : rawDemoTitle;

  const isDemoPreview =
    demoMode === '1' && typeof demoBody === 'string' && demoBody.trim().length > 0;

  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_THREAD);
  const [draft, setDraft] = useState('');
  const [loadingThread, setLoadingThread] = useState(true);
  const [operatorMode, setOperatorMode] = useState(false);
  const [requesterUserId, setRequesterUserId] = useState<string | null>(null);
  const [banditOptions, setBanditOptions] = useState<string[]>(['Neo', 'Elia']);
  const [replyAsBandit, setReplyAsBandit] = useState<string>('Neo');
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    void trackEvent({
      eventName: 'chat_opened',
      referenceType: 'chat',
      referenceId: notificationId || banditName,
      onceKey: `chat_opened:${notificationId || banditName}`,
    });
  }, [notificationId, banditName]);

  const loadThread = useCallback(
    async (silent?: boolean) => {
      try {
        if (!silent) setLoadingThread(true);
        const operatorUserId = getOperatorUserId();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const isOperator = !!operatorUserId && user?.id === operatorUserId;
        setOperatorMode(isOperator);

        const { data: bandits } = await supabase.from('bandit').select('name').limit(12);
        const names = (bandits || [])
          .map((b: any) => String(b.name || '').trim())
          .filter(Boolean);
        if (names.length > 0) {
          setBanditOptions(names);
          setReplyAsBandit(names[0]);
        }

        if (!isOperator || !notificationId || !referenceId) {
          return;
        }

        setRequesterUserId(referenceId);
        const { data: requestNotif } = await supabase
          .from('notifications')
          .select('*')
          .eq('id', notificationId)
          .maybeSingle();
        const { data: replies } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', referenceId)
          .eq('reference_id', notificationId)
          .eq('reference_type', 'operator_reply')
          .order('created_at', { ascending: true });

        const thread: ChatMessage[] = [];
        if (requestNotif) {
          const label = notificationType === 'local_friend' ? 'Local Friend request' : 'Ask me request';
          thread.push({
            id: `req-${notificationId}`,
            role: 'user',
            body: `${label}\n\n${String((requestNotif as any).message || '')}`,
            sentAt: 'Now',
          });
        }
        (replies || []).forEach((row: any, idx: number) => {
          thread.push({
            id: `r-${row.id || idx}`,
            role: 'bandit',
            body: String(row.message || ''),
            sentAt: 'Sent',
          });
        });
        setMessages(thread.length > 0 ? thread : []);
      } finally {
        if (!silent) setLoadingThread(false);
      }
    },
    [notificationId, notificationType, referenceId],
  );

  useEffect(() => {
    if (isDemoPreview) {
      const title = (demoTitle && String(demoTitle).trim()) || 'Demo';
      const body = String(demoBody).trim();
      setMessages([
        {
          id: 'demo-preview',
          role: 'bandit',
          body: `${title}\n\n${body}`,
          sentAt: 'Pilot demo',
        },
      ]);
      setLoadingThread(false);
      setOperatorMode(false);
      return;
    }
    void loadThread(false);
  }, [isDemoPreview, demoBody, demoTitle, loadThread]);

  const onRefreshThread = useCallback(async () => {
    if (isDemoPreview) {
      setRefreshing(true);
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    try {
      await loadThread(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadThread, isDemoPreview]);

  const send = useCallback(() => {
    if (isDemoPreview) return;
    const t = draft.trim();
    if (!t) return;
    void (async () => {
      if (operatorMode && requesterUserId && notificationId) {
        const replyReferenceType =
          notificationType === 'local_friend' ? 'operator_reply_local_friend' : 'operator_reply_bandit_question';
        const { error } = await supabase.from('notifications').insert({
          user_id: requesterUserId,
          type: 'bandit_reply',
          title: `Reply from ${replyAsBandit}`,
          message: t,
          reference_id: notificationId,
          reference_type: replyReferenceType,
        });
        if (error) return;
        const now = new Date();
        const sentAt = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        const next: ChatMessage = {
          id: `b-${now.getTime()}`,
          role: 'bandit',
          body: t,
          sentAt,
        };
        setMessages((prev) => [...prev, next]);
        setDraft('');
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        return;
      }
      const now = new Date();
      const sentAt = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      const next: ChatMessage = {
        id: `u-${now.getTime()}`,
        role: 'user',
        body: t,
        sentAt,
      };
      setMessages((prev) => [...prev, next]);
      setDraft('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    })();
  }, [draft, operatorMode, requesterUserId, notificationId, replyAsBandit, notificationType, isDemoPreview]);

  const renderItem = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.row, isUser ? styles.rowUser : styles.rowBandit]}>
        {!isUser && <Text style={styles.senderLabel}>{banditName}</Text>}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBandit]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextBandit]}>
            {item.body}
          </Text>
          <Text style={[styles.time, isUser && styles.timeUser]}>{item.sentAt}</Text>
        </View>
      </View>
    );
  }, [banditName]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: banditName }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {loadingThread ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.thread}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void onRefreshThread()} />
            }
            ListHeaderComponent={
              <Text style={styles.threadHint}>
                {operatorMode
                  ? 'Operator reply mode: your replies are sent to the guest Inbox.'
                  : `Thread with ${banditName}.`}
              </Text>
            }
          />
        )}
        {operatorMode && (
          <View style={styles.operatorBar}>
            <Text style={styles.operatorLabel}>Reply as:</Text>
            <View style={styles.operatorBandits}>
              {banditOptions.slice(0, 4).map((name) => {
                const active = replyAsBandit === name;
                return (
                  <Pressable
                    key={name}
                    onPress={() => setReplyAsBandit(name)}
                    style={[styles.operatorChip, active && styles.operatorChipActive]}
                  >
                    <Text style={[styles.operatorChipText, active && styles.operatorChipTextActive]}>{name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        <View style={[styles.composer, { paddingBottom: 10 + insets.bottom }]}>
          <TextInput
            style={styles.input}
            placeholder={isDemoPreview ? 'Demo preview — sending disabled' : 'Write a message…'}
            placeholderTextColor="#888"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={2000}
            editable={!isDemoPreview}
          />
          <Pressable
            style={[styles.sendBtn, (!draft.trim() || isDemoPreview) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!draft.trim() || isDemoPreview}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F0F2F5' },
  thread: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  threadHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 14,
    lineHeight: 17,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    marginBottom: 10,
    maxWidth: '100%',
  },
  rowUser: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  rowBandit: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    marginBottom: 4,
    marginLeft: 2,
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: '#111',
    borderBottomRightRadius: 4,
  },
  bubbleBandit: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E2E2',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextUser: { color: '#FFFFFF' },
  bubbleTextBandit: { color: '#222' },
  time: {
    marginTop: 6,
    fontSize: 10,
    color: '#888',
    alignSelf: 'flex-end',
  },
  timeUser: { color: '#CCC' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDD',
    backgroundColor: '#FFF',
    gap: 8,
  },
  operatorBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
    backgroundColor: '#FFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E4',
  },
  operatorLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    fontWeight: '700',
  },
  operatorBandits: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  operatorChip: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  operatorChipActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  operatorChipText: {
    fontSize: 12,
    color: '#222',
    fontWeight: '700',
  },
  operatorChipTextActive: {
    color: '#FFF',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  sendBtn: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 2,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
