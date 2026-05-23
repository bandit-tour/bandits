import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocalFriendBottleHero } from '@/components/LocalFriendBottleHero';
import { claimLocalFriendOceanFloat } from '@/lib/localFriendOcean';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { requestNotificationsRefresh } from '@/lib/notificationEvents';

type BottleScanPhase = 'loading' | 'empty' | 'message' | 'error';

/**
 * Travel in a Bottle — QR entry (`/bottle`).
 * Claims one floating Local Friend message from the ocean queue, then lets the guest
 * open it in Chat via "Who sent this?" (Pilot Desk routing is unchanged).
 */
export default function BottleScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;

  const [phase, setPhase] = useState<BottleScanPhase>('loading');
  const [message, setMessage] = useState('');
  const [floatId, setFloatId] = useState<string | null>(null);
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadFloatingMessage = useCallback(async () => {
    setErrorText(null);
    setPhase('loading');
    try {
      await ensureAnonymousSession().catch(() => undefined);
      const result = await claimLocalFriendOceanFloat();
      requestNotificationsRefresh();
      if (!result.ok || !result.message?.trim()) {
        setPhase('empty');
        setMessage('');
        setFloatId(null);
        setNotificationId(null);
        return;
      }
      setMessage(result.message.trim());
      setFloatId(result.floatId || null);
      setNotificationId(result.notificationId || null);
      setPhase('message');
    } catch (e) {
      setPhase('error');
      setErrorText(e instanceof Error ? e.message : 'Could not reach the ocean right now.');
    }
  }, []);

  useEffect(() => {
    void loadFloatingMessage();
  }, [loadFloatingMessage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFloatingMessage();
    } finally {
      setRefreshing(false);
    }
  }, [loadFloatingMessage]);

  const refreshControl = usePremiumRefreshControl(refreshing, onRefresh);

  const openInChat = useCallback(() => {
    const nid = String(notificationId || '').trim();
    const fid = String(floatId || '').trim();
    if (!nid || !fid) return;
    router.push({
      pathname: '/chat',
      params: {
        banditName: 'Message in a bottle',
        notificationId: nid,
        notificationType: 'local_friend_bottle',
        referenceId: fid,
        referenceType: 'local_friend_ocean_claim',
        notificationTitle: 'Message in a bottle',
        notificationMessage: message,
      },
    });
  }, [floatId, message, notificationId, router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Travel in a Bottle', headerBackTitle: 'Back' }} />
      <ScrollView
        style={[styles.root, isDesktopWeb && styles.rootDesktop]}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        refreshControl={refreshControl}
      >
        <LocalFriendBottleHero height={isDesktopWeb ? 320 : 240} />

        {phase === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text style={styles.hint}>Searching the floating ocean…</Text>
          </View>
        ) : null}

        {phase === 'empty' ? (
          <View style={styles.card}>
            <Text style={styles.headline}>The ocean is quiet for now</Text>
            <Text style={styles.body}>
              No traveler notes are floating right now. Send your own from Local Friend — it still reaches the pilot
              desk and will drift here for someone else to find.
            </Text>
            <Pressable style={styles.secondaryBtn} onPress={() => router.push('/localFriend')}>
              <Text style={styles.secondaryBtnText}>Send a Local Friend note</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'error' ? (
          <View style={styles.card}>
            <Text style={styles.headline}>Could not fetch a bottle</Text>
            <Text style={styles.body}>{errorText || 'Try again in a moment.'}</Text>
            <Pressable style={styles.primaryBtn} onPress={() => void loadFloatingMessage()}>
              <Text style={styles.primaryBtnText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'message' ? (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>A note drifted ashore</Text>
            <Text style={styles.messageBody}>{message}</Text>
            <Pressable style={styles.primaryBtn} onPress={openInChat} testID="bottle-who-sent-this">
              <Text style={styles.primaryBtnText}>Who sent this?</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => router.push('/notifications')}>
              <Text style={styles.secondaryBtnText}>Open Notifications</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  rootDesktop: { maxWidth: 720, alignSelf: 'center', width: '100%' },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  center: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  hint: { color: '#AAA', fontSize: 14 },
  card: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2A2A2A',
    gap: 14,
  },
  eyebrow: {
    color: '#9EC9FF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  headline: { color: '#F5F5F5', fontSize: 20, fontWeight: '700' },
  body: { color: '#B8B8B8', fontSize: 15, lineHeight: 22 },
  messageBody: { color: '#FFFFFF', fontSize: 17, lineHeight: 26 },
  primaryBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#111', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#444',
  },
  secondaryBtnText: { color: '#DDD', fontSize: 15, fontWeight: '600' },
});
