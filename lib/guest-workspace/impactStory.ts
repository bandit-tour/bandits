/**
 * Impact tab — travel footprint story seed.
 * Emotional recap language (not admin stats). Consumes IMPACT_VIEW for causes / passport / volunteer.
 */

import { IMPACT_VIEW, type ImpactCause } from "@/lib/guest-workspace/productWorlds";

export type DropSource = {
  id: string;
  emoji: string;
  label: string;
  drops: number;
};

export type LeftBehindItem = {
  id: string;
  emoji: string;
  label: string;
  value: string;
};

export type ImpactComparison = {
  id: string;
  line: string;
};

export const IMPACT_STORY = {
  title: "Your Impact",
  subtitle: "What you left behind during your journey.",
  supporting: "Every local choice you made created a real impact.",
  intro:
    "Every local business visited, every Local Friend recommendation followed, every experience booked, every reusable action, and every verified local choice contributes to your footprint. Impact is not points — it is the visible trace of what you contributed and left behind.",
  leftBehindLead:
    "What you left behind is the proof of your journey — businesses supported, recommendations followed, experiences booked, and reusable actions that stay with the destination." as string,

  destination: "Athens",
  destinationFull: IMPACT_VIEW.destination,
  dropsEarned: IMPACT_VIEW.dropsEarned,
  dropsRequired: IMPACT_VIEW.dropsRequired,
  remainingDrops: IMPACT_VIEW.dropsRequired - IMPACT_VIEW.dropsEarned,

  dropSources: [
    { id: "s1", emoji: "🏨", label: "Stayed in local hotel", drops: 12 },
    { id: "s2", emoji: "♻️", label: "Bought refill instead of plastic", drops: 18 },
    { id: "s3", emoji: "🎟️", label: "Booked Local Experience", drops: 22 },
    { id: "s4", emoji: "🏪", label: "Supported local business", drops: 16 },
    { id: "s5", emoji: "🤝", label: "Used Local Friend recommendation", drops: 14 },
    { id: "s6", emoji: "🍾", label: "Travel in a Bottle completed", drops: 10 },
  ] as DropSource[],

  leftBehind: [
    { id: "l1", emoji: "🌱", label: "trees funded", value: "2" },
    { id: "l2", emoji: "💧", label: "plastic bottles avoided", value: "38" },
    { id: "l3", emoji: "🏪", label: "local businesses supported", value: "6" },
    { id: "l4", emoji: "☕", label: "local purchases", value: "14" },
    { id: "l5", emoji: "🚶", label: "independent creators discovered", value: "11" },
    { id: "l6", emoji: "❤️", label: "spent inside the local economy", value: "€247" },
  ] as LeftBehindItem[],

  comparisons: [
    {
      id: "c1",
      line: "You created more impact than 84% of visitors in Athens.",
    },
    {
      id: "c2",
      line: "You are one of the Top 5% supporters of local businesses.",
    },
  ] as ImpactComparison[],

  shareLine:
    "I left a real footprint in Athens — 92 Water Drops toward a cleaner shore and a stronger local economy.",

  badgeUnlockCopy: (remaining: number) =>
    remaining <= 0
      ? "Your Athens Impact badge and passport stamp are unlocked."
      : `${remaining} more drops unlock your Athens Impact badge and passport stamp.`,

  causes: IMPACT_VIEW.causes as ImpactCause[],
  volunteer: IMPACT_VIEW.volunteer,
  passportEntries: IMPACT_VIEW.passportEntries,
};
