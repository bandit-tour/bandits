/**
 * Production Travel in a Bottle — Workspace sleeping-stay inventory.
 * When Workspace publishes zero verified stays, Guest falls back to labeled SAMPLE
 * fixtures (`BOTTLE_MATCHES`) so the paired journey UX stays exercisable.
 */
import { workspaceGet, workspacePost } from "@/lib/workspace/client";
import {
  BOTTLE_MATCHES,
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

export type BottleCatalogMode = "live" | "sample";

export type BottleCatalogResult = {
  matches: BottleMatch[];
  mode: BottleCatalogMode;
  liveCount: number;
  /** Workspace may advertise stub demoStays without full listing payloads. */
  workspaceDemoStubCount: number;
  /** Set when the Workspace request failed — UI should offer retry, not invent stays. */
  error?: string | null;
};

function euros(cents: number) {
  return `From €${Math.round(cents / 100)}`;
}

export function mapWorkspaceBottleStay(row: WorkspaceBottleStay, hotelName?: string): BottleMatch | null {
  const photos = (row.photos || []).filter((u) => /^https?:\/\//i.test(u));
  const cover =
    row.coverPhoto && /^https?:\/\//i.test(row.coverPhoto) ? row.coverPhoto : photos[0] || "";
  // Incomplete supplier photography stays out of bookable live UI.
  if (!cover) return null;
  const nights = 1;
  const typeLabel = (row.natureType || "cabin").replace(/_/g, " ");
  return {
    id: row.id,
    inventorySource: "provider_record",
    hotel: {
      name: hotelName || "Partner hotel",
      nights: 2,
      city: "",
      emoji: "🏨",
      imageUrl: "",
    },
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
    priceLabel: euros(row.priceCentsPerNight || 0),
    travelTime: `${row.distanceMinutes || 45} min`,
    distance: row.location,
    departure: "After hotel nights",
    story:
      row.description ||
      `Hotel nights, then one night at ${row.title} — a second place to sleep, not a spa day.`,
    cta: "View journey",
    availabilityCta: "Check dates",
    journeyNights: 3,
  };
}

function sampleMatches(hotelName?: string): BottleMatch[] {
  const name = hotelName || DEFAULT_BOTTLE_HOTEL.name;
  return BOTTLE_MATCHES.map((m) => ({
    ...m,
    inventorySource: "sample" as const,
    hotel: { ...m.hotel, name },
  }));
}

export async function fetchLiveBottleStays(): Promise<WorkspaceBottleStay[]> {
  const result = await workspaceGet<{ ok?: boolean; stays?: WorkspaceBottleStay[] }>("/api/public/bottle/stays");
  if (!result.ok) return [];
  return (result.data.stays || []).filter((s) => s.source === "provider_record");
}

function nightsBetween(checkIn: string, checkOut: string): number | null {
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
  return nights >= 1 ? nights : null;
}

function stayMatchesRequest(
  row: WorkspaceBottleStay,
  destination: string,
  travelers: number,
): boolean {
  if (row.maxGuests && travelers > row.maxGuests) return false;
  const q = destination.trim().toLowerCase();
  if (!q) return true;
  const blob = `${row.location || ""} ${row.title || ""} ${row.natureType || ""}`.toLowerCase();
  if (blob.includes(q)) return true;
  // Athens hotel Mix: verified Attica / nearby nature stays are in range.
  if (/athens|attica/.test(q)) {
    return /athens|attica|parnitha|mesogeia|peloponnese|sounio|aegina|hyd|coast|marathon|lavrio/.test(
      blob,
    );
  }
  return false;
}

/**
 * Live mix only. Sample journeys are not returned as search results.
 */
export async function searchMixedSleeps(input: {
  destination: string;
  checkIn: string;
  checkOut: string;
  travelers: number;
  hotelName?: string | null;
}): Promise<BottleCatalogResult> {
  const totalNights = nightsBetween(input.checkIn, input.checkOut);
  const query = new URLSearchParams({
    destination: input.destination,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    travelers: String(input.travelers),
  });
  const result = await workspaceGet<{
    ok?: boolean;
    stays?: WorkspaceBottleStay[];
    demoStays?: { id?: string }[];
  }>(`/api/public/bottle/stays?${query.toString()}`);

  if (!result.ok) {
    return {
      matches: [],
      mode: "live",
      liveCount: 0,
      workspaceDemoStubCount: 0,
      error: result.detail || "Could not reach Workspace sleeping stays.",
    };
  }

  const workspaceDemoStubCount = Array.isArray(result.data?.demoStays) ? result.data.demoStays.length : 0;
  const hotelNights = totalNights && totalNights >= 2 ? totalNights - 1 : 1;
  const secondNights = totalNights && totalNights >= 2 ? totalNights - hotelNights : 1;
  const mapped = (result.data.stays || [])
    .filter((s) => s.source === "provider_record")
    .filter((s) => stayMatchesRequest(s, input.destination, input.travelers))
    .map((r) => mapWorkspaceBottleStay(r, input.hotelName || undefined))
    .filter((m): m is BottleMatch => Boolean(m))
    .map((m) => ({
      ...m,
      hotel: { ...m.hotel, nights: hotelNights },
      second: { ...m.second, nights: secondNights },
      journeyNights: hotelNights + secondNights,
      priceLabel: m.priceLabel === "From €0" ? "Price on request" : m.priceLabel,
    }));

  return {
    matches: mapped,
    mode: "live",
    liveCount: mapped.length,
    workspaceDemoStubCount,
    error: null,
  };
}

/**
 * Prefer verified Workspace stays. If none are published (or mapping yields zero
 * usable covers), restore the full SAMPLE paired-journey catalog.
 */
export async function loadBottleCatalog(hotelName?: string): Promise<BottleCatalogResult> {
  const result = await workspaceGet<{
    ok?: boolean;
    stays?: WorkspaceBottleStay[];
    demoStays?: { id?: string }[];
    count?: number;
  }>("/api/public/bottle/stays");

  if (!result.ok) {
    return {
      matches: [],
      mode: "sample",
      liveCount: 0,
      workspaceDemoStubCount: 0,
      error: result.detail || "Could not reach Workspace sleeping stays.",
    };
  }

  const workspaceDemoStubCount = Array.isArray(result.data?.demoStays) ? result.data.demoStays.length : 0;
  const liveRows = (result.data.stays || []).filter((s) => s.source === "provider_record");
  const mapped = liveRows
    .map((r) => mapWorkspaceBottleStay(r, hotelName))
    .filter((m): m is BottleMatch => Boolean(m));
  if (mapped.length > 0) {
    return {
      matches: mapped,
      mode: "live",
      liveCount: mapped.length,
      workspaceDemoStubCount,
      error: null,
    };
  }

  /** Workspace answered; no verified outdoor stays — labeled SAMPLE fixtures only. */
  return {
    matches: sampleMatches(hotelName),
    mode: "sample",
    liveCount: 0,
    workspaceDemoStubCount,
    error: null,
  };
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
