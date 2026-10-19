/**
 * Athens lodging discovery for Travel in a Bottle.
 * Prefers Workspace Places proxy (cached); falls back to Guest Places Text Search.
 * Discovery only — never invents rooms, rates, or bookings.
 */
import { getMapsApiKey } from "@/lib/placePhoto";
import { workspaceGet, workspaceOrigin } from "@/lib/workspace/client";
import { BOTTLE_PLAN_HOTELS } from "@/lib/guest-workspace/productWorlds";

export type AthensDiscoveryHotel = {
  placeId: string;
  slug?: string;
  name: string;
  address: string;
  photoUrls: string[];
  rating: number | null;
  userRatingCount: number | null;
  googleMapsUri: string | null;
  websiteUri: string | null;
  phone?: string | null;
  editorialSummary?: string | null;
  partner?: boolean;
  source: string;
  lat?: number | null;
  lng?: number | null;
};

const PLACES = "https://places.googleapis.com/v1";

function photoMedia(apiKey: string, resourceName: string): string | null {
  const name = String(resourceName || "").trim();
  if (!name || !apiKey) return null;
  const path = name
    .split("/")
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `${PLACES}/${path}/media?maxWidthPx=1200&maxHeightPx=900&key=${encodeURIComponent(apiKey)}`;
}

async function guestPlacesSearch(query: string, pageToken?: string | null): Promise<{
  hotels: AthensDiscoveryHotel[];
  nextPageToken: string | null;
  error?: string;
}> {
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    return { hotels: [], nextPageToken: null, error: "Maps key missing on Guest App" };
  }
  const textQuery = /athens/i.test(query) ? query : `${query} Athens Greece hotel`;
  try {
    const body: Record<string, unknown> = {
      textQuery: textQuery || "hotels in Athens Greece",
      languageCode: "en",
      regionCode: "GR",
      includedType: "lodging",
      pageSize: 20,
      locationBias: {
        circle: {
          center: { latitude: 37.9838, longitude: 23.7275 },
          radius: 28000.0,
        },
      },
    };
    if (pageToken) body.pageToken = pageToken;
    const resp = await fetch(`${PLACES}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.photos,places.rating,places.userRatingCount,places.googleMapsUri,places.websiteUri,nextPageToken",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      return { hotels: [], nextPageToken: null, error: `Places ${resp.status}` };
    }
    const json = (await resp.json()) as {
      places?: Array<Record<string, unknown>>;
      nextPageToken?: string;
    };
    const hotels: AthensDiscoveryHotel[] = [];
    for (const p of json.places || []) {
      const placeId = String(p.id || "")
        .replace(/^places\//i, "")
        .trim();
      const name = String((p.displayName as { text?: string } | undefined)?.text || "").trim();
      if (!placeId || !name) continue;
      const photos = Array.isArray(p.photos) ? p.photos : [];
      const photoUrls: string[] = [];
      for (const ph of photos.slice(0, 4)) {
        const media = photoMedia(apiKey, String((ph as { name?: string }).name || ""));
        if (media) photoUrls.push(media);
      }
      const loc = p.location as { latitude?: number; longitude?: number } | undefined;
      hotels.push({
        placeId,
        name,
        address: String(p.formattedAddress || "").trim(),
        photoUrls,
        rating: typeof p.rating === "number" ? p.rating : null,
        userRatingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
        googleMapsUri: typeof p.googleMapsUri === "string" ? p.googleMapsUri : null,
        websiteUri: typeof p.websiteUri === "string" ? p.websiteUri : null,
        source: "google_places_guest",
        lat: typeof loc?.latitude === "number" ? loc.latitude : null,
        lng: typeof loc?.longitude === "number" ? loc.longitude : null,
      });
    }
    return { hotels, nextPageToken: json.nextPageToken || null };
  } catch (e) {
    return {
      hotels: [],
      nextPageToken: null,
      error: e instanceof Error ? e.message : "Places search failed",
    };
  }
}

function partnerCards(): AthensDiscoveryHotel[] {
  return BOTTLE_PLAN_HOTELS.map((h) => ({
    placeId: `partner:${h.id}`,
    slug: h.id,
    name: h.name,
    address: `${h.city}, Greece`,
    photoUrls: [],
    rating: null,
    userRatingCount: null,
    googleMapsUri: null,
    websiteUri: null,
    partner: true,
    source: "partner",
  }));
}

/** Generic Athens browse keeps partner hotels. A named search must not pin PLAY above that hotel. */
function partnersMatchingQuery(query: string, partners: AthensDiscoveryHotel[]): AthensDiscoveryHotel[] {
  const q = query.trim().toLowerCase();
  const generic = !q || /^hotels?\s+in\s+athens$/.test(q);
  if (generic) return partners;
  return partners.filter((h) => {
    const name = h.name.trim().toLowerCase();
    return name.includes(q) || q.includes(name);
  });
}

export async function searchAthensHotels(input: {
  query?: string;
  pageToken?: string | null;
}): Promise<{
  hotels: AthensDiscoveryHotel[];
  nextPageToken: string | null;
  attribution: string;
  source: "workspace" | "guest_places" | "partners_only";
  error?: string | null;
  placesConfigured?: boolean;
}> {
  const q = String(input.query || "").trim() || "hotels in Athens";
  const origin = String(workspaceOrigin() || "").replace(/\/$/, "");
  if (origin) {
    const qs = new URLSearchParams({ q, pageSize: "20" });
    if (input.pageToken) qs.set("pageToken", input.pageToken);
    const result = await workspaceGet<{
      ok?: boolean;
      hotels?: AthensDiscoveryHotel[];
      partners?: AthensDiscoveryHotel[];
      nextPageToken?: string | null;
      error?: string | null;
      placesConfigured?: boolean;
      attribution?: string;
    }>(`/api/public/hotels/search?${qs.toString()}`);
    if (result.ok && (result.data.hotels?.length || result.data.partners?.length)) {
      const places = result.data.hotels || [];
      const partners = partnersMatchingQuery(
        q,
        (result.data.partners || []).map((p) => ({ ...p, partner: true })),
      );
      // Matching partners on the first page only, so a named search is not topped by another hotel.
      const merged = input.pageToken ? places : [...partners, ...places];
      return {
        hotels: merged,
        nextPageToken: result.data.nextPageToken || null,
        attribution: result.data.attribution || "Powered by Google",
        source: "workspace",
        error: result.data.error || null,
        placesConfigured: result.data.placesConfigured,
      };
    }
  }

  const local = await guestPlacesSearch(q, input.pageToken);
  if (local.hotels.length) {
    const merged = input.pageToken
      ? local.hotels
      : [...partnersMatchingQuery(q, partnerCards()), ...local.hotels];
    return {
      hotels: merged,
      nextPageToken: local.nextPageToken,
      attribution: "Powered by Google",
      source: "guest_places",
      error: null,
    };
  }

  return {
    hotels: partnersMatchingQuery(q, partnerCards()),
    nextPageToken: null,
    attribution: "Powered by Google",
    source: "partners_only",
    error: local.error || "Places discovery unavailable — showing partner hotels only.",
  };
}

export async function fetchAthensHotelDetail(placeIdRaw: string): Promise<{
  hotel: AthensDiscoveryHotel | null;
  reviews: Array<{ rating?: number; text?: string; author?: string }>;
  attribution: string;
  error?: string | null;
}> {
  const placeId = String(placeIdRaw || "")
    .replace(/^places\//i, "")
    .trim();
  if (!placeId || placeId.startsWith("partner:")) {
    return { hotel: null, reviews: [], attribution: "Powered by Google", error: "Not a Places hotel" };
  }

  const ws = await workspaceGet<{
    ok?: boolean;
    hotel?: AthensDiscoveryHotel;
    reviews?: Array<{ rating?: number; text?: string; author?: string }>;
    attribution?: string;
    error?: string;
  }>(`/api/public/hotels/place/${encodeURIComponent(placeId)}`);
  if (ws.ok && ws.data.hotel) {
    return {
      hotel: ws.data.hotel,
      reviews: ws.data.reviews || [],
      attribution: ws.data.attribution || "Powered by Google",
      error: null,
    };
  }

  const apiKey = getMapsApiKey();
  if (!apiKey) {
    return { hotel: null, reviews: [], attribution: "Powered by Google", error: "Maps key missing" };
  }
  try {
    const resp = await fetch(`${PLACES}/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,location,photos,rating,userRatingCount,googleMapsUri,websiteUri,internationalPhoneNumber,editorialSummary,reviews",
      },
    });
    if (!resp.ok) {
      return { hotel: null, reviews: [], attribution: "Powered by Google", error: `Details ${resp.status}` };
    }
    const p = (await resp.json()) as Record<string, unknown>;
    const photos = Array.isArray(p.photos) ? p.photos : [];
    const photoUrls: string[] = [];
    for (const ph of photos.slice(0, 10)) {
      const media = photoMedia(apiKey, String((ph as { name?: string }).name || ""));
      if (media) photoUrls.push(media);
    }
    const loc = p.location as { latitude?: number; longitude?: number } | undefined;
    const hotel: AthensDiscoveryHotel = {
      placeId,
      name: String((p.displayName as { text?: string } | undefined)?.text || "").trim(),
      address: String(p.formattedAddress || "").trim(),
      photoUrls,
      rating: typeof p.rating === "number" ? p.rating : null,
      userRatingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
      googleMapsUri: typeof p.googleMapsUri === "string" ? p.googleMapsUri : null,
      websiteUri: typeof p.websiteUri === "string" ? p.websiteUri : null,
      phone: typeof p.internationalPhoneNumber === "string" ? p.internationalPhoneNumber : null,
      editorialSummary:
        typeof (p.editorialSummary as { text?: string } | undefined)?.text === "string"
          ? String((p.editorialSummary as { text: string }).text)
          : null,
      source: "google_places_guest",
      lat: typeof loc?.latitude === "number" ? loc.latitude : null,
      lng: typeof loc?.longitude === "number" ? loc.longitude : null,
    };
    const reviews = Array.isArray(p.reviews)
      ? (p.reviews as Array<Record<string, unknown>>)
          .slice(0, 5)
          .map((r) => ({
            rating: typeof r.rating === "number" ? r.rating : undefined,
            text:
              String((r.text as { text?: string } | undefined)?.text || "").trim() || undefined,
            author:
              String((r.authorAttribution as { displayName?: string } | undefined)?.displayName || "").trim() ||
              undefined,
          }))
          .filter((r) => r.text)
      : [];
    return { hotel, reviews, attribution: "Powered by Google", error: null };
  } catch (e) {
    return {
      hotel: null,
      reviews: [],
      attribution: "Powered by Google",
      error: e instanceof Error ? e.message : "Details failed",
    };
  }
}

export function bottleHotelHref(hotel: AthensDiscoveryHotel): string {
  if (hotel.partner && hotel.slug) return `/bottleHotel/${hotel.slug}`;
  return `/bottleHotel/place_${encodeURIComponent(hotel.placeId)}`;
}

export function parseBottleHotelParam(slug: string): {
  kind: "partner" | "place";
  id: string;
} {
  const raw = String(slug || "").trim();
  if (raw.startsWith("place_")) {
    return { kind: "place", id: decodeURIComponent(raw.slice("place_".length)) };
  }
  if (raw.startsWith("ChIJ") || raw.startsWith("places/")) {
    return { kind: "place", id: raw.replace(/^places\//i, "") };
  }
  return { kind: "partner", id: raw.toLowerCase() };
}
