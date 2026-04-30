import { AlumaIntroCard } from '@/components/AlumaIntroCard';
import type { AlumaOnboardingStepDef } from '@/lib/alumaOnboarding';
import type { HotelSlug } from '@/lib/hotelWhiteLabel';
import { getHotelWhiteLabelOrDefault } from '@/lib/hotelWhiteLabel';
import { bootstrapMainAppSession, persistHotelEntry, syncPilotHotelProfileIfNeeded } from '@/lib/pilotSession';
import { getGuestFlipSignal, loadSignalBank } from '@/lib/signals';
import { useAndroidWebBackGuard } from '@/lib/useAndroidWebBackGuard';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: WINDOW_H } = Dimensions.get('window');

const FADE_OUT_MS = 320;
const FADE_IN_MS = 380;
const IPHONE_INLINE_CTA_DELAY_MS = 2600;

export type HotelOnboardingFlowProps = {
  hotelSlug: HotelSlug;
  /** Same approved sequence as ALUMA — typically `ALUMA_ONBOARDING_STEPS` for both brands; visuals differ via `getHotelWhiteLabelOrDefault(hotelSlug)`. */
  steps: readonly AlumaOnboardingStepDef[];
  /** When true, replace to home without painting the intro. */
  shouldSkipIntro: () => Promise<boolean>;
  /** Persist completion for this hotel (ALUMA flags vs PLAY PWA stage, etc.). */
  markOnboardingComplete: () => Promise<void>;
  backGuardPath: string;
  testID?: string;
};

/**
 * Shared ALUMA-class onboarding: boot → two-step card intro → home.
 * ALUMA and PLAY differ only by slug, completion persistence, and `hotelWhiteLabel` assets — not by layout or motion.
 */
export function HotelOnboardingFlow({
  hotelSlug,
  steps,
  shouldSkipIntro,
  markOnboardingComplete,
  backGuardPath,
  testID,
}: HotelOnboardingFlowProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hotel = getHotelWhiteLabelOrDefault(hotelSlug);
  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [signalBody, setSignalBody] = useState('');
  const [iphonePlayCtaVisible, setIphonePlayCtaVisible] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const transitionLock = useRef(false);
  const isIphoneWeb =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    /iPhone|iPad|iPod/i.test(String(navigator.userAgent || ''));
  const shouldUseIphonePlayInlineFlow = hotelSlug === 'play-theatrou' && (Platform.OS === 'ios' || isIphoneWeb);

  useAndroidWebBackGuard(backGuardPath);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const skip = await shouldSkipIntro();
        if (cancelled) return;
        if (skip) {
          router.replace('/bandits');
          return;
        }
        try {
          await bootstrapMainAppSession();
          await syncPilotHotelProfileIfNeeded();
          await persistHotelEntry(hotelSlug, 'guest_universal');
          const flip = await getGuestFlipSignal(hotelSlug);
          let line = flip.body?.trim() || '';
          if (!line) {
            const bank = await loadSignalBank();
            line = bank[Math.floor(Math.random() * Math.max(bank.length, 1))]?.body?.trim() || '';
          }
          if (!cancelled) setSignalBody(line || 'Trust the street with no sign.');
        } catch {
          if (!cancelled) setSignalBody('Trust the street with no sign.');
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelSlug, router, shouldSkipIntro]);

  useEffect(() => {
    if (!shouldUseIphonePlayInlineFlow || booting) {
      setIphonePlayCtaVisible(false);
      return;
    }
    const id = setTimeout(() => setIphonePlayCtaVisible(true), IPHONE_INLINE_CTA_DELAY_MS);
    return () => clearTimeout(id);
  }, [shouldUseIphonePlayInlineFlow, booting]);

  const goHome = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await bootstrapMainAppSession();
      await syncPilotHotelProfileIfNeeded();
      await persistHotelEntry(hotelSlug, 'guest_universal');
      await markOnboardingComplete();
      router.replace('/bandits');
    } finally {
      setBusy(false);
    }
  }, [busy, hotelSlug, markOnboardingComplete, router]);

  const advance = useCallback(() => {
    if (busy || transitionLock.current) return;
    if (stepIndex >= steps.length - 1) {
      void goHome();
      return;
    }
    transitionLock.current = true;
    Animated.timing(fade, {
      toValue: 0,
      duration: FADE_OUT_MS,
      useNativeDriver: true,
    }).start(() => {
      setStepIndex((i) => i + 1);
      fade.setValue(0);
      Animated.timing(fade, {
        toValue: 1,
        duration: FADE_IN_MS,
        useNativeDriver: true,
      }).start(() => {
        transitionLock.current = false;
      });
    });
  }, [busy, fade, goHome, stepIndex, steps.length]);

  if (booting) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
        <View style={[styles.fill, styles.boot]} />
      </>
    );
  }

  const step = steps[stepIndex]!;
  const iphonePlayPrimary = steps[0];
  const iphonePlayReward = steps[1];
  const inlineHeadline = shouldUseIphonePlayInlineFlow
    ? (iphonePlayPrimary?.headline ?? step.headline)
    : step.headline;
  const inlineSubline = shouldUseIphonePlayInlineFlow
    ? (iphonePlayReward?.subline ?? iphonePlayPrimary?.subline ?? step.subline)
    : step.subline;
  const inlineEyebrow = shouldUseIphonePlayInlineFlow ? iphonePlayReward?.eyebrow : step.eyebrow;
  const inlineCta = shouldUseIphonePlayInlineFlow ? (iphonePlayReward?.cta ?? 'Explore the City') : step.cta;
  const inlineShowVideo = shouldUseIphonePlayInlineFlow ? true : step.showVideo;
  const onInlineCta = shouldUseIphonePlayInlineFlow ? goHome : advance;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      <View
        testID={testID}
        style={[
          styles.fill,
          Platform.OS === 'web' ? ({ minHeight: '100vh' } as { minHeight: '100vh' }) : { minHeight: WINDOW_H },
        ]}
      >
        <ImageBackground source={hotel.introHeroSource} style={styles.fill} resizeMode="cover">
          <LinearGradient
            colors={['rgba(6, 5, 4, 0.82)', 'rgba(10, 9, 8, 0.88)', 'rgba(4, 3, 2, 0.92)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.centerStage, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.centerBundle}>
              <Image
                source={hotel.logoSource}
                style={styles.logoMark}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <Animated.View style={[styles.cardStage, { opacity: fade }]}>
                <AlumaIntroCard
                  showVideo={inlineShowVideo}
                  kicker={step.kicker}
                  eyebrow={inlineEyebrow}
                  headline={inlineHeadline}
                  quotedMessage={(shouldUseIphonePlayInlineFlow || stepIndex === 0) ? signalBody : undefined}
                  subline={inlineSubline}
                  ctaLabel={inlineCta}
                  onCta={onInlineCta}
                  busy={busy}
                  hideCta={shouldUseIphonePlayInlineFlow && !iphonePlayCtaVisible}
                />
              </Animated.View>
            </View>
          </View>
        </ImageBackground>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
  },
  boot: {
    backgroundColor: '#0A0908',
  },
  centerStage: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  centerBundle: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: {
    width: 200,
    height: 62,
    marginBottom: 20,
  },
  cardStage: {
    width: '100%',
    alignItems: 'center',
  },
  staffFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  staffFooterHit: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  staffFooterHitPressed: {
    opacity: 0.75,
  },
  staffFooterText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(250,250,250,0.42)',
    textDecorationLine: 'underline',
  },
});
