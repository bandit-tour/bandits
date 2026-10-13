/**
 * Durable guest lifecycle store — AsyncStorage primary + Supabase when tables exist.
 * Never logs the user out on checkout. Memory survives.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

import { accessLevelForState, modeForState } from "./access";
import type {
  CityMemoryItem,
  GuestLifecycleEvent,
  GuestLifecycleEventType,
  GuestLifecycleRecord,
  GuestLifecycleSnapshot,
  GuestLifecycleState,
  GuestStayRecord,
} from "./types";
import {
  DEMO_CITY,
  DEMO_HOTEL_NAME,
  DEMO_HOTEL_SLUG,
  DEMO_ROOM,
  DEMO_STAY_BOOKING,
} from "./types";

const STORAGE_KEY = "@bandits_guest_lifecycle_v1";

type LocalBundle = {
  lifecycle: GuestLifecycleRecord;
  stays: GuestStayRecord[];
  cityMemory: CityMemoryItem[];
  events: GuestLifecycleEvent[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function demoStay(userId: string): GuestStayRecord {
  const t = nowIso();
  return {
    id: `stay_demo_${userId.slice(0, 8)}`,
    userId,
    hotelId: null,
    hotelSlug: DEMO_HOTEL_SLUG,
    hotelName: DEMO_HOTEL_NAME,
    city: DEMO_CITY,
    roomNumber: DEMO_ROOM,
    bookingNumber: DEMO_STAY_BOOKING,
    bookingSource: "seed",
    status: "checked_in",
    checkInAt: t,
    checkOutAt: null,
    plannedCheckInAt: t,
    plannedCheckOutAt: null,
    isActive: true,
    reactivatedFromStayId: null,
    createdAt: t,
    updatedAt: t,
  };
}

function seedBundle(userId: string): LocalBundle {
  const stay = demoStay(userId);
  const t = nowIso();
  const lifecycle: GuestLifecycleRecord = {
    userId,
    state: "ACTIVE_STAY",
    accessLevel: "FULL_STAY",
    mode: "DURING_TRIP_MODE",
    activeStayId: stay.id,
    lastCity: DEMO_CITY,
    lastHotelSlug: DEMO_HOTEL_SLUG,
    lastHotelName: DEMO_HOTEL_NAME,
    nextTripIntent: null,
    nextDestination: null,
    lastCheckedOutAt: null,
    lastReactivatedAt: null,
    lastActivationAt: t,
    conciergeEntitled: true,
    tasteSummary: { cities: [DEMO_CITY], neighborhoods: ["Psyrri", "Exarchia"] },
    createdAt: t,
    updatedAt: t,
  };
  const cityMemory: CityMemoryItem[] = [
    {
      id: newId("mem"),
      userId,
      city: DEMO_CITY,
      kind: "destination_visited",
      entityId: DEMO_CITY.toLowerCase(),
      title: "Athens",
      subtitle: "Current trip city",
      category: "city",
      neighborhood: null,
      meta: {},
      createdAt: t,
      updatedAt: t,
    },
    {
      id: newId("mem"),
      userId,
      city: DEMO_CITY,
      kind: "neighborhood",
      entityId: "psyrri",
      title: "Psyrri",
      subtitle: "Hotel neighborhood",
      category: "neighborhood",
      neighborhood: "Psyrri",
      meta: {},
      createdAt: t,
      updatedAt: t,
    },
    {
      id: newId("mem"),
      userId,
      city: DEMO_CITY,
      kind: "spot",
      entityId: "spot_courtyard",
      title: "Courtyard Kitchen",
      subtitle: "Place you loved",
      category: "Food",
      neighborhood: "Psyrri",
      meta: { loved: true },
      createdAt: t,
      updatedAt: t,
    },
  ];
  return { lifecycle, stays: [stay], cityMemory, events: [] };
}

async function resolveUserId(): Promise<string> {
  if (isSupabaseConfigured()) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) return session.user.id;
    } catch {
      /* fall through */
    }
  }
  const cached = await AsyncStorage.getItem("@bandits_lifecycle_anon_id");
  if (cached) return cached;
  const id = `local_${Date.now().toString(36)}`;
  await AsyncStorage.setItem("@bandits_lifecycle_anon_id", id);
  return id;
}

function emptyBundle(userId: string): LocalBundle {
  const t = nowIso();
  const state = "PRE_TRIP" as const;
  const lifecycle: GuestLifecycleRecord = {
    userId,
    state,
    accessLevel: accessLevelForState(state),
    mode: modeForState(state),
    activeStayId: null,
    lastCity: null,
    lastHotelSlug: null,
    lastHotelName: null,
    nextTripIntent: null,
    nextDestination: null,
    lastCheckedOutAt: null,
    lastReactivatedAt: null,
    lastActivationAt: null,
    conciergeEntitled: false,
    tasteSummary: {},
    createdAt: t,
    updatedAt: t,
  };
  return { lifecycle, stays: [], cityMemory: [], events: [] };
}

async function readLocal(userId: string): Promise<LocalBundle> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalBundle;
      if (parsed?.lifecycle?.userId === userId) return parsed;
      // Migrate bundle to current user id (same device account continuity)
      if (parsed?.lifecycle) {
        parsed.lifecycle.userId = userId;
        parsed.stays = (parsed.stays || []).map((s) => ({ ...s, userId }));
        parsed.cityMemory = (parsed.cityMemory || []).map((m) => ({ ...m, userId }));
        parsed.events = (parsed.events || []).map((e) => ({ ...e, userId }));
        await writeLocal(parsed);
        return parsed;
      }
    }
  } catch {
    /* seed */
  }
  const seeded = emptyBundle(userId);
  await writeLocal(seeded);
  return seeded;
}

async function writeLocal(bundle: LocalBundle): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
}

async function trySyncSupabase(bundle: LocalBundle): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const uid = bundle.lifecycle.userId;
  if (uid.startsWith("local_")) return;
  try {
    const lc = bundle.lifecycle;
    await supabase.from("guest_lifecycle" as never).upsert(
      {
        user_id: lc.userId,
        state: lc.state,
        access_level: lc.accessLevel,
        mode: lc.mode,
        active_stay_id: lc.activeStayId,
        last_city: lc.lastCity,
        last_hotel_slug: lc.lastHotelSlug,
        last_hotel_name: lc.lastHotelName,
        next_trip_intent: lc.nextTripIntent,
        next_destination: lc.nextDestination,
        last_checked_out_at: lc.lastCheckedOutAt,
        last_reactivated_at: lc.lastReactivatedAt,
        last_activation_at: lc.lastActivationAt,
        concierge_entitled: lc.conciergeEntitled,
        taste_summary: lc.tasteSummary,
        updated_at: lc.updatedAt,
      } as never,
      { onConflict: "user_id" } as never,
    );
  } catch {
    /* table may not be migrated yet — local store is source of truth */
  }
}

export async function loadGuestLifecycleSnapshot(): Promise<GuestLifecycleSnapshot> {
  const userId = await resolveUserId();
  const bundle = await readLocal(userId);
  const activeStay =
    bundle.stays.find((s) => s.id === bundle.lifecycle.activeStayId) ??
    bundle.stays.find((s) => s.isActive) ??
    null;
  return {
    lifecycle: bundle.lifecycle,
    activeStay,
    stays: bundle.stays,
    cityMemory: bundle.cityMemory,
    recentEvents: bundle.events.slice(-40).reverse(),
  };
}

export async function persistBundle(mutator: (b: LocalBundle) => LocalBundle): Promise<GuestLifecycleSnapshot> {
  const userId = await resolveUserId();
  const current = await readLocal(userId);
  const next = mutator(current);
  next.lifecycle.updatedAt = nowIso();
  await writeLocal(next);
  void trySyncSupabase(next);
  const activeStay =
    next.stays.find((s) => s.id === next.lifecycle.activeStayId) ??
    next.stays.find((s) => s.isActive) ??
    null;
  return {
    lifecycle: next.lifecycle,
    activeStay,
    stays: next.stays,
    cityMemory: next.cityMemory,
    recentEvents: next.events.slice(-40).reverse(),
  };
}

export function appendLifecycleEvent(
  bundle: LocalBundle,
  partial: {
    eventType: GuestLifecycleEventType;
    stayId?: string | null;
    fromState?: GuestLifecycleState | null;
    toState?: GuestLifecycleState | null;
    city?: string | null;
    hotelSlug?: string | null;
    payload?: Record<string, unknown>;
  },
): LocalBundle {
  const event: GuestLifecycleEvent = {
    id: newId("evt"),
    userId: bundle.lifecycle.userId,
    eventType: partial.eventType,
    stayId: partial.stayId ?? bundle.lifecycle.activeStayId,
    fromState: partial.fromState ?? null,
    toState: partial.toState ?? null,
    accessLevel: bundle.lifecycle.accessLevel,
    city: partial.city ?? bundle.lifecycle.lastCity,
    hotelSlug: partial.hotelSlug ?? bundle.lifecycle.lastHotelSlug,
    payload: partial.payload ?? {},
    createdAt: nowIso(),
  };
  return { ...bundle, events: [...bundle.events, event] };
}

export function applyState(
  bundle: LocalBundle,
  state: GuestLifecycleState,
  patch: Partial<GuestLifecycleRecord> = {},
): LocalBundle {
  const accessLevel = accessLevelForState(state);
  const mode = modeForState(state);
  return {
    ...bundle,
    lifecycle: {
      ...bundle.lifecycle,
      ...patch,
      state,
      accessLevel,
      mode,
      updatedAt: nowIso(),
    },
  };
}

export async function resetLifecycleToDemoActiveStay(): Promise<GuestLifecycleSnapshot> {
  const userId = await resolveUserId();
  const seeded = seedBundle(userId);
  await writeLocal(seeded);
  void trySyncSupabase(seeded);
  return loadGuestLifecycleSnapshot();
}

export type { LocalBundle };
