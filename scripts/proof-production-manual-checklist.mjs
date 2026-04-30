import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const PROD = 'https://bandits-two.vercel.app';
const outDir = path.join(root, 'artifacts', 'runtime-proof', `prod-manual-checklist-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const result = {
  productionUrl: PROD,
  checklist: {
    entryFullIntroFirst: false,
    entryRoutesToHomeAfterContinue: false,
    homeHasBanditsBanner: false,
    homeHasHero: false,
    alertsBottomTabVisible: false,
    alertsBottomTabNavigates: false,
    bottomTabsNavigateCore: false,
    noRuntimePageError: false,
  },
  urls: {},
  screenshots: {},
  pageErrors: [],
  consoleErrorsSample: [],
  notes: [],
};

await mkdir(outDir, { recursive: true });
const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1365, height: 920 } });
const page = await context.newPage();

page.on('pageerror', (e) => result.pageErrors.push(String(e.message || e)));
page.on('console', (m) => {
  if (m.type() === 'error' && result.consoleErrorsSample.length < 25) {
    result.consoleErrorsSample.push(String(m.text()));
  }
});

try {
  // Fresh first-time style check.
  await context.clearCookies();
  await page.goto(`${PROD}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2600);

  result.screenshots.introFirstLoad = path.join(outDir, '1-intro-first-load.png');
  await page.screenshot({ path: result.screenshots.introFirstLoad, fullPage: true });

  const introBody = ((await page.textContent('body')) || '').toLowerCase();
  const introFull = (await page.getByTestId('play-theatrou-full-intro').count()) > 0;
  result.checklist.entryFullIntroFirst = introFull && introBody.includes('message in a bottle');

  const openBtn = page.getByRole('button', { name: /open your message/i });
  if ((await openBtn.count()) > 0) {
    await openBtn.first().click({ timeout: 15000 });
    await wait(6000);
  } else {
    result.notes.push('Open your message CTA not found during run.');
  }

  result.urls.afterIntroContinue = page.url();
  result.screenshots.afterIntroContinue = path.join(outDir, '2-after-intro-continue.png');
  await page.screenshot({ path: result.screenshots.afterIntroContinue, fullPage: true });
  result.checklist.entryRoutesToHomeAfterContinue = page.url().includes('/bandits');

  // Home hero / banner
  await page.goto(`${PROD}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(3500);
  result.urls.bandits = page.url();
  result.screenshots.banditsHome = path.join(outDir, '3-bandits-home.png');
  await page.screenshot({ path: result.screenshots.banditsHome, fullPage: true });
  result.checklist.homeHasHero = (await page.getByTestId('bandits-home-hero').count()) > 0;
  result.checklist.homeHasBanditsBanner = (await page.getByTestId('bandits-bandits-banner').count()) > 0;

  // Bottom tabs and alerts
  result.checklist.alertsBottomTabVisible = (await page.getByText('Alerts', { exact: true }).count()) > 0;
  if (result.checklist.alertsBottomTabVisible) {
    await page.getByText('Alerts', { exact: true }).first().click();
    await wait(3000);
    result.urls.alerts = page.url();
    result.screenshots.alertsTab = path.join(outDir, '4-alerts-tab.png');
    await page.screenshot({ path: result.screenshots.alertsTab, fullPage: true });
    result.checklist.alertsBottomTabNavigates = page.url().includes('/alerts') || page.url().includes('/scam-alerts');
  }

  // Core tab nav smoke: Home -> Chat -> Menu -> Home
  const clickLabel = async (label) => {
    const loc = page.getByText(label, { exact: true });
    if ((await loc.count()) > 0) {
      await loc.first().click();
      await wait(2200);
      return true;
    }
    return false;
  };

  const chatOk = (await clickLabel('Chat')) && page.url().includes('/chat');
  result.screenshots.chatTab = path.join(outDir, '5-chat-tab.png');
  await page.screenshot({ path: result.screenshots.chatTab, fullPage: true });

  const menuOk = (await clickLabel('Menu')) && page.url().includes('/menu');
  result.screenshots.menuTab = path.join(outDir, '6-menu-tab.png');
  await page.screenshot({ path: result.screenshots.menuTab, fullPage: true });

  const homeOk = (await clickLabel('Home')) && page.url().includes('/bandits');
  result.screenshots.homeReturn = path.join(outDir, '7-home-return.png');
  await page.screenshot({ path: result.screenshots.homeReturn, fullPage: true });

  result.checklist.bottomTabsNavigateCore = chatOk && menuOk && homeOk;
  result.checklist.noRuntimePageError = result.pageErrors.length === 0;

  await writeFile(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
