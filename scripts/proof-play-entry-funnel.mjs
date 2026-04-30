import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const PROD = 'https://bandits-two.vercel.app';
const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `play-entry-funnel-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);
await mkdir(outDir, { recursive: true });

const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));

try {
  await page.goto(`${PROD}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2000));
  const fullIntro = await page.getByTestId('play-theatrou-full-intro').count();
  const fastSkip = await page.getByTestId('play-theatrou-fast-skip').count();
  await page.screenshot({ path: path.join(outDir, '1-guest-link.png'), fullPage: true });
  const hasMessageBottle = ((await page.textContent('body')) || '').toLowerCase().includes('message in a bottle');
  const result = {
    prod: PROD,
    fullIntroTestId: fullIntro,
    fastSkipTestId: fastSkip,
    hasMessageBottle,
    pageErrors,
    pass:
      fullIntro > 0 &&
      fastSkip === 0 &&
      hasMessageBottle &&
      pageErrors.length === 0,
  };
  await writeFile(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
