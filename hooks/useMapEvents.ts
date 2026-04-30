import { getEvents, type EventFilters } from '@/app/services/events';
import { useCity } from '@/contexts/CityContext';
import { Database } from '@/lib/database.types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

type Event = Database['public']['Tables']['event']['Row'];

export interface MapBounds {
  center: { latitude: number; longitude: number };
  zoom: number;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export function useMapEvents(onEventPress?: (event: Event) => void) {
  const { banditId: rawBanditId } = useLocalSearchParams<{ banditId?: string }>();
  const banditId = Array.isArray(rawBanditId) ? rawBanditId[0] : rawBanditId;
  const { selectedCity } = useCity();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: EventFilters = {};
      if (banditId && banditId !== 'undefined') {
        filters.banditId = banditId;
      } else if (selectedCity?.trim()) {
        filters.city = selectedCity.trim();
      }

      const load = getEvents(filters);
      const timeoutMs = 28000;
      const allEventsData = await Promise.race([
        load,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Could not load places in time. Check your connection and try again.')),
            timeoutMs,
          ),
        ),
      ]);

      // Supabase / JSON may return numerics as strings — coerce before map markers.
      const validEvents = allEventsData.filter((event) => {
        const lat = Number(event.location_lat);
        const lng = Number(event.location_lng);
        return Number.isFinite(lat) && Number.isFinite(lng);
      });
      setEvents(validEvents);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  }, [banditId, selectedCity]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const calculateOptimalMapBounds = (initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }): MapBounds => {
    if (events.length === 0) {
      return {
        center: { latitude: initialRegion.latitude, longitude: initialRegion.longitude },
        zoom: 12,
        bounds: {
          north: initialRegion.latitude + initialRegion.latitudeDelta / 2,
          south: initialRegion.latitude - initialRegion.latitudeDelta / 2,
          east: initialRegion.longitude + initialRegion.longitudeDelta / 2,
          west: initialRegion.longitude - initialRegion.longitudeDelta / 2,
        }
      };
    }
    
    // Find the bounding box of all events
    const lats = events.map(event => event.location_lat);
    const lngs = events.map(event => event.location_lng);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    // Calculate center point
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    
    // Calculate the span (delta) of the bounding box
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    
    // Add some padding (10% on each side)
    const padding = 0.1;
    const paddedLatSpan = latSpan * (1 + padding * 2);
    const paddedLngSpan = lngSpan * (1 + padding * 2);
    
    // Calculate optimal zoom level based on the span
    let zoom = 14; // Default zoom
    
    if (paddedLatSpan > 0.1) zoom = 10;  // Very wide area
    else if (paddedLatSpan > 0.05) zoom = 11;  // Wide area
    else if (paddedLatSpan > 0.02) zoom = 12; // Medium area
    else if (paddedLatSpan > 0.01) zoom = 13; // Small area
    else if (paddedLatSpan > 0.005) zoom = 14; // Very small area
    else if (paddedLatSpan > 0.002) zoom = 15; // Tiny area
    else zoom = 16; // Very tiny area
    
    return {
      center: { latitude: centerLat, longitude: centerLng },
      zoom: zoom,
      bounds: {
        north: maxLat + (latSpan * padding),
        south: minLat - (latSpan * padding),
        east: maxLng + (lngSpan * padding),
        west: minLng - (lngSpan * padding)
      }
    };
  };

  const handleEventPress = (event: Event) => {
    if (onEventPress) {
      onEventPress(event);
    } else {
      // Default behavior: navigate to event detail page
      const url = banditId 
        ? `/event/${event.id}?banditId=${banditId}` as any
        : `/event/${event.id}` as any;
      router.push(url);
    }
  };

  return {
    events,
    loading,
    error,
    banditId: banditId as string,
    calculateOptimalMapBounds,
    handleEventPress,
    refetchEvents: fetchEvents,
  };
}
