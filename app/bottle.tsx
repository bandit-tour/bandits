import { HotelOnboardingFlow } from '@/app/hotel/HotelOnboardingFlow';
import { buildBottleQrSteps } from '@/lib/bottleQrIntro';
import {
  resolveGuestBottleOpening,
  type GuestBottleHook,
} from '@/lib/guest-moment';
import { bootstrapMainAppSession, PLAY_THEATROU_SLUG, persistHotelEntry } from '@/lib/pilotSession';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * Ocean Bottle Message — social QR scan hook (NOT Travel in a Bottle).
 * Mode A — Moment (curiosity first, sender hidden).
 * Mode B — Local Friend ocean message (reply → Chat).
 * Continues in /bottleDiscover — never a dead public page.
 */
export default function BottleScanScreen() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [hook, setHook] = useState<GuestBottleHook | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resolved = await resolveGuestBottleOpening();
        if (!cancelled) setHook(resolved);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const steps = useMemo(
    () =>
      buildBottleQrSteps(
        hook?.empty
          ? 'No new bottle messages right now.'
          : hook?.hookSubline ?? 'Find out who sent it inside bandiTour.',
      ),
    [hook?.empty, hook?.hookSubline],
  );

  const enterDiscover = useCallback(async () => {
    await bootstrapMainAppSession();
    await persistHotelEntry(PLAY_THEATROU_SLUG, 'guest_universal');
    router.replace('/bottleDiscover');
  }, [router]);

  if (booting || !hook) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.boot}>
          <ActivityIndicator size="large" color="#EED8B4" />
        </View>
      </>
    );
  }

  const discoverLabel = hook.empty
    ? 'Continue'
    : hook.mode === 'moment'
      ? 'See who sent this'
      : 'Reply in Chat';

  return (
    <HotelOnboardingFlow
      hotelSlug={PLAY_THEATROU_SLUG}
      steps={steps}
      shouldSkipIntro={() => Promise.resolve(false)}
      markOnboardingComplete={async () => {}}
      backGuardPath="/bottle"
      testID="bottle-qr-play-intro"
      prefilledSignalLine={
        hook.empty
          ? 'The ocean is quiet — no eligible messages to discover right now.'
          : hook.quote
      }
      bottleDiscoverLabel={discoverLabel}
      onBottleDiscover={() => void enterDiscover()}
    />
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: '#0A0908',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
