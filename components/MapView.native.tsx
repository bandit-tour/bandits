/**
 * Native map uses a lightweight placeholder (no react-native-maps) so iOS EAS builds
 * avoid CocoaPods failures. Full maps remain on web. Login and the rest of the app work.
 */
import { useMapEvents } from '@/hooks/useMapEvents';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import EventList, { EventListRef } from './EventList';

interface MapViewProps {
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  onMapReady: () => void;
  onError: (error: any) => void;
  onRegionChange: (region: any) => void;
  children?: React.ReactNode;
}

/** Stub for API compatibility with react-native-maps Marker exports. */
export function Marker() {
  return null;
}

export default function PlatformMapView({
  initialRegion,
  onMapReady,
  onError,
  onRegionChange,
  children,
}: MapViewProps) {
  const eventListRef = useRef<EventListRef>(null);
  const { banditId } = useLocalSearchParams();

  const { events, loading, error } = useMapEvents();

  useEffect(() => {
    if (error) {
      onError(new Error(error));
    }
  }, [error, onError]);

  useEffect(() => {
    onMapReady();
    onRegionChange(initialRegion);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <View style={styles.placeholder} accessibilityLabel="Map placeholder">
          <Text style={styles.placeholderTitle}>Map</Text>
          <Text style={styles.placeholderSub}>
            {initialRegion.latitude.toFixed(4)}, {initialRegion.longitude.toFixed(4)}
          </Text>
        </View>
      </View>

      <EventList
        ref={eventListRef}
        events={events}
        loading={loading}
        error={error}
        banditId={banditId as string}
        variant="horizontal"
        showButton={false}
        imageHeight={120}
        contentContainerStyle={styles.eventsContainer}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    height: '40%',
    backgroundColor: '#f0f0f0',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  placeholderSub: {
    marginTop: 6,
    fontSize: 12,
    color: '#666',
  },
  eventsContainer: {
    marginTop: 8,
  },
});
