/**
 * SmartTraveler listing coupon — stable per place, partner vs editorial.
 * Partner codes come from Workspace offer uniqueCode when published.
 */
import type { SmartTravelerCatalogEntry } from "@/lib/guest-workspace/liveSmartTraveler";
import type { SmartTravelerPartner } from "@/lib/guest-workspace/productWorlds";
import { smartTravelerRedeemObjectId } from "@/lib/guest-workspace/liveSmartTraveler";

export type SmartTravelerListingCoupon = {
  code: string;
  redeemable: boolean;
  /** Empty for live partners; editorial uses NON-REDEEMABLE PREVIEW. */
  disclaimer: string;
};

function fnv1aHex(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(8, "0").slice(0, 8);
}

/** Editorial / non-partner — never implies merchant authorization. */
export function stableEditorialPreviewCode(placeId: string): string {
  return `PREVIEW-${fnv1aHex(`st-editorial:${placeId}`)}`;
}

/** Deterministic fallback when Workspace has not hydrated uniqueCode yet. */
export function stablePartnerListingFallback(place: SmartTravelerPartner): string {
  const offerId = smartTravelerRedeemObjectId(place);
  return `ST-${fnv1aHex(`st-partner:${place.id}:${offerId}`)}`;
}

export function resolveSmartTravelerListingCoupon(
  entry: SmartTravelerCatalogEntry | (SmartTravelerPartner & { isEditorial?: boolean }),
): SmartTravelerListingCoupon {
  const editorial = entry.isEditorial === true;
  if (editorial) {
    return {
      code: stableEditorialPreviewCode(entry.id),
      redeemable: false,
      disclaimer: "NON-REDEEMABLE PREVIEW",
    };
  }
  const offer = entry.offers?.[0] as { uniqueCode?: string } | undefined;
  const fromWorkspace = String(offer?.uniqueCode || "").trim();
  const code = fromWorkspace || stablePartnerListingFallback(entry);
  return {
    code,
    redeemable: true,
    disclaimer: "",
  };
}
