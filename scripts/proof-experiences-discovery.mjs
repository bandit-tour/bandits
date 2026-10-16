/**
 * Experiences discovery restore — browser QA.
 * Proves rich editorial gallery, filters, preview non-bookable, no empty technical screen.
 */
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
loadEnv({ path: path.join(root, '.env'), quiet: true });
loadEnv({ path: path.join(root, '.env.development.local'), override: true, quiet: true });

const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8082';
const out = path.join(root, 'artifacts', 'runtime-proof', 'experiences-discovery');

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, name), fullPage: true });
  return `artifacts/runtime-proof/experiences-discovery/${name}`;
}

async function run() {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(`${base}/experiences`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(3500);
  const afterShot = await shot(page, '01-experiences-tab.png');
  const body = await page.locator('body').innerText();

  const emptyBroken =
    /No published provider experiences yet/i.test(body) ||
    (/^0 experiences$/im.test(body) && !/preview/i.test(body));
  const hasInspiration = /Inspiration|Preview|Impossible to Google/i.test(body);
  const hasCards =
    (await page.locator('[testID^="exp-preview-card-"], [data-testid^="exp-preview-card-"]').count()) > 0 ||
    /Coming soon|Explore|Costume Warehouse|Market|Vinyl|Jazz/i.test(body);
  const noOrch = !/\smu[a-z0-9]{6,10}\b/i.test(body);

  const filters = ['Workshops', 'Nightlife', 'Art', 'Fashion', 'Queer', 'Food', 'Music'];
  const filterResults = {};
  for (const f of filters) {
    const chip = page.getByTestId(`exp-filter-${f}`);
    if ((await chip.count()) === 0) {
      filterResults[f] = { pass: false, reason: 'missing_chip' };
      continue;
    }
    await chip.click();
    await page.waitForTimeout(600);
    const t = await page.locator('body').innerText();
    const brokenEmpty = /No published provider/i.test(t);
    const hasContent =
      /preview|Coming soon|Explore|experience/i.test(t) &&
      !brokenEmpty &&
      !/Nothing in this category yet — try another filter\.\s*$/i.test(t.trim());
    // Allow category empty only if truly no editorial match — DNA covers all chips
    const nothingOnly = /Nothing in this category yet/i.test(t) && !/Coming soon|Preview/i.test(t);
    filterResults[f] = {
      pass: !brokenEmpty && !nothingOnly && (hasContent || /preview/i.test(t)),
      snippet: t.slice(0, 180),
    };
    await shot(page, `02-filter-${f.toLowerCase()}.png`);
  }

  await page.getByTestId('exp-filter-All').click();
  await page.waitForTimeout(500);

  // Open first preview card via text
  const openTarget = page.getByText(/Costume Warehouse|Raid a Costume|Shop the Market|Vinyl/i).first();
  let detailOk = false;
  let previewCta = false;
  let detailShot = null;
  let backOk = false;
  if ((await openTarget.count()) > 0) {
    await openTarget.click();
    await page.waitForTimeout(2200);
    detailShot = await shot(page, '03-preview-detail.png');
    const dBody = await page.locator('body').innerText();
    previewCta =
      /Coming soon|Inspiration only|not open to book|Preview/i.test(dBody) &&
      !(await page.getByTestId('exp-book-cta').count());
    detailOk = /Preview|Coming soon|Inspiration/i.test(dBody);
    const back = page.getByLabel(/Go back|Back/i).first();
    if ((await back.count()) > 0) {
      await back.click();
      await page.waitForTimeout(1500);
    } else {
      await page.goBack();
      await page.waitForTimeout(1500);
    }
    backOk = /Experiences|Impossible to Google/i.test(await page.locator('body').innerText());
    await shot(page, '04-after-back.png');
  }

  // Live inventory API honesty
  const liveRes = await page.evaluate(async () => {
    try {
      const r = await fetch('/__workspace/api/public/experiences', {
        headers: {
          Accept: 'application/json',
          'X-Guest-Email': 'guest@banditour.demo',
          'X-Guest-Bridge': 'banditour-guest-bridge-2026',
          'X-Guest-QA': '1',
        },
      });
      const j = await r.json();
      return { status: r.status, count: (j.experiences || []).length };
    } catch (e) {
      return { status: 0, error: String(e) };
    }
  });

  const filtersPass = Object.values(filterResults).every((v) => v.pass);
  const pass =
    !emptyBroken &&
    hasInspiration &&
    hasCards &&
    noOrch &&
    filtersPass &&
    detailOk &&
    previewCta &&
    backOk;

  const result = {
    pass,
    checks: {
      emptyBroken,
      hasInspiration,
      hasCards,
      noOrch,
      filtersPass,
      detailOk,
      previewCta,
      backOk,
    },
    filterResults,
    liveInventory: liveRes,
    provenance: {
      editorial: 'lib/guest-workspace/productWorlds.ts GUEST_EXPERIENCES (16 DNA seeds)',
      detail: 'lib/guest-workspace/experienceDetail.ts DETAIL_BY_ID',
      liveSoT: 'Workspace GET /api/public/experiences (currently empty in this env)',
    },
    shots: { afterShot, detailShot },
  };
  await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  if (!pass) process.exitCode = 1;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
