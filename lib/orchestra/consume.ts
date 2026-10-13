/**
 * Assembles Guest Experience projection from Orchestra + local MVP.
 * Presentation stays on existing screens — this module owns no UI.
 */

import {
  GUEST_INTEGRATION_CHECKLIST,
  checklistSummary,
  type IntegrationCapability,
} from "@/lib/orchestra/checklist";
import { GUEST_APP_CANON } from "@/lib/orchestra/canon";
import {
  fetchCommerceWallet,
  fetchConnectionOsSnapshot,
  fetchLiveExperiencePreview,
  orchestraOsOrigin,
  partnerPlatformOrigin,
} from "@/lib/orchestra/client";
import {
  getHotelWhiteLabelOrDefault,
  isKnownHotelSlug,
  normalizeHotelSlug,
  type HotelSlug,
} from "@/lib/hotelWhiteLabel";

export type GuestExperienceProjection = {
  canon: typeof GUEST_APP_CANON;
  generatedAt: string;
  propertySlug: string | null;
  hotelier: {
    welcomeTitle: string;
    welcomeBody: string;
    displayName: string;
    campaigns: Array<{ id: string; title: string; detail: string }>;
    upsells: Array<{ id: string; title: string; price?: string }>;
    timeline: Array<{ id: string; label: string; detail: string }>;
    source: "mvp_local" | "orchestra" | "missing";
  };
  liveExperience: {
    connected: boolean;
    preview: unknown | null;
    detail: string;
  };
  commerce: {
    wallet: unknown | null;
    detail: string;
  };
  connection: {
    snapshot: unknown | null;
    detail: string;
  };
  checklist: IntegrationCapability[];
  summary: ReturnType<typeof checklistSummary>;
  origins: {
    orchestraOs: string | null;
    partnerPlatform: string | null;
  };
};

export async function buildGuestExperienceProjection(input?: {
  hotelSlug?: string | null;
  visitorId?: string | null;
}): Promise<GuestExperienceProjection> {
  const rawSlug = input?.hotelSlug ? normalizeHotelSlug(input.hotelSlug) : null;
  const slug = rawSlug && isKnownHotelSlug(rawSlug) ? (rawSlug as HotelSlug) : null;
  const brand = slug
    ? getHotelWhiteLabelOrDefault(slug)
    : {
        title: "Your stay",
        welcomeBodyPrimary: "Welcome.",
        displayName: "Your hotel",
      };

  const live = await fetchLiveExperiencePreview({
    propertySlug: slug ?? undefined,
    visitorId: input?.visitorId ?? undefined,
    destination: "Athens",
  });

  const wallet = input?.visitorId
    ? await fetchCommerceWallet(input.visitorId)
    : ({ ok: false, status: "MISSING" as const, detail: "no visitor id" } as const);

  const connection = await fetchConnectionOsSnapshot();

  return {
    canon: GUEST_APP_CANON,
    generatedAt: new Date().toISOString(),
    propertySlug: slug,
    hotelier: {
      welcomeTitle: brand.title,
      welcomeBody: brand.welcomeBodyPrimary,
      displayName: brand.displayName,
      campaigns: [],
      upsells: [],
      timeline: [],
      source: "mvp_local",
    },
    liveExperience: {
      connected: live.ok,
      preview: live.ok ? live.data : null,
      detail: live.ok ? "orchestra_os" : live.detail,
    },
    commerce: {
      wallet: wallet.ok ? wallet.data : null,
      detail: wallet.ok ? "orchestra_os" : wallet.detail,
    },
    connection: {
      snapshot: connection.ok ? connection.data : null,
      detail: connection.ok ? "orchestra_os" : connection.detail,
    },
    checklist: GUEST_INTEGRATION_CHECKLIST,
    summary: checklistSummary(),
    origins: {
      orchestraOs: orchestraOsOrigin(),
      partnerPlatform: partnerPlatformOrigin(),
    },
  };
}
