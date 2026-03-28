import { router } from 'expo-router';
import React from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import LeafletMapView from '@/components/LeafletMapView';

const ATHENS = {
  latitude: 37.9838,
  longitude: 23.7275,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

/**
 * Home bandit card: small map with place dots (web) or maps icon (native) → full city map.
 */
export default function BanditMiniMapPreview({ banditId }: { banditId: string }) {
  const openFullMap = () => {
    router.push(`/cityMap?banditId=${encodeURIComponent(banditId)}` as any);
  };

  if (Platform.OS !== 'web') {
    return (
      <Pressable onPress={openFullMap} style={styles.iconBtn} hitSlop={8}>
        <Image
          source={require('@/assets/icons/Alecive-Flatwoken-Apps-Google-Maps.512.png')}
          style={styles.mapIcon}
        />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={openFullMap} style={styles.webWrap} hitSlop={4}>
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

const styles = StyleSheet.create({
  webWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  mapClip: {
    width: 76,
    height: 76,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#e8e8e8',
  },
  mapIcon: {
    width: 47,
    height: 47,
  },
  iconBtn: {
    padding: 2,
  },
});
