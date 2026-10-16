/**
 * banDiShop geo — real distance from traveler origin.
 * Origin modes: device (Near me) · hotel · manual neighbourhood · Athens browse.
 * Never invent walk times or GPS status copy for customers.
 * Maps open helpers live in `@/lib/maps/openDirections` (keeps this module RN-Linking free).
 */

export type GeoPoint = { lat: number; lng: number };

/** PLAY Theatrou · Psyrri — verified sandbox hotel pin. */
export const PLAY_THEATROU_ORIGIN: GeoPoint & { label: string } = {
  lat: 37.9778,
  lng: 23.7245,
  label: "PLAY Theatrou",
};

/** City centre reference for All Athens browse distance sort. */
export const ATHENS_CITY_ORIGIN: GeoPoint & { label: string } = {
  lat: 37.9838,
  lng: 23.7275,
  label: "Athens",
};

export const SHOP_RADIUS_BANDS_KM = [1, 2, 5, 10, 25] as const;
export type ShopRadiusKm = (typeof SHOP_RADIUS_BANDS_KM)[number];

export type TravelerOriginMode = "device" | "hotel" | "manual" | "city";

export type TravelerOrigin = GeoPoint & {
  mode: TravelerOriginMode;
  label: string;
  /** Precise GPS only when device granted; else hotel/manual/city. */
  precise: boolean;
};

/** Manual fallback neighbourhoods when Near me permission is denied. */
export const SHOP_MANUAL_ORIGINS: TravelerOrigin[] = [
  { ...ATHENS_CITY_ORIGIN, mode: "manual", precise: false, label: "Athens centre" },
  { lat: 37.9775, lng: 23.7248, mode: "manual", label: "Psyrri", precise: false },
  { lat: 37.9763, lng: 23.7258, mode: "manual", label: "Monastiraki", precise: false },
  { lat: 37.9865, lng: 23.7345, mode: "manual", label: "Exarchia", precise: false },
  { lat: 37.9735, lng: 23.7295, mode: "manual", label: "Plaka", precise: false },
  { lat: 37.9782, lng: 23.7425, mode: "manual", label: "Kolonaki", precise: false },
  { lat: 37.9655, lng: 23.7245, mode: "manual", label: "Koukaki", precise: false },
  { lat: 37.9782, lng: 23.7145, mode: "manual", label: "Gazi", precise: false },
];

/** Haversine distance in kilometres. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km)) return "Distance unavailable";
  if (km < 0.1) return "< 100 m";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/**
 * Distance label for cards — km only (no invented walk minutes).
 * Optional walkMinutes only when a real routing engine provided it.
 */
export function distanceLabelFor(
  km: number,
  opts?: { walkMinutes?: number | null; originLabel?: string },
): string {
  const base = formatDistanceKm(km);
  if (opts?.walkMinutes != null && opts.walkMinutes > 0) {
    return `${base} · ~${opts.walkMinutes} min walk`;
  }
  if (opts?.originLabel) return `${base} from ${opts.originLabel}`;
  return base;
}

export function withinRadius(km: number, radiusKm: number): boolean {
  return Number.isFinite(km) && km <= radiusKm;
}

export function resolveHotelOrigin(opts?: {
  hotelSlug?: string | null;
  hotelName?: string | null;
  lat?: number | null;
  lng?: number | null;
}): TravelerOrigin {
  const slug = String(opts?.hotelSlug || "").trim().toLowerCase();
  const name = String(opts?.hotelName || "").trim();
  const label =
    name ||
    (slug === "play-theatrou" || slug === "play-athens" ? PLAY_THEATROU_ORIGIN.label : "") ||
    "Your hotel";

  if (
    opts?.lat != null &&
    opts?.lng != null &&
    Number.isFinite(opts.lat) &&
    Number.isFinite(opts.lng)
  ) {
    return {
      lat: opts.lat,
      lng: opts.lng,
      mode: "hotel",
      label,
      precise: false,
    };
  }

  /** Known verified hotel pins only — never invent coordinates for unknown hotels. */
  if (slug === "play-theatrou" || slug === "play-athens" || /play theatrou/i.test(name)) {
    return {
      lat: PLAY_THEATROU_ORIGIN.lat,
      lng: PLAY_THEATROU_ORIGIN.lng,
      mode: "hotel",
      label: name || PLAY_THEATROU_ORIGIN.label,
      precise: false,
    };
  }

  return {
    lat: PLAY_THEATROU_ORIGIN.lat,
    lng: PLAY_THEATROU_ORIGIN.lng,
    mode: "hotel",
    label,
    precise: false,
  };
}

export function athensCityOrigin(): TravelerOrigin {
  return {
    lat: ATHENS_CITY_ORIGIN.lat,
    lng: ATHENS_CITY_ORIGIN.lng,
    mode: "city",
    label: ATHENS_CITY_ORIGIN.label,
    precise: false,
  };
}

/** Customer-facing origin line — no GPS/diagnostic jargon. */
export function originCustomerLabel(origin: TravelerOrigin): string {
  if (origin.mode === "device") return "Near you";
  if (origin.mode === "hotel") return `From ${origin.label}`;
  if (origin.mode === "manual") return `Near ${origin.label}`;
  return "Across Athens";
}

/** Athens neighbourhood seed coords for marketplace listings (real map pins). */
export const ATHENS_NEIGHBORHOOD_COORDS: Record<string, GeoPoint> = {
  Psyrri: { lat: 37.9775, lng: 23.7248 },
  Kerameikos: { lat: 37.9789, lng: 23.7185 },
  Monastiraki: { lat: 37.9763, lng: 23.7258 },
  Exarchia: { lat: 37.9865, lng: 23.7345 },
  Plaka: { lat: 37.9735, lng: 23.7295 },
  Thisseio: { lat: 37.9768, lng: 23.7205 },
  Kolonaki: { lat: 37.9782, lng: 23.7425 },
  Mets: { lat: 37.9685, lng: 23.7365 },
  Pangrati: { lat: 37.9688, lng: 23.7485 },
  Koukaki: { lat: 37.9655, lng: 23.7245 },
  Petralona: { lat: 37.9682, lng: 23.7125 },
  Gazi: { lat: 37.9782, lng: 23.7145 },
};
