/**
 * Warm daily lines for profile “A Note For Today” (curated, non-robotic; rotates per user per day).
 */
const WARM_DAILY_NOTES: readonly string[] = [
  'Welcome, beautiful days are waiting.',
  'Your trip begins with one happy step.',
  'Today is a good day to get lost beautifully.',
  'The world feels lighter when you travel.',
  'Let curiosity pick the next corner.',
  'Sunrise belongs to the quietly brave.',
  'A small detour can change the whole day.',
  'Cities are gentler when you look up.',
  'Pack light, feel everything.',
  'The best stories start with a wrong turn.',
] as const;

/**
 * Deterministic per-user, per-UTC-day index into `WARM_DAILY_NOTES`.
 */
export function dailyInspirationLineForUser(
  userId: string,
  d: Date = new Date(),
): string {
  const dayKey = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
  const key = `${userId}|${dayKey}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % WARM_DAILY_NOTES.length;
  return WARM_DAILY_NOTES[idx] ?? WARM_DAILY_NOTES[0];
}
