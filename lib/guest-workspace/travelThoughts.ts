/**
 * Moments = rotating inspirational travel thoughts.
 * Appear on Profile / QR / bottle / stay — NOT account settings.
 */

export type TravelThought = {
  id: string;
  line: string;
  city?: string;
  mood?: string;
};

export const TRAVEL_THOUGHTS: TravelThought[] = [
  { id: "t1", line: "Athens feels different after midnight.", city: "Athens", mood: "night" },
  { id: "t2", line: "The best tables are the ones you didn’t plan.", city: "Athens", mood: "food" },
  { id: "t3", line: "A city reveals itself when you walk without a map.", mood: "wander" },
  { id: "t4", line: "Rooftops remember every sunset you almost skipped.", city: "Athens", mood: "gold" },
  { id: "t5", line: "Local friends turn a stay into a story.", mood: "people" },
  { id: "t6", line: "Breakfast tastes better when checkout isn’t rushing you.", mood: "slow" },
  { id: "t7", line: "Psyrri wakes up twice — once for coffee, once for music.", city: "Athens", mood: "vibe" },
  { id: "t8", line: "Keep one empty hour. That’s where the trip happens.", mood: "pause" },
  { id: "t9", line: "Ask a local where they go on their night off.", mood: "secret" },
  { id: "t10", line: "Every bottle journey starts with one curious guest.", mood: "bottle" },
];

/** Stable rotation by day + slot so Profile / QR / stay share the same thought. */
export function getRotatingTravelThought(slot = 0, at = new Date()): TravelThought {
  const dayIndex = Math.floor(at.getTime() / (1000 * 60 * 60 * 8)); // ~3 rotations / day
  const idx = (dayIndex + slot) % TRAVEL_THOUGHTS.length;
  return TRAVEL_THOUGHTS[idx]!;
}

export function getTravelThoughtsForProfile(count = 3, at = new Date()): TravelThought[] {
  return Array.from({ length: count }, (_, i) => getRotatingTravelThought(i, at));
}
