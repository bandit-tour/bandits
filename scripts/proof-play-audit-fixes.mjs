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
  `play-audit-fixes-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const report = {
  outDir,
  routes: {},
  screenshots: {
    defaultEntryPlay: path.join(outDir, '1-default-entry-play.png'),
    introToHome: path.join(outDir, '2-intro-to-home.png'),
    playMenuClean: path.join(outDir, '3-play-menu-clean.png'),
    internalBackFlow: path.join(outDir, '4-internal-back-flow.png'),
    returningSkipHome: path.join(outDir, '5-returning-skip-home.png'),
  },
  checks: {
    defaultEntryIsPlay: false,
    introToHome: false,
    playMenuClean: false,
    internalBackFlow: false,
    returningSkipHome: false,
  },
  pass: 'FAIL',
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1365, height: 920 } });
const page = await context.newPage();

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // A) default entry route
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2200);
  report.routes.defaultEntry = page.url();
  report.checks.defaultEntryIsPlay = page.url().includes('/hotel/play-athens');
  await page.screenshot({ path: report.screenshots.defaultEntryPlay, fullPage: true });

  // Intro -> Home
  if (await page.getByRole('button', { name: /Open your message/i }).count()) {
    await page.getByRole('button', { name: /Open your message/i }).click({ timeout: 10000 });
  }
  await wait(3500);
  report.routes.afterIntroButton = page.url();
  report.checks.introToHome = page.url().includes('/bandits');
  await page.screenshot({ path: report.screenshots.introToHome, fullPage: true });

  // D) menu clean for PLAY
  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2400);
  const menuText = (await page.textContent('body')) || '';
  report.routes.menu = page.url();
  report.checks.playMenuClean =
    !/ALUMA|Hotelier|Pilot Desk/i.test(menuText);
  await page.screenshot({ path: report.screenshots.playMenuClean, fullPage: true });

  // C) internal app stack back flow: Menu -> bandiTEAM -> Back -> Menu
  await page.getByText('bandiTEAM', { exact: false }).first().click({ timeout: 10000 });
  await wait(2000);
  const profileUrl = page.url();
  await page.goBack({ timeout: 10000 });
  await wait(1800);
  const backUrl = page.url();
  report.routes.profile = profileUrl;
  report.routes.afterBackFromProfile = backUrl;
  report.checks.internalBackFlow = profileUrl.includes('/bandiTeam') && backUrl.includes('/menu');
  await page.screenshot({ path: report.screenshots.internalBackFlow, fullPage: true });

  // E) returning user skip intro -> home
  await page.goto(`${base}/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2800);
  report.routes.returning = page.url();
  report.checks.returningSkipHome = page.url().includes('/bandits');
  await page.screenshot({ path: report.screenshots.returningSkipHome, fullPage: true });

  report.pass = Object.values(report.checks).every(Boolean) ? 'PASS' : 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
