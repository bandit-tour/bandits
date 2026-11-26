/**
 * Places / billable Maps financial guard — Guest App.
 *
 * Google Case 78008922 (2026-11-25): ~21k Text Search Pro requests, ~99% dups, >30 rps.
 * BOTH Places APIs DISABLED by founder. This module FAIL-CLOSES all live Places traffic
 * until explicit founder re-enable. No live calls to "prove" repair.
 */

export const GOOGLE_PLACES_INCIDENT = {
  caseId: "78008922",
  projectId: "banditour---randomchat",
  projectNumber: "698546846023",
  apiKeyName: "banditours-places",
  windowUtc: "2026-11-25T12:00:00Z/2026-11-25T18:00:00Z",
  sku: "Places API Text Search Pro",
  approxRequests: 21000,
  approxDupRate: 0.99,
  peakRps: 30,
  fields: "id,displayName,formattedAddress,location,photos",
  founderDisabledBothPlacesApis: true,
} as const;

/** Hard kill — founder must flip env to "0" AND re-enable GCP Places before live calls. */
export function isGooglePlacesLiveBlocked(): boolean {
  if (GOOGLE_PLACES_INCIDENT.founderDisabledBothPlacesApis) {
    const override = String(process.env.EXPO_PUBLIC_GOOGLE_PLACES_FOUNDER_REENABLE ?? "")
      .trim()
      .toLowerCase();
    // Explicit founder re-enable only — never default open.
    if (override !== "1" && override !== "true" && override !== "yes") return true;
  }
  const disabled = String(process.env.EXPO_PUBLIC_GOOGLE_PLACES_DISABLED ?? "1")
    .trim()
    .toLowerCase();
  if (disabled === "" || disabled === "1" || disabled === "true" || disabled === "yes") {
    return true;
  }
  return false;
}

export type PlacesGuardDecision = {
  allowed: boolean;
  reason: string;
  code:
    | "OK"
    | "PLACES_FOUNDER_DISABLED"
    | "PLACES_KILL_SWITCH"
    | "RATE_LIMIT_MINUTE"
    | "RATE_LIMIT_DAY"
    | "CIRCUIT_OPEN"
    | "DUP_IN_FLIGHT"
    | "DUP_CACHE_HIT"
    | "BUDGET_EXHAUSTED";
  cacheHit?: boolean;
};

const MAX_PER_MINUTE = 8;
const MAX_PER_DAY = 30; // draft founder config — enforced even if re-enabled without raising
const CIRCUIT_FAILS = 3;
const CIRCUIT_COOLDOWN_MS = 15 * 60 * 1000;
const RESULT_TTL_MS = 6 * 60 * 60 * 1000;

type MinuteBucket = { minute: number; count: number };
type DayBucket = { day: string; count: number };

let minuteBucket: MinuteBucket = { minute: 0, count: 0 };
let dayBucket: DayBucket = { day: "", count: 0 };
let circuitOpenUntil = 0;
let consecutiveFails = 0;

const inFlight = new Map<string, Promise<unknown>>();
const resultCache = new Map<string, { expiresAt: number; value: unknown }>();

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}
function utcMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

function bumpCounters(): PlacesGuardDecision | null {
  const m = utcMinute();
  if (minuteBucket.minute !== m) minuteBucket = { minute: m, count: 0 };
  const d = utcDay();
  if (dayBucket.day !== d) dayBucket = { day: d, count: 0 };

  if (minuteBucket.count >= MAX_PER_MINUTE) {
    return {
      allowed: false,
      reason: `Places rate limit: max ${MAX_PER_MINUTE}/min`,
      code: "RATE_LIMIT_MINUTE",
    };
  }
  if (dayBucket.count >= MAX_PER_DAY) {
    return {
      allowed: false,
      reason: `Places daily cap: max ${MAX_PER_DAY}/day (founder draft; raise only with FA)`,
      code: "RATE_LIMIT_DAY",
    };
  }
  return null;
}

export function placesGuardPrecheck(normalizedKey: string): PlacesGuardDecision {
  if (GOOGLE_PLACES_INCIDENT.founderDisabledBothPlacesApis) {
    const override = String(process.env.EXPO_PUBLIC_GOOGLE_PLACES_FOUNDER_REENABLE ?? "")
      .trim()
      .toLowerCase();
    if (override !== "1" && override !== "true" && override !== "yes") {
      return {
        allowed: false,
        reason: `Places APIs founder-disabled (Case ${GOOGLE_PLACES_INCIDENT.caseId}) — graceful degrade, no retry`,
        code: "PLACES_FOUNDER_DISABLED",
      };
    }
  }
  if (isGooglePlacesLiveBlocked()) {
    return {
      allowed: false,
      reason: "EXPO_PUBLIC_GOOGLE_PLACES_DISABLED — no live Places",
      code: "PLACES_KILL_SWITCH",
    };
  }
  if (Date.now() < circuitOpenUntil) {
    return {
      allowed: false,
      reason: "Places circuit open after repeated failures — no retry storm",
      code: "CIRCUIT_OPEN",
    };
  }
  const cached = resultCache.get(normalizedKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      allowed: false,
      reason: "dup suppressed — serving result cache",
      code: "DUP_CACHE_HIT",
      cacheHit: true,
    };
  }
  if (inFlight.has(normalizedKey)) {
    return {
      allowed: false,
      reason: "dup suppressed — coalesce in-flight",
      code: "DUP_IN_FLIGHT",
    };
  }
  const limited = bumpCounters();
  if (limited) return limited;
  return { allowed: true, reason: "authorized under minute/day caps", code: "OK" };
}

export function placesGuardGetCached<T>(normalizedKey: string): T | undefined {
  const cached = resultCache.get(normalizedKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;
  return undefined;
}

export function placesGuardGetInFlight<T>(normalizedKey: string): Promise<T> | undefined {
  return inFlight.get(normalizedKey) as Promise<T> | undefined;
}

export function placesGuardBegin(_normalizedKey: string): void {
  const m = utcMinute();
  if (minuteBucket.minute !== m) minuteBucket = { minute: m, count: 0 };
  const d = utcDay();
  if (dayBucket.day !== d) dayBucket = { day: d, count: 0 };
  minuteBucket.count += 1;
  dayBucket.count += 1;
}

export function placesGuardTrackInFlight<T>(
  normalizedKey: string,
  promise: Promise<T>,
): Promise<T> {
  inFlight.set(normalizedKey, promise);
  return promise.finally(() => {
    inFlight.delete(normalizedKey);
  });
}

export function placesGuardCacheResult(normalizedKey: string, value: unknown): void {
  resultCache.set(normalizedKey, { expiresAt: Date.now() + RESULT_TTL_MS, value });
}

export function placesGuardRecordSuccess(): void {
  consecutiveFails = 0;
}

export function placesGuardRecordFailure(httpStatus?: number): void {
  consecutiveFails += 1;
  if (
    httpStatus === 429 ||
    httpStatus === 403 ||
    consecutiveFails >= CIRCUIT_FAILS
  ) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    consecutiveFails = 0;
  }
}

export function placesGuardUsageSnapshot() {
  bumpCounters();
  return {
    minuteCount: minuteBucket.count,
    minuteCap: MAX_PER_MINUTE,
    day: dayBucket.day || utcDay(),
    dayCount: dayBucket.count,
    dayCap: MAX_PER_DAY,
    circuitOpenUntil: circuitOpenUntil || null,
    liveBlocked: isGooglePlacesLiveBlocked(),
    inFlight: inFlight.size,
    cacheEntries: resultCache.size,
    incident: GOOGLE_PLACES_INCIDENT,
  };
}

/** Normalize Text Search query for dedupe (case/space). */
export function normalizePlacesSearchKey(textQuery: string): string {
  return `searchText:${String(textQuery || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()}`;
}

export function normalizePlacesGetKey(placeId: string): string {
  return `getPlace:${String(placeId || "")
    .trim()
    .replace(/^places\//i, "")
    .toLowerCase()}`;
}

/** Test-only reset — never call from production paths. */
export function __resetPlacesGuardForTests(): void {
  minuteBucket = { minute: 0, count: 0 };
  dayBucket = { day: "", count: 0 };
  circuitOpenUntil = 0;
  consecutiveFails = 0;
  inFlight.clear();
  resultCache.clear();
}

/**
 * Simulated storm. Kill-switch ON → zero allows (no Places storm).
 * founderReenableForTest + uniqueKeys → exercises minute/day caps (30+ rps).
 * founderReenableForTest + identical query → first OK, rest DUP_CACHE_HIT (~21k dups).
 */
export function simulateSearchTextStorm(opts: {
  query: string;
  count: number;
  founderReenableForTest?: boolean;
  uniqueKeys?: boolean;
}): { decisions: PlacesGuardDecision[]; liveAllowed: number } {
  const prev = process.env.EXPO_PUBLIC_GOOGLE_PLACES_FOUNDER_REENABLE;
  const prevDisabled = process.env.EXPO_PUBLIC_GOOGLE_PLACES_DISABLED;
  if (opts.founderReenableForTest) {
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_FOUNDER_REENABLE = "1";
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_DISABLED = "0";
  }
  try {
    const decisions: PlacesGuardDecision[] = [];
    let liveAllowed = 0;
    for (let i = 0; i < opts.count; i++) {
      const q = opts.uniqueKeys ? `${opts.query} #${i}` : opts.query;
      const key = normalizePlacesSearchKey(q);
      const d = placesGuardPrecheck(key);
      decisions.push(d);
      if (d.allowed) {
        liveAllowed += 1;
        placesGuardBegin(key);
        placesGuardCacheResult(key, []);
      } else if (d.code === "DUP_CACHE_HIT" || d.code === "DUP_IN_FLIGHT") {
        // coalesce — no begin
      }
    }
    return { decisions, liveAllowed };
  } finally {
    // Metro/strict: do not use `delete process.env.*`
    if (prev === undefined) process.env.EXPO_PUBLIC_GOOGLE_PLACES_FOUNDER_REENABLE = "";
    else process.env.EXPO_PUBLIC_GOOGLE_PLACES_FOUNDER_REENABLE = prev;
    if (prevDisabled === undefined) process.env.EXPO_PUBLIC_GOOGLE_PLACES_DISABLED = "";
    else process.env.EXPO_PUBLIC_GOOGLE_PLACES_DISABLED = prevDisabled;
  }
}
