/**
 * Guest App ACCESS law (Bandit-first).
 * HOME = trip brain · EXPLORE = intentional discovery · MORE = full universe.
 * Bandits remain the human heart — never More-only.
 */

export const GUEST_ACCESS = {
  home: {
    role: "trip_brain",
    href: "/home",
    answers: [
      "Where am I in my stay?",
      "What matters now?",
      "What should I do next?",
      "What does my Local Bandit recommend?",
    ],
  },
  explore: {
    role: "intentional_discovery",
    href: "/explore",
    lanes: ["bandits", "places", "experiences", "finds"] as const,
  },
  more: {
    role: "full_universe",
    href: "/menu",
  },
} as const;
