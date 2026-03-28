import { getEvents } from '@/app/services/events';
import { useMapEvents as useMapEventsHook } from '@/hooks/useMapEvents';
import { Database } from '@/lib/database.types';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import EventList, { EventListRef } from './EventList';

type Event = Database['public']['Tables']['event']['Row'];

function boundsFromEvents(
  events: Event[],
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  },
): { center: [number, number]; zoom: number } {
  const valid = events.filter(
    (e) =>
      e.location_lat != null &&
      e.location_lng != null &&
      typeof e.location_lat === 'number' &&
      typeof e.location_lng === 'number',
  );
  if (valid.length === 0) {
    return {
      center: [initialRegion.latitude, initialRegion.longitude],
      zoom: 13,
    };
  }
  const lats = valid.map((e) => e.location_lat as number);
  const lngs = valid.map((e) => e.location_lng as number);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const paddedLatSpan = latSpan * 1.2;
  let zoom = 14;
  if (paddedLatSpan > 0.1) zoom = 10;
  else if (paddedLatSpan > 0.05) zoom = 11;
  else if (paddedLatSpan > 0.02) zoom = 12;
  else if (paddedLatSpan > 0.01) zoom = 13;
  else if (paddedLatSpan > 0.005) zoom = 14;
  else zoom = 15;
  if (valid.length === 1) zoom = Math.min(15, zoom + 1);
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  return { center: [centerLat, centerLng], zoom };
}

// Dynamic imports for Leaflet (client-side only)
let MapContainer: any = null;
let TileLayer: any = null;
let Marker: any = null;
let Popup: any = null;
let useMapEvents: any = null;
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
  const { banditId: routeBanditId } = useLocalSearchParams();
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);

  // Use provided banditId prop, or fall back to route param
  const activeBanditId = banditId || routeBanditId;

  // Create a handler that scrolls to the event instead of navigating
  const handleMarkerPress = (event: any) => {
    eventListRef.current?.scrollToEvent(event.id);
  };

  // Custom state for mini map with specific banditId
  const [customEvents, setCustomEvents] = useState<Event[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // Use hook for normal mode, custom state for mini mode with banditId
  const hookData = useMapEventsHook();
  const events = banditId ? customEvents : hookData.events;
  const loading = banditId ? customLoading : hookData.loading;
  const error = banditId ? customError : hookData.error;

  // Fetch events for specific banditId when in mini mode
  useEffect(() => {
    if (banditId && miniMode) {
      fetchEventsForBandit();
    }
  }, [banditId, miniMode]);

  const fetchEventsForBandit = async () => {
    try {
      setCustomLoading(true);
      setCustomError(null);

      const allEventsData = await getEvents({ banditId });

      // Filter out any events that still have null coordinates
      const validEvents = allEventsData.filter(event =>
        event.location_lat != null &&
        event.location_lng != null &&
        typeof event.location_lat === 'number' &&
        typeof event.location_lng === 'number'
      );

      setCustomEvents(validEvents);
    } catch (err) {
      console.error('Error fetching events for bandit:', err);
      setCustomError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setCustomLoading(false);
    }
  };

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
        useMapEvents = reactLeaflet.useMapEvents;
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

  // Track used colors to ensure uniqueness
  const [usedColors, setUsedColors] = useState<Set<string>>(new Set());

  // Color assignment cache to maintain consistency
  const [colorAssignments] = useState<Map<string, string>>(new Map());
  let colorIndex = 0;

  // Create custom marker icon with unique color
  const createCustomIcon = (eventId: string) => {
    if (!L) return null;

    // Get or assign a unique color for this event
    let color = colorAssignments.get(eventId);
    if (!color) {
      // Find the next available color
      while (colorIndex < markerColors.length && usedColors.has(markerColors[colorIndex])) {
        colorIndex++;
      }

      if (colorIndex < markerColors.length) {
        color = markerColors[colorIndex];
        colorAssignments.set(eventId, color);
        setUsedColors(prev => new Set([...prev, color!]));
        colorIndex++;
      } else {
        // Fallback to a default color if we somehow run out
        color = '#C0392B';
      }
    }

    // Smaller markers for mini mode
    const size = miniMode ? 10 : 20;
    const borderWidth = miniMode ? 1 : 2;

    return L.divIcon({
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border: ${borderWidth}px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>
      `,
      className: 'custom-marker',
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
    });
  };

  const mapBounds = useMemo(
    () => boundsFromEvents(events, initialRegion),
    [events, initialRegion.latitude, initialRegion.longitude],
  );

  // Handle map events
  const MapEventHandler = () => {
    const map = useMapEvents ? useMapEvents({
      moveend: () => {
        const center = map.getCenter();
        const zoom = map.getZoom();
        const region = {
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: 0.01 / Math.pow(2, zoom - 10),
          longitudeDelta: 0.01 / Math.pow(2, zoom - 10),
        };
        onRegionChange(region);
      },
    }) : null;

    useEffect(() => {
      if (map) {
        setMapInstance(map);
      }
    }, [map]);

    return null;
  };

  if (!leafletLoaded) {
    if (miniMode) {
      return (
        <View style={[styles.miniMapContainer, styles.miniLoadingBox]}>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#888' }}>…</div>
        </View>
      );
    }
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
          {!miniMode && <MapEventHandler />}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Event markers */}
          {events.map((event) => {
            if (!event.location_lat || !event.location_lng) {
              return null;
            }

            return (
              <Marker
                key={event.id}
                position={[event.location_lat, event.location_lng]}
                icon={createCustomIcon(event.id)}
                eventHandlers={miniMode ? {} : {
                  click: () => handleMarkerPress(event),
                }}
              >
                {!miniMode && (
                  <Popup>
                    <div style={{ minWidth: '200px' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{event.name}</h3>
                      {event.address && (
                        <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#666' }}>
                          {event.address}
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
    height: '40%',
    backgroundColor: '#f0f0f0',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventsContainer: {
    marginTop: 8,
  },
});