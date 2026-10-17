/**
 * Measure Guest App tab-to-tab navigation: visual response + meaningful content.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.RUNTIME_BASE_URL || "http://localhost:8082";
const out = path.join(root, "artifacts", "runtime-proof", "tab-nav-latency");
const label = process.env.PERF_LABEL || "before";

async function waitBody(page) {
  await page.waitForFunction(() => (document.body?.innerText || "").length > 40, null, { timeout: 60000 });
}

async function clickAndTime(page, click, contentRe, name, visualProbe, contentProbe) {
  const t0 = Date.now();
  let visualMs = null;
  let contentMs = null;
  const requests = [];
  const onReq = (req) => {
    const u = req.url();
    if (/supabase|__workspace|\/api\//i.test(u) && !/\.(png|jpg|jpeg|webp|svg|css|js)(\?|$)/i.test(u)) {
      requests.push({ t: Date.now() - t0, u: u.slice(0, 180) });
    }
  };
  page.on("request", onReq);
  await click();
  for (let i = 0; i < 240; i += 1) {
    if (visualMs == null) {
      const ok = visualProbe ? await visualProbe() : true;
      if (ok) visualMs = Date.now() - t0;
    }
    if (contentMs == null) {
      if (contentProbe) {
        if (await contentProbe()) contentMs = Date.now() - t0;
      } else {
        const text = await page.locator("body").innerText().catch(() => "");
        if (contentRe.test(text)) contentMs = Date.now() - t0;
      }
    }
    if (visualMs != null && contentMs != null) break;
    await page.waitForTimeout(40);
  }
  page.off("request", onReq);
  return {
    name,
    visualMs: visualMs ?? Date.now() - t0,
    contentMs: contentMs ?? null,
    requestCount: requests.length,
    firstRequests: requests.slice(0, 10),
  };
}

async function run() {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const report = { label, base, cold: [], warm: [], repeat: [], notes: [] };

  await page.goto(`${base}/home`, { waitUntil: "commit", timeout: 90000 });
  await waitBody(page);
  await page.getByTestId("guest-bottom-nav").waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);

  const lower = (id) => () => page.getByTestId(id).click();
  const upper = (name) => () => page.getByRole("tab", { name: new RegExp(`^${name}$`, "i") }).click();

  const overlayVisible = async () =>
    (await page.getByTestId("discovery-shell-active").count()) > 0;

  const coldTargets = [
    {
      name: "home→explore",
      click: lower("bottom-nav-explore"),
      re: /Explore in |Tonight|Loading places|No places found|spots near/i,
      visual: overlayVisible,
      contentProbe: async () => {
        if ((await page.getByTestId("explore-screen-title").count()) > 0) return true;
        const text = await page.locator("body").innerText().catch(() => "");
        return /\bExplore\b/.test(text) && (/Map|Coffee|Nightlife|Loading places|Local banDits/i.test(text));
      },
    },
    {
      name: "explore→experiences",
      click: upper("Experiences"),
      re: /Impossible to Google/i,
      visual: async () => /Impossible to Google/i.test(await page.locator("body").innerText()),
    },
    {
      name: "experiences→smarttraveler",
      click: upper("SmartTraveler"),
      re: /Local Find|Editorial Local Finds|SmartTraveler/i,
      visual: async () => /Editorial Local Finds|Local Finds/i.test(await page.locator("body").innerText()),
    },
    {
      name: "→hotelier",
      click: lower("bottom-nav-hotel"),
      re: /Hotel|Hotelier|check.?in|Stay|Welcome|Connect a stay|PLAY/i,
      visual: async () => (await page.getByTestId("bottom-nav-hotel").count()) > 0,
    },
    {
      name: "→chat",
      click: lower("bottom-nav-chat"),
      re: /Chat|Community|Messages|inbox|conversations|No conversations/i,
      visual: async () => (await page.getByTestId("bottom-nav-chat").count()) > 0,
    },
    {
      name: "→more",
      click: lower("bottom-nav-more"),
      re: /Settings|Profile|Travel in a Bottle|Impact|Menu/i,
      visual: async () => (await page.getByTestId("bottom-nav-more").count()) > 0,
    },
  ];

  for (const t of coldTargets) {
    const row = await clickAndTime(page, t.click, t.re, t.name, t.visual, t.contentProbe);
    report.cold.push(row);
    await page.screenshot({
      path: path.join(out, `${label}-cold-${t.name.replace(/[^a-z0-9]+/gi, "-")}.png`),
      fullPage: false,
    });
  }

  report.warm.push(
    await clickAndTime(
      page,
      lower("bottom-nav-explore"),
      /Explore in |Tonight|Loading places|No places found/i,
      "return→explore",
      overlayVisible,
      async () => {
        if ((await page.getByTestId("explore-screen-title").count()) > 0) return true;
        const text = await page.locator("body").innerText().catch(() => "");
        return /\bExplore\b/.test(text) && (/Map|Coffee|Nightlife|Loading places|Local banDits/i.test(text));
      },
    ),
  );
  report.warm.push(
    await clickAndTime(
      page,
      upper("Experiences"),
      /Impossible to Google|Experiences|Preview|live experience/i,
      "return→experiences",
      async () => /Impossible to Google/i.test(await page.locator("body").innerText()),
    ),
  );
  report.warm.push(
    await clickAndTime(page, lower("bottom-nav-home"), /Welcome|ARRIVING|BEFORE ARRIVAL|Trip|Local banDits/i, "return→home"),
  );

  for (let i = 0; i < 3; i += 1) {
    report.repeat.push(
      await clickAndTime(
        page,
        lower("bottom-nav-explore"),
        /Explore in |Tonight|Loading places|No places found/i,
        `thrash-explore-${i}`,
        overlayVisible,
        async () => {
          if ((await page.getByTestId("explore-screen-title").count()) > 0) return true;
          const text = await page.locator("body").innerText().catch(() => "");
          return /\bExplore\b/.test(text) && (/Map|Coffee|Nightlife|Loading places|Local banDits/i.test(text));
        },
      ),
    );
    report.repeat.push(
      await clickAndTime(page, lower("bottom-nav-home"), /Welcome|ARRIVING|BEFORE ARRIVAL|Trip/i, `thrash-home-${i}`),
    );
  }

  await upper("Experiences")();
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText();
  report.experiences = {
    comingSoonCount: (body.match(/Coming soon/gi) || []).length,
    hasPreview: /Preview/i.test(body),
    hasEuroPrice: /€\d/.test(body),
    storyInsteadOfPrice: /\bStory\b/.test(body),
    liveBanner: /Hosted by locals|live experience/i.test(body),
  };
  await page.screenshot({ path: path.join(out, `${label}-experiences.png`), fullPage: false });

  const nums = (rows) => rows.map((r) => r.contentMs).filter((n) => typeof n === "number");
  report.summary = {
    coldContentMax: Math.max(...nums(report.cold), 0),
    warmContentMax: Math.max(...nums(report.warm), 0),
    coldVisualMax: Math.max(...report.cold.map((r) => r.visualMs), 0),
    warmVisualMax: Math.max(...report.warm.map((r) => r.visualMs), 0),
    thrashExploreMax: Math.max(...nums(report.repeat.filter((r) => r.name.includes("explore"))), 0),
  };

  await fs.writeFile(path.join(out, `${label}-report.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
