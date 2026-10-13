/**
 * Production Local Experiences — Workspace provider_record inventory.
 * Seeded GUEST_EXPERIENCES are editorial DEMO only and must not be mixed as SoT.
 */
import { workspaceGet, workspaceOrigin } from "@/lib/workspace/client";
import {
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
  seatsLeft?: number;
  sessionId?: string;
  startsAt?: string;
  cancellation?: string;
  source?: string;
};

const FALLBACK_COVER = experienceCover("1516483638261-f4dbaf036963");

export function mapWorkspaceExperience(row: WorkspaceLocalExperience): GuestExperience | null {
  const photos = (row.photos || []).filter((u) => isValidExperienceImageUrl(u));
  const imageUrl = photos[0] || FALLBACK_COVER;
  if (!isValidExperienceImageUrl(imageUrl)) return null;
  return {
    id: row.id,
    title: row.title,
    category: "Workshops",
    categoryLabel: "Local experience",
    duration: row.duration || row.when || "Session",
    area: row.neighborhood || row.city || "Athens",
    distance: row.location || row.neighborhood || row.city || "Athens",
    rating: 0,
    story: row.description || row.title,
    when: row.when || row.duration || "Upcoming",
    priceCents: row.priceCents || 0,
    seatsLeft: row.seatsLeft ?? 0,
    host: row.hostName || "Local host",
    meetingPoint: row.location || row.neighborhood || "Athens",
    included: ["Local host"],
    imageUrl,
    availableToday: (row.seatsLeft ?? 0) > 0,
    bookingMode: "request",
  };
}

export function mapWorkspaceDetail(row: WorkspaceLocalExperience, base: GuestExperience): ExperienceDetail {
  const photos = (row.photos || []).filter((u) => isValidExperienceImageUrl(u));
  const gallery = photos.length ? photos : [base.imageUrl];
  const slot: ExperienceAvailabilitySlot = {
    id: row.sessionId || `sess_${row.id}`,
    label: row.when || "Upcoming session",
    timeRange: row.startsAt ? new Date(row.startsAt).toLocaleString() : row.duration || "See host",
    spotsLeft: row.seatsLeft ?? 0,
    priceCents: row.priceCents || base.priceCents,
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
    availability: row.sessionId && (row.seatsLeft ?? 0) > 0 ? [slot] : [],
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

export async function fetchLiveLocalExperiences(): Promise<WorkspaceLocalExperience[]> {
  const result = await workspaceGet<{ ok?: boolean; experiences?: WorkspaceLocalExperience[] }>(
    "/api/public/experiences",
  );
  if (!result.ok) return [];
  return (result.data.experiences || []).filter((e) => e.source === "provider_record" || e.partnerId || e.hostEmail);
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
