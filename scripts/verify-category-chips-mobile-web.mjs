import { chromium, devices } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8081';
const CHIP_REGEX = /(FOOD|CULTURE|NIGHTLIFE|SHOPPING|COFFEE)/i;

async function runScenario(name, contextOptions) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const report = {
    name,
    checks: [],
    errors: [],
  };

  const pushCheck = (label, ok, meta = '') => {
    report.checks.push({ label, ok, meta });
  };

  try {
    await page.goto(`${BASE_URL}/cityGuide`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(1500);

    const beforeUrl = page.url();
    const firstChip = page.getByText(CHIP_REGEX).first();
    const chipVisible = await firstChip.isVisible().catch(() => false);
    pushCheck('cityGuide chip visible', chipVisible);
    if (!chipVisible) throw new Error('No category chip visible on /cityGuide');

    await firstChip.click({ timeout: 10000 });
    await page.waitForTimeout(900);

    const afterUrl = page.url();
    const inlinePicks = await page.getByText(/picks/i).first().isVisible().catch(() => false);
    pushCheck('cityGuide inline picks appears', inlinePicks);
    pushCheck('cityGuide no route push on chip tap', beforeUrl === afterUrl, `${beforeUrl} -> ${afterUrl}`);

    const inlineOpenLabel = await page.getByText(/^Open$/).first().isVisible().catch(() => false);
    pushCheck('cityGuide recommendation CTA shown inline', inlineOpenLabel);
  } catch (e) {
    report.errors.push(String(e?.message || e));
    const text = await page.locator('body').innerText().catch(() => '');
    report.debugBody = text.slice(0, 800);
    await page.screenshot({ path: `artifacts/runtime-proof/${name}-category-check.png`, fullPage: true }).catch(() => undefined);
  } finally {
    await context.close();
    await browser.close();
  }
  return report;
}

const desktop = await runScenario('desktop-web', { viewport: { width: 1440, height: 980 } });
const iphone = await runScenario('iphone-viewport-web', devices['iPhone 14']);
const out = { baseUrl: BASE_URL, results: [desktop, iphone] };
console.log(JSON.stringify(out, null, 2));
