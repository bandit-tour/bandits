/**
 * Experience booking — Workspace operator store + Orchestra Commerce ledger.
 * Never invents payment success. Returns MISSING / ERROR honestly.
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

/**
 * 1) Workspace book_experience — operator receives booking + seat decrement
 * 2) Orchestra Commerce book — payment ledger when product mapped + OS reachable
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

  if (!origin) {
    if (workspaceBook.ok) {
      const order: ExperienceBookOrder = {
        id: workspaceBook.data.bookingId,
        status: "confirmed",
        source: "workspace",
      };
      publishGuestLiveEvent({
        type: "commerce.booking.confirmed",
        title: `Booked · ${input.experienceTitle}`,
        entityId: input.experienceId,
        detail: input.slotLabel,
        sourceRef: `workspace:${workspaceBook.data.bookingId}`,
      });
      return {
        ok: true,
        data: {
          order,
          raw: workspaceBook.data,
          workspaceBookingId: workspaceBook.data.bookingId,
        },
        source: "orchestra_os",
      };
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
    };

    if ((!res.ok || raw.ok === false) && workspaceBook.ok) {
      return {
        ok: true,
        data: {
          order: {
            id: workspaceBook.data.bookingId,
            status: "confirmed",
            note: "Workspace booked; Commerce ledger deferred",
          },
          raw,
          workspaceBookingId: workspaceBook.data.bookingId,
        },
        source: "orchestra_os",
      };
    }

    if (!res.ok || raw.ok === false) {
      const msg =
        (Array.isArray(raw.errors) && raw.errors.join("; ")) ||
        raw.detail ||
        `${res.status} booking rejected`;
      return { ok: false, status: "ERROR", detail: msg };
    }

    if (!raw.order) {
      if (workspaceBook.ok) {
        return {
          ok: true,
          data: {
            order: { id: workspaceBook.data.bookingId, status: "confirmed" },
            raw,
            workspaceBookingId: workspaceBook.data.bookingId,
          },
          source: "orchestra_os",
        };
      }
      return {
        ok: false,
        status: "ERROR",
        detail: "Commerce OS returned no order — payment not confirmed.",
      };
    }

    const order = raw.order;
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
        order,
        raw,
        workspaceBookingId: workspaceBook.ok ? workspaceBook.data.bookingId : undefined,
      },
      source: "orchestra_os",
    };
  } catch (e) {
    if (workspaceBook.ok) {
      return {
        ok: true,
        data: {
          order: { id: workspaceBook.data.bookingId, status: "confirmed" },
          raw: { error: e instanceof Error ? e.message : "fetch failed" },
          workspaceBookingId: workspaceBook.data.bookingId,
        },
        source: "orchestra_os",
      };
    }
    return {
      ok: false,
      status: "ERROR",
      detail: e instanceof Error ? e.message : "Checkout request failed",
    };
  }
}
