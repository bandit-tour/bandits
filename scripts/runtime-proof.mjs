import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8081';
const outDir = path.resolve('artifacts/runtime-proof');

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}

async function run() {
  await fs.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console:${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror:${err.message}`);
  });

  // 1) Notifications open repeatedly
  for (let i = 1; i <= 5; i += 1) {
    await page.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(1500);
    await screenshot(page, `notifications-open-${i}.png`);
  }

  // 2) Attempt Local Friend thread open and send
  await page.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1200);
  const threadRows = page.locator('text=Local Friend').first();
  const hasLocalFriend = (await threadRows.count()) > 0;
  if (hasLocalFriend) {
    await threadRows.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await screenshot(page, 'local-friend-thread-open.png');
    const input = page.locator('textarea, input[placeholder*="Write a message"]').first();
    if ((await input.count()) > 0) {
      await input.fill('Runtime proof reply from automated test');
      const send = page.getByRole('button', { name: /send/i }).first();
      if ((await send.count()) > 0) await send.click().catch(() => {});
      await page.waitForTimeout(1500);
      await screenshot(page, 'local-friend-thread-send.png');
    }
  } else {
    await screenshot(page, 'local-friend-thread-not-found.png');
  }

  // 3) Profile upload attempt
  await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1000);
  await screenshot(page, 'profile-before-upload.png');
  const upload = page.getByText(/upload from library/i).first();
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 4000 }).catch(() => null);
  await upload.click().catch(() => {});
  const chooser = await chooserPromise;
  if (chooser) {
    // Use an existing image in repo
    await chooser.setFiles(path.resolve('assets/images/playstore.png'));
    await page.waitForTimeout(3000);
    await screenshot(page, 'profile-after-upload.png');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'profile-after-refresh.png');
  } else {
    await screenshot(page, 'profile-upload-control-not-found.png');
  }

  await fs.writeFile(
    path.join(outDir, 'runtime-proof-report.json'),
    JSON.stringify(
      {
        base,
        timestamp: new Date().toISOString(),
        hasLocalFriend,
        errors,
      },
      null,
      2,
    ),
  );

  await context.close();
  await browser.close();
  console.log(`Saved runtime proof to ${outDir}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

