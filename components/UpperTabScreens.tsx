import React from 'react';
import { StyleSheet, View } from 'react-native';

import BanditsScreen from '@/app/(tabs)/bandits';
import ExploreScreen from '@/app/(tabs)/explore';
import MySpotsScreen from '@/app/(tabs)/mySpots';

export type UpperTabKey = 'bandits' | 'mySpots' | 'explore';

type Props = {
  active: UpperTabKey;
};

/**
 * Keeps Local banDits / My Spots / Explore mounted so switching upper tabs does not
 * tear down FlatLists, images, or the Explore map WebView.
 */
export default function UpperTabScreens({ active }: Props) {
  return (
    <View style={styles.host}>
      <View
        style={[styles.pane, active === 'bandits' ? styles.paneVisible : styles.paneHidden]}
        pointerEvents={active === 'bandits' ? 'auto' : 'none'}
      >
        <BanditsScreen tabActive={active === 'bandits'} />
      </View>
      <View
        style={[styles.pane, active === 'mySpots' ? styles.paneVisible : styles.paneHidden]}
        pointerEvents={active === 'mySpots' ? 'auto' : 'none'}
      >
        <MySpotsScreen tabActive={active === 'mySpots'} />
      </View>
      <View
        style={[styles.pane, active === 'explore' ? styles.paneVisible : styles.paneHidden]}
        pointerEvents={active === 'explore' ? 'auto' : 'none'}
      >
        <ExploreScreen tabActive={active === 'explore'} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
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
  },
});
