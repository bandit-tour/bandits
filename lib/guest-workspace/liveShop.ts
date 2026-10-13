/**
 * Production banDiShop — Workspace partner_record inventory with real pins.
 * BANDISHOP_LISTINGS in productWorlds.ts are editorial DEMO only and must not mix as SoT.
 */
import { workspaceGet, workspaceOrigin } from "@/lib/workspace/client";
import {
  isValidExperienceImageUrl,
  type ShopFulfillment,
  type ShopListing,
} from "@/lib/guest-workspace/productWorlds";
import {
  distanceLabelFor,
  haversineKm,
  PLAY_THEATROU_ORIGIN,
  type TravelerOrigin,
} from "@/lib/guest-workspace/shopGeo";

export type WorkspaceShopListing = {
  id: string;
  title: string;
  description?: string;
  priceCents: number;
  category?: string;
  condition?: string;
  pickupArea?: string;
  photos?: string[];
  status?: string;
  distanceMinutes?: number;
  distanceKm?: number | null;
  lat?: number | null;
  lng?: number | null;
  meetingPoint?: string;
  pickupAddress?: string;
  stock?: number;
  fulfillment?: string;
  deliveryRadiusKm?: number | null;
  partnerId?: string | null;
  source?: string;
  labelled?: string | null;
  createdAt?: string;
  seller?: {
    email?: string;
    name?: string;
    rating?: number;
    sellerType?: string;
    meetingArea?: string;
    bio?: string;
    partnerId?: string | null;
    pickupAddress?: string;
    locationVerified?: boolean;
  };
};

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe380?auto=format&fit=crop&w=1400&q=80";

function firstPhoto(photos?: string[]): string {
  const urls = (photos || []).filter((u) => isValidExperienceImageUrl(u));
  return urls[0] || FALLBACK_COVER;
}

function mapCategory(raw?: string): string {
  const c = (raw || "Handmade").trim();
  if (/vintage/i.test(c)) return "Vintage";
  if (/art/i.test(c)) return "Art";
  if (/book/i.test(c)) return "Books";
  if (/cloth|fashion/i.test(c)) return "Fashion";
  if (/photo/i.test(c)) return "Photography";
  if (/music/i.test(c)) return "Music";
  if (/furniture|home|decor/i.test(c)) return "Home";
  if (/food|drink/i.test(c)) return "Food & Drink";
  if (/jewel/i.test(c)) return "Jewelry";
  if (/handmade|craft|local/i.test(c)) return "Handmade";
  return c || "Handmade";
}

export function isLiveShopRow(row: WorkspaceShopListing): boolean {
  if (!row?.id || !row.title) return false;
  if (row.source === "demo_seed") return false;
  if (row.labelled && /DEMO/i.test(row.labelled)) return false;
  if (row.lat == null || row.lng == null) return false;
  return row.source == null || row.source === "" || row.source === "partner_record";
}

export function mapWorkspaceShopListing(
  row: WorkspaceShopListing,
  origin?: TravelerOrigin | null,
): ShopListing | null {
  if (!isLiveShopRow(row)) return null;
  const lat = row.lat!;
  const lng = row.lng!;
  const imageUrl = firstPhoto(row.photos);
  if (!isValidExperienceImageUrl(imageUrl)) return null;
  const gallery = (row.photos || []).filter((u) => isValidExperienceImageUrl(u));
  const distanceKm = origin
    ? haversineKm(origin, { lat, lng })
    : row.distanceKm != null
      ? Number(row.distanceKm)
      : haversineKm(PLAY_THEATROU_ORIGIN, { lat, lng });
  const neighborhood =
    row.pickupArea?.split(/[·,]/)[0]?.trim() ||
    row.seller?.meetingArea?.split(/[·,]/)[0]?.trim() ||
    "Athens";
  const fulfillment = (row.fulfillment === "delivery" || row.fulfillment === "both"
    ? row.fulfillment
    : "pickup") as ShopFulfillment;
  const sellerName = row.seller?.name || "Local seller";
  const shopName = sellerName;
  const partnerId = row.partnerId || row.seller?.partnerId || `ptr_shop_${row.id}`;
  const distanceLabel = distanceLabelFor(distanceKm, {
    originLabel: origin?.label || "Your hotel",
  });

  return {
    id: row.id,
    title: row.title,
    description: row.description || row.title,
    priceCents: row.priceCents || 0,
    category: mapCategory(row.category),
    condition: row.condition || "Good",
    neighborhood,
    pickupArea: row.pickupArea || neighborhood,
    lat,
    lng,
    pickupAddress: row.pickupAddress || row.seller?.pickupAddress || row.meetingPoint || row.pickupArea || neighborhood,
    partnerId,
    sellerId: row.seller?.email || partnerId,
    distanceMinutes: Math.max(1, Math.round((distanceKm * 1000) / 80)),
    distanceLabel,
    sellerName,
    shopName,
    sellerRating: row.seller?.rating ?? 4.8,
    imageUrl,
    gallery: gallery.length ? gallery : [imageUrl],
    availability: ["Pickup only", "Flexible meeting time"],
    badges: ["Local maker", "Pickup nearby"],
    fulfillment,
    fulfillmentNote: "Reserve now · pay when you meet · no shipping",
    deliveryRadiusKm: row.deliveryRadiusKm ?? undefined,
    stock: row.stock ?? 1,
  };
}

export async function fetchLiveShopListings(opts?: {
  lat?: number;
  lng?: number;
  radiusKm?: number | null;
  originLabel?: string;
}): Promise<{ ok: boolean; listings: ShopListing[]; via: "public" | "discover" | "none"; detail?: string }> {
  const origin = workspaceOrigin();
  if (!origin) {
    return { ok: false, listings: [], via: "none", detail: "WORKSPACE_URL unset" };
  }

  const lat = opts?.lat ?? PLAY_THEATROU_ORIGIN.lat;
  const lng = opts?.lng ?? PLAY_THEATROU_ORIGIN.lng;
  const radiusQ =
    opts?.radiusKm != null && Number.isFinite(opts.radiusKm) ? `&radiusKm=${opts.radiusKm}` : "";
  const originLabel = opts?.originLabel || "Your hotel";
  const label = encodeURIComponent(originLabel);
  const travelerOrigin: TravelerOrigin = {
    lat,
    lng,
    mode: "hotel",
    label: originLabel,
    precise: false,
  };

  const pub = await workspaceGet<{
    ok?: boolean;
    listings?: WorkspaceShopListing[];
  }>(`/api/public/shop/listings?lat=${lat}&lng=${lng}${radiusQ}&originLabel=${label}`);

  if (pub.ok) {
    const mapped = (pub.data.listings || [])
      .map((row) => mapWorkspaceShopListing(row, travelerOrigin))
      .filter(Boolean) as ShopListing[];
    return { ok: true, listings: mapped, via: "public" };
  }

  const discover = await workspaceGet<{
    ok?: boolean;
    bandiShop?: { listings?: WorkspaceShopListing[] };
  }>(`/api/discover?lat=${lat}&lng=${lng}${radiusQ}&originLabel=${label}`);

  if (!discover.ok) {
    return { ok: false, listings: [], via: "none", detail: discover.detail };
  }

  const mapped = (discover.data.bandiShop?.listings || [])
    .map((row) => mapWorkspaceShopListing(row, travelerOrigin))
    .filter(Boolean) as ShopListing[];
  return { ok: true, listings: mapped, via: "discover" };
}

export async function fetchLiveShopListingDetail(
  id: string,
  opts?: { lat?: number; lng?: number; originLabel?: string },
): Promise<ShopListing | null> {
  const origin = workspaceOrigin();
  if (!origin) return null;
  const lat = opts?.lat ?? PLAY_THEATROU_ORIGIN.lat;
  const lng = opts?.lng ?? PLAY_THEATROU_ORIGIN.lng;
  const originLabel = opts?.originLabel || "Your hotel";
  const label = encodeURIComponent(originLabel);
  const travelerOrigin: TravelerOrigin = {
    lat,
    lng,
    mode: "hotel",
    label: originLabel,
    precise: false,
  };

  const result = await workspaceGet<{
    ok?: boolean;
    listing?: WorkspaceShopListing;
    listings?: WorkspaceShopListing[];
  }>(`/api/public/shop/listings?id=${encodeURIComponent(id)}&lat=${lat}&lng=${lng}&originLabel=${label}`);

  if (!result.ok) return null;
  const row =
    result.data.listing ||
    (result.data.listings || []).find((l) => l.id === id);
  if (!row) return null;
  return mapWorkspaceShopListing(row, travelerOrigin);
}
