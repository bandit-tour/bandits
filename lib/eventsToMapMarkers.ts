import type { Database } from '@/lib/database.types';
import { eventMapCoordinates } from '@/lib/mapCoordinates';

type Event = Database['public']['Tables']['event']['Row'];

export type MapMarkerRow = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
  genre: string;
};

const COORD_KEY_PRECISION = 4;
/** ~25m spiral steps so stacked venues separate visually on the map. */
const JITTER_STEP_LAT = 0.00022;
const JITTER_STEP_LNG = 0.00028;

function coordBucketKey(lat: number, lng: number): string {
  return `${lat.toFixed(COORD_KEY_PRECISION)}:${lng.toFixed(COORD_KEY_PRECISION)}`;
}

function jitterOffset(index: number): { dLat: number; dLng: number } {
  if (index <= 0) return { dLat: 0, dLng: 0 };
  const ring = Math.ceil(index / 6);
  const slot = (index - 1) % 6;
  const angle = (Math.PI / 3) * slot;
  return {
    dLat: Math.sin(angle) * JITTER_STEP_LAT * ring,
    dLng: Math.cos(angle) * JITTER_STEP_LNG * ring,
  };
}

export function eventsToMapMarkers(events: Event[]): MapMarkerRow[] {
  const bucketCounts = new Map<string, number>();
  const out: MapMarkerRow[] = [];

  for (const event of events) {
    const coords = eventMapCoordinates(event);
    if (!coords) continue;

    const key = coordBucketKey(coords.lat, coords.lng);
    const index = bucketCounts.get(key) ?? 0;
    bucketCounts.set(key, index + 1);
    const { dLat, dLng } = jitterOffset(index);

    out.push({
      id: event.id,
      lat: coords.lat + dLat,
      lng: coords.lng + dLng,
      name: String(event.name ?? ''),
      address: String(event.address ?? ''),
      genre: String(event.genre ?? ''),
    });
  }
  return out;
}
