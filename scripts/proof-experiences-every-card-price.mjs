/**
 * P0 — every Local Experience card shows a EUR price (real or Example price · Preview).
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
const out = path.join(root, 'artifacts', 'runtime-proof', 'experiences-every-card-price');

const FILTERS = ['All', 'Workshops', 'Nightlife', 'Art', 'Fashion', 'Queer', 'Food', 'Music'];
const EXAMPLE_LABEL = 'Example price · Preview';

async function shot(page, name, fullPage = true) {
  await fs.mkdir(out, { recursive: true });
  const rel = `artifacts/runtime-proof/experiences-every-card-price/${name}`;
  await page.screenshot({ path: path.join(root, rel), fullPage });
  return rel;
}

async function scrollToBottom(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let last = 0;
      const tick = () => {
        window.scrollTo(0, document.body.scrollHeight);
        const h = document.body.scrollHeight;
        if (h === last) {
          resolve(undefined);
          return;
        }
        last = h;
        setTimeout(tick, 350);
      };
      tick();
    });
  });
}

async function auditFilter(page, filter) {
  if (filter !== 'All') {
    await page.getByTestId(`exp-filter-${filter}`).click();
    await page.waitForTimeout(600);
  }
  await scrollToBottom(page);
  await page.waitForTimeout(400);

  const cards = await page.evaluate(() => {
    const live = [...document.querySelectorAll('[data-testid^="exp-live-card-"], [testID^="exp-live-card-"]')];
    const preview = [...document.querySelectorAll('[data-testid^="exp-preview-card-"], [testID^="exp-preview-card-"]')];
    const ids = [...live, ...preview].map((el) => {
      const tid = el.getAttribute('data-testid') || el.getAttribute('testID') || '';
      return tid.replace(/^exp-(live|preview)-card-/, '');
    });
    return [...new Set(ids.filter(Boolean))];
  });

  const prices = await page.evaluate(() => {
    const map = new Map();
    for (const el of document.querySelectorAll('[data-testid^="exp-price-"], [testID^="exp-price-"]')) {
      const id = el.getAttribute('data-testid') || el.getAttribute('testID') || '';
      if (!id.startsWith('exp-price-') || id.includes('-example-')) continue;
      const expId = id.replace(/^exp-price-/, '');
      map.set(expId, (el.textContent || '').trim());
    }
    return [...map.entries()].map(([expId, text]) => ({ expId, text }));
  });

  const examples = await page.evaluate(() => {
    return [...document.querySelectorAll('[data-testid^="exp-price-example-"], [testID^="exp-price-example-"]')].map(
      (el) => (el.textContent || '').trim(),
    );
  });

  const cardCount = cards.length;
  const pricedIds = new Set(prices.map((p) => p.expId));
  const cardsWithoutPrice = cards.filter((id) => !pricedIds.has(id));
  const withEuro = prices.filter((p) => /€\s*\d/.test(p.text));
  const missingEuro = prices.filter((p) => !/€\s*\d/.test(p.text));
  const priceOnRequest = prices.filter((p) => /price on request/i.test(p.text));
  const inspirationOnly = prices.filter((p) => /inspiration/i.test(p.text));

  return {
    filter,
    cardCount,
    uniquePriceCount: prices.length,
    cardsWithoutPrice,
    withEuroCount: withEuro.length,
    missingEuro,
    priceOnRequest,
    inspirationOnly,
    exampleLabelCount: examples.filter((t) => t.includes('Example price')).length,
    samplePrices: withEuro.slice(0, 5).map((p) => p.text),
  };
}

async function run() {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = {
    base,
    checkedAt: new Date().toISOString(),
    filters: {},
    screenshots: {},
  };

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${base}/experiences`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await mobile.waitForTimeout(5000);

  for (const filter of FILTERS) {
    report.filters[filter] = await auditFilter(mobile, filter);
  }
  report.screenshots.mobileFullScroll = await shot(mobile, 'mobile-full-scroll.png');

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await desktop.goto(`${base}/experiences`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await desktop.waitForTimeout(5000);
  report.filters.AllDesktop = await auditFilter(desktop, 'All');
  await scrollToBottom(desktop);
  report.screenshots.desktopFullScroll = await shot(desktop, 'desktop-full-scroll.png');

  await desktop.locator('[data-testid^="exp-preview-card-"], [testID^="exp-preview-card-"]').first().click();
  await desktop.waitForTimeout(2500);
  report.screenshots.detailPreview = await shot(desktop, 'detail-preview.png', false);

  await desktop.goto(`${base}/experiences`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await desktop.waitForTimeout(4000);
  const liveCard = desktop.locator('[data-testid^="exp-live-card-"], [testID^="exp-live-card-"]').first();
  if ((await liveCard.count()) > 0) {
    await liveCard.click();
    await desktop.waitForTimeout(3000);
    report.screenshots.detailReal = await shot(desktop, 'detail-real.png', false);
    const detailBody = await desktop.locator('body').innerText();
    report.detailRealHasEuro = /€\s*\d/.test(detailBody);
    report.detailRealIsExample = detailBody.includes(EXAMPLE_LABEL);
  } else {
    report.detailRealSkipped = 'no live cards';
  }

  const filterRows = Object.values(report.filters);
  const totalCards = filterRows.reduce((n, r) => Math.max(n, r.cardCount), 0);
  const allFiltersPass = filterRows.every(
    (r) =>
      r.cardCount === 0 ||
      (r.withEuroCount === r.cardCount &&
        r.cardsWithoutPrice.length === 0 &&
        r.priceOnRequest.length === 0 &&
        r.inspirationOnly.length === 0 &&
        r.missingEuro.length === 0),
  );

  const pass = allFiltersPass && totalCards > 0;

  report.summary = {
    totalCardsSeen: totalCards,
    pass,
    EXAMPLE_LABEL,
  };

  await fs.writeFile(path.join(out, 'REPORT.json'), JSON.stringify(report, null, 2));
  const resultMd = `# Experiences — every card price

**Verdict:** ${pass ? 'PASS' : 'FAIL'}
**Base:** ${base}
**Checked:** ${report.checkedAt}

## Summary
- Max cards in one filter view: ${totalCards}
- Example label: \`${EXAMPLE_LABEL}\`

## Per filter
${filterRows.map((r) => `- **${r.filter}**: cards=${r.cardCount} priced=${r.withEuroCount}/${r.priceNodeCount} examples=${r.exampleLabelCount}`).join('\n')}

## Screenshots
${Object.entries(report.screenshots)
  .map(([k, v]) => `- ${k}: \`${v}\``)
  .join('\n')}
`;
  await fs.writeFile(path.join(out, 'RESULT.md'), resultMd);

  console.log(JSON.stringify({ pass, summary: report.summary }, null, 2));
  await browser.close();
  process.exit(pass ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
