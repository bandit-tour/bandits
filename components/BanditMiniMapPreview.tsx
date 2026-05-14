import { router } from 'expo-router';
import React from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import LeafletMapView from '@/components/LeafletMapView';

/**
 * Top-right thumbnail on every Local banDit card.
 *
 * Visual contract (must be identical for every bandit):
 *  - Fixed 80×80 rounded thumbnail with subtle white border + soft shadow.
 *  - Web: live Leaflet mini-map auto-centered on the bandit's curated locations
 *    with colored dot markers. When the bandit has zero mappable events the
 *    LeafletMapView mini path renders a branded placeholder (NOT raw OSM tiles)
 *    so the thumbnail never shows "pale blue lines / broken tiles".
 *  - Native: branded Google-Maps icon button (same outer dimensions/shape).
 *
 * Tapping the thumbnail always opens the full city map filtered by this bandit.
 */

const ATHENS = {
  latitude: 37.9838,
  longitude: 23.7275,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const THUMB_SIZE = 80;

export default function BanditMiniMapPreview({ banditId }: { banditId: string }) {
  const openFullMap = () => {
    router.push(`/cityMap?banditId=${encodeURIComponent(banditId)}` as any);
  };

  if (Platform.OS !== 'web') {
    return (
      <Pressable onPress={openFullMap} style={styles.nativeWrap} hitSlop={8} accessibilityRole="button" accessibilityLabel="Open city map">
        <View style={styles.nativeInner}>
          <Image
            source={require('@/assets/icons/google-maps-512.png')}
            style={styles.mapIcon}
          />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={openFullMap} style={styles.webWrap} hitSlop={4} accessibilityRole="button" accessibilityLabel="Open city map">
      <View style={styles.mapClip} pointerEvents="none">
        <LeafletMapView
          miniMode
          banditId={banditId}
          initialRegion={ATHENS}
          onMapReady={() => {}}
          onError={() => {}}
          onRegionChange={() => {}}
        />
      </View>
    </Pressable>
  );
}

const sharedShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  android: { elevation: 4 },
  default: {
    boxShadow: '0 2px 6px rgba(0,0,0,0.18)' as any,
  },
});

const styles = StyleSheet.create({
  webWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    ...(sharedShadow as object),
  },
  mapClip: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#EEF1F4',
  },
  nativeWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(sharedShadow as object),
  },
  nativeInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7FA',
  },
  mapIcon: {
    width: 56,
    height: 56,
  },
});
