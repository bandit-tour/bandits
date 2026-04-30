/**
 * Pilot Local Friend: keep replies feeling human — varied voices, pacing, no “bot burst”.
 */

/** Quiet gap between operator sends (ms) — fixed so cooldown feels predictable. */
export const MIN_OPERATOR_SEND_GAP_MS = 3200;

export function pickNextSender(banditNames: string[], lastSender: string | null): string {
  const names = banditNames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return 'Local banDit';
  if (names.length === 1) return names[0]!;
  const last = lastSender?.trim();
  const others = last ? names.filter((n) => n !== last) : names;
  const pool = others.length > 0 ? others : names;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Ms to wait before another send is allowed (0 = ok to send). */
export function msUntilNextOperatorSend(lastSendAtMs: number): number {
  if (!lastSendAtMs) return 0;
  const elapsed = Date.now() - lastSendAtMs;
  return Math.max(0, MIN_OPERATOR_SEND_GAP_MS - elapsed);
}

const REPLY_OPENERS = ['Try', 'Check', 'Walk', 'Tonight:', 'Quiet pick:', 'Late tip:'] as const;

/** Short lines — different lengths / tones for demo stagger. */
export const PILOT_DEMO_REPLY_LINES: readonly string[] = [
  'Psyrri side street — small bar, no sign.',
  'Exarchia first, then drift toward the square.',
  'Basement jazz near the market — ask for the late set.',
  'Back-street kafeneio in Koukaki.',
  'Pop-up gallery — follow the lanterns off the main strip.',
  'Street food from sunset — Monastiraki side.',
  'Secret DJ in Exarchia after 11 — ask locals.',
  'Rooftop opens late — third floor, no poster.',
  'If you want quiet: one room, locals only.',
  'Live set tonight — cash bar, small door.',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function buildPilotDemoReplyBody(): string {
  const line = pick(PILOT_DEMO_REPLY_LINES);
  if (Math.random() < 0.45) {
    return `${pick(REPLY_OPENERS)} ${line.charAt(0).toLowerCase()}${line.slice(1)}`;
  }
  return line;
}
