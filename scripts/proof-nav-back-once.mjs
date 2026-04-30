import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.PROFILE_VERIFY_BASE || 'http://localhost:8081';
const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `nav-back-once-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const result = {
  outDir,
  browserBack: {
    sequence: [],
    beforeBack: '',
    afterBack: '',
    pass: false,
  },
  mobileBack: {
    pass: false,
    note: 'Not executed in this run (web runtime proof only).',
  },
  screenshots: {
    beforeBack: path.join(outDir, '1-before-back.png'),
    afterBack: path.join(outDir, '2-after-back.png'),
  },
  pass: 'FAIL',
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1365, height: 920 } });
const page = await context.newPage();

try {
  await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1500);
  result.browserBack.sequence.push(page.url());

  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1000);
  result.browserBack.sequence.push(page.url());

  // category A / B simulated via menu item switches
  await page.goto(`${base}/following`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1000);
  result.browserBack.sequence.push(page.url());

  await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1000);
  result.browserBack.sequence.push(page.url());

  await page.goto(`${base}/alerts`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1000);
  result.browserBack.sequence.push(page.url());

  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1200);
  result.browserBack.sequence.push(page.url());
  result.browserBack.beforeBack = page.url();
  await page.screenshot({ path: result.screenshots.beforeBack, fullPage: true });

  await page.goBack({ timeout: 10000 });
  await wait(1400);
  result.browserBack.afterBack = page.url();
  result.browserBack.pass = result.browserBack.afterBack.includes('/bandits');
  await page.screenshot({ path: result.screenshots.afterBack, fullPage: true });

  result.pass = result.browserBack.pass ? 'PASS' : 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result));
