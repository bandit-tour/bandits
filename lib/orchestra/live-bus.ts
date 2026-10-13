/**
 * In-process Guest Live Bus — surfaces subscribe; publishers emit.
 * Realtime (Supabase) fans into this bus so screens stay alive without pull-to-refresh.
 */

import { DeviceEventEmitter, type EmitterSubscription } from "react-native";

import { BANDITS_NOTIFICATIONS_REFRESH } from "@/lib/notificationEvents";
import { BANDITS_SCAM_ALERTS_REFRESH } from "@/lib/scamAlertsRefresh";
import {
  GUEST_LIVE_ROUTING,
  type GuestLiveEvent,
  type GuestLiveEventType,
  type GuestLiveSurface,
} from "@/lib/orchestra/live-events";

const SURFACE_PREFIX = "guest_live_surface:";
const EVENT_CHANNEL = "guest_live_event_v1";
const RECENT_MAX = 40;

const recent: GuestLiveEvent[] = [];

export function guestLiveSurfaceChannel(surface: GuestLiveSurface): string {
  return `${SURFACE_PREFIX}${surface}`;
}

export function listRecentGuestLiveEvents(limit = 20): GuestLiveEvent[] {
  return recent.slice(0, limit);
}

/** Publish a typed live event → fan-out to mapped Guest surfaces. */
export function publishGuestLiveEvent(
  partial: Omit<GuestLiveEvent, "id" | "publishedAt" | "surfaces" | "workspace"> & {
    id?: string;
    publishedAt?: string;
    type: GuestLiveEventType;
    surfaces?: GuestLiveSurface[];
  },
): GuestLiveEvent {
  const route = GUEST_LIVE_ROUTING[partial.type];
  const event: GuestLiveEvent = {
    id: partial.id ?? `gle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: partial.type,
    workspace: route.workspace,
    surfaces: partial.surfaces ?? [...route.surfaces],
    title: partial.title,
    detail: partial.detail,
    entityId: partial.entityId,
    propertySlug: partial.propertySlug,
    destination: partial.destination,
    publishedAt: partial.publishedAt ?? new Date().toISOString(),
    sourceRef: partial.sourceRef,
  };

  recent.unshift(event);
  if (recent.length > RECENT_MAX) recent.length = RECENT_MAX;

  try {
    DeviceEventEmitter.emit(EVENT_CHANNEL, event);
    for (const surface of event.surfaces) {
      DeviceEventEmitter.emit(guestLiveSurfaceChannel(surface), event);
    }
    // Keep legacy refresh channels in sync so existing screens stay alive.
    if (event.surfaces.includes("alerts")) {
      DeviceEventEmitter.emit(BANDITS_SCAM_ALERTS_REFRESH);
    }
    if (event.surfaces.includes("notifications")) {
      DeviceEventEmitter.emit(BANDITS_NOTIFICATIONS_REFRESH);
    }
  } catch {
    /* ignore */
  }

  return event;
}

/** Subscribe to one Guest surface — callback should silent-reload that screen's data. */
export function subscribeGuestLiveSurface(
  surface: GuestLiveSurface,
  onEvent: (event: GuestLiveEvent) => void,
): () => void {
  const sub: EmitterSubscription = DeviceEventEmitter.addListener(
    guestLiveSurfaceChannel(surface),
    onEvent,
  );
  return () => sub.remove();
}

/** Subscribe to all guest live events (diagnostics / journey spine). */
export function subscribeGuestLiveEvents(onEvent: (event: GuestLiveEvent) => void): () => void {
  const sub: EmitterSubscription = DeviceEventEmitter.addListener(EVENT_CHANNEL, onEvent);
  return () => sub.remove();
}

/**
 * Map a Postgres table change into a Guest live event and publish.
 * Keep silent — no full-screen loading; screens already use silent reload patterns.
 */
export function publishFromTableChange(input: {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE" | "*";
  row?: Record<string, unknown> | null;
}): GuestLiveEvent | null {
  const table = input.table;
  const row = input.row ?? {};
  const id = String(row.id ?? row.event_id ?? `${table}-${Date.now()}`);
  const title = String(row.title ?? row.name ?? row.headline ?? table);

  if (table === "event" || table === "bandit_event") {
    const genre = String(row.genre ?? row.category ?? "").toLowerCase();
    const hotelish =
      /hotel|rooftop|spa|checkout|lobby|courtyard/i.test(title) ||
      /hotel|rooftop/i.test(genre);
    if (hotelish) {
      return publishGuestLiveEvent({
        type: "hotelier.rooftop_event.published",
        title,
        entityId: id,
        sourceRef: `supabase:${table}`,
        detail: "Hotelier / property activity",
      });
    }
    if (input.eventType === "INSERT") {
      return publishGuestLiveEvent({
        type: "experience.listed",
        title,
        entityId: id,
        sourceRef: `supabase:${table}`,
      });
    }
    return publishGuestLiveEvent({
      type: "experience.availability.changed",
      title,
      entityId: id,
      sourceRef: `supabase:${table}`,
    });
  }

  if (table === "bandit") {
    return publishGuestLiveEvent({
      type: "bandit.profile.updated",
      title: String(row.display_name ?? row.name ?? "Local banDit"),
      entityId: id,
      sourceRef: "supabase:bandit",
    });
  }

  if (table === "scam_alerts") {
    return publishGuestLiveEvent({
      type: "admin.destination_alert.published",
      title,
      entityId: id,
      sourceRef: "supabase:scam_alerts",
      detail: String(row.detail ?? row.body ?? ""),
    });
  }

  if (table === "notifications") {
    const kind = String(row.category ?? row.type ?? "").toLowerCase();
    if (/booking|payment|commerce|order/.test(kind)) {
      return publishGuestLiveEvent({
        type: "commerce.booking.confirmed",
        title,
        entityId: id,
        sourceRef: "supabase:notifications",
      });
    }
    if (/impact|water|drop/.test(kind)) {
      return publishGuestLiveEvent({
        type: "impact.action.completed",
        title,
        entityId: id,
        sourceRef: "supabase:notifications",
      });
    }
    if (/insight|premium|bandit/.test(kind)) {
      return publishGuestLiveEvent({
        type: "bandit.premium_insight.published",
        title,
        entityId: id,
        sourceRef: "supabase:notifications",
      });
    }
    return null;
  }

  if (table === "spots") {
    return publishGuestLiveEvent({
      type: "experience.listed",
      title,
      entityId: id,
      sourceRef: "supabase:spots",
    });
  }

  if (table === "guest_live_events") {
    const type = String(row.event_type ?? "") as GuestLiveEventType;
    if (type && GUEST_LIVE_ROUTING[type]) {
      return publishGuestLiveEvent({
        type,
        title: String(row.title ?? type),
        detail: row.detail ? String(row.detail) : undefined,
        entityId: row.entity_id ? String(row.entity_id) : id,
        propertySlug: row.property_slug ? String(row.property_slug) : undefined,
        destination: row.destination ? String(row.destination) : undefined,
        sourceRef: "supabase:guest_live_events",
        id: String(row.id ?? id),
        publishedAt: row.published_at ? String(row.published_at) : undefined,
      });
    }
  }

  return null;
}
