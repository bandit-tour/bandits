/**
 * Guest Trip OS — persisted lifecycle.
 * Checkout = STATE SHIFT, not EXIT. Account stays alive; access level changes.
 */

export const GUEST_LIFECYCLE_STATES = [
  "PRE_TRIP",
  "ACTIVE_STAY",
  "AFTER_TRIP",
  "NEXT_TRIP_PLANNING",
  "REACTIVATED",
] as const;

export type GuestLifecycleState = (typeof GUEST_LIFECYCLE_STATES)[number];

export const GUEST_ACCESS_LEVELS = [
  "FULL_STAY",
  "AFTER_TRIP",
  "PRE_TRIP",
  "LOCAL_AT_HOME",
  "PLANNING",
] as const;

export type GuestAccessLevel = (typeof GUEST_ACCESS_LEVELS)[number];

export const GUEST_TRIP_MODES = [
  "PRE_TRIP_MODE",
  "DURING_TRIP_MODE",
  "AFTER_TRIP_MODE",
  "PLANNING_MODE",
  "REACTIVATED_FULL_MODE",
] as const;

export type GuestTripMode = (typeof GUEST_TRIP_MODES)[number];

/** Capabilities gated by access — enforce in code, not only UI hide. */
export type GuestCapability =
  | "hotel_services"
  | "hotel_events"
  | "hotel_offers"
  | "late_checkout"
  | "room_service"
  | "ask_reception"
  | "in_stay_local_friend"
  | "octopus_concierge"
  | "stay_smarttraveler_perks"
  | "city_memory"
  | "saves"
  | "follows"
  | "discovery"
  | "trip_planning"
  | "public_guides"
  | "experiences"
  | "bottle_planning"
  | "local_at_home"
  | "reactivate_stay";

export type GuestStayRecord = {
  id: string;
  userId: string;
  hotelId: string | null;
  hotelSlug: string | null;
  hotelName: string | null;
  city: string;
  roomNumber: string | null;
  bookingNumber: string;
  bookingSource: string;
  status: "confirmed" | "checked_in" | "checked_out" | "cancelled" | "upcoming";
  checkInAt: string | null;
  checkOutAt: string | null;
  plannedCheckInAt: string | null;
  plannedCheckOutAt: string | null;
  isActive: boolean;
  reactivatedFromStayId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GuestLifecycleRecord = {
  userId: string;
  state: GuestLifecycleState;
  accessLevel: GuestAccessLevel;
  mode: GuestTripMode;
  activeStayId: string | null;
  lastCity: string | null;
  lastHotelSlug: string | null;
  lastHotelName: string | null;
  nextTripIntent: string | null;
  nextDestination: string | null;
  lastCheckedOutAt: string | null;
  lastReactivatedAt: string | null;
  lastActivationAt: string | null;
  conciergeEntitled: boolean;
  tasteSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CityMemoryKind =
  | "saved_place"
  | "liked_place"
  | "neighborhood"
  | "followed_bandit"
  | "guide"
  | "experience"
  | "smarttraveler"
  | "bottle_journey"
  | "category"
  | "destination_visited"
  | "spot";

export type CityMemoryItem = {
  id: string;
  userId: string;
  city: string;
  kind: CityMemoryKind;
  entityId: string | null;
  title: string;
  subtitle: string | null;
  category: string | null;
  neighborhood: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GuestLifecycleEventType =
  | "guest.checked_in"
  | "guest.checked_out"
  | "guest.entered_after_trip_mode"
  | "guest.saved_place"
  | "guest.followed_bandit"
  | "guest.started_trip_planning"
  | "guest.added_new_booking"
  | "guest.reactivated"
  | "guest.started_new_stay"
  | "guest.attached_pre_trip";

export type GuestLifecycleEvent = {
  id: string;
  userId: string;
  eventType: GuestLifecycleEventType;
  stayId: string | null;
  fromState: GuestLifecycleState | null;
  toState: GuestLifecycleState | null;
  accessLevel: GuestAccessLevel | null;
  city: string | null;
  hotelSlug: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type GuestLifecycleSnapshot = {
  lifecycle: GuestLifecycleRecord;
  activeStay: GuestStayRecord | null;
  stays: GuestStayRecord[];
  cityMemory: CityMemoryItem[];
  recentEvents: GuestLifecycleEvent[];
};

/** Demo booking used for PLAY Theatrou seed stay. */
export const DEMO_STAY_BOOKING = "PLAY-ATH-402";
export const DEMO_HOTEL_SLUG = "play-theatrou";
export const DEMO_HOTEL_NAME = "PLAY Theatrou";
export const DEMO_CITY = "Athens";
export const DEMO_ROOM = "402";
