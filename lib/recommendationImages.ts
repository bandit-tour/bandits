import { Database } from '@/lib/database.types';
import { pickVenueGalleryHeroUri } from '@/lib/eventVenueGallery';
import { isBannedPhotoIdentity, isBannedPhotoUri } from '@/lib/photoBanList';
import {
  resolveGooglePlaceBusinessData,
  isGooglePlacesDerivedPhotoUrl,
  isLikelyLogoOrBadPlaceImage,
  normalizeEventImageUri,
  getCategoryImagePoolUrls,
  getCategoryFallbackImage,
  hashPickIndex,
} from '@/lib/placePhoto';

type Event = Database['public']['Tables']['event']['Row'];
const BUSINESS_IMAGE_CACHE = new Map<string, string>();
/** First consumer wins per Places media/ref identity; reuse only when google_place_key matches owner. */
const HERO_PHOTO_CLAIMS = new Map<string, { eventId: string; placeKey: string }>();
const STOCK_IMAGE_HOSTS = ['images.pexels.com', 'pexels.com', 'images.unsplash.com', 'unsplash.com', 'picsum.photos'];

/**
 * Module-level memoization of the *entire* strict resolver result, keyed by a
 * signature of the input event list (event ids + per-event `google_place_id`).
 *
 * The previous behavior re-fanned-out `Promise.all(events.map(resolveGooglePlaceBusinessData))`
 * on every screen focus / tab switch, even when the same list had been resolved
 * seconds earlier. For lists of 10-20 events this issued 10-20 Places API
 * requests every time the user navigated back and forth — visibly slow on
 * mobile.
 *
 * With the signature cache:
 *   - first call: live fetch, result stored as a Promise (so concurrent callers
 *     awaiting the same signature share the in-flight Promise instead of
 *     racing).
 *   - subsequent calls with the same signature: resolved Promise reused
 *     synchronously, no network.
 *   - signature differs: live fetch (different event set, different ordering,
 *     or a row's `google_place_id` was backfilled in the meantime).
 *
 * Entries are kept up to `STRICT_PIPELINE_TTL_MS` so newly backfilled photos
 * surface within ~5 minutes without requiring a hard refresh.
 */
const STRICT_PIPELINE_TTL_MS = 5 * 60 * 1000;
type StrictPipelineEntry = {
  signature: string;
  expiresAt: number;
  promise: Promise<Record<string, string | null>>;
};
const STRICT_PIPELINE_CACHE = new Map<string, StrictPipelineEntry>();

function buildStrictPipelineSignature(events: Event[]): string {
  // Stable: same set of (event.id, google_place_id) → same signature.
  // Order-insensitive so a re-sorted list still hits the cache.
  const parts: string[] = [];
  for (const e of events) {
    const pid = String((e as any).google_place_id ?? '').toLowerCase();
    parts.push(`${e.id}:${pid}`);
  }
  parts.sort();
  return parts.join('|');
}

/** Force the strict-pipeline cache to drop one or all entries. */
export function invalidateStrictRecommendationImagesCache(signature?: string): void {
  if (signature) STRICT_PIPELINE_CACHE.delete(signature);
  else STRICT_PIPELINE_CACHE.clear();
}

function isStockHostUri(uri: string): boolean {
  try {
    const host = new URL(uri).hostname.toLowerCase();
    return STOCK_IMAGE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function canonicalRecommendationImageIdentity(src: string): string {
  try {
    const u = new URL(src);
    const host = u.hostname.toLowerCase();
    const p = u.pathname;
    if (host.includes('maps.googleapis.com') && p.includes('/photo')) {
      return `google-photo:${u.searchParams.get('photoreference') ?? ''}`;
    }
    if (host.includes('places.googleapis.com') && p.includes('/media')) {
      return `places-new-media:${p}`.toLowerCase();
    }
    if (
      host.includes('pexels.com') ||
      host.includes('unsplash.com') ||
      host.includes('supabase.co') ||
      host.includes('googleusercontent.com')
    ) {
      return `${host}${p}`.toLowerCase();
    }
    return `${host}${p}${u.search}`.toLowerCase();
  } catch {
    return src.trim().toLowerCase();
  }
}

function businessKey(event: Event): string {
  const placeId = String((event as any).google_place_id ?? '').trim();
  if (placeId) return `place:${placeId}`;
  const name = String(event.name ?? '').trim().toLowerCase();
  const addr = String(event.address ?? '').trim().toLowerCase();
  return `name:${name}|addr:${addr}|event:${event.id}`;
}

function venueSignature(event: Event): string {
  const name = String(event.name ?? '').trim().toLowerCase();
  const addr = String(event.address ?? '').trim().toLowerCase();
  const city = String(event.city ?? '').trim().toLowerCase();
  return `${name}|${addr}|${city}`;
}

function normalizePlaceId(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/^places\//i, '')
    .toLowerCase();
}

export function getPlacesMediaPlaceIdFromUrl(uri: string): string | null {
  try {
    const u = new URL(uri);
    const host = u.hostname.toLowerCase();
    const path = u.pathname;
    if (!host.includes('places.googleapis.com') || !path.includes('/media')) return null;
    const m = path.match(/\/v1\/places\/([^/]+)\/photos\//i);
    return m?.[1] ? normalizePlaceId(decodeURIComponent(m[1])) : null;
  } catch {
    return null;
  }
}

/** Same physical place ↔ same normalized key when both IDs are known. */
export function normalizedPlaceClaimKey(
  googlePlaceId?: string | null,
  embeddedUrlPlaceId?: string | null,
): string {
  const a = normalizePlaceId(googlePlaceId ?? '');
  const b = normalizePlaceId(embeddedUrlPlaceId ?? '');
  return a || b || '__none__';
}

/** Session-wide guard: unrelated venues must not reuse the same Google photo URL. */
export function claimVerifiedHeroPhotoUrl(
  uri: string | null | undefined,
  meta: { eventId: string; googlePlaceId?: string | null },
): string | null {
  const raw = normalizeEventImageUri(uri);
  if (!raw || !isGooglePlacesDerivedPhotoUrl(raw)) return null;
  // Hard ban list: specific frames flagged as off-brand for any venue.
  if (isBannedPhotoUri(raw)) return null;
  const idKey = canonicalRecommendationImageIdentity(raw);
  if (!idKey) return null;
  if (isBannedPhotoIdentity(idKey)) return null;
  const urlPid = getPlacesMediaPlaceIdFromUrl(raw);
  const placeKey = normalizedPlaceClaimKey(meta.googlePlaceId, urlPid);
  const owner = HERO_PHOTO_CLAIMS.get(idKey);
  if (owner) {
    if (owner.eventId === meta.eventId) return raw;
    if (placeKey !== '__none__' && owner.placeKey === placeKey) return raw;
    return null;
  }
  HERO_PHOTO_CLAIMS.set(idKey, { eventId: meta.eventId, placeKey });
  return raw;
}

/**
 * Stored URLs must encode the same Places (New) place id we read from Postgres.
 * Rows without google_place_id cannot prove a hero URL belongs to them.
 */
function isStoredUrlTrustedForEvent(event: Event, uri: string): boolean {
  const eventPlaceId = normalizePlaceId((event as any).google_place_id);
  if (!eventPlaceId) return false;
  const urlPlaceId = getPlacesMediaPlaceIdFromUrl(uri);
  if (!urlPlaceId) return false;
  return urlPlaceId === eventPlaceId;
}

function storedHeroMatchesVerifiedPlace(uri: string, verifiedPlaceId: string): boolean {
  const vid = normalizePlaceId(verifiedPlaceId);
  if (!vid) return false;
  const urlPid = getPlacesMediaPlaceIdFromUrl(uri);
  return Boolean(urlPid && urlPid === vid);
}

/** Supported venue categories for the neutral placeholder palette. */
export type VenueCategoryKey = 'food' | 'nightlife' | 'culture' | 'shopping' | 'coffee' | 'generic';

type CategoryTheme = {
  key: VenueCategoryKey;
  label: string;
  icon: string;
  bg1: string;
  bg2: string;
  fg: string;
  accent: string;
};

const CATEGORY_THEMES: Record<VenueCategoryKey, CategoryTheme> = {
  food: {
    key: 'food',
    label: 'Food',
    icon: '🍽',
    bg1: 'hsl(18, 38%, 94%)',
    bg2: 'hsl(14, 30%, 84%)',
    fg: 'hsl(14, 38%, 22%)',
    accent: 'hsl(14, 60%, 46%)',
  },
  nightlife: {
    key: 'nightlife',
    label: 'Nightlife',
    icon: '🌙',
    bg1: 'hsl(258, 34%, 94%)',
    bg2: 'hsl(258, 28%, 82%)',
    fg: 'hsl(258, 40%, 22%)',
    accent: 'hsl(280, 56%, 50%)',
  },
  culture: {
    key: 'culture',
    label: 'Culture',
    icon: '🏛',
    bg1: 'hsl(40, 36%, 94%)',
    bg2: 'hsl(38, 28%, 84%)',
    fg: 'hsl(34, 32%, 22%)',
    accent: 'hsl(34, 52%, 44%)',
  },
  shopping: {
    key: 'shopping',
    label: 'Shopping',
    icon: '🛍',
    bg1: 'hsl(330, 32%, 94%)',
    bg2: 'hsl(330, 26%, 84%)',
    fg: 'hsl(330, 34%, 22%)',
    accent: 'hsl(330, 56%, 48%)',
  },
  coffee: {
    key: 'coffee',
    label: 'Coffee',
    icon: '☕',
    bg1: 'hsl(28, 30%, 94%)',
    bg2: 'hsl(28, 24%, 82%)',
    fg: 'hsl(28, 36%, 22%)',
    accent: 'hsl(28, 50%, 38%)',
  },
  generic: {
    key: 'generic',
    label: 'Local place',
    icon: '📍',
    bg1: 'hsl(210, 14%, 94%)',
    bg2: 'hsl(210, 12%, 84%)',
    fg: 'hsl(215, 16%, 22%)',
    accent: 'hsl(215, 24%, 40%)',
  },
};

export function normalizeVenueCategoryKey(raw: string | null | undefined): VenueCategoryKey {
  const t = String(raw ?? '').trim().toLowerCase();
  if (!t) return 'generic';
  if (t.includes('food') || t.includes('restaurant') || t.includes('eat') || t.includes('brunch') || t.includes('bakery')) return 'food';
  if (t.includes('coffee') || t.includes('café') || t.includes('cafe')) return 'coffee';
  if (t.includes('night') || t.includes('bar') || t.includes('club') || t.includes('cocktail') || t.includes('comedy') || t.includes('drag') || t.includes('queer')) return 'nightlife';
  if (t.includes('shop') || t.includes('store') || t.includes('market') || t.includes('flea') || t.includes('boutique')) return 'shopping';
  if (t.includes('culture') || t.includes('museum') || t.includes('gallery') || t.includes('cinema') || t.includes('theatre') || t.includes('theater') || t.includes('art') || t.includes('exhib')) return 'culture';
  return 'generic';
}

function escapeXmlText(raw: string): string {
  return String(raw ?? '').replace(/[<>&"']/g, (ch) => {
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '&') return '&amp;';
    if (ch === '"') return '&quot;';
    return '&apos;';
  });
}

function deriveInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'LP').slice(0, 2);
}

function buildCategoryPlaceholderSvg(theme: CategoryTheme, name: string): string {
  const safeName = escapeXmlText(name);
  const safeLabel = escapeXmlText(theme.label.toUpperCase());
  const initials = escapeXmlText(deriveInitials(name));
  return `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='900' viewBox='0 0 1200 900'>`
    + `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>`
    + `<stop offset='0%' stop-color='${theme.bg1}'/>`
    + `<stop offset='100%' stop-color='${theme.bg2}'/>`
    + `</linearGradient></defs>`
    + `<rect width='1200' height='900' fill='url(#g)'/>`
    + `<circle cx='600' cy='340' r='130' fill='rgba(255,255,255,0.78)'/>`
    + `<text x='600' y='372' text-anchor='middle' font-family='-apple-system,Segoe UI,Roboto,Arial,sans-serif' font-size='96' font-weight='700' fill='${theme.fg}'>${initials}</text>`
    + `<text x='600' y='508' text-anchor='middle' font-family='-apple-system,Segoe UI,Roboto,Arial,sans-serif' font-size='28' font-weight='700' fill='${theme.accent}' letter-spacing='4'>${safeLabel}</text>`
    + `<text x='600' y='572' text-anchor='middle' font-family='-apple-system,Segoe UI,Roboto,Arial,sans-serif' font-size='40' font-weight='600' fill='${theme.fg}'>${safeName}</text>`
    + `<text x='600' y='638' text-anchor='middle' font-family='-apple-system,Segoe UI,Roboto,Arial,sans-serif' font-size='24' font-weight='500' fill='${theme.fg}' opacity='0.74'>Image pending verification</text>`
    + `</svg>`;
}

/** Category-aware neutral placeholder. Never returns a third-party stock URL. */
export function buildCategoryNeutralPlaceholder(
  nameRaw: string,
  category: string | null | undefined,
  _seed?: string,
): string {
  const name = String(nameRaw ?? '').trim() || 'Local place';
  const key = normalizeVenueCategoryKey(category);
  const theme = CATEGORY_THEMES[key];
  const svg = buildCategoryPlaceholderSvg(theme, name);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Backward-compatible neutral placeholder. We retain the seed argument so existing
 * callers (per-event uniqueness) keep working, but the visual is now category-aware
 * with a neutral, non-stock SVG. The seed is no longer used to vary hue — the
 * category does, and we want the same venue/category to render identically.
 */
export function buildNeutralBusinessPlaceholderFromSeed(nameRaw: string, seed: string): string {
  return getCategoryFallbackImage(null, seed);
}

/** Internal QA placeholder — must never be shown in production UI. */
export function isInternalNeutralPlaceholderUri(uri: string | null | undefined): boolean {
  return String(uri ?? '').trim().startsWith('data:image/svg+xml');
}

/**
 * User-facing last-resort: curated category stock photo (stable per venue via seed).
 * Replaces "Image pending verification" SVG placeholders in all list surfaces.
 */
export function buildUserFacingVenueFallbackImage(
  event: Event,
  seedOverride?: string,
): string {
  const category = (event as any)?.genre ?? (event as any)?.category ?? null;
  const pool = getCategoryImagePoolUrls(category);
  const seed = seedOverride ?? businessKey(event);
  if (pool.length === 0) return getCategoryImagePoolUrls('generic')[0] ?? '';
  return pool[hashPickIndex(seed, pool.length)] ?? pool[0];
}

/** @deprecated Internal only — use `buildUserFacingVenueFallbackImage` in UI. */
export function buildNeutralBusinessPlaceholder(event: Event): string {
  return buildUserFacingVenueFallbackImage(event);
}

function isUserFacingStoredHeroUri(uri: string): boolean {
  if (isLikelyLogoOrBadPlaceImage(uri)) return false;
  if (isBannedPhotoUri(uri)) return false;
  if (isStockHostUri(uri)) return false;
  return true;
}

function getStoredImageCandidatesBroad(event: Event): string[] {
  const out: string[] = [];
  const add = (raw: string | null | undefined) => {
    const n = normalizeEventImageUri(raw);
    if (!n || !isUserFacingStoredHeroUri(n)) return;
    if (!out.includes(n)) out.push(n);
  };
  const ev = event as Record<string, unknown>;
  add(typeof ev.google_photo_url === 'string' ? ev.google_photo_url : null);
  add(typeof ev.bandit_photo_url === 'string' ? ev.bandit_photo_url : null);
  add(typeof ev.recommendation_place_photo_url === 'string' ? ev.recommendation_place_photo_url : null);
  if (event.image_gallery) {
    try {
      const parsed = JSON.parse(event.image_gallery);
      if (Array.isArray(parsed)) {
        parsed.forEach((u: unknown) => typeof u === 'string' && add(u));
      }
    } catch {
      event.image_gallery.split(',').forEach((u) => add(u.trim()));
    }
  }
  add(event.image_url);
  return out;
}

/** DB-backed hero for user UI: Supabase, Wikimedia, Google Places — not stale stock hosts. */
export function pickUserFacingStoredHeroUrl(event: Event): string | null {
  const candidates = getStoredImageCandidatesBroad(event);
  return candidates[0] ?? null;
}

function getDbImageCandidates(event: Event): string[] {
  const out: string[] = [];
  const add = (raw: string | null | undefined) => {
    const n = normalizeEventImageUri(raw);
    if (!n || isLikelyLogoOrBadPlaceImage(n)) return;
    // Do not treat stock-host image URLs as business-primary recommendation images.
    if (isStockHostUri(n)) return;
    // Per-photo ban list: skip frames explicitly flagged as off-brand.
    if (isBannedPhotoUri(n)) return;
    if (!isGooglePlacesDerivedPhotoUrl(n)) return;
    if (!out.includes(n)) out.push(n);
  };
  if (event.image_gallery) {
    try {
      const parsed = JSON.parse(event.image_gallery);
      if (Array.isArray(parsed)) {
        parsed.forEach((u: unknown) => typeof u === 'string' && add(u));
      }
    } catch {
      event.image_gallery.split(',').forEach((u) => add(u.trim()));
    }
  }
  add(event.image_url);
  return out;
}

/**
 * DB-backed hero only (no live Places fetch). Matches spot detail expectations:
 * google_photo_url → bandit_photo_url / recommendation_place_photo_url → image_url → first curated gallery URL.
 */
export function pickStoredRecommendationHeroUrl(event: Event): string | null {
  const ev = event as Record<string, unknown>;
  const tryRaw = (raw: unknown): string | null => {
    const n = normalizeEventImageUri(typeof raw === 'string' ? raw : null);
    if (!n || isLikelyLogoOrBadPlaceImage(n)) return null;
    if (isStockHostUri(n)) return null;
    if (isBannedPhotoUri(n)) return null;
    if (!isGooglePlacesDerivedPhotoUrl(n)) return null;
    return n;
  };

  const banditPhoto = ev.bandit_photo_url ?? ev.recommendation_place_photo_url;
  for (const raw of [ev.google_photo_url, banditPhoto, ev.image_url]) {
    const ok = tryRaw(raw);
    if (ok) return ok;
  }
  const db = getDbImageCandidates(event);
  return db[0] ?? null;
}

export async function resolveStrictRecommendationImagesByEventId(
  events: Event[],
): Promise<Record<string, string | null>> {
  // Signature-keyed memoization: same list shape → reuse last in-flight or
  // resolved Promise. See `STRICT_PIPELINE_CACHE` for rationale and TTL.
  const signature = buildStrictPipelineSignature(events);
  const now = Date.now();
  const cached = STRICT_PIPELINE_CACHE.get(signature);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }
  if (cached) STRICT_PIPELINE_CACHE.delete(signature);

  const live = resolveStrictRecommendationImagesByEventIdUncached(events);
  STRICT_PIPELINE_CACHE.set(signature, {
    signature,
    expiresAt: now + STRICT_PIPELINE_TTL_MS,
    promise: live,
  });
  // If the live fetch rejects, drop the cache so the next caller can retry.
  live.catch(() => {
    const entry = STRICT_PIPELINE_CACHE.get(signature);
    if (entry && entry.promise === live) STRICT_PIPELINE_CACHE.delete(signature);
  });
  return live;
}

async function resolveStrictRecommendationImagesByEventIdUncached(
  events: Event[],
): Promise<Record<string, string | null>> {
  try {
    const usedImageToPlaceId = new Map<string, string>();
    const usedPlaceIdToVenueSignature = new Map<string, string>();
    const out: Record<string, string | null> = {};
    const placeCandidatesByEventId = new Map<string, { placeId: string | null; urls: string[] }>();

    await Promise.all(
      events.map(async (event) => {
        try {
          const resolved = await resolveGooglePlaceBusinessData({
            placeId: (event as any).google_place_id ?? null,
            name: String(event.name ?? ''),
            address: String(event.address ?? ''),
            city: String(event.city ?? ''),
            neighborhood: String(event.neighborhood ?? ''),
            photoLimit: 8,
          });
          placeCandidatesByEventId.set(
            event.id,
            {
              placeId: String(resolved?.placeId ?? '').trim() || null,
              urls: (resolved?.photoUrls ?? []).filter(
                (u) => Boolean(u) && !isLikelyLogoOrBadPlaceImage(u) && !isBannedPhotoUri(u),
              ),
            },
          );
        } catch {
          placeCandidatesByEventId.set(event.id, { placeId: null, urls: [] });
        }
      }),
    );

    for (const event of events) {
      let picked: string | null = null;
      const key = businessKey(event);
      const storedHero = pickStoredRecommendationHeroUrl(event);
      const resolved = placeCandidatesByEventId.get(event.id) ?? { placeId: null, urls: [] };
      // Only Places pipeline output counts as verified — never trust legacy event.google_place_id alone.
      const verifiedPlaceId = normalizePlaceId(resolved.placeId || '');
      const currentVenueSignature = venueSignature(event);

      const venueGalleryHero = pickVenueGalleryHeroUri(event);
      const cached = BUSINESS_IMAGE_CACHE.get(key);
      const safeCached =
        cached &&
        !isStockHostUri(cached) &&
        !isLikelyLogoOrBadPlaceImage(cached) &&
        isGooglePlacesDerivedPhotoUrl(cached)
          ? cached
          : null;
      if (cached && !safeCached) BUSINESS_IMAGE_CACHE.delete(key);

      const trustedStoredHero =
        verifiedPlaceId &&
        storedHero &&
        isStoredUrlTrustedForEvent(event, storedHero) &&
        storedHeroMatchesVerifiedPlace(storedHero, verifiedPlaceId)
          ? storedHero
          : null;

      const trustedRowGoogleHero =
        venueGalleryHero &&
        isGooglePlacesDerivedPhotoUrl(venueGalleryHero) &&
        verifiedPlaceId &&
        storedHeroMatchesVerifiedPlace(venueGalleryHero, verifiedPlaceId)
          ? venueGalleryHero
          : null;

      const orderedCandidates: Array<{ uri: string; source: 'live' | 'cache' | 'stored' | 'rowgallery' | 'storedany' }> = [];
      if (trustedRowGoogleHero) {
        orderedCandidates.push({ uri: trustedRowGoogleHero, source: 'rowgallery' });
      }
      const storedAny = pickUserFacingStoredHeroUrl(event);
      if (storedAny) {
        orderedCandidates.push({ uri: storedAny, source: 'storedany' });
      }
      if (safeCached && verifiedPlaceId && storedHeroMatchesVerifiedPlace(safeCached, verifiedPlaceId)) {
        orderedCandidates.push({ uri: safeCached, source: 'cache' });
      }
      for (const uri of resolved.urls) orderedCandidates.push({ uri, source: 'live' });
      if (trustedStoredHero) orderedCandidates.push({ uri: trustedStoredHero, source: 'stored' });

      // GALLERY-FIRST GUARANTEE (per global image policy):
      //   "If a venue has a photo gallery in its detail page, the cover image
      //    on the listing card must always be taken from that gallery."
      // When the live Places fetch fails (verifiedPlaceId is empty) but the
      // row already has a Google-Places gallery whose URL embeds the row's
      // google_place_id, trust the stored gallery as a cover. That's the same
      // image that's already on the detail page — using it on the card is
      // strictly better than degrading to a neutral placeholder.
      if (!verifiedPlaceId) {
        const rowPlaceId = normalizePlaceId((event as any).google_place_id);
        const galleryHero = venueGalleryHero;
        if (
          rowPlaceId &&
          galleryHero &&
          isGooglePlacesDerivedPhotoUrl(galleryHero) &&
          !isBannedPhotoUri(galleryHero) &&
          storedHeroMatchesVerifiedPlace(galleryHero, rowPlaceId)
        ) {
          out[event.id] = galleryHero;
          continue;
        }
        const storedAny = pickUserFacingStoredHeroUrl(event);
        if (storedAny) {
          out[event.id] = storedAny;
          continue;
        }
        out[event.id] = buildUserFacingVenueFallbackImage(event);
        continue;
      }

      for (const candidate of orderedCandidates) {
        const uri = candidate.uri;
        if (!uri || isLikelyLogoOrBadPlaceImage(uri)) continue;
        if (isBannedPhotoUri(uri)) continue;
        if (candidate.source !== 'live' && candidate.source !== 'storedany' && !storedHeroMatchesVerifiedPlace(uri, verifiedPlaceId)) continue;
        if (candidate.source === 'stored' && !isStoredUrlTrustedForEvent(event, uri)) continue;
        const imageId = canonicalRecommendationImageIdentity(uri);
        if (!imageId) continue;
        if (isBannedPhotoIdentity(imageId)) continue;

        const prevVenueSignature = usedPlaceIdToVenueSignature.get(verifiedPlaceId);
        if (prevVenueSignature && prevVenueSignature !== currentVenueSignature) continue;

        const prevPlaceId = usedImageToPlaceId.get(imageId);
        if (prevPlaceId) {
          if (prevPlaceId !== verifiedPlaceId) continue;
        } else {
          usedImageToPlaceId.set(imageId, verifiedPlaceId);
        }
        usedPlaceIdToVenueSignature.set(verifiedPlaceId, currentVenueSignature);
        picked = uri;
        break;
      }

      if (picked) BUSINESS_IMAGE_CACHE.set(key, picked);
      out[event.id] = picked ?? buildUserFacingVenueFallbackImage(event);
    }

    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[recommendationImages] resolveStrictRecommendationImagesByEventId failed', msg);
    const fallback: Record<string, string | null> = {};
    for (const event of events) {
      fallback[event.id] = buildUserFacingVenueFallbackImage(event);
    }
    return fallback;
  }
}

function shareKeyForRecommendationDuplicate(ev: Event): string {
  const p = normalizePlaceId((ev as any).google_place_id);
  return p ? `place:${p}` : `solo:${ev.id}`;
}

/** Collapse illegitimate duplicates to row placeholders; duplicates under one google_place_id may stay. */
export function enforceUniqueRecommendationImagesByEventId(
  events: Event[],
  sourceByEventId: Record<string, string | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const event of events) {
    const raw = sourceByEventId[event.id] ?? null;
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    const normalized = trimmed ? normalizeEventImageUri(trimmed) : null;
    if (!normalized || isLikelyLogoOrBadPlaceImage(normalized)) {
      out[event.id] = buildUserFacingVenueFallbackImage(event);
      continue;
    }
    if (!isGooglePlacesDerivedPhotoUrl(normalized)) {
      out[event.id] = normalized;
      continue;
    }
    out[event.id] = normalized;
  }

  const byCanon = new Map<string, Event[]>();
  for (const event of events) {
    const src = out[event.id];
    if (!src || !isGooglePlacesDerivedPhotoUrl(src)) continue;
    const c = canonicalRecommendationImageIdentity(src);
    if (!c) continue;
    const arr = byCanon.get(c) ?? [];
    arr.push(event);
    byCanon.set(c, arr);
  }

  for (const group of byCanon.values()) {
    if (group.length <= 1) continue;
    const placeKeys = new Set(group.map((ev) => shareKeyForRecommendationDuplicate(ev)));
    if (placeKeys.size <= 1) continue;
    for (const ev of group) {
      out[ev.id] = buildUserFacingVenueFallbackImage(ev, `${ev.id}:dedupe:${c}`);
    }
  }

  const sharedHttpGroups = new Map<string, Event[]>();
  for (const event of events) {
    const src = out[event.id];
    if (!src || src.startsWith('data:image')) continue;
    if (!/^https?:\/\//i.test(src)) continue;
    const c = canonicalRecommendationImageIdentity(src);
    if (!c) continue;
    const arr = sharedHttpGroups.get(c) ?? [];
    arr.push(event);
    sharedHttpGroups.set(c, arr);
  }
  const stableOrderIdx = new Map(events.map((e, i) => [e.id, i]));
  for (const grp of sharedHttpGroups.values()) {
    if (grp.length <= 1) continue;
    const placeKeys = new Set(grp.map((ev) => shareKeyForRecommendationDuplicate(ev)));
    if (placeKeys.size <= 1) continue;
    const sorted = [...grp].sort((a, b) => (stableOrderIdx.get(a.id) ?? 0) - (stableOrderIdx.get(b.id) ?? 0));
    for (let gi = 1; gi < sorted.length; gi += 1) {
      const ev = sorted[gi];
      out[ev.id] = buildUserFacingVenueFallbackImage(ev, `${ev.id}:http-dedupe:${gi}`);
    }
  }

  return out;
}
