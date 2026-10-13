/**
 * Lifecycle analytics + live bus fan-out.
 * Philosophy: return-with-intent metrics, not DAU scrolling.
 */

import { trackEvent, type AnalyticsEventName } from "@/lib/analytics";
import { publishGuestLiveEvent } from "@/lib/orchestra/live-bus";
import type { GuestLiveEventType } from "@/lib/orchestra/live-events";

import type { LocalBundle } from "./store";
import type { GuestLifecycleEventType } from "./types";

const ANALYTICS_MAP: Partial<Record<GuestLifecycleEventType, AnalyticsEventName>> = {
  "guest.checked_out": "lifecycle_checkout",
  "guest.entered_after_trip_mode": "lifecycle_after_trip",
  "guest.started_trip_planning": "lifecycle_trip_planning",
  "guest.reactivated": "lifecycle_reactivated",
  "guest.added_new_booking": "lifecycle_new_booking",
  "guest.checked_in": "lifecycle_checked_in",
  "guest.started_new_stay": "lifecycle_new_stay",
  "guest.saved_place": "lifecycle_saved_place",
  "guest.followed_bandit": "lifecycle_followed_bandit",
};

export async function emitLifecycleAnalytics(
  eventType: GuestLifecycleEventType,
  bundle: LocalBundle,
): Promise<void> {
  const mapped = ANALYTICS_MAP[eventType];
  if (!mapped) return;
  await trackEvent({
    eventName: mapped,
    referenceType: "guest_lifecycle",
    referenceId: bundle.lifecycle.userId,
  });
}

const LIVE_MAP: Partial<Record<GuestLifecycleEventType, GuestLiveEventType>> = {
  "guest.checked_out": "guest.checked_out",
  "guest.checked_in": "guest.checked_in",
  "guest.reactivated": "guest.reactivated",
  "guest.entered_after_trip_mode": "guest.entered_after_trip_mode",
  "guest.started_trip_planning": "guest.started_trip_planning",
  "guest.added_new_booking": "guest.added_new_booking",
  "guest.started_new_stay": "guest.started_new_stay",
};

export async function publishLifecycleLiveEvent(
  eventType: GuestLifecycleEventType,
  bundle: LocalBundle,
): Promise<void> {
  const liveType = LIVE_MAP[eventType];
  if (!liveType) return;
  try {
    publishGuestLiveEvent({
      type: liveType,
      title: eventType,
      detail: `${bundle.lifecycle.state} · ${bundle.lifecycle.accessLevel}`,
      entityId: bundle.lifecycle.activeStayId ?? bundle.lifecycle.userId,
      propertySlug: bundle.lifecycle.lastHotelSlug ?? undefined,
      destination: bundle.lifecycle.lastCity ?? undefined,
    });
  } catch {
    /* non-blocking */
  }
}
