import { chromium } from "playwright";
import fs from "fs";

const OUT = "artifacts/image-pass";
fs.mkdirSync(OUT, { recursive: true });

async function capture(page, name) {
  const client = await page.context().newCDPSession(page);
  const { data } = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  fs.writeFileSync(`${OUT}/${name}`, Buffer.from(data, "base64"));
  console.log("saved", name, fs.statSync(`${OUT}/${name}`).size);
}

async function dismissOverlays(page) {
  await page
    .evaluate(() => {
      const texts = ["Continue", "Got it", "Skip", "Close", "Start exploring", "Enter", "OK"];
      for (const t of texts) {
        const els = [...document.querySelectorAll("div,button,span,a")];
        const hit = els.find((e) => (e.textContent || "").trim() === t);
        if (hit) hit.click();
      }
    })
    .catch(() => {});
  await page.waitForTimeout(800);
}

async function auditImages(page) {
  return page.evaluate(() => {
    const imgs = [...document.querySelectorAll("img")];
    const bad = [];
    const ratios = [];
    for (const img of imgs) {
      const src = img.currentSrc || img.src || "";
      if (!src || src.startsWith("data:")) continue;
      const broken = !img.complete || img.naturalWidth === 0;
      const ow = img.offsetWidth;
      const oh = img.offsetHeight;
      if (ow < 80 || oh < 40) continue;
      const ratio = oh ? +(ow / oh).toFixed(2) : null;
      ratios.push({ ow, oh, ratio, src: src.slice(0, 70) });
      const shallow = ow > 160 && oh > 0 && ow / oh > 2.2;
      if (broken || shallow) {
        bad.push({ broken, shallow, ow, oh, ratio, src: src.slice(0, 90) });
      }
    }
    return {
      total: imgs.length,
      bad,
      ratios: ratios.slice(0, 12),
      text: (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 320),
    };
  });
}

async function clickChip(page, label) {
  const chip = page.getByTestId(`exp-filter-${label}`);
  await chip.click({ force: true, timeout: 15000 });
  await page.waitForTimeout(2500);
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
try {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://localhost:8081/experiences", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(5000);
  await dismissOverlays(page);
  await clickChip(page, "Workshops");
  await page.waitForTimeout(2500);
  let a = await auditImages(page);
  console.log(
    "WORKSHOPS",
    JSON.stringify(
      { total: a.total, badCount: a.bad.length, bad: a.bad, ratios: a.ratios, text: a.text },
      null,
      2,
    ),
  );
  await capture(page, "desktop-experiences-workshops.png");

  for (const r of [
    "/smarttraveler",
    "/travelBottle",
    "/shop",
    "/hotelier",
    "/experience/exp_costume_warehouse",
  ]) {
    await page.goto(`http://localhost:8081${r}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(4000);
    await dismissOverlays(page);
    a = await auditImages(page);
    console.log(r, "total", a.total, "bad", a.bad.length);
    if (a.bad.length) console.log("  BAD", JSON.stringify(a.bad.slice(0, 6)));
    console.log("  text", a.text.slice(0, 140));
    await capture(page, `desktop${r.replace(/\//g, "-")}.png`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:8081/experiences", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(4000);
  await dismissOverlays(page);
  await clickChip(page, "Workshops");
  await page.waitForTimeout(2500);
  a = await auditImages(page);
  console.log(
    "MOBILE WORKSHOPS",
    JSON.stringify({
      total: a.total,
      bad: a.bad,
      ratios: a.ratios.slice(0, 6),
      text: a.text.slice(0, 180),
    }),
  );
  await capture(page, "mobile-experiences-workshops.png");
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
