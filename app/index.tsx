import OpeningIntroScreen from '@/components/OpeningIntroScreen';
import {
  getShouldSkipIntroWebSync,
  hasSeenOpeningIntro,
  markOpeningIntroSeen,
  urlSearchHasIntroOne,
} from '@/lib/openingIntroStorage';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

type Gate = 'loading' | 'redirect' | 'intro';

/**
 * Web: one sync read — no `loading` state, no async before first paint. Default: intro.
 * `?intro=1` overrides “seen” and always opens the intro (QA).
 * Native: `loading` until `AsyncStorage` is read in `useEffect` (rare for production URL).
 */
function initialGate(): Gate {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (urlSearchHasIntroOne(window.location.search)) {
      return 'intro';
    }
    return getShouldSkipIntroWebSync() ? 'redirect' : 'intro';
  }
  return 'loading';
}

/**
 * Root `/`: opening intro on first visit, then **Home** at `/bandits` after Enter or Skip.
 */
export default function Index() {
  const router = useRouter();
  const params = useLocalSearchParams<{ intro?: string | string[] }>();
  const forceIntroFromQuery = useMemo(() => {
    const raw = params.intro;
    const s = Array.isArray(raw) ? raw[0] : raw;
    const v = String(s ?? '')
      .trim()
      .replace(/=+$/, '')
      .trim();
    return v === '1';
  }, [params.intro]);

  const [gate, setGate] = useState<Gate>(initialGate);

  useEffect(() => {
    if (forceIntroFromQuery) {
      setGate('intro');
    }
  }, [forceIntroFromQuery]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    let a = true;
    void (async () => {
      if (forceIntroFromQuery) {
        if (a) setGate('intro');
        return;
      }
      const seen = await hasSeenOpeningIntro();
      if (!a) return;
      setGate(seen ? 'redirect' : 'intro');
    })();
    return () => {
      a = false;
    };
  }, [forceIntroFromQuery]);

  const finish = useCallback(async () => {
    await markOpeningIntroSeen();
    router.replace('/bandits' as Href);
  }, [router]);

  if (gate === 'loading') {
    return (
      <View
        style={[styles.boot, Platform.OS === 'web' && ({ minHeight: '100vh' } as const)]}
        testID="opening-gate-boot"
        accessibilityLabel="Loading"
      />
    );
  }

  if (gate === 'redirect') {
    return <Redirect href={'/bandits' as Href} />;
  }

  return <OpeningIntroScreen onEnter={finish} onSkip={finish} />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    width: '100%',
    backgroundColor: '#0a0a0a',
  },
});
