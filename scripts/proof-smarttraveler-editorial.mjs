/**
 * SmartTraveler — editorial discovery when Workspace live inventory is empty.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8082';
const out = path.join(root, 'artifacts', 'runtime-proof', 'smarttraveler-editorial');

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, name), fullPage: false });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/smarttraveler`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByTestId('st-find-count').waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  const countText = await page.getByTestId('st-find-count').innerText();
  const count = Number(countText);
  const body = await page.locator('body').innerText();
  await shot(page, '01-mobile-finds.png');
  const cards = await page.locator('[data-testid^="st-card-"]').count();

  await page.getByTestId('st-filter-Jewellery').click();
  await page.waitForTimeout(600);
  const jewel = await page.locator('body').innerText();
  const jewelCount = Number(await page.getByTestId('st-find-count').innerText());
  await shot(page, '02-filter-jewellery.png');

  const first = page.locator('[data-testid^="st-card-"]').first();
  await first.click();
  await page.waitForTimeout(1500);
  const detail = await page.locator('body').innerText();
  await shot(page, '03-detail.png');
  const noRedeem = (await page.getByText('Unlock Guest Privilege').count()) === 0;
  const editorial = /Editorial Local Find|not an approved Hotel Guest Special/i.test(detail);
  const back = page.getByRole('button', { name: /back/i }).first();
  if ((await back.count()) > 0) await back.click();
  else await page.goto(`${base}/smarttraveler`);
  await page.waitForTimeout(1000);
  const backOk = /Editorial Local Finds|SmartTraveler/i.test(await page.locator('body').innerText());

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await desktop.goto(`${base}/smarttraveler`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await desktop.getByTestId('st-find-count').waitFor({ timeout: 20000 });
  await desktop.waitForTimeout(2000);
  await shot(desktop, '04-desktop.png');
  const deskCount = Number(await desktop.getByTestId('st-find-count').innerText());

  const checks = {
    notEmpty: count > 0 && cards > 0 && !/No local finds published near you yet/i.test(body),
    editorialLabeled: /Editorial Local Finds/i.test(body) && /cannot be redeemed/i.test(body),
    noGpsClaim: /not GPS/i.test(body),
    filterJewellery: jewelCount > 0 && jewelCount < count && /Jewellery|Studio|silver/i.test(jewel),
    detailEditorial: editorial && noRedeem,
    backWorks: backOk,
    desktop: deskCount > 0,
  };
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  const report = { pass: failed.length === 0, failed, checks, count, jewelCount, deskCount };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.pass) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
