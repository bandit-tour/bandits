/**
 * Hotel half of Travel in a Bottle — reuse existing white-label + public hotel config.
 * Does not invent a parallel hotel inventory database.
 */
import type { ImageSourcePropType } from "react-native";

import {
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

export type HotelBottleListing = {
  slug: string;
  displayName: string;
  location: string;
  description: string;
  /** Remote HTTPS gallery URLs when Workspace/Partner publishes them. */
  remoteGalleryUrls: string[];
  /** Local compiled white-label property photography. */
  localGallery: ImageSourcePropType[];
  services: string[];
  benefits: HotelBottleBenefit[];
  /** True when Workspace only returned branding hero — not full room inventory. */
  roomInventoryMissing: boolean;
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

/**
 * Property photography for the selected hotel only.
 * Logos, brand marks and bottle art are not gallery photos.
 */
function propertyLocalGallery(wl: HotelWhiteLabelConfig): ImageSourcePropType[] {
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
function ownLocalGallery(
  source: "local" | "remote" | "play_fallback",
  wl: HotelWhiteLabelConfig,
  norm: string,
): ImageSourcePropType[] {
  if (source !== "local") return [];
  if (normalizeHotelSlug(wl.slug) !== norm) return [];
  return localGalleryFor(wl);
}

function serviceLabel(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Load hotel listing context for Bottle planning from existing contracts only.
 */
export async function loadHotelBottleListing(slug: string | null | undefined): Promise<HotelBottleListing> {
  const norm = normalizeHotelSlug(slug) || "play-theatrou";
  const resolved = await resolveHotelWhiteLabel(norm, { allowPlayFallback: true });
  const wl = resolved.config;
  const remote = resolved.remote || (await fetchRemoteHotelConfig(norm));

  let services: string[] = [];
  let benefits: HotelBottleBenefit[] = [];
  let remoteGalleryUrls: string[] = [];

  // Re-fetch full config JSON so we can read benefits/services (not on RemoteHotelConfig type).
  const origin = String(workspaceOrigin() || "").replace(/\/$/, "");
  if (origin) {
    try {
      const res = await fetch(`${origin}/api/public/hotels/${encodeURIComponent(norm)}/config`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const json = (await res.json()) as {
          location?: string;
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
        ]).filter((u) => !isStockPhotoUrl(u));
        if (Array.isArray(json.services)) {
          services = json.services.map(serviceLabel);
        }
        if (Array.isArray(json.benefits)) {
          benefits = json.benefits.filter((b) => b && b.title);
        } else if (json.benefits && typeof json.benefits === "object" && "title" in json.benefits) {
          benefits = [json.benefits as HotelBottleBenefit];
        }
        const hasRoomTypes = Array.isArray(json.roomTypes) && json.roomTypes.length > 0;
        const description = [
          wlRemote?.welcomeBodyPrimary,
          wlRemote?.welcomeBodySecondary,
        ]
          .filter(Boolean)
          .join("\n\n");

        return {
          slug: norm,
          displayName: wl.displayName,
          location: String(json.location || wl.menuLocationLine || "Athens"),
          description: description || wl.welcomeBodyPrimary,
          remoteGalleryUrls,
          localGallery: ownLocalGallery(resolved.source, wl, norm),
          services,
          benefits,
          roomInventoryMissing: !hasRoomTypes,
          whiteLabel: wl,
        };
      }
    } catch {
      /* fall through to local */
    }
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
    remoteGalleryUrls,
    localGallery: ownLocalGallery(resolved.source, wl, norm),
    services,
    benefits,
    roomInventoryMissing: true,
    whiteLabel: wl,
  };
}
