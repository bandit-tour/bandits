import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const url = "https://bandits-two.vercel.app/profile";
const outDir = path.dirname(fileURLToPath(import.meta.url));
const shot = path.join(outDir, "profile-browser.png");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
const consoleErrors = [];
page.on("pageerror", (err) => pageErrors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2500);
const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 1200);
await page.screenshot({ path: shot, fullPage: true });
await browser.close();

const out = {
  at: new Date().toISOString(),
  url,
  pageErrors,
  consoleErrors: consoleErrors.slice(0, 20),
  hasProfileStayError:
    pageErrors.some((e) => /PROFILE_STAY is not defined/i.test(e)) ||
    /PROFILE_STAY is not defined/i.test(bodyText),
  bodyStartsWith: bodyText.replace(/\s+/g, " ").trim().slice(0, 200),
  screenshot: "profile-browser.png",
  browserStatus:
    pageErrors.length === 0 && !/PROFILE_STAY is not defined/i.test(bodyText)
      ? "PASS"
      : "FAIL",
};

fs.writeFileSync(path.join(outDir, "profile-playwright.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
