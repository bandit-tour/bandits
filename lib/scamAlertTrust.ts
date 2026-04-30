import type { ScamAlertRow } from '@/services/scamAlerts';

export type TrustBadgeTone = 'gold' | 'navy' | 'amber' | 'rose' | 'slate';

export type TrustBadge = {
  key: string;
  label: string;
  hint?: string;
  tone: TrustBadgeTone;
};

export type TrustContext = {
  /** Reports in same city whose location text overlaps this alert (excl. self), last 30 days */
  sameAreaReportCount: number;
  /** Total reports in city in last 7 days */
  cityReportCount7d: number;
  hoursSincePosted: number;
};

function hoursBetween(iso: string, nowMs: number): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 999;
  return Math.max(0, (nowMs - t) / 36e5);
}

function countRecentInCity(rows: ScamAlertRow[], excludeId: string, city: string, nowMs: number, days: number): number {
  const cutoff = nowMs - days * 864e5;
  const c = city.trim().toLowerCase();
  return rows.filter((r) => {
    if (r.id === excludeId) return false;
    if ((r.city || '').trim().toLowerCase() !== c) return false;
    const ts = new Date(r.created_at).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  }).length;
}

/** Overlap on normalized location substring (no geocoder). */
export function countOverlappingLocationReports(
  rows: ScamAlertRow[],
  excludeId: string,
  location: string,
  nowMs: number,
  days: number,
): number {
  const cutoff = nowMs - days * 864e5;
  const key = location.trim().toLowerCase().slice(0, 20);
  if (key.length < 6) return 0;
  return rows.filter((r) => {
    if (r.id === excludeId) return false;
    const ts = new Date(r.created_at).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) return false;
    const loc = r.location.trim().toLowerCase();
    return loc.includes(key.slice(0, 12)) || key.includes(loc.slice(0, 12));
  }).length;
}

export function buildTrustBadges(row: ScamAlertRow, ctx: TrustContext, nowMs = Date.now()): TrustBadge[] {
  const out: TrustBadge[] = [];

  if (row.admin_verified === true) {
    out.push({
      key: 'admin',
      label: 'Verified by bandiTEAM',
      hint: 'Reviewed against community guidelines.',
      tone: 'navy',
    });
  }

  if (ctx.sameAreaReportCount >= 2) {
    out.push({
      key: 'multi_area',
      label: 'Multiple reports',
      hint: 'Several travelers flagged issues near this area.',
      tone: 'amber',
    });
  }

  const sev = Math.min(3, Math.max(1, Math.round(Number(row.severity) || 2)));
  const hours = hoursBetween(row.created_at, nowMs);
  if (sev >= 3 && hours <= 48) {
    out.push({
      key: 'trending',
      label: 'Trending warning',
      hint: 'High severity and very recent.',
      tone: 'rose',
    });
  }

  if (hours <= 24) {
    out.push({
      key: 'recent',
      label: 'Recent activity',
      hint: 'Posted in the last day.',
      tone: 'gold',
    });
  }

  if (ctx.cityReportCount7d >= 5 && hours <= 72) {
    out.push({
      key: 'city_pulse',
      label: 'Active destination',
      hint: 'Many traveler reports in this city this week.',
      tone: 'slate',
    });
  }

  const seen = new Set<string>();
  return out.filter((b) => {
    if (seen.has(b.key)) return false;
    seen.add(b.key);
    return true;
  });
}

export function buildTrustContextFromRows(
  row: ScamAlertRow,
  allInCity: ScamAlertRow[],
  nowMs = Date.now(),
): TrustContext {
  const city = row.city?.trim() || '';
  return {
    sameAreaReportCount: countOverlappingLocationReports(allInCity, row.id, row.location, nowMs, 30),
    cityReportCount7d: countRecentInCity(allInCity, row.id, city, nowMs, 7),
    hoursSincePosted: hoursBetween(row.created_at, nowMs),
  };
}

export function severityAccent(severity: number): { bar: string; soft: string; label: string } {
  const s = Math.min(3, Math.max(1, Math.round(Number(severity) || 2)));
  if (s <= 1) return { bar: '#2E7D32', soft: 'rgba(46,125,50,0.12)', label: 'Watch' };
  if (s === 2) return { bar: '#F57C00', soft: 'rgba(245,124,0,0.14)', label: 'Caution' };
  return { bar: '#C62828', soft: 'rgba(198,40,40,0.12)', label: 'High risk' };
}
