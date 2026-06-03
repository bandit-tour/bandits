import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { BanditsScreen } from '@/app/(tabs)/bandits';
import { ExploreScreen } from '@/app/(tabs)/explore';
import type { UpperTabKey } from '@/lib/upperTab';

type Props = {
  active: UpperTabKey;
};

const MySpotsLazy = React.lazy(() =>
  import('@/app/(tabs)/mySpots').then((m) => ({ default: m.MySpotsScreen })),
);
function TabPaneFallback() {
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="small" color="#0a7ea4" />
    </View>
  );
}

/**
 * Instant upper-tab switch (no stack transition). Stack routes stay in sync via router.replace
 * but render null while this overlay is enabled.
 *
 * iOS: mount only the active pane (memory). Android: unmount Explore when hidden (WebView/FlatList
 * steal JS from bottom nav). Bandits + My Spots stay visited for fast return.
 */
export default function UpperTabScreens({ active }: Props) {
  const iosSinglePane = Platform.OS === 'ios';
  /** Keep Explore mounted once visited — remounting on Android caused dead first taps. */
  const androidUnmountExplore = false;
  const [visited, setVisited] = useState<Set<UpperTabKey>>(() => new Set(['bandits']));

  const tabsToMount = useMemo(() => {
    if (iosSinglePane) return new Set<UpperTabKey>([active]);
    const next = new Set(visited);
    next.add(active);
    if (androidUnmountExplore && active !== 'explore') {
      next.delete('explore');
    }
    return next;
  }, [active, androidUnmountExplore, iosSinglePane, visited]);

  useEffect(() => {
    if (iosSinglePane) return;
    setVisited((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev);
      next.add(active);
      return next;
    });
  }, [active, iosSinglePane]);

  const mountBandits = tabsToMount.has('bandits');
  const mountMySpots = tabsToMount.has('mySpots');
  const mountExplore = tabsToMount.has('explore');

  return (
    <View style={styles.host}>
      {mountBandits ? (
        <View
          style={[styles.pane, active === 'bandits' ? styles.paneVisible : styles.paneHidden]}
          pointerEvents={active === 'bandits' ? 'auto' : 'none'}
        >
          <BanditsScreen tabActive={active === 'bandits'} />
        </View>
      ) : null}
      {mountMySpots ? (
        <View
          style={[styles.pane, active === 'mySpots' ? styles.paneVisible : styles.paneHidden]}
          pointerEvents={active === 'mySpots' ? 'auto' : 'none'}
        >
          <Suspense fallback={<TabPaneFallback />}>
            <MySpotsLazy tabActive={active === 'mySpots'} />
          </Suspense>
        </View>
      ) : null}
      {mountExplore ? (
        <View
          style={[styles.pane, active === 'explore' ? styles.paneVisible : styles.paneHidden]}
          pointerEvents={active === 'explore' ? 'auto' : 'none'}
        >
          <ExploreScreen tabActive={active === 'explore'} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, backgroundColor: '#FFFFFF' },
  pane: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  paneVisible: {
    opacity: 1,
    zIndex: 1,
  },
  paneHidden: {
    opacity: 0,
    zIndex: 0,
    pointerEvents: 'none',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
