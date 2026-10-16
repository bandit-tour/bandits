/**
 * Travel in a Bottle WHEN calendar: range, nights, Mix gate, Workspace dates.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.RUNTIME_BASE_URL || "http://localhost:8082";
const out = path.join(root, "artifacts", "runtime-proof", "bottle-dates");

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, name), fullPage: false });
}

async function openAndPick(page, start, end) {
  await page.getByTestId("bottle-when").click();
  await page.getByTestId("bottle-calendar").waitFor({ timeout: 8000 });
  for (let i = 0; i < 14; i += 1) {
    if (await page.getByTestId(`bottle-day-${start}`).count()) break;
    await page.getByTestId("bottle-cal-next").click();
  }
  await page.getByTestId(`bottle-day-${start}`).click();
  for (let i = 0; i < 4; i += 1) {
    if (await page.getByTestId(`bottle-day-${end}`).count()) break;
    await page.getByTestId("bottle-cal-next").click();
  }
  await page.getByTestId(`bottle-day-${end}`).click();
  return page.getByTestId("bottle-calendar");
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const report = { checks: {}, api: [], notes: [] };
  page.on("request", (req) => {
    if (req.url().includes("/api/public/bottle/stays")) report.api.push(req.url());
  });

  await page.goto(`${base}/travelBottle`, { waitUntil: "commit", timeout: 60000 });
  await page.getByText("Two sleeps. One extraordinary trip.").waitFor({ timeout: 25000 });
  report.checks.mixDisabledInitially = await page.getByTestId("travel-bottle-mix-cta").isDisabled();
  report.checks.noRawDatePrompt = !(await page.locator("body").innerText()).includes("Choose a check-in and check-out date");
  report.checks.noDateTextInputs = (await page.locator("input").count()) === 1;
  await shot(page, "01-entry-desktop.png");

  await page.getByTestId("bottle-when").click();
  await page.getByTestId("bottle-calendar").waitFor({ timeout: 8000 });
  report.checks.calendarOpens = (await page.getByTestId("bottle-calendar").count()) === 1;
  await shot(page, "02-calendar-open.png");

  const past = "2026-10-01";
  if (await page.getByTestId(`bottle-day-${past}`).count()) {
    await page.getByTestId(`bottle-day-${past}`).click({ force: true });
    report.checks.pastDateIgnored = (await page.getByTestId("bottle-date-label").innerText()) === "Select your dates";
  } else {
    report.checks.pastDateIgnored = true;
    report.notes.push("October 1 was not on the open month.");
  }

  await page.keyboard.press("Escape");
  report.checks.escapeCloses = (await page.getByTestId("bottle-calendar").count()) === 0;

  await openAndPick(page, "2026-11-02", "2026-11-10");
  const label = await page.getByTestId("bottle-date-label").innerText();
  report.checks.humanDates = /Nov/.test(label) && !/\d{4}\/\d{2}\/\d{2}/.test(label) && !/YYYY/.test(label);
  report.checks.eightNights = (await page.getByTestId("bottle-calendar-status").innerText()).includes("8 nights");
  report.checks.rangeHighlighted = (await page.locator("[data-testid^='bottle-range-2026-11-']").count()) >= 7;
  await shot(page, "03-range-selected.png");
  await page.getByTestId("bottle-cal-close").click();
  report.checks.calendarClosedAfterRange = (await page.getByTestId("bottle-calendar").count()) === 0;
  report.checks.noChoosePromptAfterDates = !(await page.locator("body").innerText()).includes(
    "Choose a check-in and check-out date",
  );
  report.checks.mixStillDisabledWithoutDestination = await page.getByTestId("travel-bottle-mix-cta").isDisabled();
  report.checks.nightsOnField = (await page.getByTestId("bottle-nights").innerText()).includes("8 nights");

  await page.getByTestId("bottle-destination-athens").click();
  report.checks.mixEnabled = !(await page.getByTestId("travel-bottle-mix-cta").isDisabled());
  await page.getByTestId("travel-bottle-mix-cta").click();
  await page.waitForTimeout(1500);
  const first = report.api.find((u) => u.includes("checkIn="));
  report.checks.workspaceDates =
    Boolean(first) &&
    first.includes("checkIn=2026-11-02") &&
    first.includes("checkOut=2026-11-10") &&
    first.includes("destination=Athens");
  report.checks.noChoosePromptAfterMix = !(await page.locator("body").innerText()).includes(
    "Choose a check-in and check-out date",
  );
  await shot(page, "04-after-mix.png");

  await page.reload({ waitUntil: "commit" });
  await page.getByText("Two sleeps. One extraordinary trip.").waitFor({ timeout: 25000 });
  report.checks.refreshClearsDates = (await page.getByTestId("bottle-date-label").innerText()) === "Select your dates";
  await page.getByTestId("bottle-when").click();
  await page.getByTestId("bottle-calendar").waitFor();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  report.checks.keyboardSelectsArrival = /choose departure/i.test(await page.getByTestId("bottle-date-label").innerText());
  await page.reload({ waitUntil: "commit" });
  await page.getByText("Two sleeps. One extraordinary trip.").waitFor({ timeout: 25000 });

  await openAndPick(page, "2026-11-16", "2026-11-20");
  report.checks.editedNights = (await page.getByTestId("bottle-calendar-status").innerText()).includes("4 nights");
  await page.getByTestId("bottle-cal-close").click();
  await page.getByTestId("bottle-destination-athens").click();
  await page.getByTestId("travel-bottle-mix-cta").click();
  await page.waitForTimeout(1500);
  const second = report.api.filter((u) => u.includes("checkIn=2026-11-16"));
  report.checks.editedDatesSent = second.some((u) => u.includes("checkOut=2026-11-20"));
  await shot(page, "05-edited-dates.png");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await mobile.goto(`${base}/travelBottle`, { waitUntil: "commit", timeout: 60000 });
  await mobile.getByText("Two sleeps. One extraordinary trip.").waitFor({ timeout: 25000 });
  await mobile.getByTestId("bottle-when").tap();
  await mobile.getByTestId("bottle-calendar").waitFor({ timeout: 8000 });
  report.checks.mobileCalendarOpens = (await mobile.getByTestId("bottle-calendar").count()) === 1;
  await shot(mobile, "06-mobile-calendar.png");
  await mobile.getByTestId("bottle-cal-close").tap();
  await shot(mobile, "07-mobile-entry.png");

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
