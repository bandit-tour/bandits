/**
 * Per-photo-reference ban list for verified Google Places photos that we
 * never want surfaced on a card or detail screen — even if they appear in a
 * venue's verified gallery. Use this when a venue's first photo on Google is
 * off-brand for the venue (e.g. a generic burger close-up on a brunch place).
 *
 * Entries are matched by photo reference token (the unique trailing segment
 * after `/photos/` in a Places (New) media URL, or the `photoreference` query
 * parameter in a Legacy Places photo URL). Matching is case-insensitive and
 * resilient to any size / quality parameters added at runtime. Live Places
 * fetches and stored row galleries both pass through `isBannedPhotoUri`, so
 * once a photoref is banned the runtime will pick the next acceptable frame
 * automatically.
 */

export type PhotoBanEntry = {
  photoRef: string;
  venue?: string;
  reason: string;
};

const BANNED_PHOTO_REFS_RAW: PhotoBanEntry[] = [
  // The Brunchers — gallery[0] returned by Google Places is a tight crop of a
  // burger + fries that visually reads as a generic stock food shot and was
  // repeatedly flagged by users as misleading. The venue has 7 other verified
  // photos that better represent the brunch concept.
  {
    photoRef: 'Ab43m-uCg4Bocdy-A4YaKjsyt02FT2LU6qS8x9RZEtlwX5zofm5GfUehOlPtbEhOq',
    venue: 'The Brunchers',
    reason: 'burger-and-fries close-up flagged as off-brand for a brunch venue',
  },
];

const BANNED_PHOTOREFS_LOWER = new Set<string>(
  BANNED_PHOTO_REFS_RAW.map((entry) => entry.photoRef.toLowerCase()),
);

/** True when the canonical identity contains a banned photoref token. */
export function isBannedPhotoIdentity(identity: string | null | undefined): boolean {
  const t = String(identity ?? '').trim().toLowerCase();
  if (!t) return false;
  for (const ref of BANNED_PHOTOREFS_LOWER) {
    if (ref && t.includes(ref)) return true;
  }
  return false;
}

/**
 * True when a raw image URL contains a banned photo reference anywhere. This
 * is the primary check used by the runtime; it handles both Places (New)
 * `/v1/places/{id}/photos/{ref}/media?...` and legacy
 * `?photoreference=<ref>&...` shapes, regardless of case or query params.
 */
export function isBannedPhotoUri(uri: string | null | undefined): boolean {
  const t = String(uri ?? '').trim().toLowerCase();
  if (!t) return false;
  for (const ref of BANNED_PHOTOREFS_LOWER) {
    if (ref && t.includes(ref)) return true;
  }
  return false;
}

export function listBannedPhotos(): readonly PhotoBanEntry[] {
  return BANNED_PHOTO_REFS_RAW;
}
