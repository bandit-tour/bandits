/**
 * Visible Workspace capabilities on Local banDit cards.
 * Derives from existing MVP data + live bus — no new parallel UI product.
 * Premium / Octopus chips require server-side authorization — never rating inference.
 */

import type { Database } from "@/lib/database.types";
import { listRecentGuestLiveEvents } from "@/lib/orchestra/live-bus";
import type { BanditPremiumVisibility } from "@/lib/guest-app/premium-visibility";

type Bandit = Database["public"]["Tables"]["bandit"]["Row"] & {
  bandit_tags?: { tags: { id: string; name: string } | null }[] | null;
};

export type BanditCapabilityChip = {
  id: string;
  label: string;
  tone: "gold" | "live" | "soft" | "action";
  href?: string;
};

export type BanditCardCapabilities = {
  verified: boolean;
  premium: boolean;
  ratingLabel: string;
  storyLine: string | null;
  aiLine: string | null;
  liveLabel: string | null;
  experienceCount: number;
  chips: BanditCapabilityChip[];
};

function firstLine(text: string | null | undefined): string | null {
  const t = String(text || "")
    .split("\n")
    .map((l) => l.trim().replace(/^•\s*/, ""))
    .find((l) => l.length >= 8);
  return t || null;
}

/** Build traveler-visible capability chrome for one Local banDit card. */
export function buildBanditCardCapabilities(
  bandit: Bandit,
  categories: Array<{ genre: string; count: number }>,
  opts?: { hotelSlug?: string | null; premium?: BanditPremiumVisibility | null },
): BanditCardCapabilities {
  const id = bandit.id;
  const rating = Number(bandit.rating) || 0;
  const experienceCount = categories.reduce((n, c) => n + (c.count || 0), 0);
  const premiumAuth = opts?.premium;
  const verified = premiumAuth?.octopusVerified === true;
  const premium = premiumAuth?.showPremiumInsights === true;
  const storyLine = firstLine(bandit.description) || firstLine(bandit.why_follow);
  const aiLine = firstLine(bandit.why_follow);

  const live = listRecentGuestLiveEvents(12).find(
    (e) =>
      e.entityId === id ||
      e.surfaces.includes("bandits") ||
      (opts?.hotelSlug && e.propertySlug === opts.hotelSlug),
  );

  const chips: BanditCapabilityChip[] = [];

  if (verified) {
    chips.push({
      id: "verified",
      label: "Octopus Verified™",
      tone: "gold",
      href: `/bandit/${id}`,
    });
  } else {
    chips.push({
      id: "local",
      label: "Local banDit",
      tone: "soft",
      href: `/bandit/${id}`,
    });
  }

  if (premium) {
    chips.push({ id: "premium", label: "Premium Insights", tone: "gold", href: `/premium/${id}` });
  }

  chips.push({
    id: "stories",
    label: "Stories",
    tone: "soft",
    href: `/bandit/${id}`,
  });

  if (live) {
    chips.push({
      id: "live",
      label: "Live",
      tone: "live",
      href: `/bandit/${id}`,
    });
  }

  chips.push({
    id: "cityguide",
    label: "City guide",
    tone: "action",
    href: `/cityGuide?banditId=${encodeURIComponent(id)}`,
  });

  chips.push({
    id: "askme",
    label: "Ask Me",
    tone: "action",
    href: `/bandit/${id}`,
  });

  if (experienceCount > 0) {
    chips.push({
      id: "experiences",
      label: `${experienceCount} experiences`,
      tone: "action",
      href: `/explore?banditId=${encodeURIComponent(id)}`,
    });
  }

  if (opts?.hotelSlug) {
    chips.push({
      id: "hotel",
      label: "Hotel picks",
      tone: "gold",
      href: `/hotelier`,
    });
  }

  return {
    verified,
    premium,
    ratingLabel: rating > 0 ? rating.toFixed(1) : "—",
    storyLine,
    aiLine,
    liveLabel: live ? live.title : null,
    experienceCount,
    chips,
  };
}
