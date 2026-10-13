/**
 * Server-minded access matrix for Guest Trip OS.
 * FULL_STAY unlocks hotel privileges; AFTER_TRIP keeps memory + discovery + planning.
 */

import type { GuestAccessLevel, GuestCapability, GuestLifecycleState, GuestTripMode } from "./types";

const FULL_STAY_CAPS: GuestCapability[] = [
  "hotel_services",
  "hotel_events",
  "hotel_offers",
  "late_checkout",
  "room_service",
  "ask_reception",
  "in_stay_local_friend",
  "octopus_concierge",
  "stay_smarttraveler_perks",
  "city_memory",
  "saves",
  "follows",
  "discovery",
  "trip_planning",
  "public_guides",
  "experiences",
  "bottle_planning",
];

const AFTER_TRIP_CAPS: GuestCapability[] = [
  "city_memory",
  "saves",
  "follows",
  "discovery",
  "trip_planning",
  "public_guides",
  "experiences",
  "bottle_planning",
  "local_at_home",
  "reactivate_stay",
];

const PRE_TRIP_CAPS: GuestCapability[] = [
  "city_memory",
  "saves",
  "follows",
  "discovery",
  "trip_planning",
  "public_guides",
  "experiences",
  "bottle_planning",
  "reactivate_stay",
];

const PLANNING_CAPS: GuestCapability[] = [
  ...PRE_TRIP_CAPS,
];

const LOCAL_AT_HOME_CAPS: GuestCapability[] = [
  "city_memory",
  "saves",
  "follows",
  "discovery",
  "public_guides",
  "experiences",
  "local_at_home",
  "reactivate_stay",
];

export const ACCESS_CAPABILITIES: Record<GuestAccessLevel, readonly GuestCapability[]> = {
  FULL_STAY: FULL_STAY_CAPS,
  AFTER_TRIP: AFTER_TRIP_CAPS,
  PRE_TRIP: PRE_TRIP_CAPS,
  PLANNING: PLANNING_CAPS,
  LOCAL_AT_HOME: LOCAL_AT_HOME_CAPS,
};

export function accessLevelForState(state: GuestLifecycleState): GuestAccessLevel {
  switch (state) {
    case "ACTIVE_STAY":
    case "REACTIVATED":
      return "FULL_STAY";
    case "AFTER_TRIP":
      return "AFTER_TRIP";
    case "NEXT_TRIP_PLANNING":
      return "PLANNING";
    case "PRE_TRIP":
    default:
      return "PRE_TRIP";
  }
}

export function modeForState(state: GuestLifecycleState): GuestTripMode {
  switch (state) {
    case "ACTIVE_STAY":
      return "DURING_TRIP_MODE";
    case "AFTER_TRIP":
      return "AFTER_TRIP_MODE";
    case "NEXT_TRIP_PLANNING":
      return "PLANNING_MODE";
    case "REACTIVATED":
      return "REACTIVATED_FULL_MODE";
    case "PRE_TRIP":
    default:
      return "PRE_TRIP_MODE";
  }
}

export function can(
  access: GuestAccessLevel | null | undefined,
  capability: GuestCapability,
): boolean {
  const level = access && ACCESS_CAPABILITIES[access] ? access : "PRE_TRIP";
  const caps = ACCESS_CAPABILITIES[level] ?? ACCESS_CAPABILITIES.PRE_TRIP;
  return Array.isArray(caps) && caps.includes(capability);
}

export function assertCan(
  access: GuestAccessLevel | null | undefined,
  capability: GuestCapability,
): void {
  if (!can(access, capability)) {
    throw new Error(`ACCESS_DENIED:${capability}:${access ?? "PRE_TRIP"}`);
  }
}

/** Hotelier stay modules require FULL_STAY. */
export const HOTELIER_STAY_CAPABILITIES: GuestCapability[] = [
  "hotel_services",
  "hotel_events",
  "hotel_offers",
  "late_checkout",
  "room_service",
  "ask_reception",
];

export function isFullStayAccess(access: GuestAccessLevel): boolean {
  return access === "FULL_STAY";
}

export function isAfterTripExperience(state: GuestLifecycleState): boolean {
  return state === "AFTER_TRIP" || state === "NEXT_TRIP_PLANNING";
}

/** Principal Guest moment is post-stay / next-trip planning — not ACTIVE stay discovery. */
export function isBottlePrimaryMoment(state: GuestLifecycleState): boolean {
  return state === "AFTER_TRIP" || state === "NEXT_TRIP_PLANNING" || state === "PRE_TRIP";
}

/** Travel in a Bottle — trip-building, not late-checkout. */
export function canUseTravelBottle(state: GuestLifecycleState): boolean {
  return (
    state === "PRE_TRIP" ||
    state === "NEXT_TRIP_PLANNING" ||
    state === "ACTIVE_STAY" ||
    state === "REACTIVATED" ||
    state === "AFTER_TRIP"
  );
}

/** Continuity analytics — return with intent, not DAU scrolling. */
export const RETURN_INTENT_METRICS = [
  "lifecycle_return_opened",
  "city_memory_opened",
  "trip_planning_started",
  "bottle_planning_opened",
  "reactivation_started",
  "reactivation_completed",
  "followed_bandit_update_opened",
  "next_destination_tapped",
] as const;

export type ReturnIntentMetric = (typeof RETURN_INTENT_METRICS)[number];
