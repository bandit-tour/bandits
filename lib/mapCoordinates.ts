import type { Database } from '@/lib/database.types';

type EventRow = Database['public']['Tables']['event']['Row'];

export const ATHENS_CENTER = {
  latitude: 37.9838,
  longitude: 23.7275,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
} as const;

/** Rough bounding box for mainland Greece + islands (Athens city guide scope). */
const GREECE_LAT_MIN = 34.5;
const GREECE_LAT_MAX = 42;
const GREECE_LNG_MIN = 19;
const GREECE_LNG_MAX = 30;

export function parseFiniteCoord(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function inGreeceBounds(lat: number, lng: number): boolean {
  return (
    lat >= GREECE_LAT_MIN &&
    lat <= GREECE_LAT_MAX &&
    lng >= GREECE_LNG_MIN &&
    lng <= GREECE_LNG_MAX
  );
}

/**
 * Normalize event coordinates for map rendering.
 * Fixes the common Athens bug where lat/lng are stored swapped (map centers on sea).
 */
export function eventMapCoordinates(
  event: Pick<EventRow, 'location_lat' | 'location_lng'>,
): { lat: number; lng: number } | null {
  const rawLat = parseFiniteCoord(event.location_lat);
  const rawLng = parseFiniteCoord(event.location_lng);
  if (rawLat == null || rawLng == null) return null;
  if (rawLat === 0 && rawLng === 0) return null;

  if (inGreeceBounds(rawLat, rawLng)) {
    return { lat: rawLat, lng: rawLng };
  }
  if (inGreeceBounds(rawLng, rawLat)) {
    return { lat: rawLng, lng: rawLat };
  }
  return null;
}

export function eventsWithMapCoordinates<T extends Pick<EventRow, 'location_lat' | 'location_lng'>>(
  events: T[],
): Array<T & { mapLat: number; mapLng: number }> {
  const out: Array<T & { mapLat: number; mapLng: number }> = [];
  for (const event of events) {
    const coords = eventMapCoordinates(event);
    if (coords) {
      out.push({ ...event, mapLat: coords.lat, mapLng: coords.lng });
    }
  }
  return out;
}

export type MapBoundsInput = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export function boundsFromMapEvents(
  events: Pick<EventRow, 'location_lat' | 'location_lng'>[],
  fallback: MapBoundsInput = ATHENS_CENTER,
  miniMode = false,
): { center: { latitude: number; longitude: number }; zoom: number } {
  const mappable = eventsWithMapCoordinates(events);
  if (mappable.length === 0) {
    return { center: { latitude: fallback.latitude, longitude: fallback.longitude }, zoom: miniMode ? 12 : 13 };
  }

  /** Prefer central Athens/Attica picks for framing so one distant outlier does not zoom the map to sea-level. */
  const atticaCore = mappable.filter(
    (e) => e.mapLat >= 37.65 && e.mapLat <= 38.25 && e.mapLng >= 23.45 && e.mapLng <= 24.05,
  );
  const forBounds = atticaCore.length >= 2 ? atticaCore : mappable;

  const lats = forBounds.map((e) => e.mapLat);
  const lngs = forBounds.map((e) => e.mapLng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const paddedLatSpan = latSpan * (miniMode ? 1.5 : 1.2);

  let zoom = miniMode ? 13 : 14;
  if (paddedLatSpan > 0.1) zoom = 10;
  else if (paddedLatSpan > 0.05) zoom = 11;
  else if (paddedLatSpan > 0.02) zoom = miniMode ? 11 : 12;
  else if (paddedLatSpan > 0.01) zoom = miniMode ? 12 : 13;
  else if (paddedLatSpan > 0.005) zoom = miniMode ? 13 : 14;
  else zoom = miniMode ? 14 : 15;
  if (mappable.length === 1) zoom = miniMode ? 14 : Math.min(15, zoom + 1);

  return {
    center: { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2 },
    zoom,
  };
}
