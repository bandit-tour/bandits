import { Database } from '@/lib/database.types';
import { isBannedPhotoUri } from '@/lib/photoBanList';
import { isLikelyLogoOrBadPlaceImage, normalizeEventImageUri } from '@/lib/placePhoto';

type Event = Database['public']['Tables']['event']['Row'];

type EventWithManualHero = Event & {
  approved_hero_url?: string | null;
  approved_thumbnail_url?: string | null;
  approved_gallery?: string | null;
  hero_approved_at?: string | null;
};

const BLOCKED_STOCK_HOSTS = ['images.pexels.com', 'pexels.com', 'images.unsplash.com', 'unsplash.com', 'picsum.photos'];

function isBlockedStockHostUri(uri: string): boolean {
  try {
    const h = new URL(uri).hostname.toLowerCase();
    return BLOCKED_STOCK_HOSTS.some((x) => h === x || h.endsWith(`.${x}`));
  } catch {
    return true;
  }
}

function isOperatorApprovedPhotoUri(uri: string): boolean {
  if (!uri.trim()) return false;
  if (isLikelyLogoOrBadPlaceImage(uri)) return false;
  if (isBlockedStockHostUri(uri)) return false;
  if (isBannedPhotoUri(uri)) return false;
  return /^https?:\/\//i.test(uri) || uri.startsWith('data:image');
}

/** True only when an operator explicitly approved this venue hero. */
export function isVenueHeroManuallyApproved(event: Event): boolean {
  const row = event as EventWithManualHero;
  return !!String(row.hero_approved_at ?? '').trim();
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

/**
 * Operator-approved gallery only — no bandit_event merges, no Google, no stock pools.
 * Returns empty when hero is not manually approved.
 */
export function getManualApprovedVenueGalleryOrdered(event: Event): string[] {
  if (!isVenueHeroManuallyApproved(event)) return [];

  const row = event as EventWithManualHero;
  const out: string[] = [];
  const push = (raw: string | null | undefined) => {
    const n = normalizeEventImageUri(raw);
    if (!n || !isOperatorApprovedPhotoUri(n)) return;
    if (!out.includes(n)) out.push(n);
  };

  push(row.approved_hero_url);
  for (const u of parseGalleryJson(row.approved_gallery)) push(u);
  push(row.approved_thumbnail_url);

  return out.slice(0, 12);
}

/** Canonical hero for all surfaces — null when not manually approved. */
export function getManualApprovedHeroUri(event: Event): string | null {
  return getManualApprovedVenueGalleryOrdered(event)[0] ?? null;
}

export type ManualHeroApprovalPayload = {
  approvedHeroUrl: string;
  approvedThumbnailUrl?: string | null;
  approvedGallery?: string[];
};

/** Build DB update for CDesk "Approve hero" action. */
export function buildManualHeroApprovalUpdate(payload: ManualHeroApprovalPayload): Record<string, string> {
  const hero = String(payload.approvedHeroUrl ?? '').trim();
  const thumb = String(payload.approvedThumbnailUrl ?? hero).trim();
  const gallery = (payload.approvedGallery?.length ? payload.approvedGallery : [hero]).filter(Boolean);
  const galleryJson = JSON.stringify([...new Set(gallery.map((u) => u.trim()).filter(Boolean))]);

  return {
    approved_hero_url: hero,
    approved_thumbnail_url: thumb || hero,
    approved_gallery: galleryJson,
    image_url: hero,
    image_gallery: galleryJson,
    hero_approved_at: new Date().toISOString(),
  };
}
