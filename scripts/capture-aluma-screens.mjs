import fs from 'node:fs/promises';

process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
const { chromium, devices } = await import('playwright');

const base = 'http://localhost:8081';
const outDir = 'artifacts/aluma';

const ALUMA_ENTRY_STORAGE = {
  slug: 'aluma-athens',
  hotelId: '00000000-0000-4000-8000-000000000003',
  displayName: 'Athens hospitality partner',
  entrySource: 'guest_universal',
};

async function captureSet(context, suffix) {
  const page = await context.newPage();
  await page.route('**/*', (route) => {
    if (route.request().resourceType() === 'font') {
      void route.abort();
      return;
    }
    void route.continue();
  });
  await page.addInitScript((payload) => {
    try {
      localStorage.setItem('@bandits_hotel_entry_v1', JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, ALUMA_ENTRY_STORAGE);

  await page.goto(`${base}/hotel/aluma-athens`, { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${outDir}/entry-${suffix}.png`, fullPage: false, timeout: 120_000 });

  await page.goto(`${base}/hotel/aluma-athens/flip`, { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${outDir}/signal-${suffix}.png`, fullPage: false, timeout: 120_000 });

  const reveal = page.getByRole('button', { name: /reveal sender/i });
  if (await reveal.count()) {
    await reveal.first().click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${outDir}/gift-sender-${suffix}.png`, fullPage: false, timeout: 120_000 });
  }

  await page.goto(`${base}/profile`, { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${outDir}/profile-${suffix}.png`, fullPage: false, timeout: 120_000 });

  await page.goto(`${base}/hotelier`, { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${outDir}/hotelier-${suffix}.png`, fullPage: false, timeout: 120_000 });

  await page.close();
}

await fs.mkdir(outDir, { recursive: true });

const desktopBrowser = await chromium.launch({ headless: true });
const desktopContext = await desktopBrowser.newContext({ viewport: { width: 1440, height: 900 } });
await captureSet(desktopContext, 'web');
await desktopContext.close();
await desktopBrowser.close();

const mobileBrowser = await chromium.launch({ headless: true });
const mobileContext = await mobileBrowser.newContext(devices['iPhone 13']);
await captureSet(mobileContext, 'mobile');
await mobileContext.close();
await mobileBrowser.close();

console.log(`Saved screenshots to ${outDir}`);
