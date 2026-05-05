import { Stack, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isDemoMode, scheduleDemoLocalFriendReply } from '@/lib/demoMode';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { getNotificationsBackendStatus, sendLocalFriendMessage } from '@/services/localFriend';

/** Full-screen send overlay — must match hero asset (no play-intro). */
const BOTTLE_SEND_SOURCE = require('@/assets/images/local-friend-bottle.mov');

type BottleLaunchVideoProps = {
  visible: boolean;
  onFinished: () => void;
};

function LocalFriendBottleVideo({ visible, onFinished }: BottleLaunchVideoProps) {
  const insets = useSafeAreaInsets();
  const doneRef = useRef(false);
  const player = useVideoPlayer(BOTTLE_SEND_SOURCE);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onFinished();
  }, [onFinished]);

  useEffect(() => {
    if (!visible) {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      return;
    }
    doneRef.current = false;
    try {
      player.muted = true;
      player.loop = false;
      if ('currentTime' in player && typeof (player as { currentTime?: number }).currentTime === 'number') {
        (player as { currentTime: number }).currentTime = 0;
      }
      player.play();
    } catch {
      finish();
    }
  }, [visible, player, finish]);

  useEffect(() => {
    if (!visible) return;
    const sub = player.addListener('playToEnd', finish);
    const t = setTimeout(finish, 9_000);
    return () => {
      sub.remove();
      clearTimeout(t);
    };
  }, [visible, player, finish]);

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={finish}>
      <View style={launchStyles.backdrop} accessibilityViewIsModal>
        <VideoView
          player={player}
          style={launchStyles.video}
          nativeControls={false}
          contentFit="contain"
          allowsFullscreen={false}
        />
        <Pressable
          onPress={finish}
          style={[launchStyles.skip, { top: insets.top + 8 }]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Skip video"
        >
          <Text style={launchStyles.skipText}>Skip</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const launchStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '88%',
    backgroundColor: 'transparent',
  },
  skip: {
    position: 'absolute',
    right: 18,
    zIndex: 2,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  skipText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default function LocalFriendScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backendReady, setBackendReady] = useState(false);
  const [statusStep, setStatusStep] = useState<'idle' | 'released' | 'matching' | 'waiting'>('idle');
  const [refreshing, setRefreshing] = useState(false);
  const [bottleOpen, setBottleOpen] = useState(false);
  const sendPromiseRef = useRef<Promise<void> | null>(null);

  const refreshBackendStatus = React.useCallback(async () => {
    try {
      const status = await getNotificationsBackendStatus();
      setBackendReady(status.enabled);
    } catch {
      setBackendReady(false);
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
      setSuccess('Sent to nearby travelers.');
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
  }, []);

  const handleSend = () => {
    if (!message.trim() || !backendReady || sending || bottleOpen) return;
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
      <LocalFriendBottleVideo visible={bottleOpen} onFinished={onBottleVideoFinished} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isDesktopWeb && styles.scrollContentDesktop,
          ]}
          keyboardShouldPersistTaps="handled"
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

            <View style={[styles.inputCard, isDesktopWeb && styles.inputCardDesktop]}>
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
                  (sending || !message.trim() || !backendReady || bottleOpen) && styles.sendButtonDisabled,
                ]}
                disabled={sending || !message.trim() || !backendReady || bottleOpen}
                onPress={handleSend}
              >
                {sending && !bottleOpen ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.sendText}>Send</Text>
                )}
              </TouchableOpacity>

              <View style={styles.statusRow}>
                <StatusPill label="Bottle out" active={statusStep === 'released'} />
                <StatusPill label="Reaching people" active={statusStep === 'matching'} />
                <StatusPill label="Waiting" active={statusStep === 'waiting'} />
              </View>

              {!!error && <Text style={styles.errorText}>{error}</Text>}
              {!!success && <Text style={styles.successText}>{success}</Text>}
              {!backendReady && <Text style={styles.errorText}>Can’t send right now.</Text>}
            </View>
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
    minWidth: 280,
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
    minWidth: 420,
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
