import { Database } from '@/lib/database.types';
import {
  fetchGooglePlacePhotoUrls,
  isGooglePlacesDerivedPhotoUrl,
  isLikelyLogoOrBadPlaceImage,
  normalizeEventImageUri,
} from '@/lib/placePhoto';

type Event = Database['public']['Tables']['event']['Row'];
const BUSINESS_IMAGE_CACHE = new Map<string, string>();
const STOCK_IMAGE_HOSTS = ['images.pexels.com', 'pexels.com', 'images.unsplash.com', 'unsplash.com', 'picsum.photos'];

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

function hashPick(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function buildNeutralBusinessPlaceholderFromSeed(nameRaw: string, seed: string): string {
  const name = String(nameRaw ?? '').trim() || 'Local Place';
  const words = name.split(/\s+/).filter(Boolean);
  const initials = (words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'LP').slice(0, 2);
  const hue = hashPick(seed) % 360;
  const bg1 = `hsl(${hue}, 12%, 92%)`;
  const bg2 = `hsl(${hue}, 10%, 84%)`;
  const fg = 'hsl(215, 14%, 24%)';
  const safeName = name.replace(/[<>&"]/g, '');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='900' viewBox='0 0 1200 900'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='${bg1}'/><stop offset='100%' stop-color='${bg2}'/></linearGradient></defs><rect width='1200' height='900' fill='url(#g)'/><circle cx='600' cy='360' r='124' fill='rgba(255,255,255,0.72)'/><text x='600' y='392' text-anchor='middle' font-family='-apple-system,Segoe UI,Roboto,Arial,sans-serif' font-size='92' font-weight='700' fill='${fg}'>${initials}</text><text x='600' y='560' text-anchor='middle' font-family='-apple-system,Segoe UI,Roboto,Arial,sans-serif' font-size='40' font-weight='600' fill='${fg}'>${safeName}</text><text x='600' y='612' text-anchor='middle' font-family='-apple-system,Segoe UI,Roboto,Arial,sans-serif' font-size='26' font-weight='500' fill='${fg}' opacity='0.78'>Image pending verification</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function buildNeutralBusinessPlaceholder(event: Event): string {
  return buildNeutralBusinessPlaceholderFromSeed(String(event.name ?? ''), businessKey(event));
}

function getDbImageCandidates(event: Event): string[] {
  const out: string[] = [];
  const add = (raw: string | null | undefined) => {
    const n = normalizeEventImageUri(raw);
    if (!n || isLikelyLogoOrBadPlaceImage(n)) return;
    // Do not treat stock-host image URLs as business-primary recommendation images.
    if (isStockHostUri(n)) return;
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
  try {
  const used = new Set<string>();
  const out: Record<string, string | null> = {};
  const placeCandidatesByEventId = new Map<string, string[]>();

  await Promise.all(
    events.map(async (event) => {
      try {
        const photos = await fetchGooglePlacePhotoUrls({
          placeId: (event as any).google_place_id ?? null,
          name: String(event.name ?? ''),
          address: String(event.address ?? ''),
          city: String(event.city ?? ''),
          neighborhood: String(event.neighborhood ?? ''),
          limit: 8,
        });
        placeCandidatesByEventId.set(
          event.id,
          photos.filter((u) => Boolean(u) && !isLikelyLogoOrBadPlaceImage(u)),
        );
      } catch {
        placeCandidatesByEventId.set(event.id, []);
      }
    }),
  );

  for (const event of events) {
    let picked: string | null = null;
    const key = businessKey(event);
    const storedHero = pickStoredRecommendationHeroUrl(event);
    if (storedHero) {
      const sid = canonicalRecommendationImageIdentity(storedHero);
      if (sid) used.add(sid);
      BUSINESS_IMAGE_CACHE.set(key, storedHero);
      out[event.id] = storedHero;
      continue;
    }

    const placeCandidates = placeCandidatesByEventId.get(event.id) ?? [];
    const dbCandidates = getDbImageCandidates(event);
    const priorityCandidates = [...placeCandidates, ...dbCandidates];
    const cached = BUSINESS_IMAGE_CACHE.get(key);
    const safeCached =
      cached &&
      !isStockHostUri(cached) &&
      !isLikelyLogoOrBadPlaceImage(cached) &&
      isGooglePlacesDerivedPhotoUrl(cached)
        ? cached
        : null;
    if (cached && !safeCached) BUSINESS_IMAGE_CACHE.delete(key);
    const candidates = safeCached ? [safeCached, ...priorityCandidates] : priorityCandidates;

    for (const candidate of candidates) {
      if (!candidate || isLikelyLogoOrBadPlaceImage(candidate)) continue;
      const id = canonicalRecommendationImageIdentity(candidate);
      if (!id || used.has(id)) continue;
      used.add(id);
      picked = candidate;
      break;
    }

    if (picked) BUSINESS_IMAGE_CACHE.set(key, picked);
    out[event.id] = picked ?? buildNeutralBusinessPlaceholder(event);
  }

  return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[recommendationImages] resolveStrictRecommendationImagesByEventId failed', msg);
    const fallback: Record<string, string | null> = {};
    for (const event of events) {
      fallback[event.id] = buildNeutralBusinessPlaceholder(event);
    }
    return fallback;
  }
}

export function enforceUniqueRecommendationImagesByEventId(
  events: Event[],
  sourceByEventId: Record<string, string | null | undefined>,
): Record<string, string | null> {
  const used = new Set<string>();
  const out: Record<string, string | null> = {};
  for (const event of events) {
    const src = sourceByEventId[event.id] ?? null;
    if (!src) {
      out[event.id] = null;
      continue;
    }
    const id = canonicalRecommendationImageIdentity(src);
    if (!id) {
      out[event.id] = null;
      continue;
    }
    const isNeutralPlaceholder = src.startsWith('data:image/svg+xml');
    if (isNeutralPlaceholder) {
      if (used.has(id)) {
        out[event.id] = null;
        continue;
      }
      used.add(id);
    }
    out[event.id] = src;
  }
  return out;
}
