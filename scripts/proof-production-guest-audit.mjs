import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const PROD = (process.env.PROD_URL || 'https://bandits-two.vercel.app').replace(/\/$/, '');
const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `prod-guest-audit-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const result = { prod: PROD, pageErrors: [], consoleErrors: [], notes: [] };

await mkdir(outDir, { recursive: true });
const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1365, height: 920 } });
const page = await context.newPage();

page.on('pageerror', (e) => result.pageErrors.push(String(e.message || e)));
page.on('console', (msg) => {
  if (msg.type() === 'error') result.consoleErrors.push(String(msg.text()));
});

try {
  await page.goto(`${PROD}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2500);
  await page.screenshot({ path: path.join(outDir, '1-entry.png'), fullPage: true });
  const openBtn = page.getByRole('button', { name: /open your message|preparing/i });
  if (await openBtn.filter({ hasText: /open your message/i }).count()) {
    await openBtn.filter({ hasText: /open your message/i }).first().click({ timeout: 10000 });
    await wait(5000);
  } else {
    result.notes.push('No Open your message (skip or returning user?)');
  }
  await page.screenshot({ path: path.join(outDir, '2-after-continue.png'), fullPage: true });

  await page.goto(`${PROD}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(4000);
  const body = ((await page.textContent('body')) || '').toLowerCase();
  await page.screenshot({ path: path.join(outDir, '3-bandits-home.png'), fullPage: true });
  const hero = await page.getByTestId('bandits-home-hero').count();
  const hasNoBandits = body.includes('no bandits found');
  const summary = { heroTestIdCount: hero, hasNoBandits, url: page.url() };
  await writeFile(
    path.join(outDir, 'result.json'),
    JSON.stringify(
      { ...result, ...summary, pageErrors: result.pageErrors, consoleErrors: result.consoleErrors.slice(0, 20) },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
