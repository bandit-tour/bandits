/**
 * P0 owner live screen review — Experiences, SmartTraveler, Travel in a Bottle evidence.
 * RUNTIME_BASE_URL defaults to production Guest (bandits-two).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const base = process.env.RUNTIME_BASE_URL || "https://bandits-two.vercel.app";
const ws = process.env.WORKSPACE_ORIGIN || "https://banditour-workspace.vercel.app";
const outRoot = path.join(root, "artifacts", "runtime-proof", "owner-live-regressions");
const expOut = path.join(outRoot, "experiences");
const stOut = path.join(outRoot, "smarttraveler");
const bottleOut = path.join(outRoot, "bottle");

async function shot(page, dir, name) {
  await fs.mkdir(dir, { recursive: true });
  const rel = path.join("artifacts", "runtime-proof", "owner-live-regressions", path.basename(dir), name);
  await page.screenshot({ path: path.join(root, rel), fullPage: true });
  return rel;
}

async function run() {
  await fs.mkdir(outRoot, { recursive: true });
  const report = {
    at: new Date().toISOString(),
    guest: base,
    workspace: ws,
    experiences: {},
    smarttraveler: {},
    bottle: {},
  };

  const wsExp = await fetch(`${ws}/api/public/experiences`).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  report.experiences.workspace = wsExp;

  const wsSt = await fetch(`${ws}/api/public/smarttraveler?city=Athens`).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  report.smarttraveler.workspacePublic = wsSt;

  const browser = await chromium.launch({ headless: true });

  for (const vp of [
    { tag: "mobile", width: 390, height: 844 },
    { tag: "desktop", width: 1280, height: 900 },
  ]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

    await page.goto(`${base}/experiences`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(5000);
    report.experiences[`listing_${vp.tag}`] = await shot(page, expOut, `listing-${vp.tag}.png`);
    const body = await page.locator("body").innerText();
    report.experiences[`hasLive_${vp.tag}`] = /live experience/i.test(body);
    report.experiences[`hasInspiration_${vp.tag}`] = /Inspiration|preview/i.test(body);

    const filters = ["All", "Workshops", "Nightlife", "Art", "Fashion", "Queer", "Food", "Music"];
    for (const f of filters) {
      const chip = page.getByTestId(`exp-filter-${f}`);
      if ((await chip.count()) === 0) continue;
      await chip.click();
      await page.waitForTimeout(500);
      await shot(page, expOut, `filter-${f.toLowerCase()}-${vp.tag}.png`);
    }

    await page.goto(`${base}/smarttraveler`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(4000);
    report.smarttraveler[`tab_${vp.tag}`] = await shot(page, stOut, `tab-${vp.tag}.png`);
    const stBody = await page.locator("body").innerText();
    report.smarttraveler[`editorialMode_${vp.tag}`] = /Editorial Local Finds/i.test(stBody);
    report.smarttraveler[`livePartners_${vp.tag}`] = /Partner|Hotel Guest Special/i.test(stBody);

    await page.goto(`${base}/travelBottle`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(3500);
    report.bottle[`plan_${vp.tag}`] = await shot(page, bottleOut, `plan-${vp.tag}.png`);

    for (const slug of ["play-theatrou", "nyx-athens", "aluma-athens"]) {
      await page.goto(`${base}/bottleHotel/${slug}`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(2500);
      report.bottle[`hotel_${slug}_${vp.tag}`] = await shot(page, bottleOut, `hotel-${slug}-${vp.tag}.png`);
    }

    await page.close();
  }

  await browser.close();

  await fs.writeFile(path.join(outRoot, "REPORT.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
