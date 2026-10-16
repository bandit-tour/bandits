/**
 * React hook — Guest Trip OS lifecycle snapshot.
 */

import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

import {
  getGuestLifecycle,
  type GuestLifecycleSnapshot,
} from "@/lib/guest-lifecycle";
import { can, isAfterTripExperience, isFullStayAccess } from "@/lib/guest-lifecycle/access";
import { buildAfterTripHome } from "@/lib/guest-lifecycle/city-memory";
import { promotionPhaseForState, type StayPromotionPhase } from "@/lib/guest-lifecycle/promotion";
import type { GuestAccessLevel, GuestLifecycleState } from "@/lib/guest-lifecycle/types";

type GuestStateQuery = GuestLifecycleState | "NEAR_CHECKOUT" | "UNKNOWN";

/** QA / Playwright: `?guestState=` presentation only. UNKNOWN does not invent a finished trip. */
function webGuestStateOverride(): GuestStateQuery | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const raw = new URLSearchParams(window.location.search).get("guestState");
    if (
      raw === "AFTER_TRIP" ||
      raw === "PRE_TRIP" ||
      raw === "ACTIVE_STAY" ||
      raw === "NEXT_TRIP_PLANNING" ||
      raw === "REACTIVATED" ||
      raw === "NEAR_CHECKOUT" ||
      raw === "UNKNOWN"
    ) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function accessForOverride(state: GuestLifecycleState): GuestAccessLevel {
  if (state === "ACTIVE_STAY" || state === "REACTIVATED") return "FULL_STAY";
  if (state === "AFTER_TRIP") return "AFTER_TRIP";
  if (state === "NEXT_TRIP_PLANNING") return "PLANNING";
  return "PRE_TRIP";
}

export function useGuestLifecycle() {
  const [snap, setSnap] = useState<GuestLifecycleSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  /** Re-read on every render so SSR/null window does not permanently cache null. */
  const [override, setOverride] = useState<GuestStateQuery | null>(() => webGuestStateOverride());

  useEffect(() => {
    setOverride(webGuestStateOverride());
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onNav = () => setOverride(webGuestStateOverride());
    window.addEventListener("popstate", onNav);
    return () => window.removeEventListener("popstate", onNav);
  }, []);

  // Expo Router soft-nav may change search without popstate — poll search string lightly.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const id = setInterval(() => {
      const next = webGuestStateOverride();
      setOverride((prev) => (prev === next ? prev : next));
    }, 400);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await getGuestLifecycle();
      setSnap(next);
      return next;
    } catch {
      /* Never throw into screen mounts (Android More tab). */
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const baseAccess = snap?.lifecycle.accessLevel ?? "PRE_TRIP";
  const baseState = snap?.lifecycle.state ?? "PRE_TRIP";
  const forcedUnknown = override === "UNKNOWN" || (loading && !override);
  const nearCheckout =
    !forcedUnknown &&
    (override === "NEAR_CHECKOUT" || snap?.lifecycle.checkoutWindowOpen === true);
  const state: GuestLifecycleState = forcedUnknown
    ? "PRE_TRIP"
    : override === "NEAR_CHECKOUT"
      ? "ACTIVE_STAY"
      : override && override !== "UNKNOWN"
        ? override
        : baseState;
  const access = forcedUnknown
    ? "PRE_TRIP"
    : override && override !== "UNKNOWN" && override !== "NEAR_CHECKOUT"
      ? accessForOverride(override)
      : nearCheckout
        ? "FULL_STAY"
        : override
          ? accessForOverride(state)
          : baseAccess;
  const phase: StayPromotionPhase = forcedUnknown
    ? "unknown"
    : promotionPhaseForState(state, nearCheckout);
  const afterTripHome = snap ? buildAfterTripHome(snap) : null;

  return {
    snap,
    loading,
    refresh,
    state,
    phase,
    nearCheckout,
    access,
    mode: snap?.lifecycle.mode ?? "PRE_TRIP_MODE",
    activeStay:
      forcedUnknown ||
      (override && override !== "ACTIVE_STAY" && override !== "REACTIVATED" && override !== "NEAR_CHECKOUT")
        ? null
        : (snap?.activeStay ?? null),
    isFullStay: phase === "during_stay" || phase === "near_checkout" || isFullStayAccess(access),
    isAfterTrip: phase === "after_checkout" || phase === "between_trips" || isAfterTripExperience(state),
    can: (cap: Parameters<typeof can>[1]) => can(access, cap),
    afterTripHome,
  };
}
