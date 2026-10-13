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

/** ACTIVE STAY — Bottle out of primary top nav; bandiTEAM before banDiShop (QA-03). */
export const DISCOVERY_LANE_STAY: { key: UpperTabKey; label: string; href: UpperTabHref }[] = [
  { key: "bandits", label: "Local banDits", href: "/bandits" },
  { key: "experiences", label: "Experiences", href: "/experiences" },
  { key: "smarttraveler", label: "SmartTraveler", href: "/smarttraveler" },
  { key: "banditeam", label: "bandiTEAM", href: "/alerts" },
  { key: "shop", label: "banDiShop", href: "/shop" },
];

/** POST-STAY / NEXT-TRIP — Bottle PRIMARY for mixed sleeping. */
export const DISCOVERY_LANE_NEXT_TRIP: { key: UpperTabKey; label: string; href: UpperTabHref }[] = [
  { key: "bandits", label: "Local banDits", href: "/bandits" },
  { key: "experiences", label: "Experiences", href: "/experiences" },
  { key: "smarttraveler", label: "SmartTraveler", href: "/smarttraveler" },
  { key: "bottle", label: "Travel in a Bottle", href: "/travelBottle" },
  { key: "shop", label: "banDiShop", href: "/shop" },
];

/**
 * Default export for deep-link registry / legacy callers.
 * Prefer discoveryLaneForLifecycle() at chrome time.
 */
export const DISCOVERY_LANE_ORDER = DISCOVERY_LANE_NEXT_TRIP;

/** @deprecated Prefer discoveryLaneForLifecycle */
export const ACCESS_UPPER_TABS = DISCOVERY_LANE_ORDER;

/**
 * ACTIVE stay → bandiTEAM in rail, Bottle not.
 * PRE_TRIP / AFTER_TRIP / PLANNING / NEXT_TRIP → Bottle in rail (primary).
 */
export function discoveryLaneForLifecycle(opts: {
  isFullStay?: boolean;
  state?: string | null;
}): { key: UpperTabKey; label: string; href: UpperTabHref }[] {
  const state = String(opts.state || "");
  const activeStay =
    opts.isFullStay === true || state === "ACTIVE_STAY" || state === "REACTIVATED";
  return activeStay ? DISCOVERY_LANE_STAY : DISCOVERY_LANE_NEXT_TRIP;
}

/** Bottle is a next-trip product — promote on Home when not mid-stay. */
export function bottleIsPrimaryInvite(opts: {
  isFullStay?: boolean;
  state?: string | null;
}): boolean {
  return discoveryLaneForLifecycle(opts).some((t) => t.key === "bottle");
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
