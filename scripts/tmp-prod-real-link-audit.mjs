import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = 'https://bandits-two.vercel.app';
const guestPath = '/hotel/play-theatrou';
const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `real-link-audit-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const report = {
  base,
  guestUrl: `${base}${guestPath}`,
  outDir,
  checks: {},
  steps: [],
  screenshots: {},
  errors: [],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function capture(page, name) {
  const shot = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  report.screenshots[name] = shot;
}

async function step(page, name, fn) {
  try {
    await fn();
    const body = ((await page.textContent('body')) || '').replace(/\s+/g, ' ').trim();
    report.steps.push({
      name,
      url: page.url(),
      bodySample: body.slice(0, 260),
    });
  } catch (e) {
    report.errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 920 } });
const page = await context.newPage();

page.on('pageerror', (e) => report.errors.push(`pageerror: ${String(e?.message || e)}`));
page.on('console', (m) => {
  if (m.type() === 'error') report.errors.push(`console: ${m.text()}`);
});

try {
  await mkdir(outDir, { recursive: true });

  await step(page, 'first_visit_guest_link', async () => {
    await page.goto(`${base}${guestPath}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await wait(2200);
    await capture(page, '1-first-visit');
    const body = ((await page.textContent('body')) || '').toLowerCase();
    report.checks.firstVisitShowsIntroLikeUi =
      body.includes('message') || body.includes('start') || body.includes('continue');
  });

  await step(page, 'attempt_continue_once', async () => {
    const labels = ['Open your message', 'Start Exploring', 'Continue', 'Enter Experience', 'Skip', 'Tap to continue'];
    let clicked = false;
    for (const label of labels) {
      const btn = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
      if ((await btn.count()) > 0) {
        try {
          await btn.click({ timeout: 3000 });
          clicked = true;
          break;
        } catch {
          // try next label
        }
      }
    }
    report.checks.firstVisitHadClickableCta = clicked;
    await wait(2500);
    await capture(page, '2-after-first-cta');
  });

  await step(page, 'second_visit_same_guest_link', async () => {
    await page.goto(`${base}${guestPath}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await wait(2600);
    await capture(page, '3-second-visit');
    report.checks.secondVisitUrl = page.url();
  });

  const routes = [
    ['/alerts', 'alerts'],
    ['/following', 'following'],
    ['/profile', 'profile'],
    ['/bandiTeam/report', 'bandiTeam-report'],
    ['/menu', 'menu'],
    ['/hotelier', 'hotelier'],
  ];

  for (const [route, key] of routes) {
    await step(page, `open_${key}`, async () => {
      await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await wait(1800);
      await capture(page, `4-${key}`);
      const body = ((await page.textContent('body')) || '').toLowerCase();
      report.checks[`${key}Route`] = {
        url: page.url(),
        hasNotFoundText: body.includes('not found') || body.includes('404'),
      };
    });
  }
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
