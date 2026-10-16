/**
 * Guest lifecycle transitions — the only way state changes.
 * Checkout never signs out; it shifts access to AFTER_TRIP.
 */

import { can, canUseTravelBottle } from "./access";
import {
  appendLifecycleEvent,
  applyState,
  loadGuestLifecycleSnapshot,
  persistBundle,
  type LocalBundle,
} from "./store";
import type {
  GuestLifecycleSnapshot,
  GuestStayRecord,
} from "./types";
import { DEMO_CITY, DEMO_HOTEL_NAME, DEMO_HOTEL_SLUG } from "./types";
import { emitLifecycleAnalytics, publishLifecycleLiveEvent } from "./events";
import { syncTransitionToWorkspace } from "./workspace-sync";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getGuestLifecycle(): Promise<GuestLifecycleSnapshot> {
  return loadGuestLifecycleSnapshot();
}

/** Hotel confirms checkout OR checkout time reached → AFTER_TRIP. Does NOT log out. */
export async function transitionCheckout(opts?: {
  confirmedByHotel?: boolean;
}): Promise<GuestLifecycleSnapshot> {
  const snap = await persistBundle((bundle) => {
    const from = bundle.lifecycle.state;
    const t = nowIso();
    const stays = bundle.stays.map((s) =>
      s.isActive || s.id === bundle.lifecycle.activeStayId
        ? {
            ...s,
            status: "checked_out" as const,
            isActive: false,
            checkOutAt: t,
            updatedAt: t,
          }
        : s,
    );
    let next = applyState(
      { ...bundle, stays },
      "AFTER_TRIP",
      {
        activeStayId: null,
        lastCheckedOutAt: t,
        /** Paid Concierge / Stay Pass validity is contractual — not cleared by checkout alone. */
      },
    );
    next = appendLifecycleEvent(next, {
      eventType: "guest.checked_out",
      fromState: from,
      toState: "AFTER_TRIP",
      payload: { confirmedByHotel: opts?.confirmedByHotel ?? true },
    });
    next = appendLifecycleEvent(next, {
      eventType: "guest.entered_after_trip_mode",
      fromState: from,
      toState: "AFTER_TRIP",
    });
    void emitLifecycleAnalytics("guest.checked_out", next);
    void emitLifecycleAnalytics("guest.entered_after_trip_mode", next);
    void publishLifecycleLiveEvent("guest.checked_out", next);
    syncTransitionToWorkspace("checkout", {
      confirmedByHotel: opts?.confirmedByHotel ?? true,
    });
    return next;
  });
  try {
    const { recordLifecycleNotice } = await import("@/lib/lifecycle/notices");
    await recordLifecycleNotice({
      id: `after_checkout_${snap.lifecycle.userId}`,
      userId: snap.lifecycle.userId,
      title: "Your journey doesn't end here.",
      message: "Explore your memories. City Memory stays with you.",
      href: "/cityMemory",
    });
  } catch {
    /* inbox notice is best-effort */
  }
  return snap;
}

/** Explicit check-in → ACTIVE_STAY + FULL_STAY. */
export async function transitionCheckIn(stayId?: string): Promise<GuestLifecycleSnapshot> {
  return persistBundle((bundle) => {
    const from = bundle.lifecycle.state;
    const t = nowIso();
    const targetId = stayId ?? bundle.lifecycle.activeStayId ?? bundle.stays[0]?.id;
    const stays = bundle.stays.map((s) => ({
      ...s,
      isActive: s.id === targetId,
      status: s.id === targetId ? ("checked_in" as const) : s.status === "checked_in" ? ("checked_out" as const) : s.status,
      checkInAt: s.id === targetId ? t : s.checkInAt,
      updatedAt: t,
    }));
    const stay = stays.find((s) => s.id === targetId);
    let next = applyState(
      { ...bundle, stays },
      "ACTIVE_STAY",
      {
        activeStayId: targetId ?? null,
        lastCity: stay?.city ?? bundle.lifecycle.lastCity,
        lastHotelSlug: stay?.hotelSlug ?? bundle.lifecycle.lastHotelSlug,
        lastHotelName: stay?.hotelName ?? bundle.lifecycle.lastHotelName,
        lastActivationAt: t,
        conciergeEntitled: true,
      },
    );
    next = appendLifecycleEvent(next, {
      eventType: "guest.checked_in",
      fromState: from,
      toState: "ACTIVE_STAY",
      stayId: targetId,
    });
    next = appendLifecycleEvent(next, {
      eventType: "guest.started_new_stay",
      fromState: from,
      toState: "ACTIVE_STAY",
      stayId: targetId,
    });
    void emitLifecycleAnalytics("guest.checked_in", next);
    void publishLifecycleLiveEvent("guest.checked_in", next);
    syncTransitionToWorkspace("check_in", { stayId: targetId });
    return next;
  });
}

/** User plans another trip → NEXT_TRIP_PLANNING (keeps City Memory). */
export async function transitionStartTripPlanning(opts?: {
  intent?: string;
  destination?: string;
}): Promise<GuestLifecycleSnapshot> {
  return persistBundle((bundle) => {
    const from = bundle.lifecycle.state;
    let next = applyState(bundle, "NEXT_TRIP_PLANNING", {
      nextTripIntent: opts?.intent ?? "Plan next trip",
      nextDestination: opts?.destination ?? null,
    });
    next = appendLifecycleEvent(next, {
      eventType: "guest.started_trip_planning",
      fromState: from,
      toState: "NEXT_TRIP_PLANNING",
      payload: { intent: opts?.intent, destination: opts?.destination },
    });
    void emitLifecycleAnalytics("guest.started_trip_planning", next);
    void publishLifecycleLiveEvent("guest.started_trip_planning", next);
    const uid = next.lifecycle.userId;
    void import("@/lib/lifecycle/notices").then(({ recordLifecycleNotice }) =>
      recordLifecycleNotice({
        id: `between_trips_${uid}`,
        userId: uid,
        title: "Where would you love to go next?",
        message: "Choose a Dream Destination when you want inspiration — not a new booking.",
        href: "/dreamDestinations",
      }),
    );
    syncTransitionToWorkspace("start_trip_planning", {
      intent: opts?.intent,
      destination: opts?.destination,
    });
    return next;
  });
}

/**
 * ADD/ACTIVATE NEW STAY: booking number + identity verify → attach to same guest.
 * Keeps all prior memory. New stay ADDED not reset.
 */
export async function transitionAddBookingAndReactivate(input: {
  bookingNumber: string;
  hotelSlug?: string;
  hotelName?: string;
  city?: string;
  roomNumber?: string;
  guestName?: string;
}): Promise<GuestLifecycleSnapshot> {
  const booking = String(input.bookingNumber || "").trim().toUpperCase();
  if (booking.length < 4) {
    throw new Error("INVALID_BOOKING_NUMBER");
  }

  return persistBundle((bundle) => {
    // Soft identity continuity: same persisted account; booking attaches.
    const from = bundle.lifecycle.state;
    const t = nowIso();
    const existing = bundle.stays.find(
      (s) => s.bookingNumber.toUpperCase() === booking,
    );
    let stay: GuestStayRecord;
    let stays = bundle.stays.map((s) => ({ ...s, isActive: false }));

    if (existing) {
      stay = {
        ...existing,
        isActive: true,
        status: "confirmed",
        hotelSlug: input.hotelSlug ?? existing.hotelSlug,
        hotelName: input.hotelName ?? existing.hotelName,
        city: input.city ?? existing.city,
        roomNumber: input.roomNumber ?? existing.roomNumber,
        updatedAt: t,
      };
      stays = stays.map((s) => (s.id === stay.id ? stay : s));
    } else {
      stay = {
        id: newId("stay"),
        userId: bundle.lifecycle.userId,
        hotelId: null,
        hotelSlug: input.hotelSlug ?? bundle.lifecycle.lastHotelSlug,
        hotelName: input.hotelName ?? bundle.lifecycle.lastHotelName,
        city: input.city ?? bundle.lifecycle.lastCity ?? DEMO_CITY,
        roomNumber: input.roomNumber ?? null,
        bookingNumber: booking,
        bookingSource: "reactivation",
        status: "confirmed",
        checkInAt: null,
        checkOutAt: null,
        plannedCheckInAt: t,
        plannedCheckOutAt: null,
        isActive: true,
        reactivatedFromStayId: bundle.stays.find((s) => s.status === "checked_out")?.id ?? null,
        createdAt: t,
        updatedAt: t,
      };
      stays = [...stays, stay];
    }

    let next: LocalBundle = {
      ...bundle,
      stays,
      // Preserve cityMemory entirely — never wipe
    };
    next = applyState(next, "REACTIVATED", {
      activeStayId: stay.id,
      lastCity: stay.city,
      lastHotelSlug: stay.hotelSlug,
      lastHotelName: stay.hotelName,
      lastReactivatedAt: t,
      lastActivationAt: t,
      conciergeEntitled: true,
      nextTripIntent: null,
    });
    next = appendLifecycleEvent(next, {
      eventType: "guest.added_new_booking",
      fromState: from,
      toState: "REACTIVATED",
      stayId: stay.id,
      payload: { bookingNumber: booking, guestName: input.guestName },
    });
    next = appendLifecycleEvent(next, {
      eventType: "guest.reactivated",
      fromState: from,
      toState: "REACTIVATED",
      stayId: stay.id,
    });
    void emitLifecycleAnalytics("guest.added_new_booking", next);
    void emitLifecycleAnalytics("guest.reactivated", next);
    void publishLifecycleLiveEvent("guest.reactivated", next);
    syncTransitionToWorkspace("reactivate", {
      bookingNumber: booking,
      hotelSlug: stay.hotelSlug,
      hotelName: stay.hotelName,
      city: stay.city,
      roomNumber: stay.roomNumber,
      guestName: input.guestName,
    });
    return next;
  });
}

/**
 * Hotel unlock / booking attach before arrival → PRE_TRIP.
 * Does not create a new identity; attaches stay to existing guest.
 */
export async function transitionAttachPreTrip(input: {
  bookingNumber: string;
  hotelSlug?: string;
  hotelName?: string;
  city?: string;
  roomNumber?: string;
}): Promise<GuestLifecycleSnapshot> {
  const booking = String(input.bookingNumber || "").trim().toUpperCase();
  if (booking.length < 4) {
    throw new Error("INVALID_BOOKING_NUMBER");
  }

  return persistBundle((bundle) => {
    const from = bundle.lifecycle.state;
    const t = nowIso();
    const stay: GuestStayRecord = {
      id: newId("stay"),
      userId: bundle.lifecycle.userId,
      hotelId: null,
      hotelSlug: input.hotelSlug ?? bundle.lifecycle.lastHotelSlug,
      hotelName: input.hotelName ?? bundle.lifecycle.lastHotelName,
      city: input.city ?? bundle.lifecycle.lastCity ?? DEMO_CITY,
      roomNumber: input.roomNumber ?? null,
      bookingNumber: booking,
      bookingSource: "unlock",
      status: "upcoming",
      checkInAt: null,
      checkOutAt: null,
      plannedCheckInAt: t,
      plannedCheckOutAt: null,
      isActive: true,
      reactivatedFromStayId: null,
      createdAt: t,
      updatedAt: t,
    };
    const stays = [
      ...bundle.stays
        .filter((s) => {
          const liveSlug = String(stay.hotelSlug || "");
          if (liveSlug && liveSlug !== DEMO_HOTEL_SLUG && s.bookingSource === "seed") return false;
          return true;
        })
        .map((s) => ({ ...s, isActive: false })),
      stay,
    ];
    let next = applyState(
      { ...bundle, stays },
      "PRE_TRIP",
      {
        activeStayId: stay.id,
        lastCity: stay.city,
        lastHotelSlug: stay.hotelSlug,
        lastHotelName: stay.hotelName,
        lastActivationAt: t,
        conciergeEntitled: false,
      },
    );
    next = appendLifecycleEvent(next, {
      eventType: "guest.attached_pre_trip",
      fromState: from,
      toState: "PRE_TRIP",
      stayId: stay.id,
      payload: { bookingNumber: booking },
    });
    syncTransitionToWorkspace("attach_pre_trip", {
      bookingNumber: booking,
      hotelSlug: stay.hotelSlug,
      hotelName: stay.hotelName,
      city: stay.city,
      roomNumber: stay.roomNumber,
    });
    return next;
  });
}

/** When stay begins after reactivation → ACTIVE_STAY. */
export async function transitionStartStayFromReactivated(): Promise<GuestLifecycleSnapshot> {
  const snap = await loadGuestLifecycleSnapshot();
  if (snap.lifecycle.state !== "REACTIVATED" && snap.lifecycle.state !== "PRE_TRIP") {
    return snap;
  }
  syncTransitionToWorkspace("start_stay_from_reactivated");
  return transitionCheckIn(snap.lifecycle.activeStayId ?? undefined);
}

export async function recordSavedPlace(input: {
  city: string;
  title: string;
  entityId?: string;
  category?: string;
  neighborhood?: string;
  imageUrl?: string | null;
  loved?: boolean;
}): Promise<GuestLifecycleSnapshot> {
  return persistBundle((bundle) => {
    if (!can(bundle.lifecycle.accessLevel, "saves")) {
      throw new Error("ACCESS_DENIED:saves");
    }
    const t = nowIso();
    const entityId = input.entityId ?? null;
    const kind = input.loved ? ("liked_place" as const) : ("saved_place" as const);
    const dedupeKey = `${kind}:${entityId || input.title}:${input.city}`;
    const already = bundle.cityMemory.some((m) => {
      const k = `${m.kind}:${m.entityId || m.title}:${m.city}`;
      return k === dedupeKey;
    });
    if (already) return bundle;
    const item = {
      id: newId("mem"),
      userId: bundle.lifecycle.userId,
      city: input.city,
      kind,
      entityId,
      title: input.title,
      subtitle: input.loved ? "Place you loved" : "Saved place",
      category: input.category ?? null,
      neighborhood: input.neighborhood ?? null,
      meta: {
        ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
        ...(input.loved ? { loved: true } : {}),
      },
      createdAt: t,
      updatedAt: t,
    };
    let next = { ...bundle, cityMemory: [...bundle.cityMemory, item] };
    next = appendLifecycleEvent(next, {
      eventType: "guest.saved_place",
      payload: { title: input.title, city: input.city },
    });
    void emitLifecycleAnalytics("guest.saved_place", next);
    return next;
  });
}

export async function recordFollowedBandit(input: {
  city: string;
  banditId: string;
  title: string;
  avatarUrl?: string | null;
}): Promise<GuestLifecycleSnapshot> {
  return persistBundle((bundle) => {
    if (!can(bundle.lifecycle.accessLevel, "follows")) {
      throw new Error("ACCESS_DENIED:follows");
    }
    const exists = bundle.cityMemory.some(
      (m) => m.kind === "followed_bandit" && m.entityId === input.banditId,
    );
    const t = nowIso();
    const displayTitle = String(input.title || "").trim() || "Local banDit";
    const cityMemory = exists
      ? bundle.cityMemory.map((m) =>
          m.kind === "followed_bandit" && m.entityId === input.banditId
            ? {
                ...m,
                title: displayTitle,
                updatedAt: t,
                meta: {
                  ...(m.meta || {}),
                  ...(input.avatarUrl ? { avatarUrl: input.avatarUrl, imageUrl: input.avatarUrl } : {}),
                },
              }
            : m,
        )
      : [
          ...bundle.cityMemory,
          {
            id: newId("mem"),
            userId: bundle.lifecycle.userId,
            city: input.city,
            kind: "followed_bandit" as const,
            entityId: input.banditId,
            title: displayTitle,
            subtitle: "Followed banDit",
            category: "bandit",
            neighborhood: null,
            meta: input.avatarUrl
              ? { avatarUrl: input.avatarUrl, imageUrl: input.avatarUrl }
              : {},
            createdAt: t,
            updatedAt: t,
          },
        ];
    let next = { ...bundle, cityMemory };
    next = appendLifecycleEvent(next, {
      eventType: "guest.followed_bandit",
      payload: { banditId: input.banditId, title: input.title },
    });
    void emitLifecycleAnalytics("guest.followed_bandit", next);
    return next;
  });
}

export function assertBottleAllowed(state: GuestLifecycleSnapshot["lifecycle"]["state"]): void {
  if (!canUseTravelBottle(state)) {
    throw new Error("ACCESS_DENIED:bottle_planning");
  }
}

/** Full E2E walk for tests / demo. */
export async function runLifecycleDemoSequence(): Promise<{
  steps: { step: string; state: string; access: string }[];
  final: GuestLifecycleSnapshot;
}> {
  const steps: { step: string; state: string; access: string }[] = [];
  const push = async (label: string, snap: GuestLifecycleSnapshot) => {
    steps.push({
      step: label,
      state: snap.lifecycle.state,
      access: snap.lifecycle.accessLevel,
    });
  };

  // Ensure ACTIVE_STAY start
  let snap = await transitionCheckIn();
  await push("ACTIVE_STAY", snap);

  snap = await transitionCheckout({ confirmedByHotel: true });
  await push("CHECKOUT → AFTER_TRIP", snap);

  snap = await transitionStartTripPlanning({
    intent: "Find next city",
    destination: "Lisbon",
  });
  await push("NEXT_TRIP_PLANNING", snap);

  snap = await transitionAddBookingAndReactivate({
    bookingNumber: "PLAY-ATH-NEXT-01",
    hotelSlug: DEMO_HOTEL_SLUG,
    hotelName: DEMO_HOTEL_NAME,
    city: DEMO_CITY,
    roomNumber: "218",
  });
  await push("NEW BOOKING → REACTIVATED", snap);

  snap = await transitionStartStayFromReactivated();
  await push("REACTIVATED → ACTIVE_STAY", snap);

  return { steps, final: snap };
}
