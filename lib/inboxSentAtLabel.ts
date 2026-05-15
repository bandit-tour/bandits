/**
 * Shared “sent at” line for inbox / live alerts (local calendar day + time).
 * Examples: Today · 7:15 AM · Yesterday · 6:30 PM · May 14 · 8:00 PM
 */
export function formatInboxSentAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startD = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startToday.getTime() - startD.getTime()) / 86_400_000);
  if (dayDiff === 0) return `Today · ${timeStr}`;
  if (dayDiff === 1) return `Yesterday · ${timeStr}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  const datePart = sameYear
    ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${datePart} · ${timeStr}`;
}
