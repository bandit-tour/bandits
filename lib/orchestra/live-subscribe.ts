/**
 * Guest App live subscriptions — Supabase Realtime → Guest Live Bus → surfaces.
 * Mount once at app root. Screens subscribe to surfaces (silent reload).
 */

import type { RealtimeChannel } from "@supabase/supabase-js";

import { isFeatureEnabled } from "@/lib/featureFlags";
import { publishFromTableChange } from "@/lib/orchestra/live-bus";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const TABLES = [
  "event",
  "bandit_event",
  "bandit",
  "scam_alerts",
  "notifications",
  "spots",
  "guest_live_events",
] as const;

let started = false;
let channels: RealtimeChannel[] = [];

function onChange(
  table: string,
  payload: {
    eventType?: string;
    new?: Record<string, unknown>;
    old?: Record<string, unknown>;
  },
) {
  const eventType = (payload.eventType ?? "*") as "INSERT" | "UPDATE" | "DELETE" | "*";
  const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) ?? null;
  publishFromTableChange({ table, eventType, row });
}

/**
 * Start ecosystem live subscriptions. Idempotent.
 * Returns a disposer for tests / hot reload.
 */
export function startGuestLiveSubscriptions(): () => void {
  if (started) {
    return () => stopGuestLiveSubscriptions();
  }
  if (!isFeatureEnabled("ff_orchestra_guest_integration")) {
    return () => undefined;
  }
  if (!isSupabaseConfigured()) {
    return () => undefined;
  }

  started = true;
  channels = TABLES.map((table) => {
    const channel = supabase
      .channel(`guest_live_${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          onChange(table, {
            eventType: payload.eventType,
            new: payload.new as Record<string, unknown>,
            old: payload.old as Record<string, unknown>,
          });
        },
      )
      .subscribe();
    return channel;
  });

  return () => stopGuestLiveSubscriptions();
}

export function stopGuestLiveSubscriptions(): void {
  for (const ch of channels) {
    void supabase.removeChannel(ch);
  }
  channels = [];
  started = false;
}

export function guestLiveSubscriptionsActive(): boolean {
  return started;
}
