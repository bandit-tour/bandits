import { Database } from '@/lib/database.types';
import { getCuratedEventImageCandidates } from '@/lib/eventImageCuration';
import { isBannedPhotoUri } from '@/lib/photoBanList';
import { buildUserFacingVenueFallbackImage } from '@/lib/recommendationImages';
import {
  isLikelyLogoOrBadPlaceImage,
  normalizeEventImageUri,
} from '@/lib/placePhoto';

export type EventListImageScope = {
  /** DB/curated image candidates with list-wide duplicate URLs stripped */
  scopedDbCandidates: string[];
  /** After DB + Places fail: always unique within the current guide list */
  uniqueFallbackUri: string;
};

type EventRow = Database['public']['Tables']['event']['Row'];
type EventImageFields = Pick<EventRow, 'id' | 'name' | 'genre' | 'image_gallery' | 'image_url'>;
const STOCK_IMAGE_HOSTS = ['images.pexels.com', 'pexels.com', 'images.unsplash.com', 'unsplash.com', 'picsum.photos'];

function isStockHostUri(uri: string): boolean {
  try {
    const host = new URL(uri).hostname.toLowerCase();
    return STOCK_IMAGE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function canonicalizeImageIdentity(rawUri: string): string {
  const uri = normalizeEventImageUri(rawUri) ?? rawUri;
  try {
    const u = new URL(uri);
    const host = u.hostname.toLowerCase();
    const path = u.pathname;
    if (host.includes('maps.googleapis.com') && path.includes('/photo')) {
      const ref = u.searchParams.get('photoreference') ?? '';
      return `google-photo:${ref}`;
    }
    if (host.includes('places.googleapis.com') && path.includes('/media')) {
      return `places-new-media:${path}`.toLowerCase();
    }
    if (host.includes('picsum.photos') && path.includes('/seed/')) {
      // /seed/<seed>/<w>/<h> -> stable identity by seed only.
      const m = path.match(/\/seed\/([^/]+)/i);
      if (m?.[1]) return `picsum-seed:${decodeURIComponent(m[1])}`;
    }
    if (
      host.includes('pexels.com') ||
      host.includes('unsplash.com') ||
      host.includes('supabase.co') ||
      host.includes('googleusercontent.com')
    ) {
      // Drop query params so transformed/resized variants of the same source collapse.
      return `${host}${path}`.toLowerCase();
    }
    return `${host}${path}${u.search}`.toLowerCase();
  } catch {
    return uri.trim().toLowerCase();
  }
}

/** Matches EventCard ordering: curated, gallery, primary image URL */
export function getEventDbImageCandidatesOrdered(event: EventImageFields): string[] {
  const isLogoLike = (uri: string) => isLikelyLogoOrBadPlaceImage(uri);
  const out: string[] = [];
  const add = (raw: string | null | undefined) => {
    const n = normalizeEventImageUri(raw);
    if (!n || isLogoLike(n)) return;
    if (isStockHostUri(n)) return;
    if (isBannedPhotoUri(n)) return;
    if (!out.includes(n)) out.push(n);
  };
  getCuratedEventImageCandidates(event as any).forEach((u) => add(u));
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

function pickUniqueUserFacingFallback(event: EventImageFields, usedIdentities: Set<string>): string {
  let attempt = 0;
  while (attempt < 12) {
    const candidate = buildUserFacingVenueFallbackImage(
      event as EventRow,
      `event-list:${event.id}:${attempt}`,
    );
    const identity = canonicalizeImageIdentity(candidate);
    if (!usedIdentities.has(identity)) {
      usedIdentities.add(identity);
      return candidate;
    }
    attempt += 1;
  }
  const fallback = buildUserFacingVenueFallbackImage(event as EventRow, `event-list:${event.id}:final`);
  usedIdentities.add(canonicalizeImageIdentity(fallback));
  return fallback;
}

/**
 * Builds per-row scoped DB URIs plus unique neutral fallbacks for one on-screen list
 * (same render order as `events`).
 */
export function buildEventListImagePlan(
  events: EventImageFields[],
  _dims: { w: number; h: number } = { w: 900, h: 675 },
): Map<string, EventListImageScope> {
  const claimedAcrossList = new Set<string>();
  const scopedById = new Map<string, string[]>();

  for (const e of events) {
    const scoped: string[] = [];
    for (const u of getEventDbImageCandidatesOrdered(e)) {
      const identity = canonicalizeImageIdentity(u);
      if (claimedAcrossList.has(identity)) continue;
      claimedAcrossList.add(identity);
      scoped.push(u);
    }
    scopedById.set(e.id, scoped);
  }

  const used = new Set<string>();
  for (const e of events) {
    for (const u of scopedById.get(e.id) ?? []) used.add(canonicalizeImageIdentity(u));
  }

  const out = new Map<string, EventListImageScope>();

  for (const e of events) {
    const uniqueFallbackUri = pickUniqueUserFacingFallback(e, used);
    out.set(e.id, {
      scopedDbCandidates: scopedById.get(e.id) ?? [],
      uniqueFallbackUri,
    });
  }

  return out;
}

/**
 * City Guide recommendation strip: duplicate primaries suppressed, missing primaries filled with
 * unique neutral fallbacks; returns final hero URI for every card.
 */
export function buildCityGuideRecommendationHeroUris(
  events: EventImageFields[],
  resolvePrimary: (event: EventImageFields) => string | null,
  _dims: { w: number; h: number } = { w: 900, h: 675 },
): Record<string, string> {
  const byEventId: Record<string, string> = {};
  const assigned = new Map<string, string>();
  const needsFallback = new Set<string>();

  for (const event of events) {
    const resolvedUri = resolvePrimary(event);
    if (!resolvedUri) {
      needsFallback.add(event.id);
      continue;
    }
    const identity = canonicalizeImageIdentity(resolvedUri);
    const duplicateOf = assigned.get(identity);
    if (duplicateOf && duplicateOf !== event.id) {
      needsFallback.add(event.id);
      continue;
    }
    assigned.set(identity, event.id);
    byEventId[event.id] = resolvedUri;
  }

  const used = new Set<string>();
  for (const event of events) {
    const assignedUri = byEventId[event.id];
    if (assignedUri) used.add(canonicalizeImageIdentity(assignedUri));
  }

  for (const event of events) {
    if (!needsFallback.has(event.id)) continue;
    byEventId[event.id] = pickUniqueNeutralFallback(event, used);
  }

  return byEventId;
}
