import assert from "node:assert/strict";
import { test } from "node:test";
import {
  __resetPlacesGuardForTests,
  isGooglePlacesLiveBlocked,
  placesGuardPrecheck,
  normalizePlacesSearchKey,
  simulateSearchTextStorm,
  GOOGLE_PLACES_INCIDENT,
  placesGuardBegin,
  placesGuardCacheResult,
  placesGuardUsageSnapshot,
} from "./placesFinancialGuard";

test("Places DISABLED by default — no live storm", () => {
  __resetPlacesGuardForTests();
  delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_FOUNDER_REENABLE;
  delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_DISABLED;
  assert.equal(isGooglePlacesLiveBlocked(), true);
  const storm = simulateSearchTextStorm({ query: "Athens hotel", count: 21000 });
  assert.equal(storm.liveAllowed, 0);
  assert.ok(storm.decisions.every((d) => !d.allowed));
  assert.ok(
    storm.decisions.every(
      (d) => d.code === "PLACES_FOUNDER_DISABLED" || d.code === "PLACES_KILL_SWITCH",
    ),
  );
});

test("~21k identical Text Search dups coalesce when (test) re-enabled", () => {
  __resetPlacesGuardForTests();
  const storm = simulateSearchTextStorm({
    query: "Acropolis Museum Athens",
    count: 21000,
    founderReenableForTest: true,
    uniqueKeys: false,
  });
  assert.equal(storm.liveAllowed, 1, "only first identical query may pass");
  const dups = storm.decisions.filter((d) => d.code === "DUP_CACHE_HIT").length;
  assert.ok(dups >= 20999, `expected ~20999 cache hits, got ${dups}`);
});

test("30+ unique rps hits minute rate limit when (test) re-enabled", () => {
  __resetPlacesGuardForTests();
  const storm = simulateSearchTextStorm({
    query: "venue",
    count: 40,
    founderReenableForTest: true,
    uniqueKeys: true,
  });
  assert.ok(storm.liveAllowed <= 8, `minute cap 8, got ${storm.liveAllowed}`);
  assert.ok(storm.decisions.some((d) => d.code === "RATE_LIMIT_MINUTE"));
});

test("retry loop / circuit opens after 429", async () => {
  __resetPlacesGuardForTests();
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_FOUNDER_REENABLE = "1";
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_DISABLED = "0";
  try {
    const mod = await import("./placesFinancialGuard");
    mod.placesGuardRecordFailure(429);
    const d = placesGuardPrecheck(normalizePlacesSearchKey("retry storm"));
    assert.equal(d.allowed, false);
    assert.equal(d.code, "CIRCUIT_OPEN");
  } finally {
    delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_FOUNDER_REENABLE;
    delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_DISABLED;
  }
});

test("concurrent budget: day/minute caps block further unique calls", () => {
  __resetPlacesGuardForTests();
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_FOUNDER_REENABLE = "1";
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_DISABLED = "0";
  try {
    for (let i = 0; i < 30; i++) {
      const key = normalizePlacesSearchKey(`day-budget-${i}`);
      placesGuardBegin(key);
      placesGuardCacheResult(key, []);
    }
    const snap = placesGuardUsageSnapshot();
    assert.ok(snap.dayCount >= 30);
    const d = placesGuardPrecheck(normalizePlacesSearchKey("day-budget-overflow"));
    assert.equal(d.allowed, false);
    assert.ok(d.code === "RATE_LIMIT_DAY" || d.code === "RATE_LIMIT_MINUTE");
  } finally {
    delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_FOUNDER_REENABLE;
    delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_DISABLED;
  }
});

test("Case metadata pinned", () => {
  assert.equal(GOOGLE_PLACES_INCIDENT.caseId, "78008922");
  assert.equal(GOOGLE_PLACES_INCIDENT.approxRequests, 21000);
  assert.equal(GOOGLE_PLACES_INCIDENT.founderDisabledBothPlacesApis, true);
});
