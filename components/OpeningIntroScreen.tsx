import { BOTTLE_POSTER, BOTTLE_VIDEO } from '@/lib/openingIntroAssets';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** On-screen intro brand line only; keep in sync with product. */
const INTRO_BRAND = 'PLAY × bandiTour';

type OpeningIntroScreenProps = {
  onEnter: () => void;
  onSkip: () => void;
};

type IntroStep = 'message' | 'bottle' | 'cta';

const FALLBACK_IF_NO_DURATION_MS = 4000;

/** Portrait bottle asset — frame keeps this width:height so the clip is never stretched edge-to-edge. */
const BOTTLE_FRAME_WH = 9 / 16;

type IntroBottleProps = { onComplete: () => void };

function useOpeningBottleFrameSize() {
  const { width: winW, height: winH } = useWindowDimensions();
  const w = winW || Dimensions.get('window').width;
  const h = winH || Dimensions.get('window').height;
  const horizontalPad = 48;
  const maxW = Math.min(400, Math.max(260, w - horizontalPad));
  const maxH = Math.max(220, h * 0.72);
  let frameW = maxW;
  let frameH = frameW / BOTTLE_FRAME_WH;
  if (frameH > maxH) {
    frameH = maxH;
    frameW = frameH * BOTTLE_FRAME_WH;
  }
  return { frameW, frameH, winW: w, winH: h };
}

function isIOSSafariWeb(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isiOS = /iPhone|iPad|iPod/i.test(ua);
  const isAppleWebKit = /WebKit/i.test(ua);
  const isOtherBrowserShell = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isiOS && isAppleWebKit && !isOtherBrowserShell;
}

/** iPhone Safari-safe visual fallback: framed poster, no native video API usage. */
function IntroBottleInlineFallback({ onComplete }: IntroBottleProps) {
  const { frameW, frameH } = useOpeningBottleFrameSize();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let done = false;
    Animated.timing(opacity, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const id = setTimeout(() => {
      if (done) return;
      done = true;
      onComplete();
    }, 3000);
    return () => {
      done = true;
      clearTimeout(id);
    };
  }, [onComplete, opacity]);

  return (
    <View
      testID="opening-intro-bottle-inline-fallback"
      style={styles.bottleStepRoot}
      accessibilityLabel="Bottle visual inline on iPhone Safari"
      pointerEvents="none"
    >
      <View style={[styles.bottleVideoCard, { width: frameW, height: frameH }]}>
        <Animated.Image
          source={BOTTLE_POSTER}
          resizeMode="contain"
          style={[StyleSheet.absoluteFillObject, { opacity }]}
          accessibilityIgnoresInvertColors
        />
      </View>
    </View>
  );
}

/**
 * Bottle clip once, no loop. Completes on native `playToEnd`, or a duration-based safety timeout.
 */
function IntroBottleVideo({ onComplete }: IntroBottleProps) {
  const { frameW, frameH } = useOpeningBottleFrameSize();
  const useInlineFallback = isIOSSafariWeb();
  const doneRef = useRef(false);
  const player = useVideoPlayer(BOTTLE_VIDEO, (p) => {
    p.loop = false;
    p.muted = true;
  });
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (fallbackRef.current) {
      clearTimeout(fallbackRef.current);
      fallbackRef.current = null;
    }
    try {
      player.pause();
    } catch {
      /* ignore */
    }
    onComplete();
  }, [onComplete, player]);

  const scheduleDurationFallback = useCallback(() => {
    if (doneRef.current) return;
    if (fallbackRef.current) {
      clearTimeout(fallbackRef.current);
      fallbackRef.current = null;
    }
    const d = player.duration;
    const ms =
      d > 0.1 && !Number.isNaN(d) ? Math.round(d * 1000) + 400 : FALLBACK_IF_NO_DURATION_MS;
    fallbackRef.current = setTimeout(finish, ms);
  }, [player, finish]);

  useEffect(() => {
    if (useInlineFallback) return;
    doneRef.current = false;
    try {
      player.muted = true;
      player.loop = false;
      if (player.currentTime > 0) {
        try {
          player.currentTime = 0;
        } catch {
          /* seek may fail before ready */
        }
      }
    } catch {
      /* ignore */
    }
  }, [player, useInlineFallback]);

  useEffect(() => {
    if (useInlineFallback) return;
    const playToEndSub = player.addListener('playToEnd', () => {
      finish();
    });
    let poll: ReturnType<typeof setInterval> | null = null;
    let pollEnd: ReturnType<typeof setTimeout> | null = null;
    const armWhenDurationReady = () => {
      if (doneRef.current) return;
      if (player.duration > 0.1 && !Number.isNaN(player.duration)) {
        scheduleDurationFallback();
        if (poll) {
          clearInterval(poll);
          poll = null;
        }
      }
    };
    scheduleDurationFallback();
    poll = setInterval(armWhenDurationReady, 200);
    pollEnd = setTimeout(() => {
      if (poll) {
        clearInterval(poll);
        poll = null;
      }
    }, 5000);
    try {
      void player.play();
    } catch {
      finish();
    }
    return () => {
      playToEndSub.remove();
      if (poll) clearInterval(poll);
      if (pollEnd) clearTimeout(pollEnd);
      if (fallbackRef.current) {
        clearTimeout(fallbackRef.current);
        fallbackRef.current = null;
      }
    };
  }, [player, finish, scheduleDurationFallback, useInlineFallback]);

  if (useInlineFallback) {
    return <IntroBottleInlineFallback onComplete={onComplete} />;
  }

  return (
    <View
      testID="opening-intro-bottle"
      style={styles.bottleStepRoot}
      pointerEvents="none"
      accessibilityLabel="Bottle message video; the next step appears when playback ends"
    >
      <View style={[styles.bottleVideoCard, { width: frameW, height: frameH }]}>
        <VideoView
          style={styles.bottleVideoView}
          player={player}
          nativeControls={false}
          contentFit="contain"
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      </View>
    </View>
  );
}

function IntroBrandKicker() {
  return (
    <View
      style={styles.brandKicker}
      accessibilityLabel="PLAY and bandiTour"
    >
      <Text style={styles.kickerText}>{INTRO_BRAND}</Text>
    </View>
  );
}

type CtaBodyProps = {
  h: number;
  insets: { top: number; bottom: number; left: number; right: number };
  onEnter: () => void;
  onSkip: () => void;
};

function CtaBody({ h, insets, onEnter, onSkip }: CtaBodyProps) {
  return (
    <ScrollView
      testID="opening-intro-step-cta"
      contentContainerStyle={[
        styles.scrollInner,
        styles.ctaScrollCentered,
        {
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: Math.max(insets.bottom, 20),
          minHeight: h,
        },
      ]}
      bounces={false}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <IntroBrandKicker />

      <View style={styles.textBlock}>
        <Text style={styles.headline}>Your stay just unlocked the city.</Text>
        <Text style={styles.subA}>Trusted locals. Hidden places. Real signals.</Text>
        <Text style={styles.giftLine}>Enter to find out who left you the message.</Text>
      </View>

      <View style={styles.ctaWrap}>
        <Pressable
          onPress={onEnter}
          accessibilityRole="button"
          accessibilityLabel="Enter bandiTour"
          style={({ pressed, hovered }) => [
            styles.ctaOuter,
            Platform.select({
              web: { transform: [{ scale: pressed || hovered ? 0.985 : 1 }] } as object,
              default: { opacity: pressed ? 0.95 : 1 },
            }),
          ]}
          testID="opening-intro-enter"
        >
          <LinearGradient
            colors={['#EED8B4', '#C4A35D', '#A77E3A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>Enter bandiTour</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={onSkip}
          hitSlop={12}
          testID="opening-intro-skip"
          style={({ pressed }) => [styles.skipWrap, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
          accessibilityLabel="Skip intro"
        >
          <Text style={styles.skipText}>Skip intro</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/**
 * Three steps: (1) message + flip → (2) bottle video once → (3) CTA. Cross-fades between steps; single brand string.
 */
export default function OpeningIntroScreen({ onEnter, onSkip }: OpeningIntroScreenProps) {
  const insets = useSafeAreaInsets();
  const h = useWindowDimensions().height || Dimensions.get('window').height;
  const [step, setStep] = useState<IntroStep>('message');
  const fade = useRef(new Animated.Value(1)).current;
  const animatingRef = useRef(false);

  const runTransition = useCallback(
    (next: IntroStep) => {
      if (animatingRef.current) return;
      animatingRef.current = true;
      Animated.timing(fade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }).start(() => {
        setStep(next);
        fade.setValue(0);
        Animated.timing(fade, {
          toValue: 1,
          duration: 340,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }).start(() => {
          animatingRef.current = false;
        });
      });
    },
    [fade],
  );

  const onBottleComplete = useCallback(() => {
    runTransition('cta');
  }, [runTransition]);

  return (
    <View style={styles.root} testID="opening-intro-root">
      <StatusBar style="light" />
      <LinearGradient
        colors={['#14110C', '#0a0a0a', '#050505']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={{ flex: 1, opacity: fade }} testID="opening-intro-layer">
        {step === 'message' ? (
          <ScrollView
            contentContainerStyle={[
              styles.scrollInner,
              {
                paddingTop: insets.top + 32,
                paddingBottom: insets.bottom + 24,
                minHeight: h,
                justifyContent: 'center',
              },
            ]}
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            testID="opening-intro-step-message"
          >
            <View style={styles.messageStep}>
              <IntroBrandKicker />
              <Text style={styles.messageLead}>Someone left you a message.</Text>
              <Text style={styles.messageBody}>
                Some cities whisper.{'\n'}
                Athens waits.{'\n\n'}
                Someone thought you might listen.
              </Text>
              <Text style={styles.whoSentTease}>Who sent it?</Text>
              <Text style={styles.whoSentSub}>Enter bandiTour to find out.</Text>
              <View style={styles.messageCta}>
                <Pressable
                  onPress={() => runTransition('bottle')}
                  accessibilityRole="button"
                  accessibilityLabel="Who sent it — Flip the message"
                  style={({ pressed, hovered }) => [
                    styles.ctaOuter,
                    Platform.select({
                      web: { transform: [{ scale: pressed || hovered ? 0.985 : 1 }] } as object,
                      default: { opacity: pressed ? 0.95 : 1 },
                    }),
                  ]}
                  testID="opening-intro-flip"
                >
                  <LinearGradient
                    colors={['#EED8B4', '#C4A35D', '#A77E3A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ctaGradient}
                  >
                    <Text style={styles.ctaText}>Who sent it?</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        ) : null}

        {step === 'bottle' ? (
          <View style={styles.bottleStepOuter} testID="opening-intro-bottle-step" accessibilityLabel="Bottle video step">
            <IntroBottleVideo onComplete={onBottleComplete} />
          </View>
        ) : null}

        {step === 'cta' ? <CtaBody h={h} insets={insets} onEnter={onEnter} onSkip={onSkip} /> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  bottleStepOuter: { flex: 1, minHeight: 200, backgroundColor: '#0a0a0a' },
  bottleStepRoot: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  /** Matches `LocalFriendBottleHero` card treatment (rounded frame, dark matte behind the clip). */
  bottleVideoCard: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0B0F18',
    maxWidth: '100%',
  },
  bottleVideoView: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: '#0B0F18',
  },
  scrollInner: {
    alignItems: 'center',
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  ctaScrollCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  messageStep: { width: '100%', maxWidth: 420, alignItems: 'center' },
  messageLead: {
    color: '#F5F0E8',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 20,
    letterSpacing: 0.2,
  },
  messageBody: {
    color: 'rgba(240, 232, 220, 0.88)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '400',
    marginBottom: 20,
  },
  whoSentTease: {
    color: '#EED8B4',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  whoSentSub: {
    color: 'rgba(240, 232, 220, 0.72)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
    fontWeight: '500',
  },
  messageCta: { width: '100%', maxWidth: 360, alignItems: 'center' },
  brandKicker: {
    marginBottom: 28,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201, 167, 100, 0.5)',
    borderRadius: 10,
  },
  kickerText: {
    color: 'rgba(240, 215, 160, 0.98)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  textBlock: { alignItems: 'center', maxWidth: 420, marginBottom: 32 },
  headline: {
    color: '#FDFBF7',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  subA: {
    color: 'rgba(245, 240, 230, 0.92)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
    marginBottom: 18,
  },
  giftLine: {
    color: '#D4B88A',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 4,
  },
  ctaWrap: { width: '100%', maxWidth: 360, alignItems: 'center' },
  ctaOuter: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  ctaGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#1A1008',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  skipWrap: { paddingVertical: 8, paddingHorizontal: 16 },
  skipText: { color: 'rgba(255, 255, 255, 0.65)', fontSize: 14, fontWeight: '600' },
});
