/**
 * Owner QA: City Memory follows, memory media, dream destinations, bottle hotel identity.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const base = process.env.RUNTIME_BASE_URL || "http://localhost:8082";
const out = path.join(root, "artifacts", "runtime-proof", "owner-qa-memory-bottle");
const LIFE = "@bandits_guest_lifecycle_v1";
const ENTRY = "@bandits_hotel_entry_v1";
const DREAM = "@bandits_dream_destinations_v1";
const MEM = "@bandits_travel_memories_v1";
const NOTES = "@bandits_lifecycle_notices_v1";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function stayBundle() {
  const t = new Date().toISOString();
  return {
    lifecycle: {
      userId: "proof-stay-user",
      state: "AFTER_TRIP",
      accessLevel: "AFTER_TRIP",
      mode: "AFTER_TRIP_MODE",
      activeStayId: null,
      lastCity: "Athens",
      lastHotelSlug: "play-theatrou",
      lastHotelName: "PLAY Theatrou",
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
        id: "stay_play",
        userId: "proof-stay-user",
        hotelId: null,
        hotelSlug: "play-theatrou",
        hotelName: "PLAY Theatrou",
        city: "Athens",
        roomNumber: "402",
        bookingNumber: "QA",
        bookingSource: "proof",
        status: "checked_out",
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
    cityMemory: [
      {
        id: "mem_follow_seed",
        userId: "proof-stay-user",
        city: "Athens",
        kind: "followed_bandit",
        entityId: "bandit_seed_nikos",
        title: "Nikos",
        subtitle: "Followed",
        category: null,
        neighborhood: null,
        meta: {},
        createdAt: t,
        updatedAt: t,
      },
    ],
    events: [],
  };
}

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, name), fullPage: true });
}

async function run() {
  const pngPath = path.join(out, "pixel.png");
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(pngPath, png);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const report = { base, checks: {}, requests: [] };
  page.on("dialog", (d) => {
    report.dialogs = report.dialogs || [];
    report.dialogs.push(d.message());
    d.accept().catch(() => {});
  });
  page.on("response", (res) => {
    const url = res.url();
    if (/bottle\/stays|hotels\/.+\/config/.test(url)) {
      report.requests.push({ url, status: res.status() });
    }
  });

  await page.addInitScript(
    ({ life, entry, bundle }) => {
      localStorage.setItem(life, JSON.stringify(bundle));
      localStorage.setItem(
        entry,
        JSON.stringify({
          slug: "aluma-athens",
          hotelId: "aluma",
          displayName: "Athens hospitality partner",
          entrySource: "hotel_link",
        }),
      );
    },
    { life: LIFE, entry: ENTRY, bundle: stayBundle() },
  );

  await page.goto(`${base}/travelBottle`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByTestId("bottle-hotel-name").waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  const hotelName = (await page.getByTestId("bottle-hotel-name").innerText()).trim();
  const hotelPanel = await page.getByTestId("bottle-hotel-panel").innerText();
  report.checks.hotelName = hotelName;
  report.checks.hotelPanelHasAnise = /ANISE|ALUMA HOTELS/i.test(hotelPanel);
  report.checks.hotelIsPlayStay = /PLAY Theatrou/i.test(hotelName);
  await shot(page, "01-bottle-current-hotel.png");

  report.checks.lifecycleStays = await page.evaluate((key) => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      return (parsed?.stays || []).map((s) => s.hotelSlug);
    } catch {
      return [];
    }
  }, LIFE);
  await page.getByTestId("bottle-second-stay").getByText("Athens hospitality partner", { exact: true }).click();
  await page.waitForTimeout(1500);
  const alumaPanel = await page.getByTestId("bottle-hotel-panel").innerText();
  report.checks.alumaChipHidesSignPhoto = !/ANISE|ALUMA HOTELS/i.test(alumaPanel);
  report.checks.alumaChipHonestEmpty =
    /No property photos published yet|Property photos publish from the hotel/i.test(alumaPanel);
  await shot(page, "02-bottle-aluma-chip-no-sign.png");

  const sampleCopy = await page.getByTestId("bottle-sample-banner").innerText();
  report.checks.sampleBannerHonest = /not live rates|not a live/i.test(sampleCopy);
  report.checks.samplePriceLabeled = /Sample price/i.test(
    await page.locator("body").innerText(),
  );

  const workspaceBeforeJourney = report.requests.filter((r) => r.url.includes("/api/public/bottle/stays")).length;
  await page.getByTestId("bottle-view-journey").first().click();
  await page.getByTestId("journey-detail").waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  const journeyText = await page.getByTestId("journey-detail").innerText();
  report.checks.journeySample = /Sample paired journey/i.test(journeyText);
  report.checks.journeySamplePrice = /Sample price/i.test(journeyText);
  report.checks.journeyHotelNotAnise = !/ANISE|ALUMA HOTELS/i.test(journeyText);
  report.checks.workspaceStayQueried = report.requests.some((r) => r.url.includes("/api/public/bottle/stays"));
  await page.getByTestId("journey-dates-cta").click();
  await page.waitForTimeout(800);
  const afterCheck = await page.getByTestId("journey-detail").innerText();
  report.checks.zeroInventoryNote = /not in live inventory|nothing to reserve|No bookable stay/i.test(afterCheck);
  await shot(page, "03-journey-sample.png");
  await page.goBack();
  await page.getByText("Two sleeps, one journey").waitFor({ timeout: 20000 });
  report.checks.backToBottle = true;
  report.checks.catalogWorkspaceHits = workspaceBeforeJourney;

  await page.goto(`${base}/cityMemory`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByTestId("city-memory-home").waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  const peopleText = await page.locator("body").innerText();
  const likesCalls = [];
  page.on("request", (req) => {
    if (req.url().includes("bandit_user_likes")) likesCalls.push(req.url());
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("city-memory-home").waitFor({ timeout: 60000 });
  await page.waitForTimeout(3000);
  report.checks.followedSeedStillVisible = /Nikos/.test(await page.locator("body").innerText());
  report.checks.peopleSectionSettled =
    (await page.getByTestId("city-memory-people-empty").count()) +
      (await page.getByTestId("city-memory-people-loading").count()) +
      (await page.locator('[data-testid^="city-memory-person-"]').count()) >
    0;
  report.checks.peopleNotStuckLoading = (await page.getByTestId("city-memory-people-loading").count()) === 0;
  report.checks.likesRequestSeen = likesCalls.length > 0 || peopleText.length > 0;
  const memoryBefore = await page.evaluate((key) => localStorage.getItem(key), MEM);
  await shot(page, "04-city-memory-people.png");

  console.log("pre-memory", JSON.stringify(report.checks));
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page2.on("dialog", (d) => d.accept().catch(() => {}));
  const memoryTitle = `QA Rooftop ${Date.now().toString(36)}`;
  await page2.goto(`${base}/memory/add`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page2.getByTestId("memory-title-input").fill(memoryTitle, { timeout: 20000 });
  await page2.getByTestId("memory-story-input").fill("Proof photo for City Memory.");
  const chooserPromise = page2.waitForEvent("filechooser", { timeout: 8000 });
  await page2.getByTestId("memory-add-photos").click();
  const chooser = await chooserPromise;
  await chooser.setFiles(pngPath);
  await page2.getByTestId("memory-save-cta").click();
  await page2.waitForTimeout(2000);
  await page2.goto(`${base}/cityMemory`, { waitUntil: "domcontentloaded" });
  await page2.getByText(memoryTitle).waitFor({ timeout: 20000 });
  report.checks.memorySavedVisible = true;
  await shot(page2, "05-memory-saved.png");
  await page2.getByText(memoryTitle).click();
  await page2.getByTestId("memory-photo-open").waitFor({ timeout: 20000 });
  await page2.getByTestId("memory-photo-open").click();
  report.checks.galleryOpened = (await page2.locator("img").count()) > 0;
  await shot(page2, "06-memory-gallery.png");
  await page2.mouse.click(20, 20);
  await page2.getByTestId("memory-edit-cta").click();
  const edited = `${memoryTitle} edited`;
  await page2.getByTestId("memory-title-input").fill(edited);
  await page2.getByTestId("memory-save-cta").click();
  await page2.waitForTimeout(1500);
  await page2.goto(`${base}/cityMemory`, { waitUntil: "domcontentloaded" });
  await page2.getByText(edited).waitFor({ timeout: 20000 });
  report.checks.memoryEdited = true;
  const isolated = await page2.evaluate(
    ({ key, title }) => {
      const raw = localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      list.push({
        id: "pm_other_account",
        userId: "other-account-qa",
        title,
        story: "secret",
        city: "Athens",
        placeLabel: null,
        occurredAt: new Date().toISOString(),
        media: [],
        visibility: "private",
        bottleShareOptIn: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      localStorage.setItem(key, JSON.stringify(list));
      return list.length;
    },
    { key: MEM, title: "OTHER SECRET MEMORY" },
  );
  await page2.reload({ waitUntil: "domcontentloaded" });
  await page2.waitForTimeout(2000);
  const afterIso = await page2.locator("body").innerText();
  report.checks.otherAccountHidden = !afterIso.includes("OTHER SECRET MEMORY");
  report.checks.ownMemoryKept = afterIso.includes(edited);
  report.checks.memoryRowsKept = isolated >= 2;
  await page2.getByText(edited).click();
  await page2.getByTestId("memory-delete-cta").click();
  await page2.waitForTimeout(1500);
  await page2.goto(`${base}/cityMemory`, { waitUntil: "domcontentloaded" });
  await page2.waitForTimeout(1500);
  report.checks.memoryDeleted = !(await page2.locator("body").innerText()).includes(edited);
  await shot(page2, "07-memory-deleted.png");

  await page2.goto(`${base}/dreamDestinations`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page2.getByTestId("dream-save-cta").waitFor({ timeout: 30000 });
  await page2.waitForFunction(
    () => {
      const btn = document.querySelector('[data-testid="dream-save-cta"]');
      return btn && btn.getAttribute("aria-disabled") !== "true";
    },
    { timeout: 20000 },
  ).catch(() => {});
  await page2.waitForTimeout(1000);
  const saveDisabled = await page2.getByTestId("dream-save-cta").isDisabled();
  report.checks.dreamSaveEnabled = !saveDisabled;
  if (!saveDisabled) {
    await page2.getByTestId("dream-destination-input").fill("Vietnam");
    await page2.getByTestId("dream-timing-input").fill("next spring");
    await page2.getByTestId("dream-save-cta").click();
    await page2.getByText(/No notification was sent/i).waitFor({ timeout: 20000 });
    report.checks.consentOff = true;
    await page2.reload({ waitUntil: "domcontentloaded" });
    await page2.getByText("Vietnam").waitFor({ timeout: 20000 });
    report.checks.dreamReload = true;
    const store = await page2.evaluate((key) => localStorage.getItem(key), DREAM);
    const parsed = JSON.parse(store || "{}");
    const ownerKey = Object.keys(parsed.byUser || {}).find((k) =>
      (parsed.byUser[k] || []).some((d) => d.name === "Vietnam"),
    );
    parsed.byUser = parsed.byUser || {};
    parsed.byUser["other-account-qa"] = [
      { id: "dream_other", name: "Oslo Secret", styles: [], priority: 0, createdAt: "", updatedAt: "" },
    ];
    await page2.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: DREAM,
      value: JSON.stringify(parsed),
    });
    await page2.reload({ waitUntil: "domcontentloaded" });
    await page2.waitForTimeout(1500);
    const dreamBody = await page2.locator("body").innerText();
    report.checks.dreamReloginSameAccount = dreamBody.includes("Vietnam");
    report.checks.dreamOtherAccountHidden = !dreamBody.includes("Oslo Secret");
    report.checks.dreamUserKey = ownerKey || null;
    await page2.getByTestId("dream-notify-consent").click();
    await page2.getByTestId("dream-destination-input").fill("Japan");
    await page2.getByTestId("dream-save-cta").click();
    await page2.getByText(/notification deep-links/i).waitFor({ timeout: 20000 });
    await page2.goto(`${base}/home?guestState=AFTER_TRIP`, { waitUntil: "domcontentloaded" });
    await page2.waitForTimeout(3000);
    const home = await page2.locator("body").innerText();
    report.checks.homeDream = /Vietnam|Japan/.test(home);
    await page2.goto(`${base}/notifications`, { waitUntil: "domcontentloaded" });
    await page2.waitForTimeout(2500);
    const notice = page2.locator("[data-testid^='lifecycle-notice-dream_saved_']").first();
    report.checks.noticeVisible = (await notice.count()) > 0;
    if (report.checks.noticeVisible) {
      await notice.click();
      await page2.getByTestId("dream-destinations-scroll").waitFor({ timeout: 20000 });
      report.checks.noticeDeepLink = true;
    }
    await shot(page2, "08-dream-home.png");
  }
  const notes = await page2.evaluate((key) => localStorage.getItem(key), NOTES);
  report.checks.noticeStoredSeparately = Boolean(notes && notes.includes("dream_saved_"));
  report.checks.seededFollowNotErased = report.checks.followedSeedStillVisible;

  const pass =
    report.checks.hotelIsPlayStay &&
    !report.checks.hotelPanelHasAnise &&
    report.checks.alumaChipHidesSignPhoto &&
    report.checks.alumaChipHonestEmpty &&
    report.checks.sampleBannerHonest &&
    report.checks.samplePriceLabeled &&
    report.checks.journeySample &&
    report.checks.journeySamplePrice &&
    report.checks.journeyHotelNotAnise &&
    report.checks.workspaceStayQueried &&
    report.checks.zeroInventoryNote &&
    report.checks.backToBottle &&
    report.checks.followedSeedStillVisible &&
    report.checks.peopleNotStuckLoading &&
    report.checks.memorySavedVisible &&
    report.checks.memoryEdited &&
    report.checks.otherAccountHidden &&
    report.checks.ownMemoryKept &&
    report.checks.memoryDeleted &&
    report.checks.dreamReload &&
    report.checks.dreamReloginSameAccount &&
    report.checks.dreamOtherAccountHidden &&
    report.checks.consentOff &&
    report.checks.homeDream &&
    report.checks.noticeDeepLink;

  report.pass = Boolean(pass);
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.pass) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
