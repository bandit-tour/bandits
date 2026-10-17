/**
 * Experience booking — Workspace operator store + Orchestra Commerce ledger.
 * Never invents payment success. Returns MISSING / ERROR honestly.
 * CONFIRMED only after verified payment (or explicit free/no-pay reservation).
 */

import { orchestraOsOrigin, type OrchestraFetchResult } from "@/lib/orchestra/client";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { publishGuestLiveEvent } from "@/lib/orchestra/live-bus";
import { bookExperienceViaWorkspace } from "@/lib/workspace/actions";

export type ExperienceBookInput = {
  workspaceId: string;
  productId: string;
  customerId: string;
  idempotencyKey: string;
  paymentMethod?: "card" | "apple_pay" | "google_pay" | "wallet_balance";
  experienceId: string;
  experienceTitle: string;
  slotId: string;
  guestCount: number;
  slotLabel: string;
  guestEmail?: string | null;
  /** When true and amount is 0, allow reservation without card. */
  noPayReservation?: boolean;
  amountCents?: number;
};

export type ExperienceBookOrder = {
  id?: string;
  status?: string;
  total?: number;
  currency?: string;
  [key: string]: unknown;
};

export type ExperienceBookResult = OrchestraFetchResult<{
  order: ExperienceBookOrder;
  raw: unknown;
  workspaceBookingId?: string;
}>;

function isPaidOrderStatus(status: string | undefined): boolean {
  const s = String(status || "").toLowerCase();
  return (
    s === "paid" ||
    s === "fulfilled" ||
    s === "succeeded" ||
    s === "captured" ||
    s === "confirmed_paid"
  );
}

/**
 * 1) Workspace book_experience — creates requested booking + seat hold
 * 2) Orchestra / Commerce checkout — payment required before guest-facing CONFIRMED
 */
export async function bookExperienceViaCommerce(
  input: ExperienceBookInput,
): Promise<ExperienceBookResult> {
  if (!input.productId && !input.experienceId.startsWith("exp_")) {
    return {
      ok: false,
      status: "MISSING",
      detail: "This experience is not mapped to a Commerce OS product yet.",
    };
  }

  const workspaceBook = await bookExperienceViaWorkspace({
    experienceId: input.experienceId,
    title: input.experienceTitle,
    sessionId: input.slotId,
    guests: input.guestCount,
    guestEmail: input.guestEmail,
  });

  const origin = orchestraOsOrigin();
  const paymentsLive = isFeatureEnabled("ff_payments_live");
  const amountCents = typeof input.amountCents === "number" ? input.amountCents : undefined;
  const freeNoPay =
    input.noPayReservation === true && (amountCents === 0 || amountCents == null);

  if (!origin) {
    if (workspaceBook.ok) {
      if (freeNoPay) {
        publishGuestLiveEvent({
          type: "commerce.booking.confirmed",
          title: `Reserved · ${input.experienceTitle}`,
          entityId: input.experienceId,
          detail: `${input.slotLabel} · no-pay reservation`,
          sourceRef: `workspace:${workspaceBook.data.bookingId}`,
        });
        return {
          ok: true,
          data: {
            order: {
              id: workspaceBook.data.bookingId,
              status: "confirmed",
              source: "workspace_no_pay",
            },
            raw: workspaceBook.data,
            workspaceBookingId: workspaceBook.data.bookingId,
          },
          source: "orchestra_os",
        };
      }
      // Honest: hold exists, payment missing — never claim CONFIRMED.
      return {
        ok: false,
        status: "MISSING",
        detail:
          "Experience request recorded, but payment is required before confirmation. Complete Stripe TEST checkout — booking stays requested until paid.",
        data: {
          order: {
            id: workspaceBook.data.bookingId,
            status: "requested",
            source: "workspace_unpaid",
          },
          raw: workspaceBook.data,
          workspaceBookingId: workspaceBook.data.bookingId,
        },
      } as ExperienceBookResult;
    }
    return {
      ok: false,
      status: "MISSING",
      detail: !workspaceBook.ok
        ? workspaceBook.detail
        : "Commerce OS unreachable — set EXPO_PUBLIC_ORCHESTRA_OS_URL (and Workspace for operator booking).",
    };
  }

  try {
    const res = await fetch(`${origin}/api/commerce/experiences/book`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspace_id: input.workspaceId,
        product_id: input.productId,
        customer_id: input.customerId,
        idempotency_key: input.idempotencyKey,
        payment_method: input.paymentMethod ?? "card",
        metadata: {
          guest_experience_id: input.experienceId,
          slot_id: input.slotId,
          guest_count: input.guestCount,
          slot_label: input.slotLabel,
          payments_live: paymentsLive,
          workspace_booking_id: workspaceBook.ok ? workspaceBook.data.bookingId : null,
        },
      }),
    });

    const raw = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      order?: ExperienceBookOrder;
      errors?: string[];
      detail?: string;
      payment_confirmed?: boolean;
    };

    if ((!res.ok || raw.ok === false) && workspaceBook.ok) {
      return {
        ok: false,
        status: "ERROR",
        detail:
          (Array.isArray(raw.errors) && raw.errors.join("; ")) ||
          raw.detail ||
          "Payment not confirmed — experience stays requested until Stripe TEST checkout succeeds.",
        data: {
          order: {
            id: workspaceBook.data.bookingId,
            status: "requested",
            note: "Workspace hold; Commerce payment missing",
          },
          raw,
          workspaceBookingId: workspaceBook.data.bookingId,
        },
      } as ExperienceBookResult;
    }

    if (!res.ok || raw.ok === false) {
      const msg =
        (Array.isArray(raw.errors) && raw.errors.join("; ")) ||
        raw.detail ||
        `${res.status} booking rejected`;
      return { ok: false, status: "ERROR", detail: msg };
    }

    if (!raw.order) {
      return {
        ok: false,
        status: "ERROR",
        detail: "Commerce OS returned no order — payment not confirmed.",
        data: workspaceBook.ok
          ? {
              order: { id: workspaceBook.data.bookingId, status: "requested" },
              raw,
              workspaceBookingId: workspaceBook.data.bookingId,
            }
          : undefined,
      } as ExperienceBookResult;
    }

    const order = raw.order;
    const paid =
      raw.payment_confirmed === true ||
      isPaidOrderStatus(String(order.status)) ||
      freeNoPay;

    if (!paid) {
      return {
        ok: false,
        status: "ERROR",
        detail: "Payment not verified — booking will not show as confirmed.",
        data: {
          order: { ...order, status: "requested" },
          raw,
          workspaceBookingId: workspaceBook.ok ? workspaceBook.data.bookingId : undefined,
        },
      };
    }

    publishGuestLiveEvent({
      type: "experience.booked",
      title: input.experienceTitle,
      entityId: input.experienceId,
      detail: `${input.slotLabel} · ${input.guestCount} guest${input.guestCount === 1 ? "" : "s"}`,
      sourceRef: `commerce:${order.id ?? "order"}`,
    });
    publishGuestLiveEvent({
      type: "commerce.booking.confirmed",
      title: `Booked · ${input.experienceTitle}`,
      entityId: String(order.id ?? input.experienceId),
      detail: input.slotLabel,
      sourceRef: `commerce:${order.id ?? "order"}`,
    });
    publishGuestLiveEvent({
      type: "commerce.payment.confirmed",
      title: `Payment · ${input.experienceTitle}`,
      entityId: String(order.id ?? input.experienceId),
      detail: order.total != null ? `${order.currency ?? "EUR"} ${order.total}` : undefined,
      sourceRef: `commerce:${order.id ?? "order"}`,
    });

    return {
      ok: true,
      data: {
        order: { ...order, status: freeNoPay ? "confirmed" : order.status || "paid" },
        raw,
        workspaceBookingId: workspaceBook.ok ? workspaceBook.data.bookingId : undefined,
      },
      source: "orchestra_os",
    };
  } catch (e) {
    if (workspaceBook.ok) {
      return {
        ok: false,
        status: "ERROR",
        detail: e instanceof Error ? e.message : "Checkout request failed",
        data: {
          order: { id: workspaceBook.data.bookingId, status: "requested" },
          raw: { error: e instanceof Error ? e.message : "fetch failed" },
          workspaceBookingId: workspaceBook.data.bookingId,
        },
      } as ExperienceBookResult;
    }
    return {
      ok: false,
      status: "ERROR",
      detail: e instanceof Error ? e.message : "Checkout request failed",
    };
  }
}
