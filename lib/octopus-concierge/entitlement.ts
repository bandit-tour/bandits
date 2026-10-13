/**
 * Octopus Concierge entitlement — Commerce OS (Orchestra preferred).
 * NEVER grant ACTIVE from localStorage, useState, or mock success.
 * Concierge task execution still writes to Workspace premium ops.
 */

import { OCTOPUS_CONCIERGE_OFFER } from "@/lib/octopus-concierge/principle";
import {
  commerceGet,
  commerceOrigin,
  commercePost,
  workspacePost,
} from "@/lib/workspace/client";

export type OctopusEntitlementState =
  | "none"
  | "pending_payment"
  | "active"
  | "expired"
  | "unavailable";

export type OctopusEntitlement = {
  state: OctopusEntitlementState;
  entitled: boolean;
  productSku: string;
  banditId: string;
  guestId: string | null;
  source: "commerce" | "none";
  detail: string;
  expiresAt: string | null;
  orderId?: string | null;
  stayId?: string | null;
};

type CommerceEntitlementPayload = {
  status?: string;
  state?: string;
  active?: boolean;
  entitled?: boolean;
  expires_at?: string | null;
  expiresAt?: string | null;
  product?: string;
  sku?: string;
  owner?: string;
  order_id?: string | null;
  stay_id?: string | null;
  entitlement?: CommerceEntitlementPayload;
};

function normalizeState(raw: CommerceEntitlementPayload | null): OctopusEntitlementState {
  if (!raw) return "none";
  if (raw.active === true || raw.entitled === true) return "active";
  const s = String(raw.status ?? raw.state ?? "").trim().toLowerCase();
  if (s === "active" || s === "entitled" || s === "paid") return "active";
  if (s === "pending" || s === "pending_payment" || s === "processing") return "pending_payment";
  if (s === "expired") return "expired";
  if (s === "none" || s === "") return "none";
  return "none";
}

export async function resolveOctopusConciergeEntitlement(input: {
  guestId: string | null;
  banditId: string;
  guestEmail?: string | null;
  stayId?: string | null;
}): Promise<OctopusEntitlement> {
  const banditId = String(input.banditId || "").trim();
  const guestId = input.guestId ? String(input.guestId).trim() : null;
  const guestEmail = input.guestEmail || "guest@banditour.demo";
  const stayId = input.stayId ? String(input.stayId).trim() : "current_stay";
  const customerKey = guestId || guestEmail;
  const base: Omit<OctopusEntitlement, "state" | "entitled" | "source" | "detail" | "expiresAt"> = {
    productSku: OCTOPUS_CONCIERGE_OFFER.sku,
    banditId,
    guestId: guestId || guestEmail,
  };

  if (!banditId) {
    return { ...base, state: "none", entitled: false, source: "none", detail: "Missing bandit id", expiresAt: null };
  }

  const origin = commerceOrigin();
  if (!origin) {
    return {
      ...base,
      state: "unavailable",
      entitled: false,
      source: "none",
      detail: "Commerce origin unset — set EXPO_PUBLIC_ORCHESTRA_OS_URL or WORKSPACE_URL",
      expiresAt: null,
    };
  }

  const qs = new URLSearchParams({
    user_id: customerKey,
    product: OCTOPUS_CONCIERGE_OFFER.sku,
    bandit_id: banditId,
    stay_id: stayId,
  });

  const result = await commerceGet<CommerceEntitlementPayload>(
    `/api/commerce/entitlements?${qs.toString()}`,
    guestEmail,
  );
  if (!result.ok) {
    return {
      ...base,
      state: "unavailable",
      entitled: false,
      source: "commerce",
      detail: result.detail,
      expiresAt: null,
    };
  }

  const payload = result.data.entitlement ?? result.data;
  const state = normalizeState(payload);
  return {
    ...base,
    state,
    entitled: state === "active",
    source: "commerce",
    detail:
      state === "active"
        ? `Commerce ACTIVE · ${payload.owner || "Workspace"}`
        : `Commerce state: ${state}`,
    expiresAt: payload.expires_at ?? payload.expiresAt ?? null,
    orderId: payload.order_id ?? null,
    stayId: payload.stay_id ?? stayId,
  };
}

export type OctopusCheckoutResult =
  | {
      ok: true;
      paymentConfirmed: true;
      orderId: string;
      sessionId?: string;
      source: "commerce";
    }
  | {
      ok: true;
      paymentConfirmed: false;
      checkoutUrl: string;
      sessionId?: string;
      source: "commerce";
    }
  | {
      ok: false;
      reason: "missing_guest" | "commerce_error" | "missing_origin";
      detail: string;
    };

/**
 * Start real Commerce checkout for Octopus Concierge (€29).
 * Never marks entitlement ACTIVE locally — only Commerce ACTIVE unlocks Concierge OS.
 * Does not surface “payments not live” — always attempts checkout.
 */
export async function startOctopusConciergeCheckout(input: {
  guestId: string | null;
  banditId: string;
  guestEmail?: string | null;
  stayId?: string | null;
  successPath?: string;
  cancelPath?: string;
}): Promise<OctopusCheckoutResult> {
  const banditId = String(input.banditId || "").trim();
  const guestId = input.guestId ? String(input.guestId).trim() : null;
  const guestEmail = input.guestEmail || "guest@banditour.demo";
  const stayId = input.stayId ? String(input.stayId).trim() : "current_stay";
  const customerKey = guestId || guestEmail;

  if (!customerKey) {
    return { ok: false, reason: "missing_guest", detail: "Sign in to unlock Octopus Concierge." };
  }
  if (!commerceOrigin()) {
    return {
      ok: false,
      reason: "missing_origin",
      detail: "Commerce origin not configured. Set EXPO_PUBLIC_ORCHESTRA_OS_URL to complete payment.",
    };
  }
  if (!banditId) {
    return { ok: false, reason: "commerce_error", detail: "Select a Local banDit first." };
  }

  const idempotencyKey = `octopus_${customerKey}_${banditId}_${stayId}_${Math.floor(Date.now() / 1000)}`;

  const result = await commercePost<{
    ok?: boolean;
    checkout_url?: string | null;
    checkoutUrl?: string | null;
    url?: string | null;
    session_id?: string;
    sessionId?: string;
    order_id?: string;
    order?: { id?: string; status?: string };
    payment_confirmed?: boolean;
    paymentConfirmed?: boolean;
    errors?: string[];
    error?: string;
  }>(
    "/api/commerce/checkout",
    {
      workspace_id: "guest-app",
      customer_id: customerKey,
      user_id: customerKey,
      guest_id: customerKey,
      product_ids: [OCTOPUS_CONCIERGE_OFFER.productId],
      product: OCTOPUS_CONCIERGE_OFFER.sku,
      bandit_id: banditId,
      stay_id: stayId,
      amount_cents: OCTOPUS_CONCIERGE_OFFER.priceCents,
      currency: OCTOPUS_CONCIERGE_OFFER.currency,
      payment_method: "card",
      terms_accepted: true,
      idempotency_key: idempotencyKey,
      success_path: input.successPath ?? `/premium/${encodeURIComponent(banditId)}`,
      cancel_path: input.cancelPath ?? `/premium/${encodeURIComponent(banditId)}`,
      metadata: {
        sku: OCTOPUS_CONCIERGE_OFFER.sku,
        bandit_id: banditId,
        stay_id: stayId,
        guest_id: customerKey,
      },
    },
    guestEmail,
  );

  if (!result.ok) {
    return { ok: false, reason: "commerce_error", detail: result.detail };
  }

  const data = result.data;
  if (data.ok === false) {
    const msg =
      (Array.isArray(data.errors) && data.errors.join("; ")) ||
      data.error ||
      "Checkout rejected by Commerce";
    return { ok: false, reason: "commerce_error", detail: msg };
  }

  const orderId = data.order_id ?? data.order?.id;
  const paid =
    data.payment_confirmed === true ||
    data.paymentConfirmed === true ||
    String(data.order?.status ?? "").toLowerCase() === "paid";

  if (paid && orderId) {
    return {
      ok: true,
      paymentConfirmed: true,
      orderId,
      sessionId: data.session_id ?? data.sessionId,
      source: "commerce",
    };
  }

  const checkoutUrl = data.checkout_url ?? data.checkoutUrl ?? data.url;
  if (checkoutUrl) {
    return {
      ok: true,
      paymentConfirmed: false,
      checkoutUrl,
      sessionId: data.session_id ?? data.sessionId,
      source: "commerce",
    };
  }

  return {
    ok: false,
    reason: "commerce_error",
    detail: "Payment not confirmed — complete checkout and verify access.",
  };
}

export function assertConciergeOpsAllowed(entitlement: OctopusEntitlement): boolean {
  return entitlement.entitled === true && entitlement.state === "active";
}

export async function submitConciergeRequestToWorkspace(input: {
  banditId: string;
  service: string;
  note: string;
  guestEmail?: string | null;
  guestId?: string | null;
}): Promise<{ ok: true; requestId: string } | { ok: false; detail: string }> {
  const guestEmail = input.guestEmail || "guest@banditour.demo";
  const result = await workspacePost<{ ok?: boolean; request?: { id: string }; error?: string }>(
    "/api/bandit/premium",
    {
      action: "concierge_request",
      banditId: input.banditId,
      service: input.service,
      note: input.note,
      guestId: input.guestId || guestEmail,
      user_id: input.guestId || guestEmail,
    },
    guestEmail,
  );
  if (!result.ok) return { ok: false, detail: result.detail };
  const id = result.data.request?.id;
  if (!id) return { ok: false, detail: result.data.error || "No request id" };
  return { ok: true, requestId: id };
}
