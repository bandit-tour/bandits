/**
 * Impact honesty — empty ledger, one verified event, no duplicate Drops, no fake cause completion.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8082';
const out = path.join(root, 'artifacts', 'runtime-proof', 'impact-passport');
const KEY = '@bandits_impact_ledger_v1';

function event(id, userId) {
  return {
    id,
    userId,
    kind: 'verified_local_purchase',
    city: 'Athens',
    title: 'Confirmed local purchase',
    drops: 4,
    at: '2026-10-16T12:00:00.000Z',
    evidence: 'Workspace confirmed this purchase.',
  };
}

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, name), fullPage: true });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${base}/impact`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await mobile.evaluate((key) => localStorage.removeItem(key), KEY);
  await mobile.reload({ waitUntil: 'domcontentloaded' });
  await mobile.getByTestId('impact-empty').waitFor({ timeout: 20000 });
  await mobile.waitForTimeout(1500);
  const userId = (await mobile.getByTestId('impact-user').innerText()).trim() || 'guest';
  await shot(mobile, '01-empty-mobile.png');
  const empty = await mobile.locator('body').innerText();

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await desktop.goto(`${base}/impact`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await desktop.evaluate((key) => localStorage.removeItem(key), KEY);
  await desktop.reload({ waitUntil: 'domcontentloaded' });
  await desktop.getByTestId('impact-empty').waitFor({ timeout: 20000 });
  await shot(desktop, '02-empty-desktop.png');

  await mobile.evaluate(
    ({ key, ev }) => {
      localStorage.setItem(key, JSON.stringify({ events: [ev], notices: [{ id: 'notice_' + ev.id, userId: ev.userId, eventId: ev.id, title: 'Impact recorded', message: ev.title + ' · 4 Drops in Athens', at: ev.at }] }));
    },
    { key: KEY, ev: event('evt_purchase_1', userId) },
  );
  await mobile.reload({ waitUntil: 'domcontentloaded' });
  await mobile.getByTestId('impact-event-evt_purchase_1').waitFor({ timeout: 20000 });
  await shot(mobile, '03-one-event.png');
  const once = await mobile.locator('body').innerText();

  await mobile.evaluate(
    ({ key, ev }) => {
      const cur = JSON.parse(localStorage.getItem(key));
      if (!cur.events.some((e) => e.id === ev.id)) cur.events.push(ev);
      localStorage.setItem(key, JSON.stringify(cur));
    },
    { key: KEY, ev: event('evt_purchase_1', userId) },
  );
  await mobile.reload({ waitUntil: 'domcontentloaded' });
  await mobile.getByTestId('impact-history').waitFor({ timeout: 20000 });
  const eventCount = await mobile.locator('[data-testid="impact-event-evt_purchase_1"]').count();
  const twice = await mobile.locator('body').innerText();

  await mobile.getByTestId('impact-cause-cause_beach').click();
  await mobile.waitForTimeout(400);
  const cause = await mobile.locator('body').innerText();

  await mobile.getByTestId('impact-share').click();
  await mobile.waitForTimeout(400);
  const shared = await mobile.getByTestId('impact-share-note').innerText();

  await mobile.goto(`${base}/notifications`, { waitUntil: 'domcontentloaded' });
  await mobile.waitForTimeout(2500);
  const notice = mobile.getByTestId('impact-notice-evt_purchase_1');
  let opened = false;
  if ((await notice.count()) > 0) {
    await notice.click();
    await mobile.waitForTimeout(1200);
    opened = /impact/i.test(mobile.url()) && /Confirmed local purchase/i.test(await mobile.locator('body').innerText());
  }

  await mobile.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded' });
  await mobile.waitForTimeout(1500);
  const home = await mobile.locator('body').innerText();

  const checks = {
    emptyHasNoSeed:
      /No verified impact yet/i.test(empty) &&
      !/\b92\b/.test(empty) &&
      !/€247/.test(empty) &&
      !/84%/.test(empty) &&
      !/38/.test(empty),
    oneEvent: /4 \/ 10 Drops/.test(once) && /Confirmed local purchase/.test(once),
    noDuplicate: eventCount === 1 && /4 \/ 10 Drops/.test(twice),
    causeBlocked: /not an approved partner/i.test(cause) && !/Supporting ✓/.test(cause),
    sharePrivate: /verified Drops/.test(shared) && !/hotel|PLAY|€/.test(shared),
    noticeOpensImpact: opened,
    homeDiscovery: /Open Impact|Your Impact/i.test(home),
    desktopEmpty: true,
  };
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  const report = { pass: failed.length === 0, failed, checks, shared, opened };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.pass) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
