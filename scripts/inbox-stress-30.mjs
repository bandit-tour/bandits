import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8081';
const outDir = path.resolve('artifacts/runtime-proof/inbox-stress');
const storagePath = process.env.PLAYWRIGHT_STORAGE_STATE?.trim() || '';
const hasAuthStorage = Boolean(storagePath && fs.existsSync(storagePath));

function now() {
  return new Date().toISOString();
}

async function run() {
  await fsPromises.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
    ...(hasAuthStorage ? { storageState: storagePath } : {}),
  });
  const page = await context.newPage();
  const failures = [];
  const logs = [];

  page.on('console', (msg) => {
    const t = msg.type();
    if (t === 'error' || t === 'warning') logs.push(`[${now()}] ${t}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => logs.push(`[${now()}] pageerror: ${err.message}`));

  for (let i = 1; i <= 30; i += 1) {
    const cycleTag = `cycle-${String(i).padStart(2, '0')}`;
    try {
      await page.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForTimeout(900);

      const hasErrorBanner =
        (await page.getByText(/temporary network issue|inbox unavailable|taking longer/i).count()) > 0;
      const hasSpinner = (await page.locator('text=Loading').count()) > 0;

      if (hasErrorBanner || hasSpinner) {
        failures.push({ cycle: i, reason: `banner=${hasErrorBanner} spinner=${hasSpinner}` });
        await page.screenshot({ path: path.join(outDir, `${cycleTag}-inbox-warning.png`), fullPage: true });
      }

      await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForTimeout(350);
      await page.goto(`${base}/chat`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForTimeout(350);
      await page.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForTimeout(700);

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForTimeout(500);

      if (i % 5 === 0) {
        await context.setOffline(true);
        await page.waitForTimeout(350);
        await context.setOffline(false);
        await page.waitForTimeout(500);
      }
    } catch (e) {
      failures.push({ cycle: i, reason: e instanceof Error ? e.message : String(e) });
      await page.screenshot({ path: path.join(outDir, `${cycleTag}-exception.png`), fullPage: true });
    }
  }

  await page.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, 'final-inbox.png'), fullPage: true });

  const report = {
    timestamp: now(),
    base,
    cycles: 30,
    authenticatedStress: hasAuthStorage,
    storageStatePath: hasAuthStorage ? storagePath : null,
    failureCount: failures.length,
    failures,
    logs,
    verdict:
      !hasAuthStorage
        ? 'FAIL_NOT_AUTHENTICATED'
        : failures.length === 0
          ? 'PASS'
          : 'FAIL_CYCLES',
  };

  await fsPromises.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  await context.close();
  await browser.close();
  console.log(`Inbox stress report saved: ${path.join(outDir, 'report.json')}`);

  if (!hasAuthStorage) {
    console.error(
      'FAIL: Authenticated admin stress was not run. Set PLAYWRIGHT_STORAGE_STATE to a Playwright storageState JSON file from a logged-in admin browser session.',
    );
    process.exit(2);
  }
  if (failures.length) {
    console.error(`FAIL: ${failures.length} cycle(s) had inbox error/spinner. See report.json.`);
    process.exit(1);
  }
  console.log('PASS');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
