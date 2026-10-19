import { Database } from '@/lib/database.types';
import {
  getManualApprovedHeroUri,
  getManualApprovedVenueGalleryOrdered,
  isVenueHeroManuallyApproved,
} from '@/lib/manualVenueHero';
import { isBannedPhotoUri } from '@/lib/photoBanList';
import {
  isDirectlyLoadableVenuePhotoUri,
  isDurableVenuePhotoUri,
  isEphemeralPlacesMediaUrl,
  isLikelyLogoOrBadPlaceImage,
  isRenderableStoredPlaceMediaUrl,
  normalizeEventImageUri,
} from '@/lib/placePhoto';

type Event = Database['public']['Tables']['event']['Row'];

const BLOCKED_STOCK_HOSTS = [
  'images.pexels.com',
  'pexels.com',
  'images.unsplash.com',
  'unsplash.com',
  'picsum.photos',
];

function isBlockedStockHostUri(uri: string): boolean {
  try {
    const h = new URL(uri).hostname.toLowerCase();
    return BLOCKED_STOCK_HOSTS.some((x) => h === x || h.endsWith(`.${x}`));
  } catch {
    // Relative /storage paths and other non-absolute URIs are not stock hosts.
    return false;
  }
}

function isAcceptableVenuePhotoUri(uri: string): boolean {
  if (!uri.trim()) return false;
  if (isLikelyLogoOrBadPlaceImage(uri)) return false;
  if (isBlockedStockHostUri(uri)) return false;
  if (isBannedPhotoUri(uri)) return false;
  // Stored Places `/media` frames already belong to this row. Show them.
  // Bare photo-resource names (no `/media`) still cannot be used as <img src>.
  if (isRenderableStoredPlaceMediaUrl(uri)) return true;
  if (!isDirectlyLoadableVenuePhotoUri(uri)) return false;
  return true;
}

function parseGalleryJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    }
  } catch {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function pushUri(out: string[], raw: unknown) {
  const n = normalizeEventImageUri(typeof raw === 'string' ? raw : null);
  if (!n || !isAcceptableVenuePhotoUri(n)) return;
  if (!out.includes(n)) out.push(n);
}

/**
 * Collect every known venue photo field from the event row / bandit merge /
 * legacy MVP shapes. Durable workspace URLs are ordered before ephemeral
 * Places `/media` resource URLs so Explore prefers originals that still load.
 */
export function getStoredVenueGalleryOrdered(event: Event): string[] {
  const row = event as Event & Record<string, unknown>;
  const durable: string[] = [];
  const ephemeral: string[] = [];
  const other: string[] = [];

  const push = (raw: unknown) => {
    const tmp: string[] = [];
    pushUri(tmp, raw);
    if (tmp.length === 0) return;
    const n = tmp[0];
    if (durable.includes(n) || ephemeral.includes(n) || other.includes(n)) return;
    if (isDurableVenuePhotoUri(n)) durable.push(n);
    else if (isEphemeralPlacesMediaUrl(n)) ephemeral.push(n);
    else other.push(n);
  };

  // Operator-curated fields first (even before hero_approved_at is set).
  push(row.approved_hero_url);
  for (const u of parseGalleryJson(
    typeof row.approved_gallery === 'string' ? row.approved_gallery : null,
  )) {
    push(u);
  }
  push(row.approved_thumbnail_url);

  /**
   * Canonical venue detail fields next — same order as /spot/[id] gallery.
   * Must precede bandit_event merges so Explore/My Spots/City Guide cards match
   * the venue page hero (Spook, Ergon House, Kick Cafe, etc.).
   */
  for (const u of parseGalleryJson(event.image_gallery)) push(u);
  push(event.image_url);

  // Places / recommendation photos merged from bandit_event — only after row gallery.
  push(row.google_photo_url);
  push(row.bandit_photo_url);
  push(row.recommendation_place_photo_url);

  // Legacy / alternate field names seen in older seeds and workspace exports.
  push(row.hero_url);
  push(row.heroUrl);
  push(row.imageUrl);
  push(row.photo_url);
  push(row.photoUrl);
  push(row.cover_url);
  push(row.coverUrl);
  push(row.thumbnail_url);
  push(row.main_image_url);
  for (const u of parseGalleryJson(typeof row.gallery === 'string' ? row.gallery : null)) push(u);
  for (const u of parseGalleryJson(typeof row.photos === 'string' ? row.photos : null)) push(u);
  for (const u of parseGalleryJson(typeof row.media === 'string' ? row.media : null)) push(u);
  if (Array.isArray(row.photos)) {
    for (const u of row.photos) push(u);
  }
  if (Array.isArray(row.media)) {
    for (const u of row.media) push(u);
  }
  if (Array.isArray(row.gallery)) {
    for (const u of row.gallery) push(u);
  }

  return [...durable, ...other, ...ephemeral].slice(0, 12);
}

/**
 * Venue gallery for list cards + Place pages.
 * Prefer manually approved gallery; otherwise use real stored venue photo URLs.
 * Never invents stock / shopping-cart placeholders.
 */
export function getEventVenueGalleryOrdered(event: Event): string[] {
  if (isVenueHeroManuallyApproved(event)) {
    const approved = getManualApprovedVenueGalleryOrdered(event);
    if (approved.length > 0) return approved;
  }
  return getStoredVenueGalleryOrdered(event);
}

/** True when the row has any mapped photo URL or a google_place_id we can refresh from. */
export function eventHasVenueMediaSource(event: Event): boolean {
  if (getEventVenueGalleryOrdered(event).length > 0) return true;
  const placeId = String((event as { google_place_id?: string | null }).google_place_id ?? '').trim();
  return placeId.length > 0;
}

/**
 * Strip list-time bandit_event merges so card heroes match /spot/[id],
 * which loads the raw `event` row only.
 */
export function eventRowForSpotDetailGallery(event: Event): Event {
  const row = { ...event } as Event & {
    bandit_photo_url?: string | null;
    recommendation_place_photo_url?: string | null;
    google_photo_url?: string | null;
  };
  delete row.bandit_photo_url;
  delete row.recommendation_place_photo_url;
  delete row.google_photo_url;
  return row;
}

/** Sync hero: approved gallery[0], else first real stored venue photo. */
export function getSpotDetailHeroUri(event: Event): string | null {
  if (isVenueHeroManuallyApproved(event)) {
    const approved = getManualApprovedHeroUri(eventRowForSpotDetailGallery(event));
    if (approved) return approved;
  }
  const fromRow = getStoredVenueGalleryOrdered(eventRowForSpotDetailGallery(event))[0] ?? null;
  if (fromRow && isDurableVenuePhotoUri(fromRow) && !isEphemeralPlacesMediaUrl(fromRow)) {
    return fromRow;
  }
  // List-time merges may hold durable Google CDN redirects while image_url is ephemeral /media.
  // Prefer those for viewport resolution — never treat Places /media?key= as permanent.
  const mergeCandidates = [
    (event as { google_photo_url?: string | null }).google_photo_url,
    (event as { recommendation_place_photo_url?: string | null }).recommendation_place_photo_url,
  ];
  for (const raw of mergeCandidates) {
    const n = normalizeEventImageUri(raw ?? '');
    if (
      n &&
      isDurableVenuePhotoUri(n) &&
      !isEphemeralPlacesMediaUrl(n) &&
      /^https?:\/\//i.test(n)
    ) {
      return n;
    }
  }
  return fromRow;
}

/** Resolves hero from stored/approved media; Google live fetch remains optional at call sites. */
export async function resolveSpotDetailHeroUri(event: Event): Promise<string | null> {
  return getSpotDetailHeroUri(event);
}

export async function resolveSpotDetailHeroUrisByEventId(
  events: Event[],
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const event of events) {
    out[event.id] = getSpotDetailHeroUri(event);
  }
  return out;
}

export function pickVenueGalleryHeroUri(event: Event): string | null {
  return getSpotDetailHeroUri(event);
}

export function pickCityGuideHeroUriByEventId(events: Event[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const e of events) {
    out[e.id] = getSpotDetailHeroUri(e);
  }
  return out;
}

export function resolveApprovedHeroUrisByEventId(events: Event[]): Record<string, string | null> {
  return pickCityGuideHeroUriByEventId(events);
}

export { isVenueHeroManuallyApproved };
