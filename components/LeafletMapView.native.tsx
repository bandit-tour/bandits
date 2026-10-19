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
  preferSeed?: boolean;
  embedded?: boolean;
  selectedEventId?: string | null;
  onSelectEvent?: (event: Event) => void;
}

export default function LeafletMapView({
  onMapReady,
  onError,
  onRegionChange,
  banditId: banditIdProp,
  seedEvents,
  preferSeed = false,
  embedded = false,
  selectedEventId = null,
  onSelectEvent,
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
      ...(preferSeed || seedEvents ? { preferSeed: true } : {}),
    }),
    [scopedBanditId, seedEvents, preferSeed],
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
    if (!selectedEventId || !mapReady) return;
    applySelection(selectedEventId, false);
  }, [applySelection, mapReady, selectedEventId]);

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
          if (clickedEvent) {
            applySelection(clickedEvent.id, !embedded);
            onSelectEvent?.(clickedEvent);
          }
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
    <View style={embedded ? styles.embeddedContainer : styles.container}>
      <View style={embedded ? styles.embeddedMap : styles.mapContainer}>
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

      {!embedded ? (
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
      ) : null}
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
  embeddedContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: 240,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapContainer: {
    height: '40%',
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  embeddedMap: {
    flex: 1,
    height: '100%',
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
