/**
 * Premium Insights visibility for Local banDit cards.
 * Reads Workspace `/api/bandit/premium?view=visibility` — never infers from rating/occupation.
 * City Guide + Ask Me remain free for every Local banDit.
 */

import { workspaceGet } from "@/lib/workspace/client";

export type BanditPremiumVisibility = {
  banditId: string;
  octopusVerified: boolean;
  octopusLevel: string | null;
  showPremiumInsights: boolean;
  commerceOperational: boolean;
  freeAskMe: true;
  cityGuide: true;
  blockers?: string[];
  /** PRODUCTION | TEST_DEMO | NONE — from Workspace visibility API. */
  authorizationClass?: "PRODUCTION" | "TEST_DEMO" | "NONE";
};

const cache = new Map<string, { at: number; value: BanditPremiumVisibility }>();
const TTL_MS = 60_000;

function fallbackUnauthorized(banditId: string): BanditPremiumVisibility {
  return {
    banditId,
    octopusVerified: false,
    octopusLevel: null,
    showPremiumInsights: false,
    commerceOperational: false,
    freeAskMe: true,
    cityGuide: true,
    blockers: ["Workspace visibility unavailable — paid CTA hidden"],
    authorizationClass: "NONE",
  };
}

export async function fetchBanditPremiumVisibility(
  banditId: string,
  guestEmail?: string | null,
): Promise<BanditPremiumVisibility> {
  const id = String(banditId || "").trim();
  if (!id) return fallbackUnauthorized("");

  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const result = await workspaceGet<
    BanditPremiumVisibility & { product?: string; error?: string; authorizationClass?: string }
  >(`/api/bandit/premium?view=visibility&banditId=${encodeURIComponent(id)}`, guestEmail);

  if (!result.ok) {
    // Never cache failures — SSR / cold proxy errors would hide premium for 60s.
    return fallbackUnauthorized(id);
  }

  const cls = result.data.authorizationClass;
  const authorizationClass =
    cls === "PRODUCTION" || cls === "TEST_DEMO" || cls === "NONE" ? cls : undefined;

  const value: BanditPremiumVisibility = {
    banditId: id,
    octopusVerified: result.data.octopusVerified === true,
    octopusLevel: result.data.octopusLevel ?? null,
    showPremiumInsights: result.data.showPremiumInsights === true,
    commerceOperational: result.data.commerceOperational === true,
    freeAskMe: true,
    cityGuide: true,
    blockers: result.data.blockers,
    authorizationClass,
  };
  cache.set(id, { at: Date.now(), value });
  return value;
}
