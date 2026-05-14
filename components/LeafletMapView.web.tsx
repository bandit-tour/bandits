import { useMapEvents as useMapEventsHook } from '@/hooks/useMapEvents';
import { ATHENS_CENTER, boundsFromMapEvents, eventMapCoordinates } from '@/lib/mapCoordinates';
import { Database } from '@/lib/database.types';
import { useLocalSearchParams } from 'expo-router';
import { repairDisplayText } from '@/lib/repairTextEncoding';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import EventList, { EventListRef } from './EventList';

type Event = Database['public']['Tables']['event']['Row'];

/**
 * Branded placeholder used when a bandit has no events with coordinates yet.
 * Keeps every mini-map thumbnail visually consistent (same size, same rounding,
 * same brand tones) so we never expose raw, empty OSM tiles to the user.
 */
function MiniMapPlaceholder() {
  return (
    <View style={styles.miniPlaceholder} accessibilityLabel="City map preview">
      <div
        style={{
          width: '100%',
          height: '100%',
          background:
            'linear-gradient(135deg, #FFD9A8 0%, #FFB475 35%, #FF7E5F 70%, #5B6EE1 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 18,
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 0 0 2px #C0392B inset, 0 1px 2px rgba(0,0,0,0.25)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 36,
            right: 20,
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 0 0 2px #27AE60 inset, 0 1px 2px rgba(0,0,0,0.25)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 26,
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 0 0 2px #2980B9 inset, 0 1px 2px rgba(0,0,0,0.25)',
          }}
        />
        <div
          style={{
            fontSize: 22,
            color: '#FFFFFF',
            textShadow: '0 1px 2px rgba(0,0,0,0.35)',
          }}
        >
          📍
        </div>
      </div>
    </View>
  );
}

// Dynamic imports for Leaflet (client-side only)
let MapContainer: any = null;
let TileLayer: any = null;
let Marker: any = null;
let Popup: any = null;
let L: any = null;

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
  children,
  miniMode = false,
  banditId
}: MapViewProps) {
  const eventListRef = useRef<EventListRef>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [activeEventIndex, setActiveEventIndex] = useState(0);
  const { banditId: routeBanditId } = useLocalSearchParams();
  const routeBanditIdValue = Array.isArray(routeBanditId) ? routeBanditId[0] : routeBanditId;
  const scopedBanditId = banditId ?? routeBanditIdValue;

  /** Same hook + shared `getEvents` path as native (`LeafletMapView.native.tsx`). */
  const { events, loading, error, banditId: mapBanditId } = useMapEventsHook(
    undefined,
    scopedBanditId ? { banditId: scopedBanditId } : undefined,
  );

  const activeBanditId = mapBanditId || scopedBanditId;

  // Create a handler that scrolls to the event instead of navigating
  const handleMarkerPress = (event: any) => {
    const idx = events.findIndex((e) => e.id === event.id);
    if (idx >= 0) setActiveEventIndex(idx);
    eventListRef.current?.scrollToEvent(event.id);
  };

  const focusMapOnEvent = useCallback(
    (event: Event) => {
      const idx = events.findIndex((e) => e.id === event.id);
      if (idx >= 0) setActiveEventIndex(idx);
      const coords = eventMapCoordinates(event);
      if (mapInstance && coords) {
        mapInstance.flyTo([coords.lat, coords.lng], Math.max(mapInstance.getZoom(), 15), {
          animate: true,
          duration: 0.45,
        });
      }
    },
    [events, mapInstance],
  );

  const focusEventByStep = (dir: -1 | 1) => {
    if (events.length === 0) return;
    const next = Math.max(0, Math.min(events.length - 1, activeEventIndex + dir));
    setActiveEventIndex(next);
    const nextEvent = events[next];
    if (!nextEvent) return;
    eventListRef.current?.scrollToEvent(nextEvent.id);
    const coords = eventMapCoordinates(nextEvent);
    if (mapInstance && coords) {
      mapInstance.flyTo([coords.lat, coords.lng], mapInstance.getZoom(), {
        animate: true,
        duration: 0.45,
      });
    }
  };

  useEffect(() => {
    if (activeEventIndex >= events.length) {
      setActiveEventIndex(0);
    }
  }, [activeEventIndex, events.length]);

  // Debug logging
  useEffect(() => {
    console.log('🗺️ Leaflet Web: Events loaded:', events.length);
    if (events.length > 0) {
      console.log('🗺️ First event sample:', {
        id: events[0].id,
        name: events[0].name,
        location_lat: events[0].location_lat,
        location_lng: events[0].location_lng,
        hasCoords: !!(events[0].location_lat && events[0].location_lng)
      });
    }
  }, [events]);

  // Load Leaflet components dynamically
  useEffect(() => {
    if (typeof window !== 'undefined') {
      Promise.all([
        import('react-leaflet'),
        import('leaflet')
      ]).then(([reactLeaflet, leaflet]) => {
        MapContainer = reactLeaflet.MapContainer;
        TileLayer = reactLeaflet.TileLayer;
        Marker = reactLeaflet.Marker;
        Popup = reactLeaflet.Popup;
        L = leaflet.default;

        // Fix for default marker icons in webpack
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        setLeafletLoaded(true);
        setTimeout(() => onMapReady(), 100);
      }).catch((err) => {
        console.error('Failed to load Leaflet:', err);
        onError(err);
      });
    }
  }, [onMapReady, onError]);

  useEffect(() => {
    if (error) {
      onError(new Error(error));
    }
  }, [error, onError]);

  // Comprehensive color palette with darker colors for better contrast (100 colors)
  const markerColors = [
    // Basic colors first (high contrast)
    '#C0392B', '#E74C3C', '#8E44AD', '#9B59B6', '#2980B9', '#3498DB', '#1ABC9C', '#16A085',
    '#27AE60', '#2ECC71', '#F39C12', '#E67E22', '#D68910', '#CA6F1E', '#AF7AC5', '#8E44AD',
    '#5DADE2', '#48C9B0', '#58D68D', '#F7DC6F', '#EB984E', '#EC7063', '#BB8FCE', '#85C1E9',

    // Reds and Pinks
    '#A93226', '#B03A2E', '#922B21', '#78281F', '#641E16', '#943126', '#A04000', '#B7472A',
    '#CD5C5C', '#B22222', '#8B0000', '#A0522D', '#D2691E', '#FF6347', '#DC143C', '#B91C1C',

    // Blues
    '#1B4F72', '#21618C', '#2874A6', '#2E86AB', '#3090C7', '#5499C7', '#7FB3D3', '#85929E',
    '#1F2937', '#374151', '#4B5563', '#6B7280', '#111827', '#1E3A8A', '#1E40AF', '#2563EB',

    // Greens
    '#0E4B29', '#145A32', '#186A3B', '#1D8348', '#229954', '#28B463', '#2ECC71', '#58D68D',
    '#0F766E', '#047857', '#065F46', '#064E3B', '#022C22', '#14532D', '#166534', '#15803D',

    // Purples
    '#4A148C', '#6A1B9A', '#7B1FA2', '#8E24AA', '#9C27B0', '#AB47BC', '#BA68C8', '#CE93D8',
    '#581C87', '#6B21A8', '#7C2D92', '#8B5CF6', '#A855F7', '#C084FC', '#DDD6FE', '#EDE9FE',

    // Oranges and Yellows
    '#B7472A', '#CB4335', '#D68910', '#E67E22', '#F39C12', '#F4D03F', '#F7DC6F', '#F9E79F',
    '#D97706', '#EA580C', '#F59E0B', '#FBBF24', '#FCD34D', '#FDE047', '#FACC15', '#EAB308',

    // Teals and Cyans
    '#0E7490', '#0891B2', '#06B6D4', '#22D3EE', '#67E8F9', '#A7F3D0', '#6EE7B7', '#34D399',
    '#059669', '#047857', '#065F46', '#064E3B', '#0F766E', '#0D9488', '#14B8A6', '#5EEAD4',

    // Grays and Dark colors
    '#212529', '#343A40', '#495057', '#6C757D', '#ADB5BD', '#CED4DA', '#DEE2E6', '#E9ECEF',
    '#1F2937', '#374151', '#4B5563', '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#F3F4F6',

    // Additional vibrant colors
    '#E91E63', '#FF5722', '#795548', '#607D8B', '#9E9E9E', '#FFEB3B', '#CDDC39', '#8BC34A',
    '#4CAF50', '#009688', '#00BCD4', '#03A9F4', '#2196F3', '#3F51B5', '#673AB7', '#9C27B0'
  ];

  /** Stable marker colors — never setState during render (fixes hook / render crashes on web). */
  const eventColorById = useMemo(() => {
    const m = new Map<string, string>();
    let idx = 0;
    for (const e of events) {
      if (!eventMapCoordinates(e)) continue;
      if (!m.has(e.id)) {
        m.set(e.id, markerColors[idx % markerColors.length]);
        idx += 1;
      }
    }
    return m;
  }, [events]);

  const createCustomIcon = (eventId: string) => {
    if (!L) return null;
    const color = eventColorById.get(eventId) ?? '#C0392B';
    /** Mini-mode markers are larger and bolder so the dots are clearly visible at 80×80. */
    const size = miniMode ? 14 : 20;
    const borderWidth = miniMode ? 2 : 2;

    return L.divIcon({
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border: ${borderWidth}px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.45);
        "></div>
      `,
      className: 'custom-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  /**
   * Detect "no mappable events" so the mini-mode thumbnail can render a
   * branded placeholder instead of empty OSM tiles. Without this guard, bandits
   * with no event coordinates show up as a confusing "pale blue lines" preview.
   */
  const hasMappableEvents = useMemo(
    () => events.some((e) => eventMapCoordinates(e) != null),
    [events],
  );

  const mapBounds = useMemo(() => {
    const { center, zoom } = boundsFromMapEvents(
      events,
      initialRegion.latitude ? initialRegion : ATHENS_CENTER,
      miniMode,
    );
    return { center: [center.latitude, center.longitude] as [number, number], zoom };
  }, [events, initialRegion.latitude, initialRegion.longitude, miniMode]);

  useEffect(() => {
    if (!mapInstance || miniMode) return;
    const handler = () => {
      const center = mapInstance.getCenter();
      const zoom = mapInstance.getZoom();
      onRegionChange({
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: 0.01 / Math.pow(2, zoom - 10),
        longitudeDelta: 0.01 / Math.pow(2, zoom - 10),
      });
    };
    mapInstance.on('moveend', handler);
    return () => {
      mapInstance.off('moveend', handler);
    };
  }, [mapInstance, miniMode, onRegionChange]);

  /**
   * Mini-mode rendering policy (every bandit thumbnail looks consistent):
   *  - While events are loading OR Leaflet isn't ready → show the branded placeholder.
   *  - If the bandit has zero mappable events → show the branded placeholder.
   *  - Only render the actual Leaflet preview when we are sure markers will appear.
   * This eliminates the "pale blue lines / cropped OSM tiles" case the user
   * reported on Neo's card and removes any cold-start flicker.
   */
  if (miniMode && (loading || !leafletLoaded || !hasMappableEvents)) {
    return <MiniMapPlaceholder />;
  }

  if (!leafletLoaded) {
    return (
      <View style={styles.container}>
        <View style={styles.mapContainer}>
          <View style={styles.loadingContainer}>
            <div style={{ textAlign: 'center', padding: '20px' }}>Loading map...</div>
          </View>
        </View>
        <EventList
          ref={eventListRef}
          events={events}
          loading={loading}
          error={error}
          banditId={activeBanditId as string}
          variant="horizontal"
          showButton={false}
          imageHeight={154}
          contentContainerStyle={styles.eventsContainer}
        />
      </View>
    );
  }

  return (
    <View style={miniMode ? styles.miniContainer : styles.container}>
      {/* Map - Full container in mini mode, top 40% in normal mode */}
      <View style={miniMode ? styles.miniMapContainer : styles.mapContainer}>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"
          integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A=="
          crossOrigin=""
        />
        <MapContainer
          key={`${mapBounds.center[0]}-${mapBounds.center[1]}-${mapBounds.zoom}-${events.length}`}
          center={mapBounds.center}
          zoom={mapBounds.zoom}
          style={{ height: '100%', width: '100%' }}
          whenCreated={setMapInstance}
          zoomControl={!miniMode}
          dragging={!miniMode}
          touchZoom={!miniMode}
          scrollWheelZoom={!miniMode}
          doubleClickZoom={!miniMode}
          boxZoom={!miniMode}
          attributionControl={!miniMode}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Event markers */}
          {events.map((event) => {
            const coords = eventMapCoordinates(event);
            if (!coords) {
              return null;
            }

            return (
              <Marker
                key={event.id}
                position={[coords.lat, coords.lng]}
                icon={createCustomIcon(event.id)}
                eventHandlers={miniMode ? {} : {
                  click: () => handleMarkerPress(event),
                }}
              >
                {!miniMode && (
                  <Popup>
                    <div style={{ minWidth: '200px' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{repairDisplayText(event.name || '')}</h3>
                      {event.address && (
                        <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#666' }}>
                          {repairDisplayText(event.address || '')}
                        </p>
                      )}
                      {event.genre && (
                        <p style={{ margin: '0', fontSize: '10px', color: '#888', textTransform: 'uppercase' }}>
                          {event.genre}
                        </p>
                      )}
                    </div>
                  </Popup>
                )}
              </Marker>
            );
          })}

          {children}
        </MapContainer>
      </View>

      {/* Bottom 60% - Events List (only in normal mode) */}
      {!miniMode && (
        <View style={styles.recommendationsPanel}>
          <View style={styles.recommendationsHeader}>
            <Text style={styles.recommendationsTitle}>Map picks</Text>
            {events.length > 1 ? (
              <View style={styles.recommendationArrows}>
                <Pressable
                  style={[styles.arrowBtn, activeEventIndex === 0 && styles.arrowBtnDisabled]}
                  disabled={activeEventIndex === 0}
                  onPress={() => focusEventByStep(-1)}
                >
                  <Text style={styles.arrowText}>‹</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.arrowBtn,
                    activeEventIndex >= events.length - 1 && styles.arrowBtnDisabled,
                  ]}
                  disabled={activeEventIndex >= events.length - 1}
                  onPress={() => focusEventByStep(1)}
                >
                  <Text style={styles.arrowText}>›</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          <Text style={styles.recommendationsHint}>
            Scroll the strip or use arrows. Marker and card clicks stay unchanged.
          </Text>
          <EventList
            ref={eventListRef}
            events={events}
            loading={loading}
            error={error}
            banditId={activeBanditId as string}
            variant="horizontal"
            showButton={false}
            imageHeight={154}
            contentContainerStyle={styles.eventsContainer}
            onEventPress={focusMapOnEvent}
          />
        </View>
      )}
    </View>
  );
}

// Export a Marker component for compatibility
export const LeafletMarker = ({ children }: { children: React.ReactNode }) => {
  return null; // Markers are handled internally
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
    height: '46%',
    backgroundColor: '#e9ecef',
  },
  miniMapContainer: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  miniLoadingBox: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
  miniPlaceholder: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#FFB475',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventsContainer: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingBottom: 12,
  },
  recommendationsPanel: {
    flex: 1,
    backgroundColor: '#f7f8fa',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  recommendationsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2937',
  },
  recommendationsHint: {
    fontSize: 12,
    color: '#6b7280',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  recommendationArrows: {
    flexDirection: 'row',
    gap: 8,
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: {
    opacity: 0.35,
  },
  arrowText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginTop: -1,
  },
});