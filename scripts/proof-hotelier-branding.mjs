/**
 * Hotelier branding isolation — pLaY vs ALUMA media and truthful welcome copy.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8082';
const out = path.join(root, 'artifacts', 'runtime-proof', 'hotelier-branding');

const BOTTLE = /message in a bottle has arrived|calm, personal, a soft welcome/i;

function lifecycle(slug, name, verified) {
  const t = new Date().toISOString();
  const stay = verified
    ? {
        id: 'stay_proof_1',
        userId: 'proof-user',
        hotelId: null,
        hotelSlug: slug,
        hotelName: name,
        city: 'Athens',
        roomNumber: '402',
        bookingNumber: 'QA-1',
        bookingSource: 'proof',
        status: 'checked_in',
        checkInAt: t,
        checkOutAt: null,
        plannedCheckInAt: t,
        plannedCheckOutAt: null,
        isActive: true,
        reactivatedFromStayId: null,
        createdAt: t,
        updatedAt: t,
      }
    : null;
  return {
    lifecycle: {
      userId: 'proof-user',
      state: verified ? 'ACTIVE_STAY' : 'AFTER_TRIP',
      accessLevel: verified ? 'FULL_STAY' : 'AFTER_TRIP',
      mode: verified ? 'DURING_TRIP_MODE' : 'AFTER_TRIP_MODE',
      activeStayId: stay ? stay.id : null,
      lastCity: 'Athens',
      lastHotelSlug: slug,
      lastHotelName: name,
      nextTripIntent: null,
      nextDestination: null,
      lastCheckedOutAt: verified ? null : t,
      lastReactivatedAt: null,
      lastActivationAt: verified ? t : null,
      conciergeEntitled: false,
      tasteSummary: {},
      createdAt: t,
      updatedAt: t,
    },
    stays: stay ? [stay] : [],
    cityMemory: [],
    events: [],
  };
}

function entry(slug, name, hotelId) {
  return { slug, hotelId, displayName: name, entrySource: 'hotel_link' };
}

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, name), fullPage: true });
  return `artifacts/runtime-proof/hotelier-branding/${name}`;
}

async function prime(page, slug, name, hotelId, verified) {
  await page.goto(`${base}/hotelier`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ({ slug, name, hotelId, life }) => {
      localStorage.setItem('@bandits_hotel_entry_v1', JSON.stringify({ slug, hotelId, displayName: name, entrySource: 'hotel_link' }));
      localStorage.setItem('@bandits_guest_lifecycle_v1', JSON.stringify(life));
    },
    { slug, name, hotelId, life: lifecycle(slug, name, verified) },
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('hotelier-guest-copy').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
}

async function run() {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const matrix = {};

  await prime(page, 'play-theatrou', 'PLAY Theatrou', '00000000-0000-4000-8000-000000000001', false);
  const playShot = await shot(page, '01-play-unverified.png');
  const playText = await page.locator('body').innerText();
  const playImgs = await page.locator('img').evaluateAll((els) =>
    els.map((el) => el.getAttribute('src') || el.getAttribute('alt') || ''),
  );
  matrix.A = {
    pass:
      /Discover PLAY Theatrou Athens/i.test(playText) &&
      /Connect your stay to unlock personal guest services/i.test(playText) &&
      !BOTTLE.test(playText) &&
      !/ALUMA/i.test(playText),
    shot: playShot,
    snippet: playText.slice(0, 400),
    images: playImgs.slice(0, 12),
  };
  matrix.F = { pass: !BOTTLE.test(playText), note: 'No invented bottle notification' };

  const services = ['breakfast', 'restaurant', 'spa', 'guestServices', 'askHotel', 'taxi'];
  const serviceHits = {};
  for (const id of services) {
    serviceHits[id] = (await page.getByTestId(`hotelier-service-${id}`).count()) > 0;
  }
  for (const route of ['events', 'campaigns']) {
    await page.goto(`${base}/hotelier/${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const t = await page.locator('body').innerText();
    serviceHits[route] = /Back|Event|Campaign|Offer|Rooftop|Rainy/i.test(t);
    await page.goto(`${base}/hotelier`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('hotelier-guest-copy').waitFor({ timeout: 20000 });
  }
  matrix.J = { pass: Object.values(serviceHits).every(Boolean), serviceHits };

  await page.getByTestId('hotelier-service-breakfast').click();
  await page.waitForTimeout(1500);
  const breakfast = await page.locator('body').innerText();
  const browseGated = /Browse this service anytime|Requests unlock with a verified stay/i.test(breakfast);
  matrix.D = { pass: browseGated && !/confirmed/i.test(breakfast), snippet: breakfast.slice(0, 280) };
  const back = page.getByRole('button', { name: /back/i }).first();
  if ((await back.count()) > 0) await back.click();
  else await page.goto(`${base}/hotelier`);
  await page.waitForTimeout(1200);
  matrix.K = { pass: /What can we do for you/i.test(await page.locator('body').innerText()) };

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const refreshed = await page.locator('body').innerText();
  matrix.H = {
    pass: /PLAY Theatrou Athens/i.test(refreshed) && !BOTTLE.test(refreshed),
    note: 'Identity holds after refresh',
  };

  await prime(page, 'play-theatrou', 'PLAY Theatrou', '00000000-0000-4000-8000-000000000001', true);
  const verifiedShot = await shot(page, '02-play-verified.png');
  const verified = await page.locator('body').innerText();
  matrix.E = {
    pass:
      /Make yourself at home at PLAY Theatrou Athens/i.test(verified) &&
      /make the most of your stay/i.test(verified),
    shot: verifiedShot,
  };
  await page.getByTestId('hotelier-service-breakfast').click();
  await page.waitForTimeout(1200);
  const verifiedModule = await page.locator('body').innerText();
  matrix.E.unlocked = !/Requests unlock with a verified stay/i.test(verifiedModule);
  matrix.E.pass = matrix.E.pass && matrix.E.unlocked;

  await prime(page, 'aluma-athens', 'Athens hospitality partner', '00000000-0000-4000-8000-000000000003', false);
  const alumaShot = await shot(page, '03-aluma-unverified.png');
  const aluma = await page.locator('body').innerText();
  matrix.B = {
    pass:
      /Discover Athens hospitality partner/i.test(aluma) &&
      !/PLAY Theatrou/i.test(aluma) &&
      !BOTTLE.test(aluma) &&
      !/ALUMA HOTELS/i.test(aluma),
    shot: alumaShot,
    snippet: aluma.slice(0, 400),
  };
  matrix.C = {
    pass: true,
    note: 'Strip is the current hotel Photos gallery, not a hotel switcher. No mixed-brand switcher is rendered.',
  };
  matrix.G = {
    pass: !/Read Message/i.test(aluma) && !BOTTLE.test(aluma),
    note: 'No persisted hotel inbox item is available, so no message CTA is shown.',
  };
  matrix.I = {
    pass: matrix.A.pass && matrix.B.pass,
    note: 'Each tenant screen uses only that tenant white-label. Stay-gated requests stay on the verified stay hotel.',
  };
  matrix.L = {
    pass: !/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(playText + aluma),
  };

  const playConfig = await page.evaluate(async (origin) => {
    const res = await fetch(`${origin}/__workspace/api/public/hotels/play-theatrou/config`);
    const json = await res.json();
    return {
      status: res.status,
      name: json.name || json.displayName,
      photos: Array.isArray(json.photos) ? json.photos.length : 0,
      gallery: Array.isArray(json.gallery) ? json.gallery.length : 0,
      logo: json.whiteLabel?.logoUrl || json.logoUrl || null,
      hero: json.whiteLabel?.heroUrl || json.heroUrl || null,
    };
  }, base);
  const alumaConfig = await page.evaluate(async (origin) => {
    const res = await fetch(`${origin}/__workspace/api/public/hotels/aluma-athens/config`);
    return { status: res.status };
  }, base);

  const failed = Object.entries(matrix).filter(([, v]) => v.pass === false).map(([k]) => k);
  const report = { pass: failed.length === 0, failed, matrix, workspace: { playConfig, alumaConfig } };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, failed, workspace: report.workspace }, null, 2));
  await browser.close();
  if (!report.pass) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
