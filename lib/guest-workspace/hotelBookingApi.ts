import { workspaceGet, workspacePost } from "@/lib/workspace/client";

export type HotelBookingQuote = {
  lodgingCents: number;
  guestServiceFeeCents: number;
  guestTotalCents: number;
  platformCommissionCents: number;
  supplierNetCents: number;
  commissionRate: number;
  currency: "EUR";
};

export async function fetchHotelBookingAvailability(
  slug: string,
  checkIn: string,
  checkOut: string,
  travelers: number,
) {
  const qs = new URLSearchParams({
    checkIn,
    checkOut,
    travelers: String(travelers),
  });
  return workspaceGet<{
    ok?: boolean;
    bookable?: boolean;
    partner?: boolean;
    reason?: string;
    availability?: { rooms?: Array<{ id: string; name: string; totalCents: number | null }> };
    quote?: HotelBookingQuote | null;
  }>(`/api/public/hotels/${encodeURIComponent(slug)}/booking?${qs}`);
}

export async function checkoutHotelBooking(input: {
  hotelSlug: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  travelers: number;
  guestEmail: string;
}) {
  return workspacePost<{
    ok?: boolean;
    reservationRef?: string;
    quote?: HotelBookingQuote;
    error?: string;
    code?: string;
  }>("/api/public/bottle/ota-booking", {
    flow: "book_hotel",
    action: "checkout",
    ...input,
  });
}

export async function quoteMixBooking(input: Record<string, unknown>) {
  return workspacePost<{
    ok?: boolean;
    quote?: {
      hotel: HotelBookingQuote;
      outdoor: HotelBookingQuote;
      guestTotalCents: number;
      guestServiceFeeCents: number;
    };
    error?: string;
    code?: string;
  }>("/api/public/bottle/ota-booking", { flow: "book_mix", action: "quote", ...input });
}

export async function checkoutMixBooking(input: Record<string, unknown>) {
  return workspacePost<{ ok?: boolean; error?: string; code?: string; reservationRef?: string }>(
    "/api/public/bottle/ota-booking",
    { flow: "book_mix", action: "checkout", ...input },
  );
}
