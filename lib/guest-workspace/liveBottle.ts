/**
 * Production Travel in a Bottle — Workspace sleeping-stay inventory.
 * Seeded BOTTLE_MATCHES are labelled DEMO only and must not mix as source of truth.
 */
import { workspaceGet, workspacePost } from "@/lib/workspace/client";
import {
  DEFAULT_BOTTLE_HOTEL,
  type BottleMatch,
} from "@/lib/guest-workspace/productWorlds";

export type WorkspaceBottleStay = {
  id: string;
  title: string;
  location: string;
  description?: string;
  natureType?: string;
  priceCentsPerNight: number;
  amenities?: string[];
  photos?: string[];
  coverPhoto?: string;
  hostName?: string;
  partnerId?: string;
  maxGuests?: number;
  availableDates?: string[];
  available?: boolean;
  distanceMinutes?: number;
  source?: string;
  cancellation?: string;
};

function euros(cents: number) {
  return `From €${Math.round(cents / 100)}`;
}

export function mapWorkspaceBottleStay(row: WorkspaceBottleStay, hotelName?: string): BottleMatch | null {
  const photos = (row.photos || []).filter((u) => /^https?:\/\//i.test(u));
  const cover =
    row.coverPhoto && /^https?:\/\//i.test(row.coverPhoto) ? row.coverPhoto : photos[0] || "";
  // No invented hotel/cabin stock — incomplete supplier photography stays out of bookable UI.
  if (!cover) return null;
  const nights = 1;
  const typeLabel = (row.natureType || "cabin").replace(/_/g, " ");
  return {
    id: row.id,
    hotel: { ...DEFAULT_BOTTLE_HOTEL, name: hotelName || DEFAULT_BOTTLE_HOTEL.name, nights: 2 },
    second: {
      name: row.title,
      nights,
      location: row.location,
      type: typeLabel.replace(/\b\w/g, (c) => c.toUpperCase()),
      emoji: "🌲",
      host: row.hostName || "Sleeping-experience host",
      availability: row.availableDates?.length
        ? `${row.availableDates.length} nights open`
        : "Ask host for dates",
      attributes: (row.amenities || []).slice(0, 4),
      imageUrl: cover,
      gallery: photos.slice(0, 6),
    },
    filterTags: [typeLabel, "Nature"],
    priceLabel: euros(row.priceCentsPerNight),
    travelTime: `${row.distanceMinutes || 45} min`,
    distance: row.location,
    departure: "After hotel nights",
    story: row.description || `Hotel nights, then one night at ${row.title} — a second place to sleep, not a spa day.`,
    cta: "View journey",
    availabilityCta: "Check dates",
    journeyNights: 3,
  };
}

export async function fetchLiveBottleStays(): Promise<WorkspaceBottleStay[]> {
  const result = await workspaceGet<{ ok?: boolean; stays?: WorkspaceBottleStay[] }>("/api/public/bottle/stays");
  if (!result.ok) return [];
  return (result.data.stays || []).filter((s) => s.source === "provider_record");
}

export async function fetchLiveBottleStay(id: string): Promise<WorkspaceBottleStay | null> {
  const result = await workspaceGet<{ ok?: boolean; stay?: WorkspaceBottleStay; stays?: WorkspaceBottleStay[] }>(
    `/api/public/bottle/stays?id=${encodeURIComponent(id)}`,
  );
  if (!result.ok) return null;
  return result.data.stay || (result.data.stays || []).find((s) => s.id === id) || null;
}

export async function bookBottleStayViaWorkspace(input: {
  stayId: string;
  title: string;
  checkIn?: string;
  nights?: number;
  guestEmail?: string | null;
}) {
  const result = await workspacePost<{
    ok?: boolean;
    error?: string;
    booking?: { id: string };
    order?: { id: string; meta?: Record<string, unknown> };
  }>(
    "/api/guest/reflection",
    {
      action: "book_bottle_stay",
      objectType: "bottle_stay",
      objectId: input.stayId,
      title: input.title,
      source: "bottle",
      checkIn: input.checkIn,
      nights: input.nights || 1,
    },
    input.guestEmail,
  );
  if (!result.ok) return { ok: false as const, detail: result.detail };
  if (result.data.ok === false) return { ok: false as const, detail: result.data.error || "Booking rejected" };
  const bookingId = result.data.booking?.id;
  if (!bookingId) return { ok: false as const, detail: "Workspace returned no booking" };
  return {
    ok: true as const,
    bookingId,
    orderId: result.data.order?.id,
    transferId: result.data.order?.meta?.stripeTransferId,
  };
}
