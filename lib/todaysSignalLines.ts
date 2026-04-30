/** Copy lines for profile “Today’s Moment” (dynamic line from `todaysSignalLineForUser`) — rotate per user per UTC day. */
const TODAYS_SIGNAL_LINES: readonly string[] = [
  'Trust your direction.',
  'Quiet confidence wins.',
  'Good things find movers.',
  'New streets, new energy.',
  'You already belong here.',
  'Stay sharp, stay kind.',
  'Move light, think big.',
  'The city rewards courage.',
  'Calm mind, strong day.',
  'Your timing is better than you think.',
] as const;

export function todaysSignalLineForUser(userId: string, d: Date = new Date()): string {
  const dayKey = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
  const key = `${userId}|signal|${dayKey}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % TODAYS_SIGNAL_LINES.length;
  return TODAYS_SIGNAL_LINES[idx] ?? TODAYS_SIGNAL_LINES[0];
}
