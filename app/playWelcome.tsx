import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import React, { useState } from 'react';
import {
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { markPlayWelcomeSeen } from '@/lib/playWelcomeStorage';

const HERO = require('@/assets/images/play-theatrou.jpg');

export default function PlayWelcomeScreen() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const onStart = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await markPlayWelcomeSeen();
      if (Platform.OS !== 'web') {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {
          /* ignore */
        }
      }
      router.replace('/playIntro');
    } finally {
      setBusy(false);
    }
  };

  const onSkip = async () => {
    await markPlayWelcomeSeen();
    router.replace('/bandits');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      <ImageBackground source={HERO} style={styles.bg} resizeMode="cover">
        <LinearGradient
          colors={['rgba(8, 8, 10, 0.42)', 'rgba(8, 8, 10, 0.72)', 'rgba(0, 0, 0, 0.88)']}
          locations={[0, 0.45, 1]}
          style={styles.gradient}
        >
          <View style={[styles.inner, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.copyBlock}>
              <Text style={styles.kicker}>Israel Canada Group</Text>
              <Text style={styles.title}>PLAY Theatrou Athens</Text>
              <Text style={styles.subtitle}>Exclusive city access for PLAY guests</Text>
              <View style={styles.rule} />
              <Text style={styles.body}>
                You’re not just visiting Athens.{'\n'}
                You’re stepping into it.
              </Text>
              <Text style={styles.bodySecondary}>
                Curated by local insiders.{'\n'}
                Unlocked for you.
              </Text>
            </View>

            <View style={styles.footer}>
              <Pressable
                style={({ pressed }) => [
                  styles.cta,
                  pressed && styles.ctaPressed,
                  busy && styles.ctaDisabled,
                ]}
                onPress={onStart}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Start exploring"
              >
                <Text style={styles.ctaText}>Start exploring</Text>
              </Pressable>
              <Pressable onPress={onSkip} style={styles.skip} hitSlop={12}>
                <Text style={styles.skipText}>Skip for now</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  copyBlock: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 0.25,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    marginBottom: 14,
    fontWeight: '700',
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.5,
    marginBottom: 22,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  rule: {
    width: 44,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: 22,
  },
  body: {
    fontSize: 20,
    lineHeight: 30,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 16,
  },
  bodySecondary: {
    fontSize: 16,
    lineHeight: 26,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  footer: {
    gap: 14,
  },
  cta: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaPressed: {
    opacity: 0.92,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    letterSpacing: 0.2,
  },
  skip: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
