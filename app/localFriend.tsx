import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  View,
} from 'react-native';

import { isDemoMode, scheduleDemoLocalFriendReply } from '@/lib/demoMode';
import { getNotificationsBackendStatus, sendLocalFriendMessage } from '@/services/localFriend';

export default function LocalFriendScreen() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backendReady, setBackendReady] = useState(false);
  const [backendReason, setBackendReason] = useState<string | null>(null);
  const [statusStep, setStatusStep] = useState<'idle' | 'released' | 'matching' | 'waiting'>('idle');
  const [refreshing, setRefreshing] = useState(false);

  const refreshBackendStatus = React.useCallback(async () => {
    try {
      const status = await getNotificationsBackendStatus();
      setBackendReady(status.enabled);
      setBackendReason(status.enabled ? null : status.reason || 'Messaging is unavailable right now.');
    } catch {
      setBackendReady(false);
      setBackendReason('Messaging is unavailable right now.');
    }
  }, []);

  useEffect(() => {
    void refreshBackendStatus();
  }, [refreshBackendStatus]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshBackendStatus();
    } finally {
      setRefreshing(false);
    }
  }, [refreshBackendStatus]);

  const handleSend = async () => {
    if (!message.trim() || !backendReady) return;

    const payload = message.trim();
    setSending(true);
    setSuccess(null);
    setError(null);

    try {
      setStatusStep('released');
      await sendLocalFriendMessage(payload);
      setMessage('');
      setStatusStep('waiting');
      setSuccess(
        isDemoMode()
          ? 'Bottle released. In pilot demo mode, a sample reply will appear in Inbox shortly (30–90s).'
          : 'Bottle released. A like-minded local friend may answer soon.',
      );
      if (isDemoMode()) {
        scheduleDemoLocalFriendReply();
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null && 'message' in e
            ? String((e as { message: unknown }).message ?? '')
            : '';
      if (msg.trim()) setError(msg.trim());
      setStatusStep('idle');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!sending) return;
    setStatusStep('matching');
  }, [sending]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Local Friend', headerBackTitle: 'Back' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        >
          <View style={styles.logoBar}>
            <Image
              source={require('@/assets/icons/banditLocalpng.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.copyBlock}>
            <Text style={styles.title}>Send something into the city</Text>
            <Text style={styles.subtitle}>
              This isn’t regular chat. It’s a note in a bottle.
              {'\n'}
              Random on the surface. Matched by vibe underneath.
            </Text>
          </View>

          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>What do you want to throw out there?</Text>
            <TextInput
              style={styles.input}
              multiline
              placeholder="Ask for a vibe, a corner, a kind of night..."
              value={message}
              onChangeText={setMessage}
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (sending || !message.trim() || !backendReady) && styles.sendButtonDisabled,
              ]}
              disabled={sending || !message.trim() || !backendReady}
              onPress={handleSend}
            >
              {sending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.sendText}>Release</Text>
              )}
            </TouchableOpacity>

            <View style={styles.statusRow}>
              <StatusPill label="Bottle released" active={statusStep === 'released'} />
              <StatusPill label="Matching vibe" active={statusStep === 'matching'} />
              <StatusPill label="Waiting reply" active={statusStep === 'waiting'} />
            </View>

            {!!error && <Text style={styles.errorText}>{error}</Text>}
            {!!success && <Text style={styles.successText}>{success}</Text>}
            {!!success && (
              <Text style={styles.waitingText}>
                During pilot, replies are curated by the bandiTour team and appear in Notifications.
              </Text>
            )}
            {!backendReady && !!backendReason && <Text style={styles.errorText}>{backendReason}</Text>}
          </View>

          <View style={styles.howItWorks}>
            <Text style={styles.howTitle}>How Local Friend works</Text>
            <Text style={styles.howBullet}>- you drop one message into the city</Text>
            <Text style={styles.howBullet}>- we route it to a like-minded local vibe</Text>
            <Text style={styles.howBullet}>- you get the reply in Notifications</Text>
          </View>

          <TouchableOpacity
            style={styles.exitButton}
            onPress={() => {
              router.replace('/bandits');
            }}
          >
            <Text style={styles.exitButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.statusPill, active && styles.statusPillActive]}>
      <Text style={[styles.statusPillText, active && styles.statusPillTextActive]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  logoBar: {
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  logo: {
    width: 96,
    height: 28,
  },
  copyBlock: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  inputCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E4E4',
    padding: 12,
  },
  inputLabel: {
    fontSize: 13,
    color: '#333',
    marginBottom: 6,
  },
  input: {
    minHeight: 90,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#000',
    marginBottom: 8,
    textAlignVertical: 'top',
  },
  sendButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#000',
  },
  sendButtonDisabled: {
    backgroundColor: '#999',
  },
  sendText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  statusPill: {
    borderWidth: 1,
    borderColor: '#D8D8D8',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: '#F8F8F8',
  },
  statusPillActive: {
    borderColor: '#0A7D32',
    backgroundColor: '#ECF8F0',
  },
  statusPillText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  statusPillTextActive: {
    color: '#0A7D32',
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#D92C2C',
  },
  successText: {
    marginTop: 8,
    fontSize: 12,
    color: '#0A7D32',
    fontWeight: '600',
  },
  waitingText: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
    lineHeight: 17,
  },
  howItWorks: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FAFAFA',
  },
  howTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  howBullet: {
    fontSize: 12,
    color: '#444',
    lineHeight: 18,
  },
  exitButton: {
    marginTop: 24,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  exitButtonText: {
    fontSize: 13,
    color: '#555',
    textDecorationLine: 'underline',
  },
});

