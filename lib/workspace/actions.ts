/**
 * Guest â†’ Workspace transactional actions.
 * All mutations hit Workspace APIs â€” never invent success locally.
 */

import { publishGuestLiveEvent } from "@/lib/orchestra/live-bus";
import { workspaceGet, workspacePost, type WorkspaceFetchResult } from "@/lib/workspace/client";

export type GuestActionResult<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; detail: string };

async function asAction<T>(
  result: WorkspaceFetchResult<T & { ok?: boolean; error?: string }>,
): Promise<GuestActionResult<T>> {
  if (!result.ok) return { ok: false, detail: result.detail };
  if (result.data && typeof result.data === "object" && "ok" in result.data && result.data.ok === false) {
    return { ok: false, detail: result.data.error || "Workspace rejected action" };
  }
  return { ok: true, data: result.data };
}

/** Reflection actions supported by Workspace POST /api/guest/reflection (GUEST-INT-1.0). */
export type GuestReflectionAction =
  | "save"
  | "unsave"
  | "claim_offer"
  | "book_experience"
  | "book_bottle_stay"
  | "follow_bandit"
  | "redeem_benefit"
  | "hotel_request"
  | "bandit_report"
  | "create_spot_collection"
  | "engage_story"
  | "request_traveler_service"
  | "local_friend_bottle"
  | "validate_claim";

/** Persist guest mutations on Workspace store — never invent success locally. */
export async function postGuestReflection(
  body: {
    action: GuestReflectionAction;
    objectType?: string;
    objectId?: string;
    claimId?: string;
    title?: string;
    source?: string;
    sessionId?: string;
    guests?: number;
    detail?: string;
    note?: string;
    requestType?: string;
    anonymous?: boolean;
    hasPhoto?: boolean;
    hasEvidence?: boolean;
    checkIn?: string;
    nights?: number;
  },
  guestEmail?: string | null,
): Promise<GuestActionResult<{ booking?: { id: string }; event?: { id: string }; reflection?: unknown }>> {
  const result = await workspacePost<{
    ok?: boolean;
    error?: string;
    booking?: { id: string };
    event?: { id: string };
    reflection?: unknown;
  }>("/api/guest/reflection", body, guestEmail);
  return asAction(result);
}

/** Fetch Workspace guest reflection (stories, activity, saves, journey signals). */
export async function fetchGuestReflection(
  guestEmail?: string | null,
): Promise<GuestActionResult<Record<string, unknown>>> {
  const result = await workspaceGet<Record<string, unknown> & { error?: string }>(
    "/api/guest/reflection",
    guestEmail,
  );
  if (!result.ok) return { ok: false, detail: result.detail };
  if (result.data && typeof result.data === "object" && "error" in result.data && result.data.error) {
    return { ok: false, detail: String(result.data.error) };
  }
  return { ok: true, data: result.data };
}

export async function submitHotelRequest(input: {
  requestType?: string;
  title?: string;
  note?: string;
  objectId?: string;
  guestEmail?: string | null;
}): Promise<GuestActionResult> {
  return postGuestReflection(
    {
      action: "hotel_request",
      requestType: input.requestType || "room_service",
      objectType: input.requestType || "room_service",
      objectId: input.objectId,
      title: input.title,
      note: input.note,
    },
    input.guestEmail,
  );
}

export async function submitBanditReport(input: {
  type: string;
  detail?: string;
  anonymous?: boolean;
  hasPhoto?: boolean;
  hasEvidence?: boolean;
  guestEmail?: string | null;
}): Promise<GuestActionResult> {
  return postGuestReflection(
    {
      action: "bandit_report",
      title: input.type,
      objectType: input.type,
      detail: input.detail,
      anonymous: input.anonymous,
      hasPhoto: input.hasPhoto,
      hasEvidence: input.hasEvidence,
    },
    input.guestEmail,
  );
}

export async function engageCreatorStory(input: {
  objectType: "destination_story" | "creator_story";
  objectId: string;
  title?: string;
  guestEmail?: string | null;
}): Promise<GuestActionResult> {
  return postGuestReflection(
    {
      action: "engage_story",
      objectType: input.objectType,
      objectId: input.objectId,
      title: input.title,
      source: input.objectType === "creator_story" ? "creator" : "destination",
    },
    input.guestEmail,
  );
}

export async function requestTravelerService(input: {
  listingId: string;
  title?: string;
  guestEmail?: string | null;
}): Promise<GuestActionResult> {
  return postGuestReflection(
    {
      action: "request_traveler_service",
      objectType: "traveler_service",
      objectId: input.listingId,
      title: input.title,
      source: "services",
    },
    input.guestEmail,
  );
}

export async function createSpotCollection(input: {
  name: string;
  guestEmail?: string | null;
}): Promise<GuestActionResult> {
  return postGuestReflection(
    {
      action: "create_spot_collection",
      title: input.name,
      source: "guest-session",
    },
    input.guestEmail,
  );
}

export async function castLocalFriendBottle(input: {
  message: string;
  anonymous?: boolean;
  guestEmail?: string | null;
}): Promise<GuestActionResult> {
  return postGuestReflection(
    {
      action: "local_friend_bottle",
      title: input.message,
      anonymous: input.anonymous,
      source: "community",
    },
    input.guestEmail,
  );
}

export async function bookExperienceViaWorkspace(input: {
  experienceId: string;
  title: string;
  sessionId?: string;
  guests: number;
  guestEmail?: string | null;
}): Promise<GuestActionResult<{ bookingId: string }>> {
  const result = await postGuestReflection(
    {
      action: "book_experience",
      objectType: "experience",
      objectId: input.experienceId,
      title: input.title,
      source: "experience",
      sessionId: input.sessionId,
      guests: input.guests,
      detail: `guest_experience_id=${input.experienceId}`,
    },
    input.guestEmail,
  );
  if (!result.ok) return result;
  const bookingId = result.data.booking?.id;
  if (!bookingId) return { ok: false, detail: "Workspace returned no booking id" };
  publishGuestLiveEvent({
    type: "experience.booked",
    title: input.title,
    entityId: input.experienceId,
    detail: `Workspace booking ${bookingId}`,
    sourceRef: `workspace:${bookingId}`,
  });
  return { ok: true, data: { bookingId } };
}

export async function claimHotelOffer(input: {
  offerId: string;
  title: string;
  guestEmail?: string | null;
}): Promise<GuestActionResult> {
  return postGuestReflection(
    {
      action: "claim_offer",
      objectType: "hotel_offer",
      objectId: input.offerId,
      title: input.title,
      source: "hotel",
    },
    input.guestEmail,
  );
}

export async function redeemSmartTravelerBenefit(input: {
  partnerId: string;
  /** Prefer the live offer / guestPrivilege id — not the place id when Workspace-backed. */
  offerId?: string;
  title: string;
  guestEmail?: string | null;
}): Promise<GuestActionResult> {
  return postGuestReflection(
    {
      action: "redeem_benefit",
      objectType: "smarttraveler_offer",
      objectId: input.offerId || input.partnerId,
      title: input.title,
      source: "smarttraveler",
    },
    input.guestEmail,
  );
}

export async function saveGuestObject(input: {
  objectType: string;
  objectId: string;
  title: string;
  source: string;
  saved: boolean;
  guestEmail?: string | null;
}): Promise<GuestActionResult> {
  return postGuestReflection(
    {
      action: input.saved ? "unsave" : "save",
      objectType: input.objectType,
      objectId: input.objectId,
      title: input.title,
      source: input.source,
    },
    input.guestEmail,
  );
}

export async function echoFollowToWorkspace(input: {
  banditId: string;
  title: string;
  guestEmail?: string | null;
}): Promise<GuestActionResult> {
  return postGuestReflection(
    {
      action: "follow_bandit",
      objectType: "bandit",
      objectId: input.banditId,
      title: input.title,
      source: "bandit",
    },
    input.guestEmail,
  );
}

export async function reserveShopListing(input: {
  listingId: string;
  message?: string;
  guestEmail?: string | null;
}): Promise<GuestActionResult<{ threadId?: string }>> {
  const result = await workspacePost<{
    ok?: boolean;
    error?: string;
    threadId?: string;
  }>(
    "/api/shop/orders",
    {
      action: "reserve",
      listingId: input.listingId,
      text: input.message,
    },
    input.guestEmail,
  );
  const mapped = await asAction(result);
  if (!mapped.ok) return mapped;
  publishGuestLiveEvent({
    type: "commerce.booking.confirmed",
    title: "banDiShop reserved",
    entityId: input.listingId,
    detail: mapped.data.threadId ? `thread ${mapped.data.threadId}` : undefined,
    sourceRef: `workspace:shop:${input.listingId}`,
  });
  return { ok: true, data: { threadId: mapped.data.threadId } };
}

export async function messageShopSeller(input: {
  listingId: string;
  text: string;
  guestEmail?: string | null;
}): Promise<GuestActionResult<{ threadId?: string }>> {
  const result = await workspacePost<{
    ok?: boolean;
    error?: string;
    threadId?: string;
  }>(
    "/api/shop/orders",
    {
      action: "chat",
      listingId: input.listingId,
      text: input.text,
    },
    input.guestEmail,
  );
  return asAction(result);
}

/** After Orchestra Commerce payment â€” unlock Workspace premium ops for concierge. */
export async function syncWorkspacePremiumEntitlement(input: {
  banditId: string;
  orderId: string;
  guestEmail?: string | null;
  guestId?: string | null;
}): Promise<GuestActionResult> {
  const result = await workspacePost<{ ok?: boolean; error?: string }>(
    "/api/bandit/premium",
    {
      action: "sync_commerce_entitlement",
      banditId: input.banditId,
      orderId: input.orderId,
      guestId: input.guestId,
    },
    input.guestEmail,
  );
  return asAction(result);
}

export async function fetchWorkspaceShopCatalog(
  guestEmail?: string | null,
): Promise<WorkspaceFetchResult<{ listings?: unknown[] }>> {
  return workspaceGet("/api/shop/orders", guestEmail);
}
