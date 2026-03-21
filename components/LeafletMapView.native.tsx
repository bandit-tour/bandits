/**
 * TEMPORARY (startup crash isolation): WebView removed — react-native-webview was on the
 * eager route-registration path (cityMap → LeafletMapView → this file).
 * Restore full WebView + Leaflet HTML from git history when debugging is done.
 */
import { getEvents } from '@/app/services/events';
import { useMapEvents } from '@/hooks/useMapEvents';
import { Database } from '@/lib/database.types';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import EventList, { EventListRef } from './EventList';

type Event = Database['public']['Tables']['event']['Row'];

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
  miniMode?: boolean;
  banditId?: string;
}

export default function LeafletMapView({
  initialRegion,
  onMapReady,
  onError,
  onRegionChange,
  miniMode = false,
  banditId,
}: MapViewProps) {
  const eventListRef = useRef<EventListRef>(null);
  const { banditId: routeBanditId } = useLocalSearchParams();
  const [customEvents, setCustomEvents] = useState<Event[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const activeBanditId = banditId || routeBanditId;

  const hookData = useMapEvents();
  const events = banditId ? customEvents : hookData.events;
  const loading = banditId ? customLoading : hookData.loading;
  const error = banditId ? customError : hookData.error;

  useEffect(() => {
    if (banditId && miniMode) {
      void fetchEventsForBandit();
    }
  }, [banditId, miniMode]);

  const fetchEventsForBandit = async () => {
    try {
      setCustomLoading(true);
      setCustomError(null);
      const allEventsData = await getEvents({ banditId });
      const validEvents = allEventsData.filter(
        (event) =>
          event.location_lat != null &&
          event.location_lng != null &&
          typeof event.location_lat === 'number' &&
          typeof event.location_lng === 'number',
      );
      setCustomEvents(validEvents);
    } catch (err) {
      console.error('Error fetching events for bandit:', err);
      setCustomError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setCustomLoading(false);
    }
  };

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
    <View style={miniMode ? styles.miniContainer : styles.container}>
      <View style={miniMode ? styles.miniMapContainer : styles.mapContainer}>
        <View style={styles.placeholder} accessibilityLabel="Map placeholder">
          <Text style={styles.placeholderTitle}>Map offline (WebView disabled)</Text>
          <Text style={styles.placeholderSub}>
            {initialRegion.latitude.toFixed(4)}, {initialRegion.longitude.toFixed(4)}
          </Text>
        </View>
      </View>

      {!miniMode && (
        <EventList
          ref={eventListRef}
          events={events}
          loading={loading}
          error={error}
          banditId={activeBanditId as string}
          variant="horizontal"
          showButton={false}
          imageHeight={120}
          contentContainerStyle={styles.eventsContainer}
        />
      )}
    </View>
  );
}

export const LeafletMarker = () => {
  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  miniContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapContainer: {
    height: '40%',
    backgroundColor: '#f0f0f0',
  },
  miniMapContainer: {
    flex: 1,
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
