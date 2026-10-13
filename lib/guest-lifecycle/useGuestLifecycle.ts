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
import type { GuestAccessLevel, GuestLifecycleState } from "@/lib/guest-lifecycle/types";

/** QA / Playwright: `?guestState=AFTER_TRIP|PRE_TRIP|ACTIVE_STAY` on web. */
function webGuestStateOverride(): GuestLifecycleState | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const raw = new URLSearchParams(window.location.search).get("guestState");
    if (
      raw === "AFTER_TRIP" ||
      raw === "PRE_TRIP" ||
      raw === "ACTIVE_STAY" ||
      raw === "NEXT_TRIP_PLANNING" ||
      raw === "REACTIVATED"
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
  const [override, setOverride] = useState<GuestLifecycleState | null>(() => webGuestStateOverride());

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
  const state = override ?? baseState;
  const access = override ? accessForOverride(override) : baseAccess;
  const afterTripHome = snap ? buildAfterTripHome(snap) : null;

  return {
    snap,
    loading,
    refresh,
    state,
    access,
    mode: snap?.lifecycle.mode ?? "PRE_TRIP_MODE",
    activeStay:
      override && override !== "ACTIVE_STAY" && override !== "REACTIVATED"
        ? null
        : (snap?.activeStay ?? null),
    isFullStay: isFullStayAccess(access),
    isAfterTrip: isAfterTripExperience(state),
    can: (cap: Parameters<typeof can>[1]) => can(access, cap),
    afterTripHome,
  };
}
