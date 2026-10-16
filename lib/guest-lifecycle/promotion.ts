/**
 * When to welcome, accompany, say goodbye, or invite a return.
 * Never inferred from the clock, demo dates, or a half-filled profile.
 */
import type { GuestLifecycleState } from "@/lib/guest-lifecycle/types";

export type StayPromotionPhase =
  | "unknown"
  | "before_stay"
  | "during_stay"
  | "near_checkout"
  | "after_checkout"
  | "between_trips";

export function promotionPhaseForState(
  state: GuestLifecycleState | null | undefined,
  nearCheckout = false,
): StayPromotionPhase {
  if (!state) return "unknown";
  if (nearCheckout && (state === "ACTIVE_STAY" || state === "REACTIVATED")) {
    return "near_checkout";
  }
  switch (state) {
    case "PRE_TRIP":
      return "before_stay";
    case "ACTIVE_STAY":
    case "REACTIVATED":
      return "during_stay";
    case "AFTER_TRIP":
      return "after_checkout";
    case "NEXT_TRIP_PLANNING":
      return "between_trips";
    default:
      return "unknown";
  }
}

/** Compact Home module — only after a real checkout, not on arrival. */
export function showBetweenTripsModule(phase: StayPromotionPhase): boolean {
  return phase === "after_checkout" || phase === "between_trips";
}
