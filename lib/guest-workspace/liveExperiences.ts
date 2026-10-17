/**
 * Production Local Experiences — Workspace provider_record inventory.
 * Seeded GUEST_EXPERIENCES are editorial DEMO only and must not be mixed as SoT.
 */
import { workspaceGet, workspaceOrigin } from "@/lib/workspace/client";
import {
  coerceExperiencePriceBasis,
  experienceCover,
  isValidExperienceImageUrl,
  type GuestExperience,
} from "@/lib/guest-workspace/productWorlds";
import type { ExperienceAvailabilitySlot, ExperienceDetail } from "@/lib/guest-workspace/experienceDetail";

export type WorkspaceLocalExperience = {
  id: string;
  title: string;
  status: string;
  when?: string;
  city?: string;
  neighborhood?: string;
  location?: string;
  duration?: string;
  photos?: string[];
  description?: string;
  hostEmail?: string;
  hostName?: string;
  partnerId?: string;
  priceCents?: number;
  priceBasis?: "per_person" | "per_group" | "per_experience";
  currency?: string;
  seatsLeft?: number;
  sessionId?: string;
  startsAt?: string;
  cancellation?: string;
  source?: string;
};

const FALLBACK_COVER = experienceCover("1516483638261-f4dbaf036963");

/** Placeholder / offline supplier CDNs — never block authorized inventory + pricing. */
const UNREACHABLE_PHOTO_HOSTS =
  /(?:cdn\.athensmakers\.gr|cdn\.tenant\.example|cdn\.banditour\.live)/i;

function isGuestRenderablePhotoUrl(url: string | null | undefined): url is string {
  if (!url || !isValidExperienceImageUrl(url)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (UNREACHABLE_PHOTO_HOSTS.test(host)) return false;
  } catch {
    return false;
  }
  return true;
}

/** Workspace sometimes returns asset keys, not https URLs — map known keys, else fallback. */
const ASSET_KEY_COVERS: Record<string, string> = {
  "cover-courtyard": experienceCover("1516483638261-f4dbaf036963"),
  "hands-in-clay": experienceCover("1493106647003-8b6ddb8e9f5b"),
  "street-stop": experienceCover("1469474968028-56623f02e42e"),
};

function resolveExperiencePhoto(keyOrUrl: string | undefined): string | null {
  const raw = String(keyOrUrl || "").trim();
  if (!raw) return null;
  if (isValidExperienceImageUrl(raw)) return raw;
  if (ASSET_KEY_COVERS[raw]) return ASSET_KEY_COVERS[raw];
  return FALLBACK_COVER;
}

function inferCategory(row: WorkspaceLocalExperience): GuestExperience["category"] {
  const blob = `${row.title || ""} ${row.description || ""}`.toLowerCase();
  if (/clay|workshop|atelier|make|cook|fragrance|jewellery|jewelry/.test(blob)) return "Workshops";
  if (/night|dj|club|bar|midnight/.test(blob)) return "Nightlife";
  if (/art|gallery|graffiti|photo/.test(blob)) return "Art";
  if (/fashion|vintage|clothes|costume/.test(blob)) return "Fashion";
  if (/queer|drag|lgbt/.test(blob)) return "Queer";
  if (/food|chef|market|bakery|lunch|dinner/.test(blob)) return "Food";
  if (/music|jazz|vinyl|dj/.test(blob)) return "Music";
  return "Workshops";
}

/** Session / orch tokens sometimes appended to otherwise real provider titles. */
const ORCH_HASH_SUFFIX = /\s(mu[a-z0-9]{6,10}|mt[a-z0-9]{5,10}|muy[a-z0-9]{5,10})$/i;

function cleanProviderTitle(title: string): string {
  return String(title || "")
    .replace(ORCH_HASH_SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Workspace row unit price — never substitute another listing's cents. */
export function resolveWorkspaceExperienceUnitCents(row: Pick<WorkspaceLocalExperience, "priceCents">): number {
  const cents = Number(row.priceCents);
  return Number.isFinite(cents) && cents > 0 ? Math.round(cents) : 0;
}

/**
 * Defense-in-depth — reject test/orchestration shells; keep real provider rows.
 * Hash suffixes on titles are stripped for display, not used as a hard reject.
 */
export function isHonestGuestExperienceRow(row: WorkspaceLocalExperience): boolean {
  const title = cleanProviderTitle(String(row.title || ""));
  const host = cleanProviderTitle(String(row.hostName || ""));
  if (!title || /\bdebug\b/i.test(title)) return false;
  if (host && /\bdebug\b/i.test(host)) return false;
  const email = String(row.hostEmail || "").toLowerCase();
  if (
    email.endsWith("@banditour.test") ||
    email.endsWith("@banditour.demo") ||
    email.endsWith("@banditour.proof") ||
    email.startsWith("lexp.")
  ) {
    return false;
  }
  /** Pure hash / empty after strip = orch shell. */
  if (/^(mu|mt|muy)[a-z0-9]{5,10}$/i.test(String(row.title || "").trim())) return false;
  return true;
}

export function mapWorkspaceExperience(row: WorkspaceLocalExperience): GuestExperience | null {
  if (!isHonestGuestExperienceRow(row)) return null;
  const status = String(row.status || "").toLowerCase();
  /** Do not list draft / unpublished provider inventory as bookable. */
  if (status && /draft|unpublished|hidden|private|archived/.test(status)) return null;

  const photos = (row.photos || [])
    .map((u) => resolveExperiencePhoto(u))
    .filter(isGuestRenderablePhotoUrl);
  /** Prefer supplier media; allow approved asset-key / cover mapping when stock-only. */
  const nonStock = photos.filter((u) => !/images\.unsplash\.com/i.test(u));
  const imageUrl = nonStock[0] || photos[0] || FALLBACK_COVER;
  if (!isGuestRenderablePhotoUrl(imageUrl)) return null;

  const title = cleanProviderTitle(row.title) || String(row.title || "").trim();
  const host = cleanProviderTitle(row.hostName || "") || "Local host";
  const category = inferCategory(row);
  return {
    id: row.id,
    title,
    category,
    categoryLabel: category === "Workshops" ? "Local experience" : category,
    duration: row.duration || row.when || "Session",
    area: row.neighborhood || row.city || "Athens",
    distance: row.location || row.neighborhood || row.city || "Athens",
    rating: 0,
    story: row.description || title,
    when: row.when || row.duration || "Upcoming",
    priceCents: resolveWorkspaceExperienceUnitCents(row),
    priceBasis: coerceExperiencePriceBasis(row.priceBasis) ?? "per_experience",
    currency: String(row.currency || "EUR").toUpperCase() || "EUR",
    seatsLeft: row.seatsLeft ?? 0,
    host,
    meetingPoint: row.location || row.neighborhood || "Athens",
    included: ["Local host"],
    imageUrl,
    availableToday: (row.seatsLeft ?? 0) > 0,
    bookingMode: "request",
    previewOnly: false,
  };
}

export function mapWorkspaceDetail(row: WorkspaceLocalExperience, base: GuestExperience): ExperienceDetail {
  /** Same CDN honesty as listing — never keep blocked supplier hosts in the gallery. */
  const photos = (row.photos || [])
    .map((u) => resolveExperiencePhoto(u))
    .filter(isGuestRenderablePhotoUrl);
  const gallery = photos.length ? photos : [base.imageUrl || FALLBACK_COVER];
  const slot: ExperienceAvailabilitySlot = {
    id: row.sessionId || `sess_${row.id}`,
    label: row.when || "Upcoming session",
    timeRange: row.startsAt ? new Date(row.startsAt).toLocaleString() : row.duration || "See host",
    spotsLeft: row.seatsLeft ?? 0,
    priceCents: resolveWorkspaceExperienceUnitCents(row) || base.priceCents,
    language: "English",
    startsAtIso: row.startsAt || new Date().toISOString(),
  };
  return {
    ...base,
    shortDescription: row.description || base.story,
    reviewCount: 0,
    gallery,
    hostProfile: {
      id: row.partnerId || row.hostEmail || "host_live",
      name: row.hostName || "Local host",
      photoUrl: gallery[0]!,
      expertise: "Local experience",
      bio: row.description || base.story,
      credentials: [],
      yearsHosting: 1,
      languages: ["English"],
    },
    coreFacts: {
      meetingArea: row.location || row.neighborhood || "Athens",
      duration: row.duration || "Session",
      languages: ["English"],
      groupSize: `${row.seatsLeft ?? 0} seats left`,
      setting: "Outdoor",
    },
    itinerary: [
      {
        id: "step1",
        title: "Meet your host",
        description: row.description || base.story,
        durationLabel: row.duration || "Session",
        imageUrl: gallery[0]!,
      },
    ],
    reviews: [],
    /** Open seats without sessionId still get a bookable date row (synthetic id). */
    availability: (row.seatsLeft ?? 0) > 0 ? [slot] : [],
    meeting: {
      label: row.location || "Meeting point",
      address: row.location || row.neighborhood || "Athens",
      description: "Your host will meet you here.",
      lat: 37.9838,
      lng: 23.7275,
      directionsHint: row.neighborhood || "Athens",
    },
    thingsToKnow: {
      guestRequirements: ["Comfortable shoes"],
      accessibility: [],
      cancellation: row.cancellation || "Full refund 48h before",
      whatToBring: [],
      ageRequirements: "See host",
      hostResponsibility: "Local host",
      safety: [],
    },
    cancellationPolicyShort: row.cancellation || "Full refund 48h before",
    commerceProductId: row.id,
    commerceWorkspaceId: "local-experiences",
  };
}

export type LiveExperiencesFetch = {
  experiences: WorkspaceLocalExperience[];
  detail?: string;
  origin?: string;
};

const EXPERIENCES_SWR_KEY = "workspace:public:experiences";
const EXPERIENCES_TTL_MS = 3 * 60 * 1000;

export async function fetchLiveLocalExperiences(): Promise<LiveExperiencesFetch> {
  const { fetchCached, readCacheStale } = await import("@/lib/appDataCache");
  const stale = readCacheStale<LiveExperiencesFetch>(EXPERIENCES_SWR_KEY);
  try {
    return await fetchCached<LiveExperiencesFetch>(EXPERIENCES_SWR_KEY, EXPERIENCES_TTL_MS, async () => {
      const result = await workspaceGet<{ ok?: boolean; experiences?: WorkspaceLocalExperience[] }>(
        "/api/public/experiences",
      );
      if (!result.ok) {
        return {
          experiences: stale?.experiences ?? [],
          detail: result.detail || "Workspace experiences unavailable",
        };
      }
      /**
       * Workspace honesty gate strips partnerId/hostEmail/source from guest cards.
       * Accept id+title rows; client honesty filter drops orch shells.
       */
      const published = (result.data.experiences || []).filter(
        (e) => Boolean(e?.id && e?.title) && isHonestGuestExperienceRow(e),
      );
      return { experiences: published, origin: result.origin };
    });
  } catch {
    return stale ?? { experiences: [], detail: "Workspace experiences unavailable" };
  }
}

export async function fetchLiveExperienceDetail(id: string): Promise<ExperienceDetail | null> {
  const origin = workspaceOrigin();
  if (!origin) return null;
  const result = await workspaceGet<{ ok?: boolean; experience?: WorkspaceLocalExperience; experiences?: WorkspaceLocalExperience[] }>(
    `/api/public/experiences?id=${encodeURIComponent(id)}`,
  );
  if (!result.ok) return null;
  const row =
    result.data.experience ||
    (result.data.experiences || []).find((e) => e.id === id);
  if (!row) return null;
  const base = mapWorkspaceExperience(row);
  if (!base) return null;
  return mapWorkspaceDetail(row, base);
}
