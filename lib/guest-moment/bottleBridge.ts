import {
  BOTTLE_QR_LOCAL_FRIEND_SUBLINE,
  BOTTLE_QR_MOMENT_SUBLINE,
  type BottleQrHookResult,
} from "@/lib/bottleQrIntro";
import {
  getMomentHistory,
  getOrCreateMomentChatThread,
  newId,
  pickEligibleGuestMoment,
  recordMomentReceived,
  saveBottleScanSession,
} from "@/lib/guest-moment/store";
import type { BottleScanSession, MomentSender } from "@/lib/guest-moment/types";
import {
  GUEST_MOMENT_CHAT_TYPE,
  GUEST_MOMENT_THREAD_REF,
} from "@/lib/guest-moment/types";
import { claimLocalFriendOceanFloat, type OceanFloatClaimResult } from "@/lib/localFriendOcean";
import { requestNotificationsRefresh } from "@/lib/notificationEvents";
import { ensureAnonymousSession } from "@/lib/pilotSession";
import {
  notifyMomentDiscovery,
  recordDiscoveryRemote,
} from "@/lib/guest-moment/remote";
import { supabase } from "@/lib/supabase";

export type GuestBottleHook = BottleQrHookResult & {
  sessionId: string;
  mode: "moment" | "local_friend" | "empty";
  sender: MomentSender;
  /** True when no eligible ocean float or Moment was available. */
  empty?: boolean;
};

function lfSender(persona?: string, floatId?: string): MomentSender {
  const name = String(persona || "Local Friend").trim() || "Local Friend";
  return {
    id: floatId ? `lf_${floatId}` : `lf_${name}`,
    displayName: name,
    city: "Athens",
    stayHint: "Nearby traveler",
    avatarInitials: name.slice(0, 1).toUpperCase() || "L",
    kind: "local_friend",
  };
}

const EMPTY_SENDER: MomentSender = {
  id: "empty",
  displayName: "bandiTour",
  avatarInitials: "B",
  kind: "guest",
};

async function durableMomentChatDelivery(args: {
  sessionId: string;
  quote: string;
  sender: MomentSender;
  momentId?: string;
  notificationId?: string | null;
}): Promise<{ threadId: string; notificationId?: string }> {
  const threadId =
    (args.momentId && /^[0-9a-f-]{36}$/i.test(args.momentId) && args.momentId) ||
    args.sessionId;

  await getOrCreateMomentChatThread({
    threadId,
    peer: args.sender,
    openingQuote: args.quote,
  });

  let notificationId = args.notificationId || undefined;
  if (notificationId && /^[0-9a-f-]{36}$/i.test(notificationId)) {
    try {
      await supabase
        .from("notifications")
        .update({
          title: "Message in a bottle",
          reference_id: threadId,
          reference_type: GUEST_MOMENT_THREAD_REF,
          type: GUEST_MOMENT_CHAT_TYPE,
        })
        .eq("id", notificationId);
    } catch {
      /* best-effort */
    }
  } else {
    notificationId =
      (await notifyMomentDiscovery({
        quote: args.quote,
        momentId: args.momentId,
        sessionId: threadId,
        hiddenTitle: "Message in a bottle",
      })) || undefined;
    if (notificationId) {
      try {
        await supabase
          .from("notifications")
          .update({
            reference_id: threadId,
            reference_type: GUEST_MOMENT_THREAD_REF,
            type: GUEST_MOMENT_CHAT_TYPE,
          })
          .eq("id", notificationId);
      } catch {
        /* ignore */
      }
    }
  }

  return { threadId, notificationId };
}

/**
 * Resolve bottle opening (Ocean Message / social QR — not Travel in a Bottle):
 * Mode B — Local Friend ocean message (intentional)
 * Mode A — Guest Moment (ambient discovery; sender hidden until reveal)
 * Empty — truthful zero-eligible state (no fabricated senders)
 */
export async function resolveGuestBottleOpening(): Promise<GuestBottleHook> {
  await ensureAnonymousSession().catch(() => undefined);

  const claim = await claimLocalFriendOceanFloat().catch(
    (): OceanFloatClaimResult => ({ ok: false }),
  );
  if (claim.notificationId) {
    requestNotificationsRefresh();
  }

  const lfQuote = String(claim.message || "").trim();
  if (claim.ok && lfQuote && claim.source === "bandit_moment" && claim.banditId) {
    const name = String(claim.banditName || "Local banDit").trim() || "Local banDit";
    const sender: MomentSender = {
      id: claim.banditId,
      displayName: name,
      city: "Athens",
      stayHint: "Local banDit",
      avatarInitials: name.slice(0, 1).toUpperCase() || "B",
      kind: "demo",
    };
    const session: BottleScanSession = {
      id: newId("scan"),
      mode: "moment",
      quote: lfQuote,
      createdAt: new Date().toISOString(),
      sender,
      revealed: false,
      banditId: claim.banditId,
      floatId: claim.floatId,
      notificationId: claim.notificationId,
    };
    const delivered = await durableMomentChatDelivery({
      sessionId: session.id,
      quote: lfQuote,
      sender,
      notificationId: claim.notificationId,
    });
    session.chatThreadId = delivered.threadId;
    session.notificationId = delivered.notificationId || claim.notificationId;
    await saveBottleScanSession(session);
    await recordMomentReceived({
      id: newId("hist"),
      quote: lfQuote,
      mode: "moment",
      receivedAt: session.createdAt,
      sender,
      revealed: false,
      replied: false,
      floatId: claim.floatId,
      chatThreadId: delivered.threadId,
    });
    requestNotificationsRefresh();
    return {
      sessionId: session.id,
      mode: "moment",
      source: "bandit_moment",
      quote: lfQuote,
      hookSubline: BOTTLE_QR_MOMENT_SUBLINE,
      banditId: claim.banditId,
      banditName: name,
      floatId: claim.floatId,
      notificationId: session.notificationId,
      sender,
    };
  }

  if (claim.ok && lfQuote && claim.source !== "bandit_moment") {
    const sender = lfSender(undefined, claim.floatId);
    const session: BottleScanSession = {
      id: newId("scan"),
      mode: "local_friend",
      quote: lfQuote,
      createdAt: new Date().toISOString(),
      sender,
      revealed: false,
      floatId: claim.floatId,
      notificationId: claim.notificationId,
      chatThreadId: claim.floatId,
    };
    await saveBottleScanSession(session);
    await recordMomentReceived({
      id: newId("hist"),
      quote: lfQuote,
      mode: "local_friend",
      receivedAt: session.createdAt,
      sender,
      revealed: false,
      replied: false,
      floatId: claim.floatId,
      chatThreadId: claim.floatId,
    });
    await recordDiscoveryRemote({
      quote: lfQuote,
      mode: "local_friend",
      sender,
      revealed: false,
      floatId: claim.floatId,
      notificationId: claim.notificationId,
    });
    requestNotificationsRefresh();
    return {
      sessionId: session.id,
      mode: "local_friend",
      source: "local_friend",
      quote: lfQuote,
      hookSubline: BOTTLE_QR_LOCAL_FRIEND_SUBLINE,
      floatId: claim.floatId,
      notificationId: claim.notificationId,
      sender,
    };
  }

  /** Mode A — guest Moment (curiosity first; no sender on the hook). */
  const hist = await getMomentHistory();
  const excludeMomentIds = hist.map((h) => h.momentId).filter(Boolean) as string[];
  const moment = await pickEligibleGuestMoment(undefined, excludeMomentIds);
  if (moment) {
    const sessionId = newId("scan");
    const delivered = await durableMomentChatDelivery({
      sessionId,
      quote: moment.text,
      sender: moment.sender,
      momentId: moment.id,
    });
    const session: BottleScanSession = {
      id: sessionId,
      mode: "moment",
      quote: moment.text,
      createdAt: new Date().toISOString(),
      sender: moment.sender,
      revealed: false,
      momentId: moment.id,
      notificationId: delivered.notificationId,
      chatThreadId: delivered.threadId,
    };
    await saveBottleScanSession(session);
    await recordMomentReceived({
      id: newId("hist"),
      quote: moment.text,
      mode: "moment",
      receivedAt: session.createdAt,
      sender: moment.sender,
      revealed: false,
      replied: false,
      momentId: moment.id,
      chatThreadId: delivered.threadId,
    });
    await recordDiscoveryRemote({
      momentId: moment.id,
      quote: moment.text,
      mode: "moment",
      sender: moment.sender,
      revealed: false,
      notificationId: delivered.notificationId,
    });
    if (delivered.notificationId) requestNotificationsRefresh();
    return {
      sessionId: session.id,
      mode: "moment",
      source: "bandit_moment",
      quote: moment.text,
      hookSubline: BOTTLE_QR_MOMENT_SUBLINE,
      sender: moment.sender,
      notificationId: delivered.notificationId,
    };
  }

  /** Truthful empty — never fabricate a sender or static quote. */
  const emptySession: BottleScanSession = {
    id: newId("scan"),
    mode: "moment",
    quote: "",
    createdAt: new Date().toISOString(),
    sender: EMPTY_SENDER,
    revealed: false,
  };
  await saveBottleScanSession(emptySession);
  return {
    sessionId: emptySession.id,
    mode: "empty",
    source: "bandit_moment",
    quote: "",
    hookSubline: "No new bottle messages right now. Try again later, or set My Moment for others.",
    sender: EMPTY_SENDER,
    empty: true,
  };
}

export async function loadActiveBottleSession(): Promise<BottleScanSession | null> {
  const { getBottleScanSession } = await import("@/lib/guest-moment/store");
  return getBottleScanSession();
}
