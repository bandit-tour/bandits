/**
 * Production SmartTraveler — Workspace partner inventory.
 * Editorial seed in productWorlds merges in the Guest UI; Workspace API is SoT for live partners.
 */
import { workspaceGet, workspaceOrigin } from "@/lib/workspace/client";
import {
  experienceCover,
  isValidExperienceImageUrl,
  SMART_TRAVELER_PARTNERS,
  type SmartTravelerFilterChip,
  type SmartTravelerGuestPrivilege,
  type SmartTravelerPartner,
} from "@/lib/guest-workspace/productWorlds";

export type SmartTravelerCatalogEntry = SmartTravelerPartner & {
  /** Editorial seed — discovery only, no server redemption. */
  isEditorial: boolean;
};

const EDITORIAL_IDS = new Set(SMART_TRAVELER_PARTNERS.map((p) => p.id));

export function isEditorialSmartTravelerId(id: string): boolean {
  return EDITORIAL_IDS.has(id);
}

/** Live partner rows first; editorial fills every category — never partner-only empty grids. */
export function mergeSmartTravelerCatalog(
  live: SmartTravelerPartner[],
): SmartTravelerCatalogEntry[] {
  const liveIds = new Set(live.map((p) => p.id));
  const partners: SmartTravelerCatalogEntry[] = live.map((p) => ({
    ...p,
    isEditorial: false,
  }));
  const editorial: SmartTravelerCatalogEntry[] = SMART_TRAVELER_PARTNERS.filter(
    (p) => !liveIds.has(p.id),
  ).map((p) => ({ ...p, isEditorial: true }));
  return [...partners, ...editorial];
}

export type WorkspaceSmartTravelerOffer = {
  id: string;
  title: string;
  detail: string;
  benefitType?: string;
  status?: string;
  hotelBenefit?: boolean;
};

export type WorkspaceSmartTravelerRow = {
  id: string;
  businessName: string;
  partnerType?: string;
  typeLabel?: string;
  description?: string;
  story?: string;
  unique?: string;
  whyVisit?: string;
  signatureProduct?: string;
  ownerStory?: string;
  atmosphere?: string;
  gallery?: string[];
  location?: string;
  hours?: string;
  neighborhood?: string;
  city?: string;
  offers?: WorkspaceSmartTravelerOffer[];
  coupons?: Array<{ id: string; title: string; detail: string; status?: string }>;
  source?: string;
  email?: string;
};

export type LiveSmartTravelerFetch = {
  ok: boolean;
  partners: SmartTravelerPartner[];
  /** How inventory was resolved — never mixes DEMO seed. */
  via: "public" | "discover" | "none";
  detail?: string;
};

const FALLBACK_COVER = experienceCover("1517248135467-4c7edcad34c4");

type FilterTag = Exclude<SmartTravelerFilterChip, "All">;

function mapFilterTags(partnerType?: string, typeLabel?: string): FilterTag[] {
  const raw = `${partnerType || ""} ${typeLabel || ""}`.toLowerCase();
  const tags: FilterTag[] = [];
  const push = (t: FilterTag) => {
    if (!tags.includes(t)) tags.push(t);
  };
  if (/fashion|boutique|leather/.test(raw)) push("Fashion");
  if (/vintage/.test(raw)) push("Vintage");
  if (/second|thrift|consign/.test(raw)) push("Second Hand");
  if (/jewel|jewelry/.test(raw)) push("Jewellery");
  if (/art|artist|pottery/.test(raw)) push("Art");
  if (/galler|museum/.test(raw)) push("Galleries");
  if (/book/.test(raw)) push("Books");
  if (/design|florist/.test(raw)) push("Design");
  if (/record|vinyl|music/.test(raw)) push("Records");
  if (/maker|workshop|potter|craft/.test(raw)) push("Makers");
  if (/caf[eé]|coffee|bakery/.test(raw)) push("Cafés");
  if (/\bbar\b|hidden_bar|nightlife|wine/.test(raw)) push("Bars");
  if (/food|restaurant|cheese|olive|farm|market|bakery/.test(raw)) push("Food");
  if (!tags.length) push("Makers");
  return tags;
}

function mapPrivilegeKind(benefitType?: string): SmartTravelerGuestPrivilege["kind"] {
  const t = (benefitType || "").toLowerCase();
  if (t.includes("drink")) return "drink";
  if (t.includes("gift")) return "gift";
  if (t.includes("maker") || t.includes("meet")) return "meet maker";
  if (t.includes("studio")) return "studio visit";
  if (t.includes("secret")) return "secret menu";
  if (t.includes("member") || t.includes("price")) return "member price";
  if (t.includes("priority") || t.includes("table")) return "priority table";
  if (t.includes("discount") || t.includes("%")) return "small discount";
  if (t.includes("reserved")) return "reserved item";
  if (t.includes("access") || t.includes("private")) return "private access";
  return "gift";
}

function neighborhoodFromLocation(location?: string, neighborhood?: string, city?: string): string {
  if (neighborhood?.trim()) return neighborhood.trim();
  const loc = (location || "").trim();
  if (!loc) return city?.trim() || "Nearby";
  const part = loc.split(/[·|,]/)[0]?.trim();
  return part || city?.trim() || "Nearby";
}

function firstGalleryUrl(gallery?: string[]): string {
  const urls = (gallery || []).filter((u) => isValidExperienceImageUrl(u));
  return urls[0] || FALLBACK_COVER;
}

function mapGuestPrivilege(
  offers?: WorkspaceSmartTravelerOffer[],
): SmartTravelerGuestPrivilege | undefined {
  const offer = offers?.[0];
  if (!offer?.id) return undefined;
  return {
    id: offer.id,
    label: offer.title,
    detail: offer.detail || offer.title,
    kind: mapPrivilegeKind(offer.benefitType),
  };
}

/** Orchestration / QA merchants — never Guest redeemable inventory (matches Workspace durable gate). */
export function isGuestVisibleSmartTravelerRow(row: WorkspaceSmartTravelerRow): boolean {
  const email = String(row.email || "").toLowerCase();
  if (!row?.id || !row.businessName) return false;
  if (email.endsWith("@banditour.test") || email.endsWith("@banditour.proof")) return false;
  if (email.endsWith("@banditour.demo")) return false;
  if (email.startsWith("orch.st.") || email.startsWith("op.st") || email.startsWith("dbg.st.")) return false;
  const biz = String(row.businessName || "").trim();
  if (/\s(mu[a-z0-9]{6,10}|mt[a-z0-9]{5,10}|muy[a-z0-9]{5,10})$/i.test(biz)) return false;
  return true;
}

/** When `source` is present, keep partner_record only. Absent source (discover) is allowed. */
export function isLivePartnerRow(row: WorkspaceSmartTravelerRow): boolean {
  if (!isGuestVisibleSmartTravelerRow(row)) return false;
  if (row.source == null || row.source === "") return true;
  return row.source === "partner_record";
}

export function mapWorkspaceSmartTraveler(row: WorkspaceSmartTravelerRow): SmartTravelerPartner | null {
  if (!isLivePartnerRow(row)) return null;
  const galleryRaw = (row.gallery || []).filter((u) => isValidExperienceImageUrl(u));
  const imageUrl = firstGalleryUrl(row.gallery);
  const gallery = galleryRaw.length ? galleryRaw : [imageUrl];
  const typeLabel =
    row.typeLabel ||
    (row.partnerType
      ? row.partnerType
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "Local find");
  const neighborhood = neighborhoodFromLocation(row.location, row.neighborhood, row.city);
  const story = row.ownerStory || row.story || row.description || row.businessName;
  const whyVisit = row.whyVisit || row.unique || row.description || story;
  const guestPrivilege = mapGuestPrivilege(row.offers);
  const offers = (row.offers || []).map((o) => ({
    id: o.id,
    title: o.title,
    detail: o.detail || o.title,
    benefitType: o.benefitType || "Hotel Guest Special",
    hotelBenefit: o.hotelBenefit ?? true,
  }));

  return {
    id: row.id,
    businessName: row.businessName,
    typeLabel,
    neighborhood,
    location: row.location || neighborhood,
    hours: row.hours || "Ask when you arrive",
    banditLine: row.unique || whyVisit,
    curator: "Local recommendation",
    story,
    whyVisit,
    lookFor: row.atmosphere || row.signatureProduct || "Ask the person behind the counter what they love this week.",
    signatureProduct: row.signatureProduct || "",
    imageUrl,
    gallery,
    filterTags: mapFilterTags(row.partnerType, typeLabel),
    guestPrivilege,
    offers,
    coupons: (row.coupons || []).map((c) => ({
      id: c.id,
      title: c.title,
      detail: c.detail || c.title,
    })),
  };
}

function filterByCity(rows: WorkspaceSmartTravelerRow[], city?: string): WorkspaceSmartTravelerRow[] {
  const c = (city || "").trim().toLowerCase();
  if (!c) return rows;
  return rows.filter((r) => {
    const blob = `${r.city || ""} ${r.location || ""} ${r.neighborhood || ""}`.toLowerCase();
    return blob.includes(c);
  });
}

function rowsFromPublicPayload(data: {
  businesses?: WorkspaceSmartTravelerRow[];
  business?: WorkspaceSmartTravelerRow | null;
  partners?: WorkspaceSmartTravelerRow[];
  smarttravelers?: WorkspaceSmartTravelerRow[];
  partner?: WorkspaceSmartTravelerRow | null;
}): WorkspaceSmartTravelerRow[] {
  if (Array.isArray(data.businesses)) return data.businesses;
  if (data.business) return [data.business];
  if (Array.isArray(data.partners)) return data.partners;
  if (Array.isArray(data.smarttravelers)) return data.smarttravelers;
  if (data.partner) return [data.partner];
  return [];
}

/**
 * Prefer `/api/public/smarttraveler`. On 404 (older Workspace deploys), fall back to
 * `/api/discover` partners — still live inventory, never DEMO seed.
 */
export async function fetchLiveSmartTravelers(opts?: {
  city?: string;
}): Promise<LiveSmartTravelerFetch> {
  const origin = workspaceOrigin();
  if (!origin) {
    return { ok: false, partners: [], via: "none", detail: "WORKSPACE_URL unset" };
  }

  const qs = opts?.city ? `?city=${encodeURIComponent(opts.city)}` : "";
  const publicResult = await workspaceGet<{
    ok?: boolean;
    businesses?: WorkspaceSmartTravelerRow[];
    business?: WorkspaceSmartTravelerRow | null;
    partners?: WorkspaceSmartTravelerRow[];
    smarttravelers?: WorkspaceSmartTravelerRow[];
    partner?: WorkspaceSmartTravelerRow | null;
  }>(`/api/public/smarttraveler${qs}`);

  if (publicResult.ok) {
    const mapped = filterByCity(rowsFromPublicPayload(publicResult.data), opts?.city)
      .map(mapWorkspaceSmartTraveler)
      .filter(Boolean) as SmartTravelerPartner[];
    if (mapped.length > 0) {
      return { ok: true, partners: mapped, via: "public" };
    }
  }

  const discover = await workspaceGet<{
    ok?: boolean;
    partners?: WorkspaceSmartTravelerRow[];
  }>("/api/discover");
  if (discover.ok) {
    const mapped = filterByCity(discover.data.partners || [], opts?.city)
      .filter(isGuestVisibleSmartTravelerRow)
      .map(mapWorkspaceSmartTraveler)
      .filter(Boolean) as SmartTravelerPartner[];
    if (mapped.length > 0) {
      return { ok: true, partners: mapped, via: "discover" };
    }
  }

  if (publicResult.ok) {
    return { ok: false, partners: [], via: "none", detail: "No guest-visible SmartTraveler partners published yet." };
  }

  if (String(publicResult.detail || "").startsWith("404") && discover.ok) {
    return { ok: false, partners: [], via: "none", detail: "No guest-visible SmartTraveler partners published yet." };
  }

  return {
    ok: false,
    partners: [],
    via: "none",
    detail: publicResult.detail || discover.detail || "SmartTraveler unavailable",
  };
}

export async function fetchLiveSmartTravelerDetail(
  id: string,
): Promise<SmartTravelerPartner | null> {
  const origin = workspaceOrigin();
  if (!origin || !id) return null;

  const publicResult = await workspaceGet<{
    ok?: boolean;
    businesses?: WorkspaceSmartTravelerRow[];
    business?: WorkspaceSmartTravelerRow | null;
    partner?: WorkspaceSmartTravelerRow | null;
    partners?: WorkspaceSmartTravelerRow[];
    smarttravelers?: WorkspaceSmartTravelerRow[];
  }>(`/api/public/smarttraveler?id=${encodeURIComponent(id)}`);

  if (publicResult.ok) {
    const row =
      publicResult.data.business ||
      publicResult.data.partner ||
      rowsFromPublicPayload(publicResult.data).find((r) => r.id === id);
    if (!row) return null;
    return mapWorkspaceSmartTraveler(row);
  }

  if (String(publicResult.detail || "").startsWith("404")) {
    const discover = await workspaceGet<{
      ok?: boolean;
      partners?: WorkspaceSmartTravelerRow[];
    }>("/api/discover");
    if (!discover.ok) return null;
    const row = (discover.data.partners || []).find((r) => r.id === id);
    if (!row) return null;
    return mapWorkspaceSmartTraveler(row);
  }

  return null;
}

/** Redeem object id — offer / privilege id when live, never confuse with seed place id. */
export function smartTravelerRedeemObjectId(place: SmartTravelerPartner): string {
  return place.guestPrivilege?.id || place.offers[0]?.id || place.id;
}
