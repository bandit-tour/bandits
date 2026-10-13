import type { Database } from '@/lib/database.types';
import { eventMapCoordinates } from '@/lib/mapCoordinates';

type Event = Database['public']['Tables']['event']['Row'];

export type MapViewportBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type MapViewportCenter = {
  lat: number;
  lng: number;
  zoom: number;
};

const DESKTOP_SPLIT_MIN_WIDTH = 900;

export function isExploreMapDesktopSplit(width: number): boolean {
  return width >= DESKTOP_SPLIT_MIN_WIDTH;
}

export function eventInMapBounds(event: Event, bounds: MapViewportBounds): boolean {
  const coords = eventMapCoordinates(event);
  if (!coords) return false;
  return (
    coords.lat <= bounds.north &&
    coords.lat >= bounds.south &&
    coords.lng <= bounds.east &&
    coords.lng >= bounds.west
  );
}

export function filterEventsInMapBounds(events: Event[], bounds: MapViewportBounds | null): Event[] {
  if (!bounds) return events;
  return events.filter((e) => eventInMapBounds(e, bounds));
}

/** Significant pan/zoom vs last searched viewport — show "Search this area". */
export function isSignificantMapMove(
  current: MapViewportCenter,
  anchor: MapViewportCenter | null,
): boolean {
  if (!anchor) return false;
  const zoomDelta = Math.abs(current.zoom - anchor.zoom);
  if (zoomDelta >= 1) return true;
  const latDelta = Math.abs(current.lat - anchor.lat);
  const lngDelta = Math.abs(current.lng - anchor.lng);
  const threshold = 0.012 / Math.pow(2, Math.max(0, current.zoom - 13));
  return latDelta > threshold || lngDelta > threshold;
}
