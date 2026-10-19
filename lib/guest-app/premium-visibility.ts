/**
 * Premium Insights visibility for Local banDit cards.
 * Reads Workspace `/api/bandit/premium?view=visibility` — never infers from rating/occupation.
 * City Guide + Ask Me remain free for every Local banDit.
 */

import { workspaceDirectOrigin, workspaceGet, workspaceOrigin } from "@/lib/workspace/client";

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
  /** Concierge preview enrolled. Not Octopus Verified. Checkout stays closed. */
  verificationPending?: boolean;
  conciergePreview?: boolean;
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
    verificationPending: false,
  };
}

export function invalidateBanditPremiumVisibilityCache(banditId?: string): void {
  if (banditId) cache.delete(String(banditId).trim());
  else cache.clear();
}

export async function fetchBanditPremiumVisibility(
  banditId: string,
  guestEmail?: string | null,
): Promise<BanditPremiumVisibility> {
  const id = String(banditId || "").trim();
  if (!id) return fallbackUnauthorized("");

  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const path = `/api/bandit/premium?view=visibility&banditId=${encodeURIComponent(id)}`;

  let result = await workspaceGet<
    BanditPremiumVisibility & { product?: string; error?: string; authorizationClass?: string }
  >(path, guestEmail);

  if (!result.ok) {
    const primary = workspaceOrigin();
    const direct = workspaceDirectOrigin();
    if (primary && direct && primary.replace(/\/$/, "") !== direct.replace(/\/$/, "")) {
      result = await workspaceGet<
        BanditPremiumVisibility & { product?: string; error?: string; authorizationClass?: string }
      >(path, guestEmail, direct);
    }
  }

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
    verificationPending: result.data.verificationPending === true && result.data.octopusVerified !== true,
    conciergePreview:
      (result.data.conciergePreview === true || result.data.verificationPending === true) &&
      result.data.octopusVerified !== true,
  };
  // Cache a real sellable or pending answer. Do not pin a transient unpaid miss.
  if (value.showPremiumInsights || value.verificationPending) {
    cache.set(id, { at: Date.now(), value });
  }
  return value;
}

const BATCH_CHUNK = 6;

/** Resolve Octopus Verified flags for many Local banDits (Workspace truth). */
export async function fetchOctopusVerifiedByBanditId(
  banditIds: string[],
): Promise<Record<string, boolean>> {
  const ids = [...new Set(banditIds.map((id) => String(id || "").trim()).filter(Boolean))];
  const out: Record<string, boolean> = {};
  for (let i = 0; i < ids.length; i += BATCH_CHUNK) {
    const chunk = ids.slice(i, i + BATCH_CHUNK);
    await Promise.all(
      chunk.map(async (id) => {
        const v = await fetchBanditPremiumVisibility(id);
        out[id] = v.octopusVerified === true;
      }),
    );
  }
  return out;
}

export type OctopusPresentationFlags = {
  verified: boolean;
  pending: boolean;
};

/** Verified and Verification Pending flags for the Local banDit directory. */
export async function fetchOctopusPresentationByBanditId(
  banditIds: string[],
): Promise<Record<string, OctopusPresentationFlags>> {
  const ids = [...new Set(banditIds.map((id) => String(id || "").trim()).filter(Boolean))];
  const out: Record<string, OctopusPresentationFlags> = {};
  for (let i = 0; i < ids.length; i += BATCH_CHUNK) {
    const chunk = ids.slice(i, i + BATCH_CHUNK);
    await Promise.all(
      chunk.map(async (id) => {
        const v = await fetchBanditPremiumVisibility(id);
        out[id] = {
          verified: v.octopusVerified === true,
          pending: v.verificationPending === true && v.octopusVerified !== true,
        };
      }),
    );
  }
  return out;
}

/** Verified first, then Verification Pending, then everyone else. Order inside each group stays put. */
export function sortBanditsByOctopusPresentation<T extends { id: string }>(
  items: T[],
  flags: Record<string, OctopusPresentationFlags>,
): T[] {
  const rank = (id: string) => {
    const row = flags[id];
    if (row?.verified) return 0;
    if (row?.pending) return 1;
    return 2;
  };
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item.id) - rank(b.item.id) || a.index - b.index)
    .map((row) => row.item);
}

/** Guest ids enrolled as Octopus Concierge previews (Verification Pending, not Verified). */
export async function fetchOctopusConciergePreviewIds(): Promise<string[]> {
  const result = await workspaceGet<{
    previews?: Array<{ banditId?: string; verificationPending?: boolean; octopusVerified?: boolean }>;
  }>("/api/bandit/premium?view=concierge-previews");
  if (!result.ok || !Array.isArray(result.data.previews)) return [];
  return result.data.previews
    .filter((p) => p.verificationPending === true && p.octopusVerified !== true && p.banditId)
    .map((p) => String(p.banditId));
}

export function sortBanditIdsVerifiedFirst<T extends { id: string }>(
  items: T[],
  verifiedById: Record<string, boolean>,
): T[] {
  const verified: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (verifiedById[item.id]) verified.push(item);
    else rest.push(item);
  }
  return [...verified, ...rest];
}
