import type { MomentInspiration } from "@/lib/guest-moment/types";

/** Shuffle pool for “New Moment” / inspiration — travel, human, curious. */
export const MOMENT_INSPIRATIONS: MomentInspiration[] = [
  {
    id: "i1",
    line: "You don’t always need a plan. Sometimes you need a street you’ve never walked before.",
    mood: "wander",
  },
  {
    id: "i2",
    line: "Athens feels different after midnight.",
    mood: "night",
  },
  {
    id: "i3",
    line: "The best tables are the ones you didn’t plan.",
    mood: "food",
  },
  {
    id: "i4",
    line: "Keep one empty hour. That’s where the trip happens.",
    mood: "pause",
  },
  {
    id: "i5",
    line: "Ask a local where they go on their night off.",
    mood: "secret",
  },
  {
    id: "i6",
    line: "Breakfast tastes better when checkout isn’t rushing you.",
    mood: "slow",
  },
  {
    id: "i7",
    line: "A city reveals itself when you walk without a map.",
    mood: "wander",
  },
  {
    id: "i8",
    line: "You’re closer to a great story than you think — take the next left.",
    mood: "curiosity",
  },
  {
    id: "i9",
    line: "Some nights the rooftop is the itinerary.",
    mood: "gold",
  },
  {
    id: "i10",
    line: "Travel light. Leave room for someone else’s favourite bakery.",
    mood: "people",
  },
  {
    id: "i11",
    line: "Psyrri wakes up twice — once for coffee, once for music.",
    mood: "vibe",
  },
  {
    id: "i12",
    line: "If the bottle found you, the city already started the conversation.",
    mood: "bottle",
  },
];

export function dayKeyUtc(at = new Date()): string {
  return at.toISOString().slice(0, 10);
}

export function pickInspiration(seed?: string, excludeId?: string): MomentInspiration {
  const pool = excludeId
    ? MOMENT_INSPIRATIONS.filter((i) => i.id !== excludeId)
    : MOMENT_INSPIRATIONS;
  if (!pool.length) return MOMENT_INSPIRATIONS[0]!;
  if (!seed) {
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx]!;
  }
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length]!;
}
