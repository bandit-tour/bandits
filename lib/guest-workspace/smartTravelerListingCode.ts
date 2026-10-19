/**
 * SmartTraveler listing coupon — stable per place, partner vs editorial.
 * Partner codes come from Workspace offer uniqueCode when published.
 */
import type { SmartTravelerCatalogEntry } from "@/lib/guest-workspace/liveSmartTraveler";
import type { SmartTravelerPartner } from "@/lib/guest-workspace/productWorlds";
import { smartTravelerRedeemObjectId } from "@/lib/guest-workspace/liveSmartTraveler";
import { sanitizeSmartTravelerVisibleText } from "@/lib/guest-workspace/smartTravelerDisplay";

export type SmartTravelerRedemptionPhase =
  | "preview"
  | "available"
  | "locked"
  | "claimed"
  | "pending_validation"
  | "redeemed";

export type SmartTravelerListingCoupon = {
  code: string;
  redeemable: boolean;
  /** Empty for live partners; editorial uses NON-REDEEMABLE PREVIEW. */
  disclaimer: string;
  offerTitle: string;
  offerDetail: string;
  redemptionPhase: SmartTravelerRedemptionPhase;
  redemptionLabel: string;
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

function offerCopy(entry: SmartTravelerPartner): { title: string; detail: string } {
  const priv = entry.guestPrivilege;
  const offer = entry.offers?.[0];
  const title = sanitizeSmartTravelerVisibleText(
    priv?.label || offer?.title || "Participating offer",
  );
  const detail = sanitizeSmartTravelerVisibleText(
    priv?.detail || offer?.detail || title || entry.banditLine,
  );
  return { title: title || "Participating offer", detail: detail || title };
}

export function resolveSmartTravelerListingCoupon(
  entry: SmartTravelerCatalogEntry | (SmartTravelerPartner & { isEditorial?: boolean }),
  opts?: {
    stayUnlocked?: boolean;
    claimStatus?: string | null;
    hasActiveClaim?: boolean;
  },
): SmartTravelerListingCoupon {
  const { title, detail } = offerCopy(entry);
  const editorial = entry.isEditorial === true;
  if (editorial) {
    return {
      code: stableEditorialPreviewCode(entry.id),
      redeemable: false,
      disclaimer: "NON-REDEEMABLE PREVIEW",
      offerTitle: title,
      offerDetail: detail,
      redemptionPhase: "preview",
      redemptionLabel: "Discovery only — not authorized by this business",
    };
  }
  const offer = entry.offers?.[0] as { uniqueCode?: string } | undefined;
  const fromWorkspace = String(offer?.uniqueCode || "").trim();
  const code = fromWorkspace || stablePartnerListingFallback(entry);

  const status = String(opts?.claimStatus || "").toLowerCase();
  let redemptionPhase: SmartTravelerRedemptionPhase = "available";
  let redemptionLabel = "Redeemable during an active hotel stay";
  if (opts?.hasActiveClaim) {
    if (status === "validated" || status === "redeemed" || status === "complete") {
      redemptionPhase = "redeemed";
      redemptionLabel = "Redeemed · merchant validated";
    } else {
      redemptionPhase = status === "pending" ? "pending_validation" : "claimed";
      redemptionLabel =
        status === "pending"
          ? "Claimed · pending merchant validation"
          : `Claimed${status ? ` · ${sanitizeSmartTravelerVisibleText(status)}` : ""}`;
    }
  } else if (opts?.stayUnlocked === false) {
    redemptionPhase = "locked";
    redemptionLabel = "Activate your hotel stay to claim this offer";
  }

  return {
    code,
    redeemable: true,
    disclaimer: "",
    offerTitle: title,
    offerDetail: detail,
    redemptionPhase,
    redemptionLabel,
  };
}
