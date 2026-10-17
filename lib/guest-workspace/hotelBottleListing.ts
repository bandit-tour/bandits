/**
 * Hotel half of Travel in a Bottle — reuse existing white-label + public hotel config.
 * Does not invent a parallel hotel inventory database.
 */
import type { ImageSourcePropType } from "react-native";

import {
  getHotelWhiteLabel,
  isKnownHotelSlug,
  normalizeHotelSlug,
  type HotelWhiteLabelConfig,
} from "@/lib/hotelWhiteLabel";
import { fetchRemoteHotelConfig, resolveHotelWhiteLabel } from "@/lib/hotelRemoteWhiteLabel";
import { workspaceOrigin } from "@/lib/workspace/client";

export type HotelBottleBenefit = {
  id?: string;
  title: string;
  body?: string;
};

/** Workspace public hotel config reachability — never treat 404 as a broken Guest surface. */
export type HotelWorkspacePublishStatus =
  | "published"
  | "not_published"
  | "unreachable"
  | "unknown";

export type HotelBottleRoomType = {
  id: string;
  name: string;
  occupancy?: number;
  description?: string;
  photoUrls: string[];
  priceCentsPerNight?: number;
  currency?: string;
};

/** Guest-visible rates only when Workspace authorizes them — never invent. */
export type HotelBottleRates = {
  authorized: boolean;
  currency?: string;
  fromCentsPerNight?: number;
  note?: string;
};

export type HotelBottleListing = {
  slug: string;
  displayName: string;
  location: string;
  description: string;
  /** Street / property address when Workspace publishes it. */
  address: string | null;
  /** Remote HTTPS gallery URLs when Workspace/Partner publishes them (stock hosts stripped). */
  remoteGalleryUrls: string[];
  /** Local compiled white-label property photography. */
  localGallery: ImageSourcePropType[];
  services: string[];
  benefits: HotelBottleBenefit[];
  roomTypes: HotelBottleRoomType[];
  policies: string[];
  rates: HotelBottleRates;
  /** Tenant status string from Workspace when present (e.g. LIVE). */
  tenantStatus: string | null;
  /** True when Workspace only returned branding hero — not full room inventory. */
  roomInventoryMissing: boolean;
  /** Honest Workspace publish state for NYX/ALUMA/PLAY tenant config. */
  workspacePublishStatus: HotelWorkspacePublishStatus;
  whiteLabel: HotelWhiteLabelConfig;
};

function uniqueHttps(urls: (string | undefined | null)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    const t = String(u || "").trim();
    if (!/^https?:\/\//i.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function isStockPhotoUrl(url: string): boolean {
  return /images\.unsplash\.com|images\.pexels\.com|picsum\.photos/i.test(url);
}

function propertyLocalGallery(wl: HotelWhiteLabelConfig): ImageSourcePropType[] {
  /**
   * Bottle discovery may show authorized in-repo property photography even when
   * Workspace tenant config is not LIVE yet. Never use logos as gallery frames.
   * Logo-presented tenants still contribute intro/hero property stills only.
   */
  const excluded = new Set(
    [wl.logoSource, wl.brandMarkSource].map((src) => JSON.stringify(src)),
  );
  const candidates = [wl.introHeroSource, wl.messageBackgroundSource, wl.giftBackgroundSource];
  const out: ImageSourcePropType[] = [];
  const seen = new Set<string>();
  for (const src of candidates) {
    const key = JSON.stringify(src);
    if (!src || excluded.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(src);
  }
  return out;
}

function localGalleryFor(wl: HotelWhiteLabelConfig): ImageSourcePropType[] {
  return propertyLocalGallery(wl);
}

/** Compiled photos only when this slug owns them. Never borrow PLAY art for another tenant. */
function compiledOwnGallery(norm: string): ImageSourcePropType[] {
  if (!isKnownHotelSlug(norm)) return [];
  const wl = getHotelWhiteLabel(norm);
  if (!wl) return [];
  return localGalleryFor(wl);
}

function serviceLabel(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseRoomTypes(raw: unknown): HotelBottleRoomType[] {
  if (!Array.isArray(raw)) return [];
  const out: HotelBottleRoomType[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name || r.title || "").trim();
    if (!name) continue;
    const id = String(r.id || r.slug || name).trim();
    const photoUrls = uniqueHttps([
      ...(Array.isArray(r.photos) ? (r.photos as string[]) : []),
      ...(Array.isArray(r.gallery) ? (r.gallery as string[]) : []),
      typeof r.imageUrl === "string" ? r.imageUrl : null,
      typeof r.coverPhoto === "string" ? r.coverPhoto : null,
    ]).filter((u) => !isStockPhotoUrl(u));
    const occupancyRaw = r.occupancy ?? r.maxGuests ?? r.sleeps;
    const occupancy =
      typeof occupancyRaw === "number" && occupancyRaw > 0
        ? occupancyRaw
        : Number(occupancyRaw) > 0
          ? Number(occupancyRaw)
          : undefined;
    const priceRaw = r.priceCentsPerNight ?? r.nightlyCents ?? r.rateCents;
    const priceCentsPerNight =
      typeof priceRaw === "number" && priceRaw > 0
        ? priceRaw
        : Number(priceRaw) > 0
          ? Number(priceRaw)
          : undefined;
    out.push({
      id,
      name,
      occupancy,
      description: String(r.description || r.body || "").trim() || undefined,
      photoUrls,
      priceCentsPerNight,
      currency: typeof r.currency === "string" ? r.currency : undefined,
    });
  }
  return out;
}

function parsePolicies(json: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    const t = String(v || "").trim();
    if (t && !out.includes(t)) out.push(t);
  };
  if (Array.isArray(json.policies)) {
    for (const p of json.policies) {
      if (typeof p === "string") push(p);
      else if (p && typeof p === "object" && "title" in p) {
        const row = p as { title?: string; body?: string };
        push([row.title, row.body].filter(Boolean).join(" — "));
      }
    }
  }
  push(json.cancellation);
  push(json.cancellationPolicy);
  push(json.checkInPolicy);
  push(json.checkOutPolicy);
  if (json.checkInTime) push(`Check-in from ${String(json.checkInTime)}`);
  if (json.checkOutTime) push(`Check-out by ${String(json.checkOutTime)}`);
  return out;
}

function parseRates(json: Record<string, unknown>, roomTypes: HotelBottleRoomType[]): HotelBottleRates {
  const explicitAuth =
    json.ratesAuthorized === true ||
    json.guestRatesAuthorized === true ||
    json.ratesPublic === true;
  const currency =
    typeof json.currency === "string"
      ? json.currency
      : typeof json.rateCurrency === "string"
        ? json.rateCurrency
        : roomTypes.find((r) => r.currency)?.currency;
  const fromRaw = json.fromCentsPerNight ?? json.priceCentsPerNight ?? json.nightlyCents;
  const fromRooms = roomTypes
    .map((r) => r.priceCentsPerNight)
    .filter((n): n is number => typeof n === "number" && n > 0);
  const fromCents =
    typeof fromRaw === "number" && fromRaw > 0
      ? fromRaw
      : Number(fromRaw) > 0
        ? Number(fromRaw)
        : fromRooms.length
          ? Math.min(...fromRooms)
          : undefined;
  const authorized = explicitAuth && typeof fromCents === "number";
  return {
    authorized,
    currency,
    fromCentsPerNight: authorized ? fromCents : undefined,
    note: authorized
      ? undefined
      : "Nightly rates appear only when this hotel authorizes guest pricing in Workspace.",
  };
}

function emptyRates(): HotelBottleRates {
  return {
    authorized: false,
    note: "Nightly rates appear only when this hotel authorizes guest pricing in Workspace.",
  };
}

/**
 * Load hotel listing context for Bottle planning from existing contracts only.
 * Workspace 404 / not-LIVE → honest `not_published` (not a broken Guest surface).
 */
export async function loadHotelBottleListing(slug: string | null | undefined): Promise<HotelBottleListing> {
  const norm = normalizeHotelSlug(slug) || "play-theatrou";
  const resolved = await resolveHotelWhiteLabel(norm, { allowPlayFallback: true });
  const wl = resolved.config;
  const remote = resolved.remote || (await fetchRemoteHotelConfig(norm));

  let services: string[] = [];
  let benefits: HotelBottleBenefit[] = [];
  let remoteGalleryUrls: string[] = [];
  let roomTypes: HotelBottleRoomType[] = [];
  let policies: string[] = [];
  let rates = emptyRates();
  let address: string | null = null;
  let tenantStatus: string | null = null;
  let workspacePublishStatus: HotelWorkspacePublishStatus = remote ? "published" : "unknown";

  // Re-fetch full config JSON so we can read benefits/services/rooms (not on RemoteHotelConfig type).
  const origin = String(workspaceOrigin() || "").replace(/\/$/, "");
  if (origin) {
    try {
      const res = await fetch(`${origin}/api/public/hotels/${encodeURIComponent(norm)}/config`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const json = (await res.json()) as Record<string, unknown> & {
          location?: string;
          address?: string;
          status?: string;
          whiteLabel?: {
            heroUrl?: string;
            logoUrl?: string;
            brandMarkUrl?: string;
            welcomeBodyPrimary?: string;
            welcomeBodySecondary?: string;
          };
          benefits?: HotelBottleBenefit | HotelBottleBenefit[];
          services?: string[];
          photos?: string[];
          gallery?: string[];
          roomTypes?: unknown[];
        };
        const wlRemote = json.whiteLabel;
        remoteGalleryUrls = uniqueHttps([
          ...(Array.isArray(json.photos) ? json.photos : []),
          ...(Array.isArray(json.gallery) ? json.gallery : []),
          wlRemote?.heroUrl,
        ]).filter((u) => !isStockPhotoUrl(u));
        if (Array.isArray(json.services)) {
          services = json.services.map(serviceLabel);
        }
        if (Array.isArray(json.benefits)) {
          benefits = json.benefits.filter((b) => b && b.title);
        } else if (json.benefits && typeof json.benefits === "object" && "title" in json.benefits) {
          benefits = [json.benefits as HotelBottleBenefit];
        }
        roomTypes = parseRoomTypes(json.roomTypes);
        policies = parsePolicies(json);
        rates = parseRates(json, roomTypes);
        address = String(json.address || "").trim() || null;
        tenantStatus = String(json.status || "").trim() || null;
        const hasRoomTypes = roomTypes.length > 0;
        const description = [
          wlRemote?.welcomeBodyPrimary,
          wlRemote?.welcomeBodySecondary,
        ]
          .filter(Boolean)
          .join("\n\n");

        // Prefer real published HTTPS photos; if only stock was stripped, use compiled own art.
        const localGallery =
          remoteGalleryUrls.length > 0 ? [] : compiledOwnGallery(norm);

        return {
          slug: norm,
          displayName: wl.displayName,
          location: String(json.location || wl.menuLocationLine || "Athens"),
          description: description || wl.welcomeBodyPrimary,
          address,
          remoteGalleryUrls,
          localGallery,
          services,
          benefits,
          roomTypes,
          policies,
          rates,
          tenantStatus,
          roomInventoryMissing: !hasRoomTypes,
          workspacePublishStatus: "published",
          whiteLabel: wl,
        };
      }
      if (res.status === 404) {
        workspacePublishStatus = "not_published";
      } else {
        workspacePublishStatus = "unreachable";
      }
    } catch {
      workspacePublishStatus = "unreachable";
    }
  } else if (!remote) {
    workspacePublishStatus = "unknown";
  }

  // Local property photography only — never another hotel's logo or stock stand-ins.
  remoteGalleryUrls = uniqueHttps([remote?.whiteLabel?.heroUrl]).filter(
    (u) => !isStockPhotoUrl(u),
  );

  return {
    slug: norm,
    displayName: wl.displayName,
    location: remote?.location || wl.menuLocationLine || "Athens",
    description: [wl.welcomeBodyPrimary, wl.welcomeBodySecondary].filter(Boolean).join("\n\n"),
    address: null,
    remoteGalleryUrls,
    localGallery: remoteGalleryUrls.length > 0 ? [] : compiledOwnGallery(norm),
    services,
    benefits,
    roomTypes: [],
    policies: [],
    rates: emptyRates(),
    tenantStatus: null,
    roomInventoryMissing: true,
    workspacePublishStatus,
    whiteLabel: wl,
  };
}

/** Format authorized nightly rate for Bottle UI. */
export function formatHotelBottleRate(rates: HotelBottleRates): string | null {
  if (!rates.authorized || typeof rates.fromCentsPerNight !== "number") return null;
  const currency = rates.currency || "EUR";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(rates.fromCentsPerNight / 100);
  } catch {
    return `${(rates.fromCentsPerNight / 100).toFixed(0)} ${currency}`;
  }
}
