/**
 * Mode A Moment connection — request / accept / decline / block.
 * Uses guest_moment_connection when available; notifications as durable inbox signal.
 */
import { ensureAnonymousSession } from "@/lib/pilotSession";
import { requestNotificationsRefresh } from "@/lib/notificationEvents";
import { supabase } from "@/lib/supabase";

export const GUEST_MOMENT_CONNECTION_TYPE = "guest_moment_connection" as const;
export const GUEST_MOMENT_CONNECTION_REF = "guest_moment_connection" as const;

export type MomentConnectionStatus = "none" | "pending" | "accepted" | "declined" | "blocked";

function newUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getMomentConnectionStatus(threadId: string): Promise<MomentConnectionStatus> {
  const tid = String(threadId || "").trim();
  if (!tid) return "none";
  await ensureAnonymousSession().catch(() => undefined);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return "none";

  try {
    const { data, error } = await supabase
      .from("guest_moment_connection")
      .select("status")
      .eq("thread_id", tid)
      .or(`requester_user_id.eq.${user.id},sender_user_id.eq.${user.id}`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data?.status) {
      const s = String(data.status);
      if (s === "pending" || s === "accepted" || s === "declined" || s === "blocked") return s;
    }
  } catch {
    /* table may not exist yet */
  }
  return "none";
}

export async function requestMomentConnection(args: {
  threadId: string;
  momentId?: string;
  senderUserId: string;
  senderDisplayName: string;
  requesterDisplayName: string;
  quote: string;
}): Promise<{ ok: boolean; error?: string; notificationId?: string }> {
  await ensureAnonymousSession().catch(() => undefined);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "auth_required" };

  const threadId = String(args.threadId || "").trim();
  const senderUserId = String(args.senderUserId || "").trim();
  if (!threadId || !UUID_RE.test(senderUserId)) {
    return { ok: false, error: "invalid_sender" };
  }
  if (senderUserId === user.id) return { ok: false, error: "self" };

  const existing = await getMomentConnectionStatus(threadId);
  if (existing === "accepted") return { ok: true };
  if (existing === "pending") return { ok: true };
  if (existing === "blocked") return { ok: false, error: "blocked" };

  try {
    const { error } = await supabase.from("guest_moment_connection").upsert(
      {
        thread_id: threadId,
        moment_id:
          args.momentId && UUID_RE.test(args.momentId) ? args.momentId : null,
        requester_user_id: user.id,
        sender_user_id: senderUserId,
        status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "thread_id,requester_user_id" },
    );
    if (error && !/does not exist|schema cache/i.test(error.message || "")) {
      /* continue to notification */
    }
  } catch {
    /* best-effort */
  }

  const notifId = newUuid();
  const requesterName = String(args.requesterDisplayName || "A traveler").trim() || "A traveler";
  const { error: nErr } = await supabase.from("notifications").insert({
    id: notifId,
    user_id: senderUserId,
    type: GUEST_MOMENT_CONNECTION_TYPE,
    title: `${requesterName} wants to connect`,
    message: String(args.quote || "").slice(0, 500) || "Connection request from a bottle discovery.",
    reference_id: threadId,
    reference_type: GUEST_MOMENT_CONNECTION_REF,
    is_read: false,
  });
  if (nErr) return { ok: false, error: nErr.message || "notify_failed" };

  requestNotificationsRefresh();
  return { ok: true, notificationId: notifId };
}

export async function respondMomentConnection(args: {
  threadId: string;
  action: "accept" | "decline" | "block";
  peerUserId?: string;
  peerDisplayName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  await ensureAnonymousSession().catch(() => undefined);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "auth_required" };

  const threadId = String(args.threadId || "").trim();
  if (!threadId) return { ok: false, error: "missing_thread" };

  const status =
    args.action === "accept" ? "accepted" : args.action === "block" ? "blocked" : "declined";

  let requesterId = args.peerUserId && UUID_RE.test(args.peerUserId) ? args.peerUserId : "";
  try {
    const { data: row } = await supabase
      .from("guest_moment_connection")
      .select("requester_user_id")
      .eq("thread_id", threadId)
      .eq("sender_user_id", user.id)
      .maybeSingle();
    if (row?.requester_user_id) requesterId = String(row.requester_user_id);

    const { error } = await supabase
      .from("guest_moment_connection")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("thread_id", threadId)
      .eq("sender_user_id", user.id);
    if (error && !/does not exist|schema cache/i.test(error.message || "")) {
      return { ok: false, error: error.message };
    }
  } catch {
    /* table may be missing — still notify */
  }

  if (args.action === "accept" && requesterId && UUID_RE.test(requesterId)) {
    const notifId = newUuid();
    const name = String(args.peerDisplayName || "Traveler").trim() || "Traveler";
    await supabase.from("notifications").insert({
      id: notifId,
      user_id: requesterId,
      type: GUEST_MOMENT_CONNECTION_TYPE,
      title: `${name} accepted your connection`,
      message: "You can now message each other in Chat.",
      reference_id: threadId,
      reference_type: GUEST_MOMENT_CONNECTION_REF,
      is_read: false,
    });
  }

  requestNotificationsRefresh();
  return { ok: true };
}

/** Persist a chat line + notify the peer (durable delivery). */
export async function persistMomentChatMessage(args: {
  threadId: string;
  body: string;
  peerUserId?: string;
  peerDisplayName?: string;
  selfDisplayName?: string;
}): Promise<{ ok: boolean; messageId?: string }> {
  await ensureAnonymousSession().catch(() => undefined);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false };

  const threadId = String(args.threadId || "").trim();
  const body = String(args.body || "").trim().slice(0, 4000);
  if (!threadId || !body) return { ok: false };

  let messageId: string | undefined;
  try {
    const { data, error } = await supabase
      .from("guest_moment_chat_message")
      .insert({
        thread_id: threadId,
        author_user_id: user.id,
        role: "user",
        body,
      })
      .select("id")
      .maybeSingle();
    if (!error && data?.id) messageId = String(data.id);
  } catch {
    /* ignore */
  }

  const peer = String(args.peerUserId || "").trim();
  if (peer && UUID_RE.test(peer) && peer !== user.id) {
    const notifId = newUuid();
    const title = String(args.selfDisplayName || "Traveler").trim() || "Traveler";
    await supabase.from("notifications").insert({
      id: notifId,
      user_id: peer,
      type: "guest_moment",
      title,
      message: body.slice(0, 500),
      reference_id: threadId,
      reference_type: "guest_moment_thread",
      is_read: false,
    });
    requestNotificationsRefresh();
  }

  return { ok: true, messageId };
}
