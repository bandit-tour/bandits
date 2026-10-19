/**
 * Confirmed Bottle reservations only.
 * Written after Workspace returns a reservation reference. Never stores inspiration or TEST previews.
 */

export type BottleBookingRecord = {
  id: string;
  flow: "hotel" | "mix";
  hotelName: string;
  outdoorTitle?: string;
  checkIn: string;
  checkOut: string;
  travelers: number;
  totalCents: number | null;
  reservationRef: string;
  /** True when the supplier record itself is a labelled TEST fixture. */
  testFixture: boolean;
  guestName: string;
  createdAt: string;
};

const KEY = "banditour.bottle.bookings.v1";

function storage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    /* private mode */
  }
  return null;
}

export function isTestFixtureLabel(value: string | null | undefined): boolean {
  return /\btest\b/i.test(value || "");
}

export function readBottleBookingHistory(): BottleBookingRecord[] {
  const raw = storage()?.getItem(KEY);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw) as BottleBookingRecord[];
    if (!Array.isArray(rows)) return [];
    return rows.filter((row) => row && typeof row.reservationRef === "string" && row.reservationRef.length > 0);
  } catch {
    return [];
  }
}

export function rememberBottleBooking(row: BottleBookingRecord): BottleBookingRecord[] {
  const next = [row, ...readBottleBookingHistory().filter((item) => item.reservationRef !== row.reservationRef)].slice(
    0,
    20,
  );
  storage()?.setItem(KEY, JSON.stringify(next));
  return next;
}
