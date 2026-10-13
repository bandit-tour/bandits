import { useMapEvents } from '@/hooks/useMapEvents';
import { eventsToMapMarkers } from '@/lib/eventsToMapMarkers';
import { buildLeafletBootHtml } from '@/lib/leafletMapHtml';
import { injectMapCatalog, injectMapSelection } from '@/lib/mapWebViewBridge';
import { ATHENS_CENTER } from '@/lib/mapCoordinates';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Database } from '@/lib/database.types';
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
  seedEvents?: Event[];
}

export default function LeafletMapView({
  onMapReady,
  onError,
  onRegionChange,
  banditId: banditIdProp,
  seedEvents,
}: MapViewProps) {
  const eventListRef = useRef<EventListRef>(null);
  const webViewRef = useRef<WebView>(null);
  const catalogPayloadRef = useRef<string>('');
  const selectedIdRef = useRef<string | null>(null);
  const { banditId: routeBanditId } = useLocalSearchParams();
  const [mapReady, setMapReady] = useState(false);

  const routeBanditIdValue = Array.isArray(routeBanditId) ? routeBanditId[0] : routeBanditId;
  const scopedBanditId = banditIdProp ?? routeBanditIdValue;

  const mapOptions = useMemo(
    () => ({
      ...(scopedBanditId ? { banditId: scopedBanditId } : {}),
      ...(seedEvents?.length ? { seedEvents } : {}),
    }),
    [scopedBanditId, seedEvents],
  );

  const { events, loading, error, banditId: mapBanditId } = useMapEvents(undefined, mapOptions);

  const effectiveBanditId = mapBanditId || scopedBanditId;
  const markersData = useMemo(() => eventsToMapMarkers(events), [events]);

  const bootHtml = useMemo(
    () =>
      buildLeafletBootHtml({
        initialLat: ATHENS_CENTER.latitude,
        initialLng: ATHENS_CENTER.longitude,
        initialZoom: 13,
        athensLat: ATHENS_CENTER.latitude,
        athensLng: ATHENS_CENTER.longitude,
      }),
    [],
  );

  const webViewKey = `city-map-${effectiveBanditId ?? 'all'}`;

  useEffect(() => {
    if (error && events.length === 0) {
      onError(new Error(error));
    }
  }, [error, events.length, onError]);

  useEffect(() => {
    setMapReady(false);
    catalogPayloadRef.current = '';
    selectedIdRef.current = null;
  }, [webViewKey]);

  const applySelection = useCallback(
    (eventId: string, scrollList = false) => {
      selectedIdRef.current = eventId;
      if (mapReady) injectMapSelection(webViewRef.current, eventId);
      if (scrollList) eventListRef.current?.scrollToEvent(eventId);
    },
    [mapReady],
  );

  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;
    const payload = JSON.stringify(markersData);
    if (payload === catalogPayloadRef.current) return;
    catalogPayloadRef.current = payload;
    injectMapCatalog(webViewRef.current, payload);
    const first = markersData[0]?.id;
    if (first) applySelection(first, false);
  }, [mapReady, markersData, applySelection]);

  const focusMapOnEvent = useCallback(
    (event: Event) => {
      applySelection(event.id, false);
    },
    [applySelection],
  );

  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'mapReady':
          setMapReady(true);
          onMapReady();
          break;
        case 'markerClick': {
          const clickedEvent = events.find((e) => e.id === data.eventId);
          if (clickedEvent) applySelection(clickedEvent.id, true);
          break;
        }
        case 'regionChange':
          onRegionChange({
            latitude: data.center.lat,
            longitude: data.center.lng,
            latitudeDelta: data.latitudeDelta,
            longitudeDelta: data.longitudeDelta,
          });
          break;
        case 'error':
          onError(new Error(data.message));
          break;
      }
    } catch (err) {
      console.error('Failed to parse WebView message:', err);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <WebView
          key={webViewKey}
          ref={webViewRef}
          source={{ html: bootHtml }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          allowsInlineMediaPlayback
          startInLoadingState={false}
          mixedContentMode="always"
          cacheEnabled
          androidLayerType="hardware"
          onError={(webviewError) => {
            onError(webviewError);
          }}
        />
        {loading && markersData.length === 0 ? (
          <View style={styles.mapLoadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#111111" />
          </View>
        ) : null}
      </View>

      <EventList
        ref={eventListRef}
        events={events}
        loading={loading}
        error={error}
        banditId={(effectiveBanditId || '') as string}
        variant="horizontal"
        showButton={false}
        imageHeight={120}
        contentContainerStyle={styles.eventsContainer}
        onEventPress={focusMapOnEvent}
      />
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
  mapContainer: {
    height: '40%',
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(238, 241, 244, 0.55)',
  },
  webview: {
    flex: 1,
  },
  eventsContainer: {
    marginTop: 8,
  },
});
