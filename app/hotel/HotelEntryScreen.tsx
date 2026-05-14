import { getHotelWhiteLabelOrDefault, normalizeHotelSlug } from '@/lib/hotelWhiteLabel';
import { openStaffEmailLogin } from '@/lib/loginNavigation';
import {
  HOTEL_BY_SLUG,
  bootstrapMainAppSession,
  persistHotelEntry,
  syncPilotHotelProfileIfNeeded,
} from '@/lib/pilotSession';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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

const { height: WINDOW_H } = Dimensions.get('window');

export type HotelEntryScreenProps = {
  slug: string;
};

/**
 * QR / web flip-card landing (legacy /hotel/[slug] paths). PWA-first: no app-store CTAs.
 * Continue opens in-app guest home (`/bandits`) on this origin — same tab / PWA; no external redirect.
 */
export function HotelEntryScreen({ slug: rawSlug }: HotelEntryScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [busyContinue, setBusyContinue] = useState(false);

  const frontOpacity = useRef(new Animated.Value(1)).current;
  const backOpacity = useRef(new Animated.Value(0)).current;

  /** Canonical slug + public URL aliases (`nyx-theatrou` → `nyx-athens`, etc.). */
  const slugNorm = useMemo(() => normalizeHotelSlug(rawSlug), [rawSlug]);
  const hotelBranding = useMemo(() => getHotelWhiteLabelOrDefault(slugNorm), [slugNorm]);

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

  const onContinueInGuide = useCallback(async () => {
    if (busyContinue) return;
    setBusyContinue(true);
    try {
      await bootstrapMainAppSession();
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
              <Text style={styles.sideBTitle}>Your welcome is ready</Text>
              <Text style={styles.sideBBody}>
                Continue in bandiTour — no install needed. Guest home opens here with bandiTS and Local banDits
                {isKnownHotel ? ` (${hotelBranding.displayName}).` : '.'}
              </Text>

              <Pressable
                style={({ pressed }) => [styles.continueLink, pressed && styles.continueLinkPressed]}
                onPress={onContinueInGuide}
                disabled={busyContinue}
                accessibilityRole="button"
                accessibilityLabel={
                  isKnownHotel
                    ? `Continue to guest home for ${hotelBranding.displayName} in this app`
                    : 'Continue to guest home in this app'
                }
              >
                <Text style={styles.continueLinkText}>
                  {busyContinue ? 'Opening…' : isKnownHotel ? `Continue — ${hotelBranding.displayName}` : 'Continue to guest home'}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.staffSignInLinkWrap, pressed && styles.staffSignInLinkPressed]}
                onPress={() => openStaffEmailLogin(router, '/menu')}
                accessibilityRole="link"
                accessibilityLabel="Staff sign in"
              >
                <Text style={styles.staffSignInLinkText}>Staff sign-in</Text>
              </Pressable>
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
  staffSignInLinkWrap: {
    marginTop: 28,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  staffSignInLinkPressed: {
    opacity: 0.75,
  },
  staffSignInLinkText: {
    fontSize: 12,
    color: 'rgba(250,250,250,0.42)',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
