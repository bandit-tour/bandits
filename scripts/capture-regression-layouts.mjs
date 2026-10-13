import { chromium, devices } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.BASE_URL || 'http://localhost:8081';
const outDir = path.join(process.cwd(), 'artifacts', 'runtime-proof', 'layout-regression-captures');

await fs.mkdir(outDir, { recursive: true });

const targets = [
  { name: 'desktop-wide-cityGuide', url: '/cityGuide', viewport: { width: 1680, height: 980 } },
  { name: 'laptop-cityGuide', url: '/cityGuide', viewport: { width: 1366, height: 900 } },
  { name: 'desktop-wide-explore', url: '/explore', viewport: { width: 1680, height: 980 } },
  { name: 'laptop-explore', url: '/explore', viewport: { width: 1366, height: 900 } },
];

const browser = await chromium.launch({ headless: true });
const captures = [];

for (const t of targets) {
  const ctx = await browser.newContext({ viewport: t.viewport });
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}${t.url}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1500);
  const screenshotPath = path.join(outDir, `${t.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const bodyText = await page.locator('body').innerText().catch(() => '');
  captures.push({ name: t.name, route: t.url, screenshotPath, bodyPreview: bodyText.slice(0, 120) });
  await ctx.close();
}

{
  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/cityGuide`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1500);
  const screenshotPath = path.join(outDir, 'iphone-cityGuide.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const bodyText = await page.locator('body').innerText().catch(() => '');
  captures.push({ name: 'iphone-cityGuide', route: '/cityGuide', screenshotPath, bodyPreview: bodyText.slice(0, 120) });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify({ baseUrl, outDir, captures }, null, 2));
