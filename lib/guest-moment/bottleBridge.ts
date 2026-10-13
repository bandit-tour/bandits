import {
  BOTTLE_QR_LOCAL_FRIEND_SUBLINE,
  BOTTLE_QR_MOMENT_SUBLINE,
  type BottleQrHookResult,
} from "@/lib/bottleQrIntro";
import {
  getBottleScanSession,
  newId,
  pickEligibleGuestMoment,
  recordMomentReceived,
  saveBottleScanSession,
} from "@/lib/guest-moment/store";
import type { BottleScanSession, MomentSender } from "@/lib/guest-moment/types";
import { claimLocalFriendOceanFloat, type OceanFloatClaimResult } from "@/lib/localFriendOcean";
import { requestNotificationsRefresh } from "@/lib/notificationEvents";
import { ensureAnonymousSession } from "@/lib/pilotSession";
import {
  notifyMomentDiscovery,
  recordDiscoveryRemote,
} from "@/lib/guest-moment/remote";

export type GuestBottleHook = BottleQrHookResult & {
  sessionId: string;
  mode: "moment" | "local_friend";
  sender: MomentSender;
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

/**
 * Resolve bottle opening:
 * Mode B — Local Friend ocean message (intentional)
 * Mode A — Guest Moment (ambient discovery; sender hidden)
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
    });
    return {
      sessionId: session.id,
      mode: "moment",
      source: "bandit_moment",
      quote: lfQuote,
      hookSubline: BOTTLE_QR_MOMENT_SUBLINE,
      banditId: claim.banditId,
      banditName: name,
      floatId: claim.floatId,
      notificationId: claim.notificationId,
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
    });
    await recordDiscoveryRemote({
      quote: lfQuote,
      mode: "local_friend",
      sender,
      revealed: false,
      floatId: claim.floatId,
      notificationId: claim.notificationId,
    });
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
  const moment = await pickEligibleGuestMoment();
  if (moment) {
    const sessionId = newId("scan");
    const notificationId = await notifyMomentDiscovery({
      quote: moment.text,
      momentId: moment.id,
      sessionId,
    });
    const session: BottleScanSession = {
      id: sessionId,
      mode: "moment",
      quote: moment.text,
      createdAt: new Date().toISOString(),
      sender: moment.sender,
      revealed: false,
      momentId: moment.id,
      notificationId: notificationId || undefined,
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
    });
    await recordDiscoveryRemote({
      momentId: moment.id,
      quote: moment.text,
      mode: "moment",
      sender: moment.sender,
      revealed: false,
      notificationId: notificationId || undefined,
    });
    if (notificationId) requestNotificationsRefresh();
    return {
      sessionId: session.id,
      mode: "moment",
      source: "bandit_moment",
      quote: moment.text,
      hookSubline: BOTTLE_QR_MOMENT_SUBLINE,
      sender: moment.sender,
      notificationId: notificationId || undefined,
    };
  }

  /** Last resort — Local banDit Moment (Neo) so QR always retains attribution. */
  const neoId = "d76cb120-018d-4a2e-8b5f-0578a71fd8f9";
  const fallbackSender: MomentSender = {
    id: neoId,
    displayName: "Neo",
    city: "Athens",
    stayHint: "Local banDit · vintage · jazz",
    avatarInitials: "N",
    kind: "demo",
  };
  const quote =
    "Monastiraki still hides vinyl if you know which alley to turn into after coffee.";
  const sessionId = newId("scan");
  const notificationId = await notifyMomentDiscovery({
    quote,
    momentId: "demo_moment_neo",
    sessionId,
  });
  const session: BottleScanSession = {
    id: sessionId,
    mode: "moment",
    quote,
    createdAt: new Date().toISOString(),
    sender: fallbackSender,
    revealed: false,
    momentId: "demo_moment_neo",
    banditId: neoId,
    notificationId: notificationId || undefined,
  };
  await saveBottleScanSession(session);
  await recordMomentReceived({
    id: newId("hist"),
    quote,
    mode: "moment",
    receivedAt: session.createdAt,
    sender: fallbackSender,
    revealed: false,
    replied: false,
    momentId: "demo_moment_neo",
  });
  if (notificationId) requestNotificationsRefresh();
  return {
    sessionId: session.id,
    mode: "moment",
    source: "bandit_moment",
    quote,
    hookSubline: BOTTLE_QR_MOMENT_SUBLINE,
    banditId: neoId,
    banditName: "Neo",
    sender: fallbackSender,
    notificationId: notificationId || undefined,
  };
}

export async function loadActiveBottleSession(): Promise<BottleScanSession | null> {
  return getBottleScanSession();
}
