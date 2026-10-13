/**
 * Guest App V2 — Integration Sprint (GUEST-INT-1.0)
 * Canonical product: this Expo app (`bandits`). Evolve in place — no parallel Guest App.
 */

export const GUEST_APP_CANON = {
  id: "GUEST-INT-1.0",
  product: "bandits",
  law: "One application. One navigation. One Guest App. Consume Orchestra — do not rebuild.",
  productionOrigin: "https://bandits-two.vercel.app",
  repo: "bandit-tour/bandits",
  forbidden: [
    "Guest App V2 beside this app",
    "Orchestra OS /guest-app as customer product",
    "Workspace System /guest-app as customer product",
    "Partner /smarttraveler as Guest App",
    "Demo Guest App sold as production",
  ] as const,
} as const;

/** Official hotel QR / check-in entry (same product). */
export const GUEST_APP_HOTEL_ENTRY = {
  play: `${GUEST_APP_CANON.productionOrigin}/hotel/play-theatrou`,
  nyx: `${GUEST_APP_CANON.productionOrigin}/hotel/nyx-athens`,
  aluma: `${GUEST_APP_CANON.productionOrigin}/hotel/aluma-athens`,
} as const;
