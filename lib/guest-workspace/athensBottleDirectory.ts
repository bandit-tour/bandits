/**
 * Athens hotel directory for Travel in a Bottle.
 * Merges Workspace public discovery with curated authorized partners (PLAY / NYX / ALUMA).
 * Never invents hotels, rates, or photography.
 */
import { BOTTLE_PLAN_HOTELS } from "@/lib/guest-workspace/productWorlds";
import { workspaceGet } from "@/lib/workspace/client";

export type AthensBottleHotelCard = {
  slug: string;
  name: string;
  city: string;
  neighborhood?: string | null;
  description?: string | null;
  /** Remote HTTPS only when Workspace publishes non-stock photos. */
  remotePhotos: string[];
  source: "workspace" | "curated";
};

function uniqueBySlug(rows: AthensBottleHotelCard[]): AthensBottleHotelCard[] {
  const seen = new Set<string>();
  const out: AthensBottleHotelCard[] = [];
  for (const row of rows) {
    const key = row.slug.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function isStockPhotoUrl(url: string): boolean {
  return /images\.unsplash\.com|images\.pexels\.com|picsum\.photos/i.test(url);
}

/** Curated Bottle partners — always available offline for search/select. */
export function curatedAthensBottleHotels(): AthensBottleHotelCard[] {
  return BOTTLE_PLAN_HOTELS.map((h) => ({
    slug: h.id,
    name: h.name,
    city: h.city,
    neighborhood: h.city === "Athens" ? "Athens" : h.city,
    description: null,
    remotePhotos: [],
    source: "curated" as const,
  }));
}

export async function fetchAthensBottleDirectory(city = "Athens"): Promise<{
  hotels: AthensBottleHotelCard[];
  workspaceCount: number;
  error?: string | null;
}> {
  const curated = curatedAthensBottleHotels();
  const result = await workspaceGet<{
    ok?: boolean;
    hotels?: Array<{
      slug?: string;
      name?: string;
      city?: string;
      neighborhood?: string | null;
      description?: string | null;
      photos?: string[];
      guestEligible?: boolean;
    }>;
    count?: number;
  }>(`/api/public/hotels?city=${encodeURIComponent(city)}`);

  if (!result.ok) {
    return {
      hotels: curated,
      workspaceCount: 0,
      error: result.detail || "Workspace hotel directory unreachable — showing partner hotels.",
    };
  }

  const fromWorkspace: AthensBottleHotelCard[] = (result.data.hotels || [])
    .filter((h) => h && h.slug && h.name)
    .map((h) => ({
      slug: String(h.slug).trim().toLowerCase(),
      name: String(h.name).trim(),
      city: String(h.city || city).trim() || city,
      neighborhood: h.neighborhood ?? null,
      description: h.description ?? null,
      remotePhotos: (h.photos || []).filter(
        (u) => typeof u === "string" && /^https?:\/\//i.test(u) && !isStockPhotoUrl(u),
      ),
      source: "workspace" as const,
    }));

  // Workspace first (richer metadata), then curated fillers.
  const hotels = uniqueBySlug([...fromWorkspace, ...curated]);
  return {
    hotels,
    workspaceCount: fromWorkspace.length,
    error: null,
  };
}

export function filterAthensBottleDirectory(
  hotels: AthensBottleHotelCard[],
  query: string,
): AthensBottleHotelCard[] {
  const q = query.trim().toLowerCase();
  if (!q) return hotels;
  return hotels.filter((h) => {
    const blob = `${h.name} ${h.city} ${h.neighborhood || ""} ${h.description || ""}`.toLowerCase();
    return blob.includes(q);
  });
}
