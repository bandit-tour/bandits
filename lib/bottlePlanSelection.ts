/**
 * Travel in a Bottle — persist guest hotel + trip params across profile / mix / refresh.
 */
import type { AthensDiscoveryHotel } from "@/lib/guest-workspace/athensHotelPlaces";

export type BottleOutdoorPick = {
  kind: "verified" | "inspiration" | "test" | "demo";
  id: string;
};

export type BottlePlanSelection = {
  destination: string;
  checkIn: string;
  checkOut: string;
  travelers: number;
  hotelNights: number;
  outdoorNights: number;
  placeId?: string;
  hotelSlug?: string;
  hotelName?: string;
  partner?: boolean;
  /** Outdoor card the guest selected. Inspiration and TEST picks are not inventory. */
  outdoorPick?: BottleOutdoorPick;
};

const KEY = "banditour.bottle.plan.v1";

function storage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) return window.sessionStorage;
  } catch {
    /* private mode */
  }
  return null;
}

function nameIsPlay(name: string | undefined): boolean {
  return /play theatrou|play athens/i.test(name || "");
}

function slugIsPlay(sel: Pick<BottlePlanSelection, "hotelSlug" | "placeId">): boolean {
  return /play-theatrou|play-athens/i.test(sel.hotelSlug || "") || sel.placeId === "partner:play-theatrou";
}

/** Drop a PLAY slug that was attached to a different selected hotel. */
export function sanitizeBottlePlanSelection(sel: BottlePlanSelection): BottlePlanSelection {
  if (!sel.hotelName || nameIsPlay(sel.hotelName) || !slugIsPlay(sel)) return sel;
  const placeId = sel.placeId === "partner:play-theatrou" ? undefined : sel.placeId;
  return {
    ...sel,
    placeId,
    hotelSlug: undefined,
    partner: false,
  };
}

export function readBottlePlanSelection(): BottlePlanSelection | null {
  const raw = storage()?.getItem(KEY);
  if (!raw) return null;
  try {
    return sanitizeBottlePlanSelection(JSON.parse(raw) as BottlePlanSelection);
  } catch {
    return null;
  }
}

export function writeBottlePlanSelection(sel: BottlePlanSelection): void {
  storage()?.setItem(KEY, JSON.stringify(sanitizeBottlePlanSelection(sel)));
}

export function selectionFromHotel(
  hotel: AthensDiscoveryHotel,
  partial: Pick<BottlePlanSelection, "destination" | "checkIn" | "checkOut" | "travelers" | "hotelNights" | "outdoorNights">,
): BottlePlanSelection {
  const partnerSlug = hotel.slug || (hotel.partner ? hotel.placeId.replace(/^partner:/, "") : undefined);
  return {
    ...partial,
    placeId: hotel.placeId,
    hotelSlug: partnerSlug,
    hotelName: hotel.name,
    partner: hotel.partner,
  };
}

const SEARCH_KEYS = [
  "destination",
  "checkIn",
  "checkOut",
  "travelers",
  "hotelNights",
  "outdoorNights",
  "placeId",
  "hotelSlug",
  "hotelName",
  "outdoorKind",
  "outdoorId",
] as const;

function tripNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

/** Keep a split that matches the selected dates. Otherwise use 2 hotel nights and the rest outdoors. */
export function fitNightSplit(checkIn: string, checkOut: string, hotelNights: number, outdoorNights: number) {
  const span = tripNights(checkIn, checkOut);
  if (span >= 2 && hotelNights >= 1 && outdoorNights >= 1 && hotelNights + outdoorNights === span) {
    return { hotelNights, outdoorNights };
  }
  if (span >= 2) {
    const hotel = Math.min(2, span - 1);
    return { hotelNights: hotel, outdoorNights: span - hotel };
  }
  return {
    hotelNights: Math.max(1, hotelNights || 1),
    outdoorNights: Math.max(1, outdoorNights || 1),
  };
}

function outdoorPickFrom(kind: string, id: string): BottleOutdoorPick | undefined {
  if ((kind === "verified" || kind === "inspiration" || kind === "test" || kind === "demo") && id) {
    return { kind, id };
  }
  return undefined;
}

function paramValue(raw: Record<string, string | string[] | undefined>, key: string): string {
  const value = raw[key];
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string");
    return first ? first.trim() : "";
  }
  return "";
}

/** Stable across renders. Search-param objects from the router are not. */
export function bottlePlanParamKey(raw: Record<string, string | string[] | undefined>): string {
  return SEARCH_KEYS.map((key) => paramValue(raw, key)).join("\u001f");
}

export function bottlePlanFromSearchParams(
  raw: Record<string, string | string[] | undefined>,
): BottlePlanSelection | null {
  const urlName = paramValue(raw, "hotelName");
  const urlPlace = paramValue(raw, "placeId");
  const urlSlug = paramValue(raw, "hotelSlug");
  let destination = paramValue(raw, "destination");
  let checkIn = paramValue(raw, "checkIn");
  let checkOut = paramValue(raw, "checkOut");
  let travelers = paramValue(raw, "travelers");
  let hotelNights = paramValue(raw, "hotelNights");
  let outdoorNights = paramValue(raw, "outdoorNights");
  let savedName = "";
  let savedPlace = "";
  let savedSlug = "";
  const saved = readBottlePlanSelection();
  const savedNamesAnotherHotel = Boolean(
    saved &&
      ((urlName && saved.hotelName && saved.hotelName !== urlName) ||
        (urlPlace && saved.placeId && saved.placeId !== urlPlace) ||
        (urlSlug && saved.hotelSlug && saved.hotelSlug !== urlSlug)),
  );

  if ((!checkIn || !checkOut) && saved && !savedNamesAnotherHotel) {
    checkIn = checkIn || saved.checkIn;
    checkOut = checkOut || saved.checkOut;
    destination = destination || saved.destination;
    travelers = travelers || String(saved.travelers);
    hotelNights = hotelNights || String(saved.hotelNights);
    outdoorNights = outdoorNights || String(saved.outdoorNights);
    if (!urlName) {
      savedName = saved.hotelName || "";
      savedPlace = saved.placeId || "";
      savedSlug = saved.hotelSlug || "";
    }
  }

  const hotelName = urlName || savedName;
  const placeId = urlPlace || savedPlace;
  const hotelSlug = urlSlug || savedSlug;
  if (!hotelName && !placeId && !hotelSlug) return null;
  const outdoorPick =
    outdoorPickFrom(paramValue(raw, "outdoorKind"), paramValue(raw, "outdoorId")) ||
    (saved && !savedNamesAnotherHotel ? saved.outdoorPick : undefined);
  const fitted = fitNightSplit(checkIn, checkOut, Math.max(1, Number(hotelNights) || 1), Math.max(1, Number(outdoorNights) || 1));

  return sanitizeBottlePlanSelection({
    destination: destination || "Athens",
    checkIn,
    checkOut,
    travelers: Math.max(1, Number(travelers) || 2),
    hotelNights: fitted.hotelNights,
    outdoorNights: fitted.outdoorNights,
    placeId: placeId || undefined,
    hotelSlug: hotelSlug || undefined,
    hotelName: hotelName || undefined,
    partner: hotelSlug.length > 0,
    outdoorPick,
  });
}

export function bottlePlanSearchKey(sel: BottlePlanSelection): string {
  return [
    sel.destination,
    sel.checkIn,
    sel.checkOut,
    String(sel.travelers),
    String(sel.hotelNights),
    String(sel.outdoorNights),
    sel.placeId || "",
    sel.hotelSlug || "",
    sel.hotelName || "",
  ].join("\u001f");
}

export function hotelProfileQuery(
  sel: Pick<BottlePlanSelection, "checkIn" | "checkOut" | "travelers" | "hotelNights" | "outdoorNights"> & {
    hotelName?: string;
    destination?: string;
  },
): string {
  const qs = new URLSearchParams();
  if (sel.destination) qs.set("destination", sel.destination);
  if (sel.checkIn) qs.set("checkIn", sel.checkIn);
  if (sel.checkOut) qs.set("checkOut", sel.checkOut);
  qs.set("travelers", String(sel.travelers));
  qs.set("hotelNights", String(sel.hotelNights));
  qs.set("outdoorNights", String(sel.outdoorNights));
  if (sel.hotelName) qs.set("hotelName", sel.hotelName);
  return qs.toString();
}

export function mixSearchParams(sel: BottlePlanSelection): Record<string, string> {
  const qs: Record<string, string> = {
    destination: sel.destination,
    checkIn: sel.checkIn,
    checkOut: sel.checkOut,
    travelers: String(sel.travelers),
    hotelNights: String(sel.hotelNights),
    outdoorNights: String(sel.outdoorNights),
  };
  if (sel.placeId) qs.placeId = sel.placeId;
  if (sel.hotelName) qs.hotelName = sel.hotelName;
  if (sel.hotelSlug) qs.hotelSlug = sel.hotelSlug;
  if (sel.outdoorPick) {
    qs.outdoorKind = sel.outdoorPick.kind;
    qs.outdoorId = sel.outdoorPick.id;
  }
  return qs;
}
