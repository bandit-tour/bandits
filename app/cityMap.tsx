import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import PlatformMapView from '../components/LeafletMapView';
import { useAppBackScreenOptions } from '@/hooks/useAppBackScreenOptions';
import { ATHENS_CENTER } from '@/lib/mapCoordinates';

export default function CityMapScreen() {
  const { banditId: rawBanditId } = useLocalSearchParams<{ banditId?: string }>();
  const banditId = Array.isArray(rawBanditId) ? rawBanditId[0] : rawBanditId;

  const screenOptions = useAppBackScreenOptions({
    title: 'Map',
    fallback: banditId ? '/bandits' : '/explore',
    headerTintColor: '#000',
    headerStyle: { backgroundColor: '#FFFFFF' },
  });

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <View style={styles.container}>
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
