/**
 * Octopus Concierge entitlement — Commerce OS (Orchestra preferred).
 * NEVER grant ACTIVE from localStorage, useState, or mock success.
 * Concierge task execution still writes to Workspace premium ops.
 */

import { OCTOPUS_CONCIERGE_OFFER } from "@/lib/octopus-concierge/principle";
import type { ConciergeTask, ConciergeTaskStatus } from "@/lib/octopus-concierge/types";
import {
  commerceGet,
  commerceOrigin,
  commercePost,
  workspaceGet,
  workspacePost,
} from "@/lib/workspace/client";

export type OctopusEntitlementState =
  | "none"
  | "pending_payment"
  | "active"
  | "expired"
  | "exhausted"
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
  requestsRemaining?: number | null;
  requestsIncluded?: number | null;
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
  requests_remaining?: number | null;
  requests_included?: number | null;
  entitlement?: CommerceEntitlementPayload;
};

/** Paid commerce must bind to the signed-in guest — never inherit demo Stay Pass. */
function requireGuestEmail(guestEmail?: string | null): string | null {
  const email = String(guestEmail || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return email;
}

function normalizeState(raw: CommerceEntitlementPayload | null): OctopusEntitlementState {
  if (!raw) return "none";
  const s = String(raw.status ?? raw.state ?? "").trim().toLowerCase();
  if (s === "exhausted") return "exhausted";
  if (s === "expired") return "expired";
  if (s === "pending" || s === "pending_payment" || s === "processing") return "pending_payment";
  if (raw.active === true || raw.entitled === true) return "active";
  if (s === "active" || s === "entitled" || s === "paid") return "active";
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
  const guestEmail = requireGuestEmail(input.guestEmail);
  const stayId = input.stayId ? String(input.stayId).trim() : "current_stay";
  const base: Omit<OctopusEntitlement, "state" | "entitled" | "source" | "detail" | "expiresAt"> = {
    productSku: OCTOPUS_CONCIERGE_OFFER.sku,
    banditId,
    guestId: guestId || guestEmail,
  };

  if (!banditId) {
    return { ...base, state: "none", entitled: false, source: "none", detail: "Missing bandit id", expiresAt: null };
  }

  if (!guestEmail) {
    return {
      ...base,
      state: "none",
      entitled: false,
      source: "none",
      detail: "Sign in to unlock Your Local Insider.",
      expiresAt: null,
    };
  }

  const origin = commerceOrigin();
  if (!origin) {
    return {
      ...base,
      state: "unavailable",
      entitled: false,
      source: "none",
      detail: "Purchases aren’t available in this build yet. Your Local Insider stays free to browse — try again after Workspace commerce is connected.",
      expiresAt: null,
    };
  }

  const qs = new URLSearchParams({
    user_id: guestEmail,
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
  const remaining =
    typeof payload.requests_remaining === "number" ? payload.requests_remaining : null;
  const included =
    typeof payload.requests_included === "number" ? payload.requests_included : null;
  return {
    ...base,
    state,
    entitled: state === "active",
    source: "commerce",
    detail:
      state === "active"
        ? `Commerce ACTIVE · ${payload.owner || "Workspace"}${remaining != null ? ` · ${remaining} requests left` : ""}`
        : state === "exhausted"
          ? "Stay Pass allowance used up for this stay"
          : state === "expired"
            ? "Stay Pass expired"
            : `Commerce state: ${state}`,
    expiresAt: payload.expires_at ?? payload.expiresAt ?? null,
    orderId: payload.order_id ?? null,
    stayId: payload.stay_id ?? stayId,
    requestsRemaining: remaining,
    requestsIncluded: included,
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
 * Start real Commerce checkout for Octopus Concierge (€19).
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
  const guestEmail = requireGuestEmail(input.guestEmail);
  const stayId = input.stayId ? String(input.stayId).trim() : "current_stay";
  const customerKey = guestEmail;

  if (!customerKey) {
    return { ok: false, reason: "missing_guest", detail: "Sign in to unlock Your Local Insider." };
  }
  if (!commerceOrigin()) {
    return {
      ok: false,
      reason: "missing_origin",
      detail: "Checkout isn’t ready yet. Connect a verified stay, then unlock Your Local Insider when payment is available.",
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

/** After Stripe hosted Checkout success URL — confirm session and grant Stay Pass. */
export async function confirmOctopusCheckoutSession(input: {
  sessionId: string;
  banditId: string;
  guestEmail?: string | null;
}): Promise<
  | { ok: true; orderId?: string; entitlement: OctopusEntitlement | null }
  | { ok: false; detail: string }
> {
  const sessionId = String(input.sessionId || "").trim();
  const banditId = String(input.banditId || "").trim();
  const guestEmail = requireGuestEmail(input.guestEmail);
  if (!sessionId || !banditId) {
    return { ok: false, detail: "Missing checkout session." };
  }
  if (!guestEmail) {
    return { ok: false, detail: "Sign in to confirm payment." };
  }
  const result = await commercePost<{
    ok?: boolean;
    error?: string;
    order_id?: string;
    entitlement?: { active?: boolean; requests_remaining?: number | null };
    stay_pass?: {
      active?: boolean;
      expiresAt?: string | null;
      orderId?: string | null;
      requestsRemaining?: number | null;
      requestsIncluded?: number | null;
    } | null;
  }>(
    "/api/commerce/checkout/confirm",
    {
      session_id: sessionId,
      sessionId,
      bandit_id: banditId,
      banditId,
    },
    guestEmail,
  );
  if (!result.ok) {
    return { ok: false, detail: result.detail || "Could not confirm Stripe payment." };
  }
  if (result.data.ok === false) {
    return {
      ok: false,
      detail: result.data.error || "Could not confirm Stripe payment.",
    };
  }
  const pass = result.data.stay_pass;
  const active = pass?.active === true || result.data.entitlement?.active === true;
  const remaining = pass?.requestsRemaining ?? result.data.entitlement?.requests_remaining ?? null;
  const entitlement: OctopusEntitlement | null = active
    ? {
        state: "active",
        entitled: true,
        productSku: OCTOPUS_CONCIERGE_OFFER.sku,
        banditId,
        guestId: guestEmail,
        source: "commerce",
        detail:
          remaining != null
            ? `Commerce ACTIVE · ${remaining} requests left`
            : "Commerce ACTIVE",
        expiresAt: pass?.expiresAt ?? null,
        orderId: pass?.orderId ?? result.data.order_id ?? null,
        requestsRemaining: remaining,
        requestsIncluded: pass?.requestsIncluded ?? null,
      }
    : null;
  return { ok: true, orderId: result.data.order_id, entitlement };
}

export function assertConciergeOpsAllowed(entitlement: OctopusEntitlement): boolean {
  return entitlement.entitled === true && entitlement.state === "active";
}

export type ConciergeTrackRequest = {
  id: string;
  service?: string;
  note?: string;
  status?: string;
  createdAt?: string;
  decidedAt?: string;
  bookingDetails?: string | null;
  messages?: Array<{ id?: string; from?: string; body?: string; at?: string }>;
  fulfillmentEvidence?: {
    confirmationNumber?: string | null;
    receiptUrl?: string | null;
    evidenceNote?: string | null;
    supplierName?: string | null;
  } | null;
};

/** Operator "completed" without fulfillment evidence must NOT become guest CONFIRMED. */
export function trackHasFulfillmentEvidence(
  row:
    | {
        fulfillmentEvidence?: ConciergeTrackRequest["fulfillmentEvidence"];
        bookingDetails?: string | null;
      }
    | null
    | undefined,
): boolean {
  const ev = row?.fulfillmentEvidence;
  if (!ev) return false;
  const conf = String(ev.confirmationNumber || "").trim();
  const receipt = String(ev.receiptUrl || "").trim();
  const note = String(ev.evidenceNote || "").trim();
  const supplier = String(ev.supplierName || "").trim();
  const hasArtifact = conf.length >= 3 || /^https?:\/\//i.test(receipt);
  const hasAttribution = supplier.length >= 2 || note.length >= 8;
  return hasArtifact && hasAttribution;
}

/** Map Workspace premium request status → Guest ConciergeTask status. */
export function mapTrackStatusToTaskStatus(
  raw: string | undefined | null,
  row?: ConciergeTrackRequest | null,
): ConciergeTaskStatus {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "cancelled" || s === "declined" || s === "unavailable" || s === "failed") {
    return "cancelled";
  }
  if (s === "awaiting_guest") return "awaiting_guest";
  if (s === "accepted" || s === "in_progress" || s === "booking") return "in_progress";
  if (s === "assigned" || s === "paid") return "assigned_to_bandit";
  // confirmed/completed require evidence — otherwise show as in_progress (coordination only).
  if (s === "confirmed" || s === "completed" || s === "done") {
    if (trackHasFulfillmentEvidence(row)) {
      return s === "confirmed" ? "confirmed" : "completed";
    }
    return "in_progress";
  }
  return "requested";
}

export async function fetchConciergeTrack(input: {
  banditId: string;
  guestEmail?: string | null;
}): Promise<
  | { ok: true; requests: ConciergeTrackRequest[] }
  | { ok: false; detail: string }
> {
  const banditId = String(input.banditId || "").trim();
  const guestEmail = requireGuestEmail(input.guestEmail);
  if (!guestEmail) return { ok: false, detail: "Sign in required" };
  if (!banditId) return { ok: false, detail: "Missing bandit id" };
  const result = await workspaceGet<{
    requests?: ConciergeTrackRequest[];
    error?: string;
  }>(`/api/bandit/premium?view=track&banditId=${encodeURIComponent(banditId)}`, guestEmail);
  if (!result.ok) return { ok: false, detail: result.detail };
  return { ok: true, requests: Array.isArray(result.data.requests) ? result.data.requests : [] };
}

/**
 * Merge Workspace track rows into local task list (by request id).
 * Creates rows for server-only requests so Active/Completed survive refresh.
 */
export function mergeTrackIntoTasks(
  local: ConciergeTask[],
  track: ConciergeTrackRequest[],
  banditDisplayName: string,
  guestId: string,
  banditId: string,
): ConciergeTask[] {
  const byId = new Map<string, ConciergeTask>();
  for (const t of local) byId.set(t.id, t);

  for (const row of track) {
    const id = String(row.id || "").trim();
    if (!id) continue;
    const status = mapTrackStatusToTaskStatus(row.status, row);
    const reply =
      [...(row.messages || [])]
        .filter((m) => String(m.from || "").toLowerCase() === "bandit" && String(m.body || "").trim())
        .sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")))
        .map((m) => String(m.body).trim())
        .pop() ||
      (row.bookingDetails ? String(row.bookingDetails).trim() : null) ||
      null;
    const evidenceBits = [
      row.fulfillmentEvidence?.confirmationNumber
        ? `conf:${row.fulfillmentEvidence.confirmationNumber}`
        : null,
      row.fulfillmentEvidence?.receiptUrl || null,
      row.fulfillmentEvidence?.supplierName
        ? `supplier:${row.fulfillmentEvidence.supplierName}`
        : null,
    ].filter(Boolean) as string[];
    const confirmation =
      trackHasFulfillmentEvidence(row) && row.fulfillmentEvidence?.confirmationNumber
        ? String(row.fulfillmentEvidence.confirmationNumber)
        : trackHasFulfillmentEvidence(row) && row.bookingDetails
          ? String(row.bookingDetails)
          : null;
    const note = String(row.note || row.service || "Concierge request").trim();
    const existing = byId.get(id);
    const now = new Date().toISOString();
    if (existing) {
      byId.set(id, {
        ...existing,
        status,
        providerReply: reply ?? existing.providerReply,
        confirmation: confirmation ?? existing.confirmation,
        evidence: evidenceBits.length ? evidenceBits : existing.evidence,
        updatedAt: row.decidedAt || now,
      });
    } else {
      byId.set(id, {
        id,
        request: note,
        guestId,
        banditId,
        banditDisplayName,
        category: "other",
        deadline: null,
        location: null,
        budget: null,
        executionMethod: "HUMAN",
        status,
        confirmation,
        providerReply: reply,
        cost: null,
        commission: null,
        evidence: evidenceBits,
        createdAt: row.createdAt || now,
        updatedAt: row.decidedAt || row.createdAt || now,
      });
    }
  }

  return Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function submitConciergeRequestToWorkspace(input: {
  banditId: string;
  service: string;
  note: string;
  guestEmail?: string | null;
  guestId?: string | null;
  /** Stable per tap — Workspace replays without a second Stay Pass debit. */
  clientRequestId?: string | null;
}): Promise<
  | { ok: true; requestId: string; requestsRemaining?: number | null }
  | { ok: false; detail: string; code?: string }
> {
  const guestEmail = requireGuestEmail(input.guestEmail);
  if (!guestEmail) {
    return { ok: false, detail: "Sign in required to send a concierge request.", code: "auth" };
  }
  // Client refuse (defense in depth). Workspace consumeStayPassRequest also refuses
  // empty/non-substantive notes server-side without consuming Stay Pass.
  const note = String(input.note || "").trim();
  const service = String(input.service || "").trim();
  if (!note) {
    return {
      ok: false,
      detail: "Add request details before sending — empty notes are not accepted.",
      code: "validation",
    };
  }
  if (!service) {
    return {
      ok: false,
      detail: "Choose a service before sending.",
      code: "validation",
    };
  }
  if (note.length < 8) {
    return {
      ok: false,
      detail: "Add a bit more detail so your banDit can act on this request.",
      code: "validation",
    };
  }
  const clientRequestId =
    String(input.clientRequestId || "").trim() ||
    `crq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const result = await workspacePost<{
    ok?: boolean;
    request?: { id: string };
    error?: string;
    stayPass?: { requestsRemaining?: number | null; requests_remaining?: number | null };
  }>(
    "/api/bandit/premium",
    {
      action: "concierge_request",
      banditId: input.banditId,
      service,
      note,
      guestId: input.guestId || guestEmail,
      user_id: guestEmail,
      clientRequestId,
      idempotencyKey: clientRequestId,
    },
    guestEmail,
  );
  if (!result.ok) {
    const detail = result.detail || "Request blocked";
    const code = /premium required|entitlement|not entitled|exhausted/i.test(detail)
      ? "premium_required"
      : /empty notes|Stay Pass not consumed|details required|Add more detail|Add request details/i.test(
            detail,
          )
        ? "validation"
        : "error";
    return { ok: false, detail, code };
  }
  const id = result.data.request?.id;
  if (!id) return { ok: false, detail: result.data.error || "No request id", code: "error" };
  const remaining =
    typeof result.data.stayPass?.requestsRemaining === "number"
      ? result.data.stayPass.requestsRemaining
      : typeof result.data.stayPass?.requests_remaining === "number"
        ? result.data.stayPass.requests_remaining
        : null;
  return { ok: true, requestId: id, requestsRemaining: remaining };
}
