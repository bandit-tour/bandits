/**
 * Browser reference capture for browser↔phone parity matrix.
 * Mobile viewport only — not desktop-responsive-as-phone.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.GUEST_BASE || "https://bandits-two.vercel.app";
const OUT = __dirname;

const ROUTES = [
  { id: "welcome", path: "/", wait: "networkidle" },
  { id: "home", path: "/home", wait: "domcontentloaded" },
  { id: "explore", path: "/explore", wait: "domcontentloaded" },
  { id: "bandits", path: "/bandits", wait: "domcontentloaded" },
  { id: "experiences", path: "/experiences", wait: "domcontentloaded" },
  { id: "smarttraveler", path: "/smarttraveler", wait: "domcontentloaded" },
  { id: "bottle", path: "/travelBottle", wait: "domcontentloaded" },
  { id: "shop", path: "/shop", wait: "domcontentloaded" },
  { id: "banditeam", path: "/alerts", wait: "domcontentloaded" },
  { id: "localFriend", path: "/localFriend", wait: "domcontentloaded" },
  { id: "chat", path: "/chat", wait: "domcontentloaded" },
  { id: "menu", path: "/menu", wait: "domcontentloaded" },
  { id: "profile", path: "/profile", wait: "domcontentloaded" },
  { id: "passport", path: "/impact", wait: "domcontentloaded" },
  { id: "bookings", path: "/bookings", wait: "domcontentloaded" },
  { id: "account", path: "/account", wait: "domcontentloaded" },
  { id: "payments", path: "/account/payments", wait: "domcontentloaded" },
  { id: "membership", path: "/account/membership", wait: "domcontentloaded" },
  { id: "support", path: "/account/technical-support", wait: "domcontentloaded" },
  { id: "faq", path: "/account/faq", wait: "domcontentloaded" },
  { id: "dreamDestinations", path: "/dreamDestinations", wait: "domcontentloaded" },
  { id: "cityMemory", path: "/cityMemory", wait: "domcontentloaded" },
  { id: "myMoment", path: "/myMoment", wait: "domcontentloaded" },
  {
    id: "octopus-premium",
    path: "/premium/d76cb120-018d-4a2e-8b5f-0578a71fd8f9",
    wait: "domcontentloaded",
  },
  { id: "bottleHotel-play", path: "/bottleHotel/play-theatrou", wait: "domcontentloaded" },
];

const CTA_SELECTORS = [
  "text=Local banDits",
  "text=Experiences",
  "text=SmartTraveler",
  "text=bandiTEAM",
  "text=banDiShop",
  "text=Home",
  "text=Explore",
  "text=Hotel",
  "text=Local Friend",
  "text=Chat",
  "text=More",
  "text=Travel in a Bottle",
  "text=Impact / Passport",
  "text=Payments",
  "text=Technical Support",
  "text=Your Local Insider",
  "text=Mix",
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  const results = [];

  for (const route of ROUTES) {
    const url = `${BASE}${route.path}`;
    const shot = path.join(OUT, `browser-${route.id}.png`);
    const row = {
      id: route.id,
      path: route.path,
      url,
      status: "FAIL",
      http: null,
      title: null,
      bodyTextSample: null,
      ctaHits: {},
      screenshot: path.basename(shot),
      error: null,
    };
    try {
      const resp = await page.goto(url, { waitUntil: route.wait, timeout: 60000 });
      row.http = resp?.status() ?? null;
      await page.waitForTimeout(1200);
      row.title = await page.title();
      const body = (await page.locator("body").innerText().catch(() => "")) || "";
      row.bodyTextSample = body.replace(/\s+/g, " ").trim().slice(0, 280);
      for (const sel of CTA_SELECTORS) {
        const label = sel.replace(/^text=/, "");
        row.ctaHits[label] = (await page.locator(sel).count()) > 0;
      }
      await page.screenshot({ path: shot, fullPage: false });
      row.status = row.http && row.http < 400 ? "CAPTURED" : "FAIL";
    } catch (e) {
      row.error = String(e?.message || e);
      try {
        await page.screenshot({ path: shot, fullPage: false });
      } catch {
        /* ignore */
      }
    }
    results.push(row);
    console.log(row.status, route.id, row.http || row.error);
  }

  const summary = {
    at: new Date().toISOString(),
    base: BASE,
    viewport: "390x844 mobile",
    note: "Browser reference capture only — native PASS requires installable EAS builds on device",
    results,
  };
  fs.writeFileSync(path.join(OUT, "browser-capture.json"), JSON.stringify(summary, null, 2));
  await browser.close();
  console.log("wrote", path.join(OUT, "browser-capture.json"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
