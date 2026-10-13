/**
 * Integration checklist â€” consume from Orchestra ecosystem into this Guest App only.
 */

export type IntegrationLane =
  | "hotelier"
  | "bandit"
  | "experience"
  | "commerce"
  | "live_experience"
  | "intelligence"
  | "identity"
  | "connection"
  | "creative";

export type IntegrationStatus = "LIVE" | "PARTIAL" | "MISSING" | "MVP_LOCAL";

export type IntegrationCapability = {
  id: string;
  lane: IntegrationLane;
  label: string;
  /** Existing Guest App surface that must reflect this capability (no new route tree). */
  guestSurface: string;
  status: IntegrationStatus;
  evidence: string;
};

/**
 * Ranked by commercial impact for the Integration Sprint.
 * MVP_LOCAL = already in Supabase/Expo MVP; wire Orchestra when LIVE.
 */
export const GUEST_INTEGRATION_CHECKLIST: IntegrationCapability[] = [
  // Hotelier OS
  { id: "hotelier.welcome", lane: "hotelier", label: "Welcome experience", guestSurface: "/hotel/* Â· home header", status: "MVP_LOCAL", evidence: "hotelWhiteLabel + HotelEntryScreen" },
  { id: "hotelier.messages", lane: "hotelier", label: "Property messages", guestSurface: "signals Â· inbox", status: "PARTIAL", evidence: "Pilot signals; Partner messaging not LIVE API" },
  { id: "hotelier.campaigns", lane: "hotelier", label: "Campaigns", guestSurface: "home Â· hotel", status: "MISSING", evidence: "Partner campaigns demo only" },
  { id: "hotelier.recommendations", lane: "hotelier", label: "Hotel recommendations", guestSurface: "bandits Â· explore", status: "PARTIAL", evidence: "Local recommendations; Hotelier OS publish path incomplete" },
  { id: "hotelier.room", lane: "hotelier", label: "Room personalization", guestSurface: "hotel entry", status: "MISSING", evidence: "No room CRM object in Guest" },
  { id: "hotelier.concierge", lane: "hotelier", label: "Concierge", guestSurface: "chat Â· Ask Me", status: "MVP_LOCAL", evidence: "Operator chat / Ask Me" },
  { id: "hotelier.upsells", lane: "hotelier", label: "Upsell cards", guestSurface: "hotel Â· menu", status: "MISSING", evidence: "Partner upsells demo; Guest not consuming" },
  { id: "hotelier.timeline", lane: "hotelier", label: "Property timeline", guestSurface: "hotel Â· journey", status: "MISSING", evidence: "No published timeline API" },

  // banDit OS
  { id: "bandit.verified", lane: "bandit", label: "Verified Local banDits", guestSurface: "/bandits", status: "MVP_LOCAL", evidence: "Supabase bandit + verified UX" },
  { id: "bandit.profiles", lane: "bandit", label: "Rich profiles", guestSurface: "/bandit/[id]", status: "MVP_LOCAL", evidence: "Profile stack LIVE" },
  { id: "bandit.follow", lane: "bandit", label: "Follow", guestSurface: "following Â· likes", status: "MVP_LOCAL", evidence: "toggleBanditLike / following" },
  { id: "bandit.reputation", lane: "bandit", label: "Reputation", guestSurface: "profile", status: "PARTIAL", evidence: "Trust signals local; Partner B4 deferred" },
  { id: "bandit.guides", lane: "bandit", label: "Guides", guestSurface: "events Â· explore", status: "MVP_LOCAL", evidence: "Events / trails" },
  { id: "bandit.recommendations", lane: "bandit", label: "Recommendations", guestSurface: "bandits home", status: "MVP_LOCAL", evidence: "Recommendation places" },
  { id: "bandit.stories", lane: "bandit", label: "Stories", guestSurface: "moments", status: "PARTIAL", evidence: "banditMoments; Partner content sync flag off" },
  { id: "bandit.premium", lane: "bandit", label: "Premium creators", guestSurface: "profile · commerce", status: "LIVE", evidence: "Octopus Concierge €29 → Commerce checkout → entitlement → Concierge OS" },

  // Experience OS
  { id: "experience.catalog", lane: "experience", label: "Experiences", guestSurface: "explore Â· events", status: "MVP_LOCAL", evidence: "Events/spots" },
  { id: "experience.availability", lane: "experience", label: "Availability", guestSurface: "event detail", status: "PARTIAL", evidence: "Guest availability overlay; Workspace sessions via discover unused for UI" },
  { id: "experience.booking", lane: "experience", label: "Booking", guestSurface: "event detail", status: "LIVE", evidence: "bookExperienceViaCommerce → Workspace + Orchestra" },
  { id: "experience.categories", lane: "experience", label: "Categories", guestSurface: "explore", status: "MVP_LOCAL", evidence: "exploreCategoryFilter" },
  { id: "experience.nearby", lane: "experience", label: "Nearby experiences", guestSurface: "map Â· explore", status: "MVP_LOCAL", evidence: "geo + map" },

  // Commerce OS
  { id: "commerce.checkout", lane: "commerce", label: "Checkout", guestSurface: "pay flows", status: "LIVE", evidence: "commerceOrigin checkout + entitlements + Workspace sync" },
  { id: "commerce.premium", lane: "commerce", label: "Premium", guestSurface: "menu", status: "LIVE", evidence: "Octopus Concierge → Commerce entitlement + /api/bandit/premium" },
  { id: "commerce.packages", lane: "commerce", label: "Packages", guestSurface: "hotel Â· shop", status: "MISSING", evidence: "No Guest consume path" },
  { id: "commerce.marketplace", lane: "commerce", label: "Marketplace", guestSurface: "shop", status: "LIVE", evidence: "banDiShop liveShop → /api/public/shop/listings + reserve → /api/shop/orders; demo seed isolated" },
  { id: "commerce.revenue", lane: "commerce", label: "Revenue tracking", guestSurface: "n/a (guest)", status: "MISSING", evidence: "Guest never owns revenue UI; HQ only" },
  { id: "commerce.wallet", lane: "commerce", label: "Wallet", guestSurface: "profile / wallet", status: "MISSING", evidence: "Orchestra /api/commerce/wallet â€” not wired" },
  { id: "commerce.commissions", lane: "commerce", label: "Commissions", guestSurface: "n/a (creator)", status: "MISSING", evidence: "Creator path; Guest may show tip disclosure only" },

  // Live Experience
  { id: "live.dynamic", lane: "live_experience", label: "Dynamic rendering", guestSurface: "hotel Â· home", status: "PARTIAL", evidence: "White-label; Orchestra resolve API not consumed" },
  { id: "live.visitor", lane: "live_experience", label: "Visitor context", guestSurface: "session", status: "MVP_LOCAL", evidence: "pilotSession hotel entry" },
  { id: "live.property", lane: "live_experience", label: "Property context", guestSurface: "hotel", status: "MVP_LOCAL", evidence: "hotel slug white-label" },
  { id: "live.destination", lane: "live_experience", label: "Destination context", guestSurface: "CityContext", status: "MVP_LOCAL", evidence: "CityContext Athens" },

  // Intelligence
  { id: "intel.recs", lane: "intelligence", label: "Recommendations", guestSurface: "bandits Â· explore", status: "PARTIAL", evidence: "Heuristic / local; Intelligence engine not consumed" },
  { id: "intel.ai", lane: "intelligence", label: "AI suggestions", guestSurface: "Ask Me", status: "PARTIAL", evidence: "ff_ai_auto_send always false; draft only" },
  { id: "intel.order", lane: "intelligence", label: "Personalized ordering", guestSurface: "bandits list", status: "MISSING", evidence: "No NBA ranking from Intelligence" },
  { id: "intel.nba", lane: "intelligence", label: "Next best action", guestSurface: "home", status: "MISSING", evidence: "Not wired" },

  // Identity
  { id: "identity.profile", lane: "identity", label: "Traveler profile", guestSurface: "profile", status: "MVP_LOCAL", evidence: "userProfile + Supabase auth" },
  { id: "identity.loyalty", lane: "identity", label: "Loyalty", guestSurface: "rewards", status: "MISSING", evidence: "No loyalty object" },
  { id: "identity.history", lane: "identity", label: "History", guestSurface: "mySpots Â· following", status: "MVP_LOCAL", evidence: "My Spots" },
  { id: "identity.prefs", lane: "identity", label: "Preferences", guestSurface: "settings", status: "PARTIAL", evidence: "Local prefs; no OS Identity sync" },

  // Connection OS
  { id: "connection.social", lane: "connection", label: "Live social", guestSurface: "community", status: "PARTIAL", evidence: "Community chat; Connection OS verify not consumed" },
  { id: "connection.campaigns", lane: "connection", label: "Live campaigns", guestSurface: "home", status: "MISSING", evidence: "Connection OS green path not in Guest" },
  { id: "connection.providers", lane: "connection", label: "Connected providers", guestSurface: "n/a", status: "MISSING", evidence: "Workspace concern; Guest reads published only" },

  // Creative Studio
  { id: "creative.campaigns", lane: "creative", label: "Dynamic campaigns", guestSurface: "home Â· hotel", status: "MISSING", evidence: "Creative pipeline not pushed to Guest" },
  { id: "creative.stories", lane: "creative", label: "Stories", guestSurface: "moments", status: "PARTIAL", evidence: "Local moments; Studio assets not synced" },
  { id: "creative.push", lane: "creative", label: "Push assets", guestSurface: "push", status: "PARTIAL", evidence: "Expo push LIVE; Creative asset pack not linked" },
  { id: "creative.promo", lane: "creative", label: "Promotional media", guestSurface: "hotel Â· explore", status: "MISSING", evidence: "No Creativeâ†’Guest media bus" },
];

export function checklistByLane(lane: IntegrationLane): IntegrationCapability[] {
  return GUEST_INTEGRATION_CHECKLIST.filter((c) => c.lane === lane);
}

export function checklistSummary(): Record<IntegrationStatus, number> {
  const out: Record<IntegrationStatus, number> = {
    LIVE: 0,
    PARTIAL: 0,
    MISSING: 0,
    MVP_LOCAL: 0,
  };
  for (const c of GUEST_INTEGRATION_CHECKLIST) out[c.status] += 1;
  return out;
}
