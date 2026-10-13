/**
 * Durable Guest Moment sync — Supabase first, Orchestra workspace bridge second.
 */
import { ensureAnonymousSession } from "@/lib/pilotSession";
import { supabase } from "@/lib/supabase";
import { workspaceGet, workspacePost } from "@/lib/workspace/client";
import type { GuestMoment, MomentSender } from "@/lib/guest-moment/types";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "G"
  );
}

function mapRemoteMoment(row: {
  id: string;
  text: string;
  day_key?: string;
  dayKey?: string;
  updated_at?: string;
  updatedAt?: string;
  bottle_eligible?: boolean;
  bottleEligible?: boolean;
  display_name?: string;
  displayName?: string;
  city?: string | null;
  stay_hint?: string | null;
  stayHint?: string | null;
  guest_user_id?: string;
  guestUserId?: string;
  guestId?: string;
  guestEmail?: string;
}): GuestMoment {
  const displayName = String(row.display_name || row.displayName || "Traveler").trim() || "Traveler";
  const guestId = String(
    row.guest_user_id || row.guestUserId || row.guestId || row.guestEmail || row.id,
  );
  return {
    id: String(row.id),
    text: String(row.text || "").trim(),
    dayKey: String(row.day_key || row.dayKey || "").slice(0, 10),
    updatedAt: String(row.updated_at || row.updatedAt || new Date().toISOString()),
    bottleEligible: row.bottle_eligible ?? row.bottleEligible ?? true,
    sender: {
      id: guestId,
      displayName,
      city: row.city || undefined,
      stayHint: row.stay_hint || row.stayHint || undefined,
      avatarInitials: initials(displayName),
      kind: "guest",
    },
  };
}

export async function publishMomentRemote(args: {
  text: string;
  bottleEligible: boolean;
  sender: MomentSender;
}): Promise<GuestMoment | null> {
  await ensureAnonymousSession().catch(() => undefined);

  try {
    const { data, error } = await supabase.rpc("publish_guest_moment", {
      p_text: args.text,
      p_bottle_eligible: args.bottleEligible,
      p_display_name: args.sender.displayName,
      p_city: args.sender.city ?? null,
      p_stay_hint: args.sender.stayHint ?? null,
    });
    if (!error && data && typeof data === "object" && (data as { ok?: boolean }).ok) {
      return mapRemoteMoment(data as never);
    }
  } catch {
    /* fall through */
  }

  try {
    const remote = await workspacePost<{
      ok?: boolean;
      moment?: {
        id: string;
        text: string;
        dayKey: string;
        updatedAt: string;
        bottleEligible: boolean;
        guestEmail: string;
        guestId: string;
        displayName: string;
        city?: string;
        stayHint?: string;
      };
    }>(
      "/api/guest/moments",
      {
        action: "publish",
        text: args.text,
        bottleEligible: args.bottleEligible,
        city: args.sender.city,
        stayHint: args.sender.stayHint,
        displayName: args.sender.displayName,
      },
      args.sender.kind === "guest" ? undefined : "guest@banditour.demo",
    );
    if (remote.ok && remote.data.moment) {
      return mapRemoteMoment(remote.data.moment as never);
    }
  } catch {
    /* local remains source of truth */
  }

  return null;
}

export async function pickEligibleMomentRemote(
  excludeSenderId?: string,
): Promise<GuestMoment | null> {
  await ensureAnonymousSession().catch(() => undefined);

  try {
    const { data, error } = await supabase.rpc("pick_eligible_guest_moment");
    if (!error && data && typeof data === "object" && (data as { ok?: boolean }).ok) {
      const mapped = mapRemoteMoment(data as never);
      if (!excludeSenderId || mapped.sender.id !== excludeSenderId) return mapped;
    }
  } catch {
    /* fall through */
  }

  try {
    const remote = await workspaceGet<{
      moment?: {
        id: string;
        text: string;
        dayKey: string;
        updatedAt: string;
        bottleEligible: boolean;
        guestEmail: string;
        guestId: string;
        displayName: string;
        city?: string;
        stayHint?: string;
      } | null;
    }>("/api/guest/moments?view=eligible");
    if (remote.ok && remote.data.moment) {
      const mapped = mapRemoteMoment(remote.data.moment as never);
      if (!excludeSenderId || mapped.sender.id !== excludeSenderId) return mapped;
    }
  } catch {
    /* fall through */
  }

  return null;
}

export async function recordDiscoveryRemote(args: {
  momentId?: string;
  quote: string;
  mode: "moment" | "local_friend";
  sender: MomentSender;
  revealed: boolean;
  floatId?: string;
  notificationId?: string;
}): Promise<string | null> {
  await ensureAnonymousSession().catch(() => undefined);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;

  try {
    const { data, error } = await supabase
      .from("guest_moment_discovery")
      .insert({
        moment_id: args.momentId && /^[0-9a-f-]{36}$/i.test(args.momentId) ? args.momentId : null,
        receiver_user_id: user.id,
        mode: args.mode,
        quote: args.quote.slice(0, 500),
        sender_display_name: args.sender.displayName,
        sender_kind: args.sender.kind,
        revealed: args.revealed,
        replied: false,
        float_id: args.floatId ?? null,
        notification_id:
          args.notificationId && /^[0-9a-f-]{36}$/i.test(args.notificationId)
            ? args.notificationId
            : null,
      })
      .select("id")
      .maybeSingle();
    if (!error && data?.id) return String(data.id);
  } catch {
    /* ignore */
  }
  return null;
}

/** Inbox row for Mode A — opens bottle discovery / chat from Notifications. */
export async function notifyMomentDiscovery(args: {
  quote: string;
  momentId?: string;
  sessionId: string;
  hiddenTitle?: string;
}): Promise<string | null> {
  await ensureAnonymousSession().catch(() => undefined);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const notifId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  try {
    const { error } = await supabase.from("notifications").insert({
      id: notifId,
      user_id: user.id,
      type: "guest_moment",
      title: args.hiddenTitle || "A Moment from the city",
      message: args.quote.slice(0, 500),
      reference_id: args.sessionId,
      reference_type: "guest_moment_discovery",
      is_read: false,
    });
    if (!error) return notifId;
  } catch {
    /* ignore */
  }
  return null;
}

export async function updateDiscoveryRevealRemote(args: {
  momentId?: string;
  chatThreadId?: string;
  revealed?: boolean;
  replied?: boolean;
  senderName?: string;
}): Promise<void> {
  await ensureAnonymousSession().catch(() => undefined);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return;

  try {
    let query = supabase
      .from("guest_moment_discovery")
      .select("id")
      .eq("receiver_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (args.momentId && /^[0-9a-f-]{36}$/i.test(args.momentId)) {
      query = supabase
        .from("guest_moment_discovery")
        .select("id")
        .eq("receiver_user_id", user.id)
        .eq("moment_id", args.momentId)
        .order("created_at", { ascending: false })
        .limit(1);
    }
    const { data: row } = await query.maybeSingle();
    if (!row?.id) return;
    await supabase
      .from("guest_moment_discovery")
      .update({
        revealed: args.revealed ?? true,
        replied: args.replied ?? false,
        ...(args.chatThreadId ? { chat_thread_id: args.chatThreadId } : {}),
        ...(args.senderName ? { sender_display_name: args.senderName } : {}),
      })
      .eq("id", row.id);
  } catch {
    /* ignore */
  }
}
