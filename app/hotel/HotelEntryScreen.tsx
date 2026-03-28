import {
  HOTEL_BY_SLUG,
  ensureAnonymousSession,
  persistHotelEntry,
  syncPilotHotelProfileIfNeeded,
} from '@/lib/pilotSession';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Store URLs must be set when listings are public; otherwise we avoid broken search/404 pages.
 * Vercel / EAS: EXPO_PUBLIC_APP_STORE_URL, EXPO_PUBLIC_PLAY_STORE_URL
 * iOS: https://apps.apple.com/app/idXXXXXXXXX
 * Android: https://play.google.com/store/apps/details?id=...
 */
function readEnvUrl(key: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  const v = process.env[key]?.trim();
  return v || undefined;
}

const STORE_UNAVAILABLE_TITLE = 'Use your browser for now';
const STORE_UNAVAILABLE_BODY =
  'The native apps are not listed in the stores yet. Tap “Continue to the city guide” below — you get the full experience here, no install required.';

const { height: WINDOW_H } = Dimensions.get('window');

export type HotelEntryScreenProps = {
  slug: string;
};

/**
 * QR / web landing — emotional hook first, then gift + store actions.
 * Continue skips intro video (goes straight to /bandits).
 */
export function HotelEntryScreen({ slug: rawSlug }: HotelEntryScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [busyContinue, setBusyContinue] = useState(false);

  const frontOpacity = useRef(new Animated.Value(1)).current;
  const backOpacity = useRef(new Animated.Value(0)).current;

  const slugNorm = useMemo(() => String(rawSlug ?? '').trim().toLowerCase(), [rawSlug]);

  const appStoreUrl = useMemo(() => readEnvUrl('EXPO_PUBLIC_APP_STORE_URL'), []);
  const playStoreUrl = useMemo(() => readEnvUrl('EXPO_PUBLIC_PLAY_STORE_URL'), []);

  const isKnownHotel = Boolean(slugNorm && HOTEL_BY_SLUG[slugNorm]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (slugNorm && isKnownHotel) {
        await persistHotelEntry(slugNorm, 'guest_universal');
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [slugNorm, isKnownHotel]);

  const onFlip = useCallback(() => {
    if (showBack) return;
    if (Platform.OS !== 'web') {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        /* ignore */
      }
    }
    Animated.parallel([
      Animated.timing(frontOpacity, {
        toValue: 0,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.timing(backOpacity, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setShowBack(true);
    });
  }, [showBack, frontOpacity, backOpacity]);

  const openAppStore = useCallback(() => {
    if (appStoreUrl) {
      void Linking.openURL(appStoreUrl);
      return;
    }
    Alert.alert(STORE_UNAVAILABLE_TITLE, STORE_UNAVAILABLE_BODY);
  }, [appStoreUrl]);

  const openPlayStore = useCallback(() => {
    if (playStoreUrl) {
      void Linking.openURL(playStoreUrl);
      return;
    }
    Alert.alert(STORE_UNAVAILABLE_TITLE, STORE_UNAVAILABLE_BODY);
  }, [playStoreUrl]);

  const onContinueInGuide = useCallback(async () => {
    if (busyContinue) return;
    setBusyContinue(true);
    try {
      await ensureAnonymousSession();
      await syncPilotHotelProfileIfNeeded();
      router.replace('/bandits');
    } finally {
      setBusyContinue(false);
    }
  }, [busyContinue, router]);

  if (!ready) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
        <View style={[styles.boot, { paddingTop: insets.top }]} />
      </>
    );
  }

  const minH = Math.max(WINDOW_H, 640);

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView
          contentContainerStyle={[styles.scrollInner, { minHeight: minH - insets.top - insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={[styles.stage, { minHeight: showBack ? 720 : 560 }]}>
            <Animated.View
              style={[styles.face, { opacity: frontOpacity }]}
              pointerEvents={showBack ? 'none' : 'auto'}
            >
              <Text style={styles.sideATitle}>Someone left you a message</Text>
              <Text style={styles.sideABody}>
                Some cities whisper. Athens waits—then offers you a corner, a late light, a reason to stay one more hour.
                Whoever sent you here thought you might listen.
              </Text>
              {!isKnownHotel ? (
                <Text style={styles.softNote}>This guest link is not active. You can still flip to continue.</Text>
              ) : null}
              <Pressable
                style={({ pressed }) => [styles.flipBtn, pressed && styles.flipBtnPressed]}
                onPress={onFlip}
                accessibilityRole="button"
                accessibilityLabel="Flip the message"
              >
                <Text style={styles.flipBtnText}>Flip the message</Text>
              </Pressable>
            </Animated.View>

            <Animated.View
              style={[styles.face, styles.faceBack, { opacity: backOpacity }]}
              pointerEvents={showBack ? 'auto' : 'none'}
            >
              <Text style={styles.sideBTitle}>A gift is waiting for you</Text>
              <Text style={styles.sideBBody}>
                Go to reception, show that you downloaded the app, and receive your gift.
              </Text>

              <View
                style={[
                  styles.storeRow,
                  appStoreUrl && playStoreUrl ? styles.storeRowWhenBothLive : null,
                ]}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.storeBtn,
                    !appStoreUrl && styles.storeBtnMuted,
                    pressed && styles.storeBtnPressed,
                  ]}
                  onPress={openAppStore}
                  accessibilityRole="button"
                  accessibilityLabel={
                    appStoreUrl ? 'Download on the App Store' : 'App Store — coming soon, use continue below'
                  }
                >
                  <Text style={styles.storeBtnText}>
                    {appStoreUrl ? 'Download on the App Store' : 'App Store (coming soon)'}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.storeBtn,
                    styles.storeBtnOutline,
                    !playStoreUrl && styles.storeBtnOutlineMuted,
                    pressed && styles.storeBtnPressed,
                  ]}
                  onPress={openPlayStore}
                  accessibilityRole="button"
                  accessibilityLabel={
                    playStoreUrl ? 'Get it on Google Play' : 'Google Play — coming soon, use continue below'
                  }
                >
                  <Text style={styles.storeBtnTextOutline}>
                    {playStoreUrl ? 'Get it on Google Play' : 'Google Play (coming soon)'}
                  </Text>
                </Pressable>
              </View>

              {!appStoreUrl || !playStoreUrl ? (
                <Text style={styles.storeFootnote}>
                  Full experience works in your browser — use Continue below until store listings are live.
                </Text>
              ) : null}

              <Text style={styles.keyLine}>Your key to the city starts here</Text>

              <Pressable
                style={({ pressed }) => [styles.continueLink, pressed && styles.continueLinkPressed]}
                onPress={onContinueInGuide}
                disabled={busyContinue}
                accessibilityRole="button"
                accessibilityLabel="Continue to the city guide in your browser"
              >
                <Text style={styles.continueLinkText}>
                  {busyContinue ? 'Opening…' : 'Continue to the city guide'}
                </Text>
              </Pressable>
              <Text style={styles.continueHint}>No install required — opens in your browser.</Text>
            </Animated.View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollInner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  stage: {
    position: 'relative',
    width: '100%',
  },
  face: {
    width: '100%',
    paddingVertical: 8,
  },
  faceBack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  sideATitle: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '600',
    color: '#FAFAFA',
    letterSpacing: -0.6,
    marginBottom: 24,
  },
  sideABody: {
    fontSize: 17,
    lineHeight: 28,
    color: 'rgba(250,250,250,0.82)',
    fontWeight: '400',
    letterSpacing: 0.2,
    marginBottom: 40,
  },
  softNote: {
    fontSize: 13,
    color: 'rgba(250,250,250,0.5)',
    marginBottom: 20,
    lineHeight: 20,
  },
  flipBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
  },
  flipBtnPressed: {
    opacity: 0.75,
  },
  flipBtnText: {
    color: '#FAFAFA',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  sideBTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '600',
    color: '#FAFAFA',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  sideBBody: {
    fontSize: 17,
    lineHeight: 28,
    color: 'rgba(250,250,250,0.85)',
    marginBottom: 32,
  },
  storeRow: {
    gap: 12,
    marginBottom: 12,
  },
  storeRowWhenBothLive: {
    marginBottom: 28,
  },
  storeFootnote: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(250,250,250,0.5)',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  storeBtn: {
    backgroundColor: '#FAFAFA',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  storeBtnMuted: {
    opacity: 0.78,
  },
  storeBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  storeBtnOutlineMuted: {
    opacity: 0.78,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  storeBtnPressed: {
    opacity: 0.85,
  },
  storeBtnText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '700',
  },
  storeBtnTextOutline: {
    color: '#FAFAFA',
    fontSize: 14,
    fontWeight: '700',
  },
  keyLine: {
    fontSize: 13,
    color: 'rgba(250,250,250,0.45)',
    letterSpacing: 0.4,
    marginBottom: 28,
    textAlign: 'center',
  },
  continueLink: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  continueLinkPressed: {
    opacity: 0.7,
  },
  continueLinkText: {
    color: 'rgba(250,250,250,0.75)',
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  continueHint: {
    fontSize: 12,
    color: 'rgba(250,250,250,0.38)',
    textAlign: 'center',
    marginTop: 8,
  },
});
