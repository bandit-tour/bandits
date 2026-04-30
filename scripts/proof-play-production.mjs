import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.PROFILE_VERIFY_BASE || 'http://localhost:8081';
const outDir = path.join(root, 'artifacts', 'runtime-proof', `play-production-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);

const report = {
  pass: 'FAIL',
  outDir,
  mismatches: [],
  screenshots: {
    home: path.join(outDir, '1-home.png'),
    alerts: path.join(outDir, '2-alerts.png'),
    localFriend: path.join(outDir, '3-local-friend.png'),
    profile: path.join(outDir, '4-profile.png'),
    menu: path.join(outDir, '5-menu.png'),
    refreshHome: path.join(outDir, '6-refresh-home.png'),
    backTest: path.join(outDir, '7-back-test.png'),
  },
  checks: {
    onboardingSkippedAfterRefresh: false,
    noTabHistoryLoop: false,
  },
  debug: {},
  errors: [],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clickFirstVisible(page, labels) {
  for (const label of labels) {
    const el = page.getByText(label, { exact: false }).first();
    if ((await el.count()) > 0) {
      try {
        await el.click({ timeout: 1500 });
        return true;
      } catch {
        // keep trying
      }
    }
  }
  return false;
}

async function run() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept().catch(() => undefined));

  try {
    await page.goto(`${base}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await wait(1200);

    // Fresh link walkthrough: intro/flip/experience -> playIntro -> home
    for (let i = 0; i < 10; i += 1) {
      const url = page.url();
      if (url.includes('/bandits')) break;
      const clicked = await clickFirstVisible(page, [
        'Start Exploring',
        'Start exploring',
        'Enter Experience',
        'Tap to continue',
        'Reveal',
        'Open',
        'Continue',
        'Skip',
      ]);
      await wait(clicked ? 2200 : 1200);
      if (page.url().includes('/playIntro')) {
        // Let intro auto-advance and set "done".
        await page.waitForURL('**/bandits', { timeout: 30000 }).catch(() => undefined);
      }
      if (!clicked && i >= 6) break;
    }

    if (!page.url().includes('/bandits')) {
      await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await wait(1500);
    }

    report.debug.urlAfterOnboarding = page.url();
    report.debug.stageAfterOnboarding = await page.evaluate(() => ({
      session: window.sessionStorage?.getItem('pwa_play_theatrou_stage_v1'),
      local: window.localStorage?.getItem('pwa_play_theatrou_done_v1'),
    }));
    if (!report.debug.stageAfterOnboarding?.local) {
      // Deterministic onboarding-complete pass for PLAY: entering experience marks done.
      await page.goto(`${base}/hotel/play-theatrou/experience`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await wait(1500);
      await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await wait(900);
      report.debug.stageAfterOnboarding = await page.evaluate(() => ({
        session: window.sessionStorage?.getItem('pwa_play_theatrou_stage_v1'),
        local: window.localStorage?.getItem('pwa_play_theatrou_done_v1'),
      }));
    }
    await page.screenshot({ path: report.screenshots.home, fullPage: true });

    // Alerts
    await clickFirstVisible(page, ['Alerts']);
    await wait(1800);
    if (!page.url().includes('/alerts')) {
      await page.goto(`${base}/alerts`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await wait(1500);
    }
    await page.screenshot({ path: report.screenshots.alerts, fullPage: true });

    // Local Friend
    await clickFirstVisible(page, ['Local Friend']);
    await wait(1800);
    if (!page.url().includes('/localFriend')) {
      await page.goto(`${base}/localFriend`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await wait(1500);
    }
    await page.screenshot({ path: report.screenshots.localFriend, fullPage: true });

    // Profile
    await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await wait(1500);
    await page.screenshot({ path: report.screenshots.profile, fullPage: true });

    // Menu
    await clickFirstVisible(page, ['Menu']);
    await wait(1600);
    if (!page.url().includes('/menu')) {
      await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await wait(1200);
    }
    await page.screenshot({ path: report.screenshots.menu, fullPage: true });

    // Refresh PLAY link: should skip onboarding and land Home
    await page.goto(`${base}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await wait(2200);
    if (!page.url().includes('/bandits')) {
      await wait(1800);
    }
    report.debug.urlAfterRefresh = page.url();
    report.debug.stageAfterRefresh = await page.evaluate(() => ({
      session: window.sessionStorage?.getItem('pwa_play_theatrou_stage_v1'),
      local: window.localStorage?.getItem('pwa_play_theatrou_done_v1'),
    }));
    report.checks.onboardingSkippedAfterRefresh = page.url().includes('/bandits');
    await page.screenshot({ path: report.screenshots.refreshHome, fullPage: true });
    if (!report.checks.onboardingSkippedAfterRefresh) {
      report.mismatches.push('PLAY refresh does not skip onboarding to Home');
    }

    // Back-button loop test: tab hops should not walk alerts/menu history
    await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await wait(1200);
    await clickFirstVisible(page, ['Alerts']);
    await wait(1100);
    await clickFirstVisible(page, ['Menu']);
    await wait(1100);
    const beforeBack = page.url();
    await page.goBack({ timeout: 5000 }).catch(() => null);
    await wait(900);
    const afterBack = page.url();
    report.checks.noTabHistoryLoop = !afterBack.includes('/alerts');
    await page.screenshot({ path: report.screenshots.backTest, fullPage: true });
    if (!report.checks.noTabHistoryLoop) {
      report.mismatches.push(`Back loop detected (${beforeBack} -> ${afterBack})`);
    }

    report.pass = report.mismatches.length === 0 ? 'PASS' : 'FAIL';
  } catch (e) {
    report.pass = 'FAIL';
    report.errors.push(e instanceof Error ? e.message : String(e));
  } finally {
    await browser.close();
  }
}

await run();
await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
