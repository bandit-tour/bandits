/**
 * Shared venue-hero recovery rules for Explore, City Guide, EventCard, map, spot/event detail.
 * Live fresh Places heroes beat stale stored Google `/media` URLs; approved durable heroes win.
 */

import { getSpotDetailHeroUri } from '@/lib/eventVenueGallery';
import { Database } from '@/lib/database.types';
import {
  isDurableVenuePhotoUri,
  isEphemeralPlacesMediaUrl,
  isGooglePlacesDerivedPhotoUrl,
  normalizeEventImageUri,
} from '@/lib/placePhoto';

type Event = Database['public']['Tables']['event']['Row'];

/** Explicitly approved durable heroes (Supabase / workspace / non-Places CDN). */
export function isPreservedApprovedDurableHero(uri: string | null | undefined): boolean {
  const n = normalizeEventImageUri(uri);
  if (!n || !/^https?:\/\//i.test(n)) return false;
  if (isEphemeralPlacesMediaUrl(n) || isGooglePlacesDerivedPhotoUrl(n)) return false;
  return isDurableVenuePhotoUri(n);
}

/** Stored URI that must not be treated as a permanent photograph. */
export function isStaleOrEphemeralVenueHero(uri: string | null | undefined): boolean {
  const n = normalizeEventImageUri(uri);
  if (!n) return true;
  if (isEphemeralPlacesMediaUrl(n)) return true;
  if (isGooglePlacesDerivedPhotoUrl(n)) return true;
  if (!isDurableVenuePhotoUri(n)) return true;
  return false;
}

/** Whether list/detail pipelines should live-refresh Places for this event. */
export function eventNeedsLivePlacesHeroRecovery(
  event: Event,
  opts?: {
    liveUri?: string | null;
    approvedUri?: string | null;
    failedUris?: Record<string, true>;
  },
): boolean {
  const failed = opts?.failedUris ?? {};
  const live = normalizeEventImageUri(opts?.liveUri ?? '');
  if (live && !failed[live]) return false;

  const approved = normalizeEventImageUri(opts?.approvedUri ?? '');
  if (approved && isPreservedApprovedDurableHero(approved) && !failed[approved]) return false;

  const stored = getSpotDetailHeroUri(event);
  if (!stored || failed[stored]) return true;
  return isStaleOrEphemeralVenueHero(stored);
}

/**
 * Final URI selection for list/map surfaces.
 * Priority: live (non-failed) → approved durable → stored durable → null (force recovery).
 * Never keep a failed URI in the selection.
 */
export function selectViewportVenueHeroUri(args: {
  liveUri?: string | null;
  approvedUri?: string | null;
  storedUri?: string | null;
  failedUris?: Record<string, true>;
}): string | null {
  const failed = args.failedUris ?? {};
  const pick = (raw: string | null | undefined, requireDurable: boolean) => {
    const n = normalizeEventImageUri(raw ?? '');
    if (!n || failed[n] || !/^https?:\/\//i.test(n)) return null;
    if (requireDurable && !isPreservedApprovedDurableHero(n) && isStaleOrEphemeralVenueHero(n)) {
      return null;
    }
    return n;
  };

  return (
    pick(args.liveUri, false) ||
    pick(args.approvedUri, true) ||
    pick(args.storedUri, true) ||
    null
  );
}

/** Mark URI failed so subsequent resolution cannot retry the same broken image. */
export function markHeroUriFailed(
  prev: Record<string, true>,
  uri: string | null | undefined,
): Record<string, true> {
  const n = normalizeEventImageUri(uri ?? '') ?? String(uri ?? '').trim();
  if (!n || prev[n]) return prev;
  return { ...prev, [n]: true };
}
