import { Stack, useLocalSearchParams, type Href } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import PlatformMapView from '../components/LeafletMapView';
import { useAppBackScreenOptions } from '@/hooks/useAppBackScreenOptions';
import { ATHENS_CENTER } from '@/lib/mapCoordinates';

/** This banDit's places — not the general Explore map. */
export default function CityMapScreen() {
  const { banditId: rawBanditId } = useLocalSearchParams<{ banditId?: string }>();
  const banditId = Array.isArray(rawBanditId) ? rawBanditId[0] : rawBanditId;

  const screenOptions = useAppBackScreenOptions({
    title: 'Map',
    fallback: (banditId ? `/bandit/${banditId}` : '/bandits') as Href,
    headerTintColor: '#000',
    headerStyle: { backgroundColor: '#FFFFFF' },
  });

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <View style={styles.container} testID="city-map-screen">
        <PlatformMapView
          banditId={banditId}
          initialRegion={ATHENS_CENTER}
          onMapReady={() => {}}
          onError={() => {}}
          onRegionChange={() => {}}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
