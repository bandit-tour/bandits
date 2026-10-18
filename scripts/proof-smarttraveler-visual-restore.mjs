/**
 * SmartTraveler visual catalog restore — editorial + live partners on production.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.RUNTIME_BASE_URL || 'https://bandits-two.vercel.app';
const out = path.join(root, 'artifacts', 'runtime-proof', 'smarttraveler-visual-restore');

const FOLIA_ID = 'st_st_merchant_mvcqvifx_banditour_live';
const EDITORIAL_ID = 'st_studio_nera';

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, name), fullPage: true });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    base,
    at: new Date().toISOString(),
    checks: {},
    counts: {},
  };

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${base}/smarttraveler`, { waitUntil: 'networkidle', timeout: 120000 });
  await mobile.getByTestId('st-find-count').waitFor({ timeout: 30000 });
  await mobile.waitForTimeout(2000);
  const mobileBody = await mobile.locator('body').innerText();
  report.counts.mobileAll = Number(await mobile.getByTestId('st-find-count').innerText());
  report.counts.mobileCards = await mobile.locator('[data-testid^="st-card-"]').count();
  await shot(mobile, 'mobile-catalog-full.png');

  await mobile.getByTestId('st-filter-Jewellery').click();
  await mobile.waitForTimeout(800);
  report.counts.mobileJewellery = Number(await mobile.getByTestId('st-find-count').innerText());
  await shot(mobile, 'mobile-category-jewellery-full.png');

  await mobile.getByTestId('st-filter-Fashion').click();
  await mobile.waitForTimeout(800);
  report.counts.mobileFashion = Number(await mobile.getByTestId('st-find-count').innerText());
  await shot(mobile, 'mobile-category-fashion-full.png');

  await mobile.goto(`${base}/localFind/${EDITORIAL_ID}`, { waitUntil: 'networkidle', timeout: 120000 });
  await mobile.waitForTimeout(1500);
  const editorialDetail = await mobile.locator('body').innerText();
  await shot(mobile, 'mobile-editorial-detail-full.png');

  await mobile.goto(`${base}/localFind/${FOLIA_ID}`, { waitUntil: 'networkidle', timeout: 120000 });
  await mobile.waitForTimeout(2500);
  const foliaDetail = await mobile.locator('body').innerText();
  await shot(mobile, 'mobile-folia-detail-full.png');

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await desktop.goto(`${base}/smarttraveler`, { waitUntil: 'networkidle', timeout: 120000 });
  await desktop.getByTestId('st-find-count').waitFor({ timeout: 30000 });
  await desktop.waitForTimeout(2000);
  report.counts.desktopAll = Number(await desktop.getByTestId('st-find-count').innerText());
  report.counts.desktopCards = await desktop.locator('[data-testid^="st-card-"]').count();
  const desktopBody = await desktop.locator('body').innerText();
  await shot(desktop, 'desktop-catalog-full.png');

  await desktop.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await desktop.waitForTimeout(600);
  await shot(desktop, 'desktop-catalog-scrolled-full.png');

  report.checks = {
    copyTagline: /Discover the local\. Enjoy the unexpected\./i.test(mobileBody),
    noHotelOnlyCopy: !/Exclusive local discounts for guests of partner hotels/i.test(mobileBody),
    editorialCatalog: report.counts.mobileAll >= 15 && report.counts.mobileCards >= 10,
    categoryNotEmpty: report.counts.mobileJewellery > 0 && report.counts.mobileFashion > 0,
    editorialLabeled: /Editorial · discovery only/i.test(mobileBody),
    editorialDetailNoClaim: /Editorial discovery/i.test(editorialDetail) && !/Claim discount code/i.test(editorialDetail),
    foliaPartnerPath:
      /Folia|Courtyard/i.test(foliaDetail) &&
      (/Claim discount code|Hotel Guest Special|Participating/i.test(foliaDetail) ||
        (await mobile.getByTestId('local-find-offer').count()) > 0),
    desktopGrid: report.counts.desktopAll >= 15,
    noEmptyAll: !/No local finds published near you yet/i.test(desktopBody),
  };

  const failed = Object.entries(report.checks).filter(([, v]) => !v).map(([k]) => k);
  report.pass = failed.length === 0;
  report.failed = failed;

  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, 'REPORT.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(
    path.join(out, 'RESULT.md'),
    `# SmartTraveler visual restore\n\n- **Pass:** ${report.pass}\n- **Base:** ${base}\n- **At:** ${report.at}\n\n## Checks\n${Object.entries(report.checks)
      .map(([k, v]) => `- ${k}: ${v ? 'PASS' : 'FAIL'}`)
      .join('\n')}\n\n${failed.length ? `## Failed\n${failed.map((f) => `- ${f}`).join('\n')}\n` : ''}`,
  );

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.pass) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
