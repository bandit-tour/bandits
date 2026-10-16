/**
 * Lifecycle promotion — banners follow stay phase; discovery screens lead with their own content.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.RUNTIME_BASE_URL || "http://localhost:8082";
const out = path.join(root, "artifacts", "runtime-proof", "lifecycle-promotion");

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, name), fullPage: false });
}

function blocked(text) {
  return /Keep discovering|BETWEEN TRIPS —|Start City Memory|Where next\?/.test(text);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const report = { checks: {} };

  await page.addInitScript(() => {
    localStorage.removeItem("@bandits_discovery_prompts_v1");
  });

  const open = async (pathName) => {
    await page.goto(`${base}${pathName}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(1800);
  };

  await open("/home?guestState=ACTIVE_STAY");
  let body = await page.locator("body").innerText();
  report.checks.activeNoBetween = !/Between trips/.test(body) && !blocked(body);
  report.checks.activeDuring = /during stay/i.test(body);
  await shot(page, "B-active-stay-home.png");

  await open("/home?guestState=PRE_TRIP");
  body = await page.locator("body").innerText();
  report.checks.beforeNoEndOfTrip = !/Between trips/.test(body) && !/Keep discovering/.test(body);
  report.checks.beforeArrival = /Before arrival|Welcome/.test(body);
  await shot(page, "A-before-stay-home.png");

  await open("/home?guestState=NEAR_CHECKOUT");
  await page.getByTestId("home-near-checkout-prompt").waitFor({ timeout: 20000 });
  body = await page.locator("body").innerText();
  report.checks.nearPrompt = /memories are yours to keep/i.test(body);
  report.checks.nearNoBetweenModule = (await page.getByTestId("home-between-trips-banner").count()) === 0;
  await page.getByText("Not now").click();
  await page.waitForTimeout(400);
  report.checks.nearDismissed = (await page.getByTestId("home-near-checkout-prompt").count()) === 0;
  await shot(page, "C-near-checkout-home.png");

  await open("/notifications");
  await page.waitForTimeout(2000);
  const nearNotice = page.getByText(/memories are yours to keep/i).first();
  report.checks.nearNotice = (await nearNotice.count()) > 0;
  if (report.checks.nearNotice) {
    await nearNotice.click();
    await page.waitForTimeout(1500);
    report.checks.nearDeepLink = page.url().includes("cityMemory");
  }
  await shot(page, "H-near-checkout-notice.png");

  await open("/home?guestState=AFTER_TRIP");
  await page.getByTestId("home-between-trips-banner").waitFor({ timeout: 20000 });
  body = await page.locator("body").innerText();
  report.checks.afterCompact = /Between trips/.test(body) && !/Keep discovering/.test(body);
  report.checks.afterLinks =
    (await page.getByTestId("home-between-city-memory").count()) === 1 &&
    (await page.getByTestId("home-between-dream").count()) === 1;
  await shot(page, "D-after-checkout-home.png");

  await open("/home?guestState=UNKNOWN");
  body = await page.locator("body").innerText();
  report.checks.unknownNeutral = !/Between trips/.test(body) && !/Keep discovering/.test(body);
  report.checks.unknownDiscover = /discover/i.test(body);
  await shot(page, "E-unknown-home.png");

  await open("/home?guestState=NEXT_TRIP_PLANNING");
  await page.getByTestId("home-between-trips-banner").waitFor({ timeout: 20000 });
  body = await page.locator("body").innerText();
  report.checks.returnCompact = /Between trips/.test(body) && !/Keep discovering/.test(body);
  await shot(page, "F-between-trips-home.png");

  await open("/notifications");
  await page.waitForTimeout(2000);
  const nextNotice = page.getByText(/Where would you love to go next/i).first();
  report.checks.betweenNotice = (await nextNotice.count()) > 0;
  if (report.checks.betweenNotice) {
    await nextNotice.click();
    await page.waitForTimeout(1500);
    report.checks.betweenDeepLink = page.url().includes("dreamDestinations");
  }
  await open("/home?guestState=AFTER_TRIP");
  await page.waitForTimeout(2200);
  await open("/notifications");
  await page.waitForTimeout(2000);
  report.checks.afterNotice = (await page.getByText(/journey doesn't end here/i).count()) > 0;
  if (report.checks.afterNotice) {
    await page.getByText(/journey doesn't end here/i).first().click();
    await page.waitForTimeout(1500);
    report.checks.afterDeepLink = page.url().includes("cityMemory");
  }
  await shot(page, "H-after-notice.png");

  await open("/bandits?guestState=AFTER_TRIP");
  body = await page.locator("body").innerText();
  report.checks.banditsLead = !blocked(body) && !/Between trips/.test(body.split("\n").slice(0, 8).join("\n"));
  await shot(page, "G-bandits.png");

  await open("/experiences?guestState=AFTER_TRIP");
  body = await page.locator("body").innerText();
  report.checks.experiencesLead = /Experiences/.test(body) && !blocked(body);
  await shot(page, "G-experiences.png");

  await open("/smarttraveler?guestState=AFTER_TRIP");
  body = await page.locator("body").innerText();
  report.checks.smartLead = /Local Finds|SmartTraveler/.test(body) && !blocked(body);
  await shot(page, "G-smarttraveler.png");

  await open("/cityMemory");
  report.checks.cityMemoryRoute = /City Memory/.test(await page.locator("body").innerText());
  await shot(page, "I-city-memory.png");

  report.pass = Object.values(report.checks).every(Boolean);
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.pass) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
