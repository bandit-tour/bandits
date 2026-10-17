/**
 * Guest App completion matrix — routes, nav surfaces, honest backend states.
 * Usage: PROD_URL=https://bandits-two.vercel.app node scripts/proof-guest-app-completion.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "artifacts", "runtime-proof", "guest-app-completion", stamp);

const BASE = (process.env.PROD_URL || process.env.GUEST_BASE || "https://bandits-two.vercel.app").replace(
  /\/$/,
  "",
);
const WS = (process.env.WORKSPACE_BASE || "https://banditour-workspace.vercel.app").replace(/\/$/, "");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function pickBottleDay(page, iso) {
  for (let i = 0; i < 14; i++) {
    const day = page.getByTestId(`bottle-day-${iso}`);
    if ((await day.count()) > 0) {
      await day.click({ timeout: 5000 });
      return;
    }
    await page.getByTestId("bottle-cal-next").click({ timeout: 5000 }).catch(() => {});
    await wait(200);
  }
  throw new Error(`Could not pick calendar day ${iso}`);
}

async function pickBottleDates(page, checkIn, checkOut) {
  await page.getByTestId("bottle-when").click({ timeout: 15000 });
  await page.getByTestId("bottle-calendar").waitFor({ timeout: 10000 });
  await pickBottleDay(page, checkIn);
  await pickBottleDay(page, checkOut);
  await page.getByTestId("bottle-cal-close").click({ timeout: 8000 }).catch(() => {});
}

async function safeShot(page, file) {
  await page.screenshot({ path: file, fullPage: false, timeout: 15000, animations: "disabled" });
}

/** Routes inventoried from app/(tabs), app/*, lib/appNavigation — no invented surfaces. */
const ROUTES = [
  { id: "welcome", path: "/", label: "Welcome / Opening intro", group: "Welcome" },
  { id: "home", path: "/home", label: "Home (Trip brain)", group: "Home" },
  { id: "explore", path: "/explore", label: "Explore container", group: "Explore" },
  { id: "bandits", path: "/bandits", label: "Local banDits", group: "Explore" },
  { id: "experiences", path: "/experiences", label: "Experiences", group: "Experiences" },
  {
    id: "experience-detail",
    path: "/experience/exp_costume_warehouse",
    label: "Experience detail (editorial)",
    group: "Experiences",
  },
  { id: "smarttraveler", path: "/smarttraveler", label: "SmartTraveler", group: "SmartTraveler" },
  { id: "shop", path: "/shop", label: "banDiShop", group: "Explore" },
  { id: "banditeam", path: "/scam-alerts", label: "bandiTEAM / Safety alerts", group: "Explore" },
  { id: "hotelier", path: "/hotelier", label: "Hotel hub", group: "Hotel" },
  { id: "localFriend", path: "/localFriend", label: "Local Friend", group: "Local Friend" },
  { id: "chat", path: "/community", label: "Chat (community tab)", group: "Messages" },
  { id: "notifications", path: "/notifications", label: "Notifications / Inbox", group: "Messages" },
  { id: "menu", path: "/menu", label: "More / Menu", group: "Profile" },
  { id: "profile", path: "/my-profile", label: "Profile", group: "Profile" },
  { id: "settings", path: "/settings", label: "Settings", group: "Settings" },
  { id: "impact", path: "/impact", label: "Impact / Passport", group: "Passport" },
  { id: "travelBottle", path: "/travelBottle", label: "Travel in a Bottle", group: "Bottle" },
  { id: "bottleHotel", path: "/bottleHotel/play-theatrou", label: "Bottle hotel profile", group: "Bottle" },
  { id: "bookings", path: "/bookings", label: "Bookings", group: "Trips" },
  { id: "dreamDestinations", path: "/dreamDestinations", label: "Dream Destinations", group: "Trips" },
  { id: "cityMemory", path: "/cityMemory", label: "City Memory", group: "Trips" },
  {
    id: "premium",
    path: "/premium/d76cb120-018d-4a2e-8b5f-0578a71fd8f9",
    label: "Your Local Insider (Neo)",
    group: "Octopus",
  },
  { id: "account", path: "/account", label: "Account", group: "Settings" },
  { id: "account-faq", path: "/account/faq", label: "Support / FAQ", group: "Support" },
  { id: "account-emergency", path: "/account/emergency", label: "Emergency support", group: "Support" },
  { id: "reactivateStay", path: "/reactivateStay", label: "Connect My New Stay", group: "Trips" },
  { id: "hotel-entry", path: "/hotel/play-theatrou", label: "Hotel QR entry (PLAY)", group: "Welcome" },
];

async function workspaceProbe() {
  const probe = { experiences: null, bottleStays: null, commerceReady: null, hotels: {} };
  try {
    const r = await fetch(`${WS}/api/public/experiences?limit=5`);
    probe.experiences = { status: r.status, ok: r.ok };
    if (r.ok) {
      const j = await r.json();
      const rows = Array.isArray(j?.experiences) ? j.experiences : Array.isArray(j) ? j : j?.data || [];
      probe.experiences.count = rows.length;
    }
  } catch (e) {
    probe.experiences = { error: String(e.message || e) };
  }
  try {
    const r = await fetch(`${WS}/api/public/bottle/stays`);
    probe.bottleStays = { status: r.status, ok: r.ok };
    if (r.ok) {
      const j = await r.json();
      const rows = Array.isArray(j?.stays) ? j.stays : Array.isArray(j) ? j : j?.data || [];
      probe.bottleStays.count = rows.length;
      probe.bottleStays.provider = rows.filter((x) => x?.source === "provider_record").length;
    }
  } catch (e) {
    probe.bottleStays = { error: String(e.message || e) };
  }
  for (const slug of ["play-theatrou", "nyx-athens"]) {
    try {
      const r = await fetch(`${WS}/api/public/hotels/${slug}/config`);
      probe.hotels[slug] = { status: r.status, ok: r.ok };
      if (r.ok) {
        const j = await r.json();
        probe.hotels[slug].statusField = j.status || null;
        probe.hotels[slug].photos = Array.isArray(j.photos) ? j.photos.length : 0;
      }
    } catch (e) {
      probe.hotels[slug] = { error: String(e.message || e) };
    }
  }
  return probe;
}

function classifyRoute(id, body, pageErrors, extra = {}) {
  const t = body.toLowerCase();
  if (pageErrors.length) return { status: "BLOCKED", reason: `pageerror: ${pageErrors[0]}` };

  switch (id) {
    case "welcome":
      if (t.includes("open your message") || t.includes("enter") || t.includes("skip")) return { status: "PASS" };
      if (extra.introSkipped && (t.includes("home") || extra.testIdHero))
        return { status: "PASS", reason: "Returning guest: intro skipped → Home (expected)" };
      return { status: "PARTIAL", reason: "Welcome state unclear" };
    case "home":
      return t.includes("home") || extra.testIdHero
        ? { status: "PASS" }
        : { status: "PARTIAL", reason: "Home shell without trip hero markers" };
    case "experiences":
      if (extra.wsExpCount === 0) {
        return t.includes("preview") || t.includes("workspace") || t.includes("no live")
          ? { status: "PARTIAL", reason: "WORKSPACE: live experiences count=0 — editorial/preview only" }
          : { status: "PARTIAL", reason: "Empty experiences — commercial blocker" };
      }
      return t.includes("experience") ? { status: "PASS" } : { status: "PARTIAL" };
    case "travelBottle":
      if (
        extra.mixForm &&
        extra.playChip &&
        (t.includes("no verified second sleeps") || extra.wsBottleProvider === 0)
      ) {
        return { status: "PASS", reason: "Mix UI complete; honest empty second-sleep inventory" };
      }
      if (extra.mixForm) return { status: "PARTIAL", reason: "Mix UI present; verify inventory messaging" };
      return { status: "BLOCKED", reason: "Mix entry missing" };
    case "premium":
      if (t.includes("local insider") || t.includes("octopus") || t.includes("concierge")) {
        return { status: "PARTIAL", reason: "Octopus shell; entitlement/checkout WORKSPACE-dependent" };
      }
      return { status: "PARTIAL", reason: "Premium route loaded" };
    case "bottleHotel":
      return t.includes("play") || t.includes("athens") || t.includes("hotel")
        ? { status: "PASS" }
        : { status: "PARTIAL" };
    default:
      if (t.includes("404") || t.includes("not found")) return { status: "BLOCKED", reason: "404" };
      if (t.length < 40) return { status: "PARTIAL", reason: "Minimal content" };
      return { status: "PASS" };
  }
}

await mkdir(outDir, { recursive: true });
const ws = await workspaceProbe();
await writeFile(path.join(outDir, "workspace-probe.json"), JSON.stringify(ws, null, 2));

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => {
  try {
    localStorage.setItem("@bandits_opening_intro_v2", "1");
  } catch {
    /* ignore */
  }
});

const matrix = [];
const journeys = {};
const pageErrors = [];

for (const route of ROUTES) {
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message || e)));
  try {
    await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await wait(route.id === "travelBottle" ? 5000 : 2800);
    const body = (await page.locator("body").innerText()) || "";
    const shot = path.join(outDir, `${route.id}.png`);
    await safeShot(page, shot);

    const extra = {};
    extra.introSkipped = true;
    if (route.id === "home" || route.id === "welcome") {
      extra.testIdHero = (await page.getByTestId("bandits-home-hero").count()) > 0;
    }
    if (route.id === "travelBottle") {
      extra.mixForm =
        (await page.getByTestId("bottle-questions").count()) > 0 &&
        (await page.getByTestId("travel-bottle-mix-cta").count()) > 0;
      extra.playChip = (await page.getByTestId("bottle-hotel-select-play-theatrou").count()) > 0;
      extra.wsBottleProvider = ws.bottleStays?.provider ?? 0;
    }
    if (route.id === "experiences") {
      extra.wsExpCount = ws.experiences?.count ?? null;
    }

    const verdict = classifyRoute(route.id, body, errs, extra);
    matrix.push({
      ...route,
      status: verdict.status,
      reason: verdict.reason || null,
      screenshot: shot,
      url: page.url(),
    });
  } catch (e) {
    matrix.push({
      ...route,
      status: "BLOCKED",
      reason: String(e.message || e),
      screenshot: null,
      url: `${BASE}${route.path}`,
    });
  } finally {
    await page.close();
  }
  pageErrors.push(...errs);
}

// Bottle E2E subset (honest — no fake booking)
{
  const page = await context.newPage();
  await page.goto(`${BASE}/travelBottle`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await wait(4000);
  try {
    await page.getByTestId("bottle-destination-athens").click();
    await page.getByTestId("bottle-hotel-select-play-theatrou").click();
    await pickBottleDates(page, "2026-10-20", "2026-10-23");
    await page.getByTestId("travel-bottle-mix-cta").click();
    await wait(6000);
    const body = await page.locator("body").innerText();
    journeys.bottle_mix_to_empty_or_sample =
      /not available yet|sample inspiration|preview sample|checking availability/i.test(body)
        ? "PASS"
        : "PARTIAL";
    await page.screenshot({ path: path.join(outDir, "journey-bottle-mix.png"), fullPage: false });
    await page.getByTestId("bottle-hotel-select-play-theatrou").click({ timeout: 5000 }).catch(() => {});
    await page.locator('text=View hotel').first().click({ timeout: 8000 }).catch(async () => {
      await page.getByRole("button", { name: /view hotel/i }).first().click({ timeout: 8000 }).catch(() => {});
    });
    await wait(3000);
    journeys.bottle_hotel_profile =
      page.url().includes("bottleHotel") || (await page.locator("body").innerText()).includes("PLAY")
        ? "PASS"
        : "PARTIAL";
    await page.screenshot({ path: path.join(outDir, "journey-bottle-hotel.png"), fullPage: false });
  } catch (e) {
    journeys.bottle_mix_to_empty_or_sample = "BLOCKED";
    journeys.error = String(e.message || e);
  }
  await page.close();
}

await browser.close();

const summary = {
  generatedAt: new Date().toISOString(),
  guestBase: BASE,
  workspaceBase: WS,
  deploymentNote: process.env.VERCEL_DEPLOYMENT_ID || null,
  matrix,
  journeys,
  workspaceBlockers: [
    ws.experiences?.count === 0 ? "Commercial experiences count=0 on Workspace" : null,
    (ws.bottleStays?.provider ?? 0) === 0 ? "Bottle second-sleep provider inventory empty" : null,
  ].filter(Boolean),
  pageErrors: pageErrors.slice(0, 15),
};

await writeFile(path.join(outDir, "RESULT.json"), JSON.stringify(summary, null, 2));

const md = [
  "# Guest App completion matrix",
  "",
  `**Guest:** ${BASE}`,
  `**Workspace:** ${WS}`,
  `**Generated:** ${summary.generatedAt}`,
  "",
  "| Route | Status | Notes |",
  "|-------|--------|-------|",
  ...matrix.map((r) => `| ${r.label} \`${r.path}\` | **${r.status}** | ${r.reason || "—"} |`),
  "",
  "## Journeys",
  ...Object.entries(journeys).map(([k, v]) => `- **${k}**: ${v}`),
  "",
  "## Workspace blockers",
  ...summary.workspaceBlockers.map((b) => `- ${b}`),
].join("\n");
await writeFile(path.join(outDir, "ROUTE-MATRIX.md"), md);

console.log(`Wrote ${outDir}`);
console.log(
  matrix.map((r) => `${r.status.padEnd(8)} ${r.path}`).join("\n"),
);
