import { getEvents, type EventFilters } from '@/app/services/events';
import { useCity } from '@/contexts/CityContext';
import { Database } from '@/lib/database.types';
import { readExploreMapSeedEvents } from '@/lib/exploreMapEventsCache';
import {
  ATHENS_CENTER,
  boundsFromMapEvents,
  eventMapCoordinates,
} from '@/lib/mapCoordinates';
import { resolveGooglePlaceBusinessData } from '@/lib/placePhoto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

type Event = Database['public']['Tables']['event']['Row'];

export type UseMapEventsOptions = {
  /**
   * When set (e.g. embedded map / mini preview), overrides `banditId` from the route.
   * Same `getEvents` path runs on web and native — never browser-only.
   */
  banditId?: string | null;
};

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

async function enrichEventCoordinates(event: Event): Promise<Event> {
  if (eventMapCoordinates(event)) return event;

  const placeId = String((event as { google_place_id?: string | null }).google_place_id ?? '').trim();
  if (!placeId) return event;

  try {
    const resolved = await resolveGooglePlaceBusinessData({
      placeId,
      name: event.name ?? '',
      address: event.address ?? '',
      city: event.city ?? 'Athens',
      neighborhood: event.neighborhood ?? '',
      photoLimit: 1,
    });
    if (resolved?.locationLat != null && resolved?.locationLng != null) {
      return {
        ...event,
        location_lat: resolved.locationLat,
        location_lng: resolved.locationLng,
      };
    }
  } catch {
    // keep row for list; map will skip until coords exist
  }
  return event;
}

async function enrichEventsForMap(events: Event[]): Promise<Event[]> {
  const needsBackfill = events.filter((event) => !eventMapCoordinates(event));
  if (needsBackfill.length === 0) return events;

  const backfilledById = new Map<string, Event>();
  const chunkSize = 4;
  for (let i = 0; i < needsBackfill.length; i += chunkSize) {
    const chunk = needsBackfill.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map((event) => enrichEventCoordinates(event)));
    for (const row of results) {
      backfilledById.set(row.id, row);
    }
  }

  return events.map((event) => backfilledById.get(event.id) ?? event);
}

export function useMapEvents(
  onEventPress?: (event: Event) => void,
  options?: UseMapEventsOptions,
) {
  const { banditId: rawRouteBanditId } = useLocalSearchParams<{ banditId?: string }>();
  const routeBanditId = Array.isArray(rawRouteBanditId) ? rawRouteBanditId[0] : rawRouteBanditId;

  const propBanditId =
    options?.banditId != null && String(options.banditId).trim() !== ''
      ? String(options.banditId).trim()
      : '';
  const effectiveBanditId =
    propBanditId !== ''
      ? propBanditId
      : routeBanditId && routeBanditId !== 'undefined'
        ? routeBanditId
        : undefined;

  const { selectedCity } = useCity();
  const router = useRouter();
  const seedEvents = readExploreMapSeedEvents(selectedCity ?? undefined, effectiveBanditId);
  const [events, setEvents] = useState<Event[]>(seedEvents);
  const [loading, setLoading] = useState(seedEvents.length === 0);
  const [error, setError] = useState<string | null>(null);
  const hasPaintedEventsRef = useRef(seedEvents.length > 0);

  const fetchEvents = useCallback(async () => {
    try {
      if (!hasPaintedEventsRef.current) setLoading(true);
      setError(null);

      const filters: EventFilters = {};
      if (effectiveBanditId) {
        filters.banditId = effectiveBanditId;
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

      setEvents(allEventsData);
      hasPaintedEventsRef.current = true;
      setLoading(false);
      void enrichEventsForMap(allEventsData).then((enriched) => {
        setEvents(enriched);
      });
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      setLoading(false);
    }
  }, [effectiveBanditId, selectedCity]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const calculateOptimalMapBounds = (initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }): MapBounds => {
    const fallback = {
      latitude: initialRegion.latitude,
      longitude: initialRegion.longitude,
      latitudeDelta: initialRegion.latitudeDelta,
      longitudeDelta: initialRegion.longitudeDelta,
    };
    const { center, zoom } = boundsFromMapEvents(events, fallback);

    const mappable = events
      .map((event) => eventMapCoordinates(event))
      .filter((coords): coords is { lat: number; lng: number } => coords != null);

    if (mappable.length === 0) {
      return {
        center,
        zoom,
        bounds: {
          north: fallback.latitude + fallback.latitudeDelta / 2,
          south: fallback.latitude - fallback.latitudeDelta / 2,
          east: fallback.longitude + fallback.longitudeDelta / 2,
          west: fallback.longitude - fallback.longitudeDelta / 2,
        },
      };
    }

    const lats = mappable.map((c) => c.lat);
    const lngs = mappable.map((c) => c.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latSpan = Math.max(maxLat - minLat, 0.0001);
    const lngSpan = Math.max(maxLng - minLng, 0.0001);
    const padding = 0.1;

    return {
      center,
      zoom,
      bounds: {
        north: maxLat + latSpan * padding,
        south: minLat - latSpan * padding,
        east: maxLng + lngSpan * padding,
        west: minLng - lngSpan * padding,
      },
    };
  };

  const handleEventPress = (event: Event) => {
    if (onEventPress) {
      onEventPress(event);
    } else {
      const url = effectiveBanditId
        ? (`/event/${event.id}?banditId=${effectiveBanditId}` as any)
        : (`/event/${event.id}` as any);
      router.push(url);
    }
  };

  return {
    events,
    loading,
    error,
    banditId: effectiveBanditId ?? '',
    calculateOptimalMapBounds,
    handleEventPress,
    refetchEvents: fetchEvents,
    athensFallback: ATHENS_CENTER,
  };
}
