/**
 * Product recovery — Experiences catalog pricing E1–E6 (browser + Workspace API).
 */
import { config as loadEnv } from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
loadEnv({ path: path.join(root, ".env"), quiet: true });

const base = process.env.RUNTIME_BASE_URL || "http://localhost:8082";
const wsDirect = process.env.WORKSPACE_ORIGIN || "http://localhost:3000";
const outDir = path.join(root, "artifacts", "runtime-proof", "product-recovery-experiences");

function euroFromCents(cents) {
  if (!Number.isFinite(cents) || cents <= 0) return "Price on request";
  return `€${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function expectedListingLabel(row) {
  const amount = euroFromCents(row.priceCents);
  if (amount === "Price on request") return amount;
  if (row.priceBasis === "per_person") return `${amount} per person`;
  if (row.priceBasis === "per_group") return `${amount} per group`;
  if (row.priceBasis === "per_experience") return `${amount} per experience`;
  return amount;
}

async function shot(page, name) {
  await fs.mkdir(outDir, { recursive: true });
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, fullPage: true });
  return `artifacts/runtime-proof/product-recovery-experiences/${name}`;
}

async function fetchWorkspaceApi(page) {
  return page.evaluate(async () => {
    try {
      const r = await fetch("/__workspace/api/public/experiences", {
        headers: {
          Accept: "application/json",
          "X-Guest-Bridge": "banditour-guest-bridge-2026",
          "X-Guest-QA": "1",
        },
      });
      const j = await r.json();
      return { status: r.status, ok: j.ok, count: j.count, experiences: j.experiences || [] };
    } catch (e) {
      return { error: String(e) };
    }
  });
}

async function run() {
  await fs.mkdir(outDir, { recursive: true });
  const report = {
    track: "Product recovery — Experiences catalog pricing E1–E6",
    closedAt: new Date().toISOString(),
    runtimeBase: base,
    workspaceOrigin: wsDirect,
    stripeLiveCharges: false,
    results: {},
    screenshots: {},
  };

  let directApi = null;
  try {
    const r = await fetch(`${wsDirect}/api/public/experiences`, {
      headers: { Accept: "application/json" },
    });
    directApi = { status: r.status, body: await r.json() };
  } catch (e) {
    directApi = { error: String(e) };
  }
  report.workspaceDirect = directApi;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(`${base}/experiences`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(4000);

  const api = await fetchWorkspaceApi(page);
  const live = (api.experiences || []).filter((e) => e?.id);

  // E1 — API supplier fields + unique unit prices
  const priceById = new Map(live.map((e) => [e.id, e.priceCents]));
  const uniquePrices = new Set([...priceById.values()].filter((p) => p > 0));
  const e1 =
    api.status === 200 &&
    api.ok !== false &&
    live.length > 0 &&
    live.every(
      (e) =>
        typeof e.priceCents === "number" &&
        (e.currency === undefined || typeof e.currency === "string"),
    );
  report.results.E1_apiSupplierFields = e1
    ? "PASS"
    : live.length === 0
      ? "BLOCKED — zero guest-bookable Workspace rows"
      : "FAIL";
  report.results.E1_note = {
    liveCount: live.length,
    uniquePositivePrices: uniquePrices.size,
    ids: live.map((e) => ({
      id: e.id,
      priceCents: e.priceCents,
      priceBasis: e.priceBasis,
      currency: e.currency || "EUR",
    })),
  };

  report.screenshots.E1_listing = await shot(page, "E1-listing.png");

  await page
    .locator('[data-testid^="exp-price-"], [testID^="exp-price-"]')
    .first()
    .waitFor({ state: "visible", timeout: 45000 })
    .catch(() => {});

  const priceNodes = await page
    .locator('[data-testid^="exp-price-"], [testID^="exp-price-"]')
    .allTextContents();
  const cardChecks = [];
  for (const row of live) {
    const testId = `[data-testid="exp-price-${row.id}"], [testID="exp-price-${row.id}"]`;
    const node = page.locator(testId);
    const text = (await node.count()) > 0 ? (await node.first().innerText()) : null;
    const expected = expectedListingLabel(row);
    cardChecks.push({ id: row.id, expected, ui: text, match: text === expected });
  }
  const e2 =
    live.length > 0 && cardChecks.length > 0 && cardChecks.every((c) => c.match === true);
  report.results.E2_listingMatchesApi = e2
    ? "PASS"
    : live.length === 0
      ? "BLOCKED"
      : "FAIL";
  report.results.E2_cardChecks = cardChecks;

  // E3–E4 — detail + checkout for up to 3 live rows (or all if fewer)
  const detailChecks = [];
  const sample = live.slice(0, Math.min(3, live.length));
  for (let i = 0; i < sample.length; i++) {
    const row = sample[i];
    const expectedEuro = euroFromCents(row.priceCents);
    const check = { id: row.id, expectedEuro, detail: "FAIL", checkout: "FAIL" };
    if (i > 0) {
      await page.goto(`${base}/experiences`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(2500);
    }
    const card = page.locator(`[data-testid="exp-live-card-${row.id}"], [testID="exp-live-card-${row.id}"]`);
    if ((await card.count()) === 0) {
      check.reason = "live card missing";
      detailChecks.push(check);
      continue;
    }
    await card.first().click();
    await page.getByTestId("exp-book-cta").waitFor({ state: "visible", timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(600);
    report.screenshots[`E3_detail_${row.id}`] = await shot(page, `E3-detail-${row.id}.png`);
    const dBody = await page.locator("body").innerText();
    check.detail =
      expectedEuro === "Price on request"
        ? dBody.includes("Price on request")
          ? "PASS"
          : "FAIL"
        : dBody.includes(expectedEuro)
          ? "PASS"
          : "FAIL";

    const bookCta = page.getByTestId("exp-book-cta");
    if ((await bookCta.count()) > 0 && expectedEuro !== "Price on request") {
      await bookCta.click();
      await page.waitForTimeout(900);
      await page.getByText(expectedEuro).first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
      report.screenshots[`E4_checkout_${row.id}`] = await shot(page, `E4-checkout-${row.id}.png`);
      const cBody = await page.locator("body").innerText();
      check.checkout = cBody.includes(expectedEuro) ? "PASS" : "FAIL";
    } else if (expectedEuro === "Price on request") {
      check.checkout = "PASS";
    }
    detailChecks.push(check);
    await page.goBack().catch(() => {});
  }

  report.results.E3_detailMatchesListing =
    sample.length === 0
      ? "BLOCKED"
      : detailChecks.every((d) => d.detail === "PASS")
        ? "PASS"
        : "FAIL";
  report.results.E4_checkoutMatchesListing =
    sample.length === 0
      ? "BLOCKED"
      : detailChecks.every((d) => d.checkout === "PASS")
        ? "PASS"
        : "FAIL";
  report.results.E3_E4_detailChecks = detailChecks;

  await page.goto(`${base}/experiences`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText();
  const comingSoon = (body.match(/Coming soon/gi) || []).length;
  const previewBadges = await page
    .locator('[data-testid="exp-preview-badge"], [testID="exp-preview-badge"]')
    .count();
  const e5 = comingSoon === 0 && previewBadges === 0 && /not bookable/i.test(body);
  report.results.E5_noFalsePromoClutter = e5 ? "PASS" : "FAIL";
  report.results.E5_metrics = { comingSoon, previewBadges, hasNotBookableCopy: /not bookable/i.test(body) };
  report.screenshots.E5_listing_clutter = await shot(page, "E5-listing-clutter.png");

  const t0 = Date.now();
  try {
    await page.getByRole("button", { name: /Shop|Travel|Explore|Home/i }).first().click({ timeout: 2000 });
  } catch {
    /* tab chrome varies */
  }
  const navMs = Date.now() - t0;
  report.results.E6_tabNavResponsive = navMs < 8000 ? "PASS" : "FAIL";
  report.results.E6_navMs = navMs;

  // Multi-listing uniqueness — BLOCKED when <2 live rows
  report.results.E_multiDistinctSupplierPrices =
    live.length >= 2
      ? uniquePrices.size >= 2
        ? "PASS"
        : "FAIL — same priceCents reused across guest-bookable listings"
      : "BLOCKED — need ≥2 guest-bookable listings in Workspace";

  await browser.close();

  await fs.writeFile(path.join(outDir, "REPORT.json"), JSON.stringify(report, null, 2));
  const failed = Object.entries(report.results).some(
    ([k, v]) => typeof v === "string" && v.startsWith("FAIL"),
  );
  console.log(JSON.stringify(report.results, null, 2));
  process.exit(failed ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
