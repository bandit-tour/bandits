import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottleSubmitVideo } from '@/components/BottleSubmitVideo';
import { isDemoMode, scheduleDemoLocalFriendReply } from '@/lib/demoMode';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { useKeyboardBottomInset } from '@/lib/useKeyboardBottomInset';
import { LOCAL_FRIEND_SUCCESS_MESSAGE, userFacingMessagingError } from '@/lib/userFacingMessagingError';
import { getNotificationsBackendStatus, sendLocalFriendMessage } from '@/services/localFriend';

export default function LocalFriendScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardBottomInset();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Probe only — never disables Send (same rule as Ask Me). */
  const [optionalReplyHint, setOptionalReplyHint] = useState<string | null>(null);
  const [statusStep, setStatusStep] = useState<'idle' | 'released' | 'matching' | 'waiting'>('idle');
  const [refreshing, setRefreshing] = useState(false);
  const [bottleOpen, setBottleOpen] = useState(false);
  const sendPromiseRef = useRef<Promise<void> | null>(null);

  const refreshBackendStatus = React.useCallback(async () => {
    try {
      const status = await getNotificationsBackendStatus();
      setOptionalReplyHint(
        status.enabled ? null : 'Enable notifications to get pings when travelers reply.',
      );
    } catch {
      setOptionalReplyHint(null);
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

  const listRefreshControl = usePremiumRefreshControl(refreshing, onRefresh);

  const onBottleVideoFinished = useCallback(async () => {
    setBottleOpen(false);
    setSending(true);
    setStatusStep('matching');
    setError(null);
    try {
      const p = sendPromiseRef.current;
      sendPromiseRef.current = null;
      if (p) await p;
      setMessage('');
      setStatusStep('waiting');
      setSuccess(LOCAL_FRIEND_SUCCESS_MESSAGE);
      if (isDemoMode()) {
        scheduleDemoLocalFriendReply();
      }
    } catch (e: unknown) {
      setError(userFacingMessagingError(e).message);
      setStatusStep('idle');
    } finally {
      setSending(false);
    }
  }, []);

  const handleSend = () => {
    if (!message.trim() || sending || bottleOpen) return;
    const payload = message.trim();
    setError(null);
    setSuccess(null);
    setStatusStep('released');
    setBottleOpen(true);
    sendPromiseRef.current = sendLocalFriendMessage(payload);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Local Friend', headerBackTitle: 'Back' }} />
      <BottleSubmitVideo visible={bottleOpen} onFinished={onBottleVideoFinished} />
      <View style={styles.screenRoot}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            isDesktopWeb && styles.scrollContentDesktop,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          refreshControl={listRefreshControl}
        >
          <View style={[styles.mainGrid, isDesktopWeb && styles.mainGridDesktop]}>
            <View style={styles.copyCol}>
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
            </View>

            {isDesktopWeb && (
              <View style={[styles.inputCard, styles.inputCardDesktop]}>
                <Text style={styles.inputLabel}>What do you want to throw out there?</Text>
                <TextInput
                  style={styles.input}
                  multiline
                  placeholder="Ask for a vibe, a corner, a kind of night..."
                  value={message}
                  onChangeText={setMessage}
                />

                <View style={styles.statusRow}>
                  <StatusPill label="Bottle out" active={statusStep === 'released'} />
                  <StatusPill label="Reaching people" active={statusStep === 'matching'} />
                  <StatusPill label="Waiting" active={statusStep === 'waiting'} />
                </View>

                {!!error && <Text style={styles.errorText}>{error}</Text>}
                {!!success && <Text style={styles.successText}>{success}</Text>}
                {!!optionalReplyHint && <Text style={styles.hintText}>{optionalReplyHint}</Text>}
              </View>
            )}
          </View>

          {!isDesktopWeb && (
            <>
              <View style={styles.statusRow}>
                <StatusPill label="Bottle out" active={statusStep === 'released'} />
                <StatusPill label="Reaching people" active={statusStep === 'matching'} />
                <StatusPill label="Waiting" active={statusStep === 'waiting'} />
              </View>

              {!!error && <Text style={styles.errorText}>{error}</Text>}
              {!!success && <Text style={styles.successText}>{success}</Text>}
              {!!optionalReplyHint && <Text style={styles.hintText}>{optionalReplyHint}</Text>}
            </>
          )}

          <TouchableOpacity
            style={styles.exitButton}
            onPress={() => {
              router.replace('/bandits');
            }}
          >
            <Text style={styles.exitButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Compose bar: input + Send stay together above the keyboard on native. */}
        <View
          style={[
            styles.composeBar,
            {
              paddingBottom: Math.max(insets.bottom, 10) + keyboardInset,
            },
          ]}
        >
          {!isDesktopWeb && (
            <>
              <Text style={styles.inputLabel}>What do you want to throw out there?</Text>
              <TextInput
                style={styles.input}
                multiline
                placeholder="Ask for a vibe, a corner, a kind of night..."
                value={message}
                onChangeText={setMessage}
              />
            </>
          )}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (sending || !message.trim() || bottleOpen) && styles.sendButtonDisabled,
            ]}
            disabled={sending || !message.trim() || bottleOpen}
            onPress={handleSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {sending && !bottleOpen ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
  screenRoot: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
  },
  scrollContentDesktop: {
    paddingTop: 24,
  },
  mainGrid: {
    width: '100%',
  },
  mainGridDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  copyCol: {
    flex: 1,
    minWidth: 0,
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
  inputCardDesktop: {
    flex: 1.1,
    minWidth: 0,
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
  composeBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E4',
  },
  sendButton: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#999',
  },
  sendText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
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
  hintText: {
    marginTop: 8,
    fontSize: 12,
    color: '#555',
    lineHeight: 17,
  },
  successText: {
    marginTop: 8,
    fontSize: 12,
    color: '#0A7D32',
    fontWeight: '600',
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
