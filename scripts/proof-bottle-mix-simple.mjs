/**
 * Travel in a Bottle entry: three questions, one mix, original video only while searching.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.RUNTIME_BASE_URL || "http://localhost:8082";
const out = path.join(root, "artifacts", "runtime-proof", "bottle-mix-simple");

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, name), fullPage: false });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const report = { checks: {}, notes: [], api: [] };
  page.on("request", (req) => {
    if (req.url().includes("/api/public/bottle/stays")) report.api.push(req.url());
  });

  await page.goto(`${base}/travelBottle`, { waitUntil: "commit", timeout: 60000 });
  await page.getByText("Two sleeps. One extraordinary trip.").waitFor({ timeout: 20000 });
  const entry = await page.locator("body").innerText();
  report.checks.threeQuestions =
    /Where are you going/i.test(entry) && /When\?/i.test(entry) && /Who.s coming/i.test(entry);
  report.checks.oneMixCta = (await page.getByTestId("travel-bottle-mix-cta").count()) === 1;
  report.checks.ctaLabel = /Mix My Sleeping Experiences/.test(entry);
  report.checks.noVideoBefore =
    (await page.locator("[data-testid='travel-bottle-mix-video']").count()) === 0 &&
    (await page.locator("video").count()) === 0;
  report.checks.noSampleGrid = (await page.getByTestId("bottle-sample-banner").count()) === 0;
  report.checks.noHotelPicker = !/Plan your second stay|Athens hospitality partner/.test(entry);
  await shot(page, "A-entry-desktop.png");

  await page.getByTestId("bottle-destination-athens").click();
  report.checks.destination = (await page.getByTestId("bottle-destination").inputValue()) === "Athens";

  await page.getByTestId("bottle-check-in").fill("2026-11-05");
  await page.getByTestId("bottle-check-out").fill("2026-11-04");
  await page.getByTestId("travel-bottle-mix-cta").click();
  await page.getByTestId("bottle-form-error").waitFor({ timeout: 5000 });
  report.checks.datesValidated = /after check-in|two nights/i.test(await page.getByTestId("bottle-form-error").innerText());

  await page.getByTestId("bottle-check-in").fill("2026-11-02");
  await page.getByTestId("bottle-check-out").fill("2026-11-05");
  await page.getByTestId("bottle-travelers-inc").click();
  report.checks.travelers = (await page.getByTestId("bottle-travelers-count").innerText()) === "3";

  await page.route("**/api/public/bottle/stays**", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  const started = Date.now();
  await page.getByTestId("travel-bottle-mix-cta").click();
  const video = page.locator("[data-testid='travel-bottle-mix-video']");
  await video.waitFor({ timeout: 8000 });
  await page.waitForTimeout(700);
  const playback = await video.evaluate((el) => ({
    tag: el.tagName,
    src: el.currentSrc || el.getAttribute("src") || "",
    paused: el.paused,
    readyState: el.readyState,
  }));
  report.checks.videoIsVideo = playback.tag === "VIDEO";
  report.checks.videoAsset = String(playback.src).includes("play-intro.mp4");
  report.checks.videoPlaying = playback.paused === false || playback.readyState >= 2;
  report.notes.push(playback);
  await shot(page, "F-video-during-search.png");
  await page.getByTestId("bottle-catalog-empty").waitFor({ timeout: 20000 });
  report.checks.searchFinishedMs = Date.now() - started;
  report.checks.videoDismissed = (await page.locator("video").count()) === 0;
  report.checks.honestEmpty = /not available yet/i.test(await page.locator("body").innerText());
  report.checks.apiCalled = report.api.some((u) => u.includes("/api/public/bottle/stays"));
  report.checks.noArtificialDelay = report.checks.searchFinishedMs < 8000;
  await shot(page, "K-empty-results.png");

  await page.getByTestId("bottle-show-samples").click();
  await page.getByTestId("bottle-sample-banner").waitFor({ timeout: 10000 });
  const sampleText = await page.locator("body").innerText();
  report.checks.samplesSeparated = /Preview only/.test(sampleText) && /cannot be booked/i.test(sampleText);
  await shot(page, "L-samples.png");

  await page.goto(`${base}/hotelier`, { waitUntil: "commit", timeout: 60000 });
  await page.waitForTimeout(1500);
  report.checks.noVideoHotelier = (await page.locator("video").count()) === 0;
  await page.goto(`${base}/cityMemory`, { waitUntil: "commit", timeout: 60000 });
  await page.waitForTimeout(1500);
  report.checks.noVideoCityMemory = (await page.locator("video").count()) === 0;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/travelBottle`, { waitUntil: "commit", timeout: 60000 });
  await page.getByText("Two sleeps. One extraordinary trip.").waitFor({ timeout: 20000 });
  report.checks.mobileEntry = (await page.getByTestId("travel-bottle-mix-cta").count()) === 1;
  await shot(page, "P-entry-mobile.png");

  const stayPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await stayPage.addInitScript(() => {
    const t = new Date().toISOString();
    localStorage.setItem(
      "@bandits_guest_lifecycle_v1",
      JSON.stringify({
        lifecycle: {
          userId: "proof-stay",
          state: "ACTIVE_STAY",
          accessLevel: "FULL_STAY",
          mode: "DURING_TRIP_MODE",
          activeStayId: "stay_play",
          lastCity: "Athens",
          lastHotelSlug: "play-theatrou",
          lastHotelName: "PLAY Theatrou Athens",
          createdAt: t,
          updatedAt: t,
        },
        stays: [
          {
            id: "stay_play",
            userId: "proof-stay",
            hotelSlug: "play-theatrou",
            hotelName: "PLAY Theatrou Athens",
            city: "Athens",
            status: "checked_in",
            isActive: true,
            bookingSource: "seed",
            createdAt: t,
            updatedAt: t,
          },
        ],
        cityMemory: [],
        events: [],
      }),
    );
  });
  await stayPage.goto(`${base}/travelBottle?guestState=ACTIVE_STAY`, { waitUntil: "commit", timeout: 60000 });
  await stayPage.getByTestId("bottle-connected-hotel").waitFor({ timeout: 20000 });
  const stayLine = await stayPage.getByTestId("bottle-connected-hotel").innerText();
  report.checks.connectedHotel = /PLAY Theatrou Athens/.test(stayLine) && !/Athens hospitality partner/.test(stayLine);
  await shot(stayPage, "M-connected-stay.png");

  report.pass = Object.values(report.checks).every(Boolean);
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.pass) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
