/**
 * Premium Insights — Guest App product law.
 * One Request + Stay Pass via Workspace Commerce (demo/test capture).
 */

export const OCTOPUS_CONCIERGE_PRODUCT_LAW = {
  id: "OCTOPUS-EXEC-001",
  product: "Premium Insights",
  thesis:
    "Premium Insights is NOT a chatbot. It is an execution system that turns every guest request into a structured task delivered by a Local banDit.",
  paid: true,
  accessRule: "NO_PAYMENT_NO_ACCESS",
  guestVoice: {
    handling: (firstName: string) => `${firstName} is handling it`,
    found: "Restaurant found",
    confirmed: "Confirmed with proof",
    done: "Completed with proof",
  },
  feeds: [
    "My Journey",
    "Notifications",
    "Concierge history",
    "Revenue Engine",
    "banDit earnings / commission",
    "Intelligence",
  ] as const,
  forbidden: [
    "Fake unlock via useState / localStorage",
    "Exposing Concierge OS before ACTIVE entitlement",
    "Pretending AI alone can call every restaurant",
    "Guest-facing technical infrastructure language",
  ] as const,
} as const;

/** Stay Pass — maps to Workspace premium_stay_pass (also accepts legacy octopus_concierge). */
export const OCTOPUS_CONCIERGE_OFFER = {
  sku: "premium_stay_pass",
  productId: "prd_premium_stay_pass",
  legacySku: "octopus_concierge",
  title: "Stay Pass",
  priceLabel: "€19",
  priceCents: 1900,
  currency: "EUR",
  periodLabel: "/ stay · up to 5 requests",
  valueLine: "Your Local banDit becomes your personal local operator for the stay.",
  persuasionLine: (firstName: string) =>
    `You ask. ${firstName} gets it done — reservations, tickets, rides, deliveries and the things that normally waste your travel time.`,
  unlockSupport: "Stay Pass · included request allowance · third-party costs are separate.",
  distinction:
    "Free bandiTour is discovery. Premium Insights is execution — your banDit gets things done.",
  ctaLabel: "Unlock Stay Pass — €19",
  allowance: 5,
  durationDays: 7,
} as const;

/** One Request — single paid coordination (service fee ≠ third-party cost). */
export const ONE_REQUEST_OFFER = {
  sku: "premium_one_request",
  productId: "prd_premium_one_request",
  title: "One Request",
  priceLabel: "€9",
  priceCents: 900,
  currency: "EUR",
  periodLabel: "/ one coordination",
  valueLine: "Pay once for a single service — Bandit time and coordination only.",
  disclosure:
    "Service fee covers assistance and coordination. Restaurant bills, tickets, and transfer fares are separate and need your approval.",
  ctaLabel: "Buy One Request — €9",
} as const;
