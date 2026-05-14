import { Database } from '@/lib/database.types';
import { isBannedPhotoUri } from '@/lib/photoBanList';
import { isGooglePlacesDerivedPhotoUrl, isLikelyLogoOrBadPlaceImage, normalizeEventImageUri } from '@/lib/placePhoto';

type Event = Database['public']['Tables']['event']['Row'];

/** Runtime merge from `bandit_event.recommendation_place_photo_url` (see `getEvents`). */
type EventWithBanditPhoto = Event & { bandit_photo_url?: string | null; recommendation_place_photo_url?: string | null };

const BLOCKED_HOSTS = ['images.pexels.com', 'pexels.com', 'images.unsplash.com', 'unsplash.com', 'picsum.photos'];

function isBlockedStockHostUri(uri: string): boolean {
  try {
    const h = new URL(uri).hostname.toLowerCase();
    return BLOCKED_HOSTS.some((x) => h === x || h.endsWith(`.${x}`));
  } catch {
    return true;
  }
}

/** Verified venue media: Google Places (New/Legacy + approved hosts) only. No stock pools, no Wikimedia editorials — those bypassed Places and diverged from /spot/[id]. */
function isVenueTrustedGalleryPhotoUri(uri: string): boolean {
  if (!uri.trim()) return false;
  if (isLikelyLogoOrBadPlaceImage(uri)) return false;
  if (isBlockedStockHostUri(uri)) return false;
  // Per-photo ban list: specific frames known to be off-brand for a venue
  // (e.g. a generic burger close-up on a brunch place) are skipped even though
  // they pass all other trust checks. The next acceptable photo in the gallery
  // becomes the hero automatically.
  if (isBannedPhotoUri(uri)) return false;
  return isGooglePlacesDerivedPhotoUrl(uri);
}

/**
 * Venue-owned gallery ordering: JSON / CSV `image_gallery` first (in order), then `image_url`.
 * Matches City Guide requirement: card hero = gallery[0] when present on the row.
 *
 * Trusted sources: Google Places–derived URLs stored on the row. Pexels/Unsplash/etc. stripped; non-Places URLs ignored so City Guide falls back to the same Places fetch as spot detail.
 */
export function getEventVenueGalleryOrdered(event: Event): string[] {
  const out: string[] = [];

  const push = (raw: string) => {
    const n = normalizeEventImageUri(raw);
    if (!n || !isVenueTrustedGalleryPhotoUri(n)) return;
    if (!out.includes(n)) out.push(n);
  };

  const ev = event as EventWithBanditPhoto;
  const banditPhoto =
    typeof ev.bandit_photo_url === 'string' ? String(ev.bandit_photo_url).trim() : '';
  const recoPhoto =
    typeof ev.recommendation_place_photo_url === 'string'
      ? String(ev.recommendation_place_photo_url).trim()
      : '';
  const linkPhoto = banditPhoto || recoPhoto;
  if (linkPhoto) push(linkPhoto);

  const raw = event.image_gallery;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const v of parsed) {
          if (typeof v === 'string' && v.trim()) push(v.trim());
        }
      }
    } catch {
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => push(s));
    }
  }

  if (event.image_url?.trim()) push(event.image_url.trim());

  return out.slice(0, 12);
}

/** First trusted gallery frame (same ordering as spot detail / City Guide). */
export function pickVenueGalleryHeroUri(event: Event): string | null {
  return getEventVenueGalleryOrdered(event)[0] ?? null;
}

/** City Guide heroes: strictly `gallery[0]` per venue row — no cross-venue pooling. */
export function pickCityGuideHeroUriByEventId(events: Event[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const e of events) {
    out[e.id] = pickVenueGalleryHeroUri(e);
  }
  return out;
}
