/**
 * Guest App navigation law — FINAL CANONICAL IA (locked).
 * HOME = trip brain · EXPLORE = ONE discovery container · MORE = full universe.
 *
 * ACTIVE-STAY top rail (persistent):
 *   Local banDits | Experiences | SmartTraveler | banDiShop | bandiTEAM
 *   — NEVER a duplicate "Explore" chip, NEVER Impact as a rail peer,
 *   — Travel in a Bottle NOT in primary top nav mid-stay.
 *
 * POST-STAY / NEXT-TRIP top rail:
 *   Local banDits | Experiences | SmartTraveler | Travel in a Bottle | banDiShop
 *   — Bottle is PRIMARY planning product (mix sleeping experiences).
 *
 * Bottom ACCESS (persistent):
 *   Home | Explore | Hotel | Local Friend | Chat | More
 *
 * Impact lives under More / Passport only.
 */

export type UpperTabKey =
  | "bandits"
  | "explore"
  | "experiences"
  | "smarttraveler"
  | "bottle"
  | "shop"
  | "banditeam"
  | "impact";

export type UpperTabHref =
  | "/bandits"
  | "/explore"
  | "/experiences"
  | "/smarttraveler"
  | "/travelBottle"
  | "/shop"
  | "/alerts"
  | "/bandiTeam"
  | "/impact";

/**
 * Deep-link registry — routes stay registered.
 * Impact lives under More / Passport, not Explore chrome.
 */
export const UPPER_TAB_ORDER: { key: UpperTabKey; label: string; href: UpperTabHref }[] = [
  { key: "bandits", label: "Local banDits", href: "/bandits" },
  { key: "explore", label: "Explore", href: "/explore" },
  { key: "experiences", label: "Experiences", href: "/experiences" },
  { key: "smarttraveler", label: "SmartTraveler", href: "/smarttraveler" },
  { key: "bottle", label: "Travel in a Bottle", href: "/travelBottle" },
  { key: "shop", label: "banDiShop", href: "/shop" },
  /** /alerts lives inside (tabs) — keeps chrome + bottom nav. Root /bandiTeam also deep-links. */
  { key: "banditeam", label: "bandiTEAM", href: "/alerts" },
  { key: "impact", label: "Impact", href: "/impact" },
];

/**
 * Owner-approved upper rail (locked):
 * Local banDits → Experiences → SmartTraveler → bandiTEAM → banDiShop
 * Travel in a Bottle lives under More + contextual next-trip entry — never replaces bandiTEAM.
 */
export const DISCOVERY_LANE_STAY: { key: UpperTabKey; label: string; href: UpperTabHref }[] = [
  { key: "bandits", label: "Local banDits", href: "/bandits" },
  { key: "experiences", label: "Experiences", href: "/experiences" },
  { key: "smarttraveler", label: "SmartTraveler", href: "/smarttraveler" },
  { key: "banditeam", label: "bandiTEAM", href: "/alerts" },
  { key: "shop", label: "banDiShop", href: "/shop" },
];

/** @deprecated Alias — owner rail is lifecycle-invariant (no TiB in top rail). */
export const DISCOVERY_LANE_NEXT_TRIP = DISCOVERY_LANE_STAY;

/**
 * Default export for deep-link registry / legacy callers.
 * Prefer discoveryLaneForLifecycle() at chrome time.
 */
export const DISCOVERY_LANE_ORDER = DISCOVERY_LANE_STAY;

/** @deprecated Prefer discoveryLaneForLifecycle */
export const ACCESS_UPPER_TABS = DISCOVERY_LANE_ORDER;

/**
 * Owner constitution: same discovery rail for every lifecycle.
 * TiB is More / contextual — never a rail peer that displaces bandiTEAM.
 */
export function discoveryLaneForLifecycle(_opts: {
  isFullStay?: boolean;
  state?: string | null;
}): { key: UpperTabKey; label: string; href: UpperTabHref }[] {
  return DISCOVERY_LANE_STAY;
}

/** Bottle is a next-trip product — promote on Home when not mid-stay (not in upper rail). */
export function bottleIsPrimaryInvite(opts: {
  isFullStay?: boolean;
  state?: string | null;
}): boolean {
  const state = String(opts.state || "");
  const midStay =
    opts.isFullStay === true || state === "ACTIVE_STAY" || state === "REACTIVATED";
  return !midStay;
}

export function bottlePrimaryInviteCopy(opts: {
  isFullStay?: boolean;
  state?: string | null;
}): { title: string; sub: string } {
  if (opts.isFullStay || opts.state === "ACTIVE_STAY" || opts.state === "REACTIVATED") {
    return {
      title: "Mix sleeping for a later trip",
      sub: "Travel in a Bottle · hotel + treehouse, cabin, vineyard, glamping…",
    };
  }
  if (opts.state === "AFTER_TRIP" || opts.state === "NEXT_TRIP_PLANNING") {
    return {
      title: "Plan your next journey",
      sub: "Mix your sleeping experience — hotel nights + a second place to sleep",
    };
  }
  return {
    title: "Mix your sleeping experience",
    sub: "Build one journey: hotel + treehouse / beach / vineyard / lodge",
  };
}

export function upperTabHref(tab: UpperTabKey): UpperTabHref {
  return UPPER_TAB_ORDER.find((t) => t.key === tab)?.href ?? "/explore";
}
