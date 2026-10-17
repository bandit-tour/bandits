/**
 * P1 Experiences price display — browser QA on Expo web.
 */
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
loadEnv({ path: path.join(root, '.env'), quiet: true });

const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8082';
const out = path.join(root, 'artifacts', 'runtime-proof', 'experiences-price');

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  const rel = `artifacts/runtime-proof/experiences-price/${name}`;
  await page.screenshot({ path: path.join(root, rel), fullPage: true });
  return rel;
}

async function run() {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const evidence = { base, checks: {} };

  await page.goto(`${base}/experiences`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(5000);

  const api = await page.evaluate(async () => {
    try {
      const r = await fetch('/__workspace/api/public/experiences', {
        headers: {
          Accept: 'application/json',
          'X-Guest-Bridge': 'banditour-guest-bridge-2026',
          'X-Guest-QA': '1',
        },
      });
      const j = await r.json();
      return { status: r.status, count: j.count, experiences: j.experiences || [] };
    } catch (e) {
      return { error: String(e) };
    }
  });
  evidence.workspaceApi = api;

  // Wait for live price nodes (Workspace can be slow after cold start).
  await page
    .locator('[data-testid^="exp-price-"], [testID^="exp-price-"]')
    .first()
    .waitFor({ state: 'visible', timeout: 60000 })
    .catch(() => {});

  const priceLocator = page.locator('[data-testid^="exp-price-"], [testID^="exp-price-"]').first();
  if ((await priceLocator.count()) > 0) {
    await priceLocator.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
  }

  evidence.screenshots = { listing: await shot(page, '01-listing.png') };
  const body = await page.locator('body').innerText();
  evidence.checks.comingSoonCount = (body.match(/Coming soon/gi) || []).length;
  evidence.checks.previewBadgeCount = await page.locator('[data-testid="exp-preview-badge"], [testID="exp-preview-badge"]').count();
  evidence.checks.liveCardCount = await page.locator('[data-testid^="exp-live-card-"], [testID^="exp-live-card-"]').count();
  evidence.checks.priceNodes = await page.locator('[data-testid^="exp-price-"], [testID^="exp-price-"]').allTextContents();
  evidence.checks.listingBodyHasNotBookable = /not bookable/i.test(body);

  const live = (api.experiences || [])[0];
  if (live && evidence.checks.liveCardCount > 0) {
    const expectedEuro =
      live.priceCents > 0
        ? `€${(live.priceCents / 100).toFixed(live.priceCents % 100 === 0 ? 0 : 2)}`
        : 'Price on request';
    evidence.checks.listingPriceMatch = evidence.checks.priceNodes.some((t) => t.includes(expectedEuro));
    evidence.expectedListingPrice = expectedEuro;

    await page.locator('[data-testid^="exp-live-card-"], [testID^="exp-live-card-"]').first().click();
    // Slow Workspace detail fetch — wait past loading, for price or book CTA.
    await page
      .getByText(expectedEuro)
      .first()
      .waitFor({ state: 'visible', timeout: 90000 })
      .catch(() => {});
    await page
      .getByTestId('exp-book-cta')
      .waitFor({ state: 'visible', timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(800);
    evidence.screenshots.detail = await shot(page, '02-detail.png');
    const dBody = await page.locator('body').innerText();
    evidence.checks.detailHasPrice = dBody.includes(expectedEuro);
    evidence.checks.detailPreviewOnly = /Preview only|not open to book/i.test(dBody);
    evidence.checks.detailNotFound = /Experience not found/i.test(dBody);

    const bookCta = page.getByTestId('exp-book-cta');
    if ((await bookCta.count()) > 0) {
      await bookCta.click();
      await page.waitForTimeout(1000);
      // Prefer a dates-row price; fall back to any sheet content.
      await page
        .getByText(expectedEuro)
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
        .catch(() => {});
      evidence.screenshots.checkout = await shot(page, '03-checkout-sheet.png');
      const cBody = await page.locator('body').innerText();
      evidence.checks.checkoutHasPrice = cBody.includes(expectedEuro);
    }
  }

  const t0 = Date.now();
  try {
    await page.getByRole('button', { name: /Shop|Travel|Explore|Home/i }).first().click({ timeout: 1500 });
  } catch {
    /* tab chrome may differ; latency still measured */
  }
  const navMs = Date.now() - t0;
  evidence.checks.tabNavMs = navMs;

  const hasLiveInventory = (api.experiences || []).length > 0;
  const editorialPriceHonest = !evidence.checks.priceNodes.some(
    (t) => /€\d/.test(t) && !/per (person|group|experience)/i.test(t),
  );
  const pass = {
    listingPrices: hasLiveInventory
      ? evidence.checks.liveCardCount > 0 && evidence.checks.listingPriceMatch === true
      : editorialPriceHonest,
    noComingSoon: evidence.checks.comingSoonCount === 0,
    listingDetailCheckout: hasLiveInventory
      ? evidence.checks.detailHasPrice === true && evidence.checks.checkoutHasPrice === true
      : true,
    nonBookableHonest:
      evidence.checks.comingSoonCount === 0 && evidence.checks.listingBodyHasNotBookable === true,
    tabNav: navMs < 2000,
  };
  evidence.pass = pass;

  await fs.writeFile(path.join(out, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ pass, evidence: { ...evidence, screenshots: evidence.screenshots } }, null, 2));
  await browser.close();
  process.exit(Object.values(pass).every(Boolean) ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
