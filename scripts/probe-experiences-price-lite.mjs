import { chromium } from 'playwright';

const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8082';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`${base}/experiences`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(6000);
const api = await page.evaluate(async () => {
  const r = await fetch('/__workspace/api/public/experiences', {
    headers: {
      Accept: 'application/json',
      'X-Guest-Bridge': 'banditour-guest-bridge-2026',
      'X-Guest-QA': '1',
    },
  });
  return r.json();
});
const body = await page.locator('body').innerText();
const liveCards = await page.locator('[data-testid^="exp-live-card-"]').count();
const prices = await page.locator('[data-testid^="exp-price-"]').allTextContents();
console.log(
  JSON.stringify(
    {
      apiCount: api.count,
      apiPrice: api.experiences?.[0]?.priceCents,
      liveCards,
      prices,
      comingSoon: (body.match(/Coming soon/gi) || []).length,
      previewBadges: await page.locator('[data-testid="exp-preview-badge"]').count(),
      notBookable: /not bookable/i.test(body),
    },
    null,
    2,
  ),
);
await browser.close();
