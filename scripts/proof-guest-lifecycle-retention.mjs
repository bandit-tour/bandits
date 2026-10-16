/**
 * Guest lifecycle retention — Between Trips, dream destinations, stay gating.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8082';
const out = path.join(root, 'artifacts', 'runtime-proof', 'guest-lifecycle-retention');
const LIFE = '@bandits_guest_lifecycle_v1';
const DREAM = '@bandits_dream_destinations_v1';

function afterTripBundle(userId) {
  const t = new Date().toISOString();
  return {
    lifecycle: {
      userId,
      state: 'AFTER_TRIP',
      accessLevel: 'AFTER_TRIP',
      mode: 'AFTER_TRIP_MODE',
      activeStayId: null,
      lastCity: 'Athens',
      lastHotelSlug: 'play-theatrou',
      lastHotelName: 'PLAY Theatrou',
      nextTripIntent: null,
      nextDestination: null,
      lastCheckedOutAt: t,
      lastReactivatedAt: null,
      lastActivationAt: null,
      conciergeEntitled: true,
      tasteSummary: {},
      createdAt: t,
      updatedAt: t,
    },
    stays: [
      {
        id: 'stay_past',
        userId,
        hotelId: null,
        hotelSlug: 'play-theatrou',
        hotelName: 'PLAY Theatrou',
        city: 'Athens',
        roomNumber: '402',
        bookingNumber: 'QA-PAST',
        bookingSource: 'proof',
        status: 'checked_out',
        checkInAt: t,
        checkOutAt: t,
        plannedCheckInAt: t,
        plannedCheckOutAt: null,
        isActive: false,
        reactivatedFromStayId: null,
        createdAt: t,
        updatedAt: t,
      },
    ],
    cityMemory: [],
    events: [],
  };
}

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, name), fullPage: false });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(`${base}/home?guestState=AFTER_TRIP`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2000);
  const userId = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('@bandits_guest_lifecycle_v1');
      if (raw) return JSON.parse(raw).lifecycle?.userId || 'guest';
    } catch {}
    return 'guest';
  });
  await page.evaluate(
    ({ key, bundle }) => localStorage.setItem(key, JSON.stringify(bundle)),
    { key: LIFE, bundle: afterTripBundle(userId) },
  );
  await page.evaluate((key) => localStorage.removeItem(key), DREAM);
  await page.goto(`${base}/home?guestState=AFTER_TRIP`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('home-between-trips-banner').waitFor({ timeout: 20000 });
  await shot(page, '01-between-trips-home.png');
  const between = await page.locator('body').innerText();

  await page.getByTestId('home-between-dream').click();
  await page.waitForTimeout(1500);
  await page.getByTestId('dream-suggest-Vietnam').click();
  await page.getByTestId('dream-save-cta').click();
  await page.getByTestId('dream-msg').waitFor({ timeout: 15000 });
  await shot(page, '02-vietnam-saved.png');
  const saved = await page.locator('body').innerText();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const afterReload = await page.locator('body').innerText();

  await page.goto(`${base}/home?guestState=AFTER_TRIP`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot(page, '03-home-vietnam-focus.png');
  const homeDream = await page.locator('body').innerText();

  await page.goto(`${base}/hotelier?guestState=AFTER_TRIP`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.getByTestId('hotelier-service-breakfast').click();
  await page.waitForTimeout(1200);
  const breakfast = await page.locator('body').innerText();

  await page.goto(`${base}/notifications`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const inbox = await page.locator('body').innerText();
  const notice = page.getByTestId(/lifecycle-notice-dream_saved_/);
  let deep = false;
  if ((await notice.count()) > 0) {
    await notice.first().click();
    await page.waitForTimeout(1200);
    deep = /dreamDestinations|Vietnam/i.test(page.url() + (await page.locator('body').innerText()));
  }

  await page.goto(`${base}/home?guestState=ACTIVE_STAY`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const duringBanner = await page.getByTestId('home-between-trips-banner').count();

  const checks = {
    betweenTripsOnHome: /Between trips|Keep discovering/i.test(between) && /City Memory|Connect stay/i.test(between),
    vietnamSaved: /Vietnam/i.test(saved) && /not invent|aspirational|bookings/i.test(saved),
    vietnamPersists: /Vietnam/i.test(afterReload),
    homeAdapts: /Dream focus: Vietnam|Dream destination|Vietnam/i.test(homeDream),
    stayGatedAfterCheckout: /Browse this service anytime|Requests unlock with a verified stay/i.test(breakfast),
    dreamNotice: /Dream destination saved|Vietnam/i.test(inbox) && deep,
    duringStayNoBetweenBanner: duringBanner === 0,
  };
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  const report = { pass: failed.length === 0, failed, checks };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.pass) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
